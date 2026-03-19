package ws

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"github.com/zlp-messenger/backend/internal/chat"
)

type callMeta struct {
	CallerID    string `json:"caller_id"`
	CalleeID    string `json:"callee_id"`
	CallType    string `json:"call_type"`
	InitiatedAt int64  `json:"initiated_at"`
	AcceptedAt  int64  `json:"accepted_at"` // 0 if not yet accepted
}

type groupParticipant struct {
	UserID   string `json:"user_id"`
	UserName string `json:"user_name"`
}

type groupCallMeta struct {
	CallID       string             `json:"call_id"`
	ChatID       string             `json:"chat_id"`
	Participants []groupParticipant `json:"participants"`
	StartedAt    int64              `json:"started_at"`
}

type Hub struct {
	mu          sync.RWMutex
	clients     map[uuid.UUID]*Client
	chatClients map[uuid.UUID]map[uuid.UUID]bool

	register   chan *Client
	unregister chan *Client

	chatService *chat.Service
	redis       *redis.Client
}

func NewHub(chatService *chat.Service, redis *redis.Client) *Hub {
	return &Hub{
		clients:     make(map[uuid.UUID]*Client),
		chatClients: make(map[uuid.UUID]map[uuid.UUID]bool),
		register:    make(chan *Client, 64),
		unregister:  make(chan *Client, 64),
		chatService: chatService,
		redis:       redis,
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client.UserID] = client
			h.mu.Unlock()
			h.setOnline(client.UserID, true)
			h.broadcastPresence(client.UserID, EventUserOnline)
			log.Printf("ws: user %s connected", client.UserID)

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client.UserID]; ok {
				delete(h.clients, client.UserID)
				for chatID := range client.chatIDs {
					delete(h.chatClients[chatID], client.UserID)
				}
				close(client.send)
			}
			h.mu.Unlock()
			h.setOnline(client.UserID, false)
			h.broadcastPresence(client.UserID, EventUserOffline)
			log.Printf("ws: user %s disconnected", client.UserID)
		}
	}
}

func (h *Hub) BroadcastToChat(chatID uuid.UUID, event OutgoingEvent, excludeUserID *uuid.UUID) {
	data, err := json.Marshal(event)
	if err != nil {
		return
	}
	h.mu.RLock()
	members := h.chatClients[chatID]
	h.mu.RUnlock()

	for userID := range members {
		if excludeUserID != nil && userID == *excludeUserID {
			continue
		}
		h.mu.RLock()
		client, ok := h.clients[userID]
		h.mu.RUnlock()
		if ok {
			select {
			case client.send <- data:
			default:
			}
		}
	}
}

func (h *Hub) SendToUser(userID uuid.UUID, event OutgoingEvent) {
	h.mu.RLock()
	client, ok := h.clients[userID]
	h.mu.RUnlock()
	if ok {
		client.SendEvent(event.Type, event.Payload)
	}
}

// BroadcastChat implements chat.Notifier — broadcasts an event to all chat members.
func (h *Hub) BroadcastChat(chatID uuid.UUID, eventType string, payload any, excludeUserID *uuid.UUID) {
	h.BroadcastToChat(chatID, OutgoingEvent{Type: eventType, Payload: payload}, excludeUserID)
}

// NotifyUser implements chat.Notifier — sends a targeted event to a single user.
func (h *Hub) NotifyUser(userID uuid.UUID, eventType string, payload any) {
	h.SendToUser(userID, OutgoingEvent{Type: eventType, Payload: payload})
}

// SubscribeToChat implements chat.Notifier — subscribes a user to a chat if they are online.
func (h *Hub) SubscribeToChat(userID, chatID uuid.UUID) {
	h.mu.RLock()
	_, online := h.clients[userID]
	h.mu.RUnlock()
	if online {
		h.SubscribeClientToChat(userID, chatID)
	}
}

func (h *Hub) IsOnline(userID uuid.UUID) bool {
	h.mu.RLock()
	defer h.mu.RUnlock()
	_, ok := h.clients[userID]
	return ok
}

func (h *Hub) handleEvent(c *Client, event IncomingEvent) {
	switch event.Type {

	case EventTyping:
		chatID := parseUUID(event.Payload, "chat_id")
		if chatID == uuid.Nil {
			return
		}
		h.BroadcastToChat(chatID, OutgoingEvent{
			Type: EventUserTyping,
			Payload: map[string]any{"chat_id": chatID, "user_id": c.UserID},
		}, &c.UserID)

	case EventStopTyping:
		chatID := parseUUID(event.Payload, "chat_id")
		if chatID == uuid.Nil {
			return
		}
		h.BroadcastToChat(chatID, OutgoingEvent{
			Type: EventUserStopTyping,
			Payload: map[string]any{"chat_id": chatID, "user_id": c.UserID},
		}, &c.UserID)

	case EventMarkRead:
		msgID := parseUUID(event.Payload, "message_id")
		if msgID == uuid.Nil {
			return
		}
		ctx := context.Background()
		_ = h.chatService.MarkRead(ctx, c.UserID, msgID)
		// Notify the original sender that their message has been read
		if msg, err := h.chatService.GetMessageByID(ctx, msgID); err == nil && msg.SenderID != nil && *msg.SenderID != c.UserID {
			h.NotifyUser(*msg.SenderID, EventMessageRead, map[string]any{"message_id": msgID})
		}

	// ── CALLS ──────────────────────────────────────────────────

	case EventCallInitiate:
		// Caller → Hub → Callee: call_incoming
		targetID := parseUUID(event.Payload, "target_user_id")
		if targetID == uuid.Nil {
			log.Printf("ws: call_initiate from %s — bad target_user_id payload: %v", c.UserID, event.Payload)
			return
		}
		callID, _ := event.Payload["call_id"].(string)
		if callID == "" {
			callID = uuid.New().String()
		}
		callType, _ := event.Payload["call_type"].(string)
		callerName, _ := event.Payload["caller_name"].(string)

		h.mu.RLock()
		_, targetOnline := h.clients[targetID]
		h.mu.RUnlock()
		log.Printf("ws: call_initiate caller=%s target=%s online=%v callID=%s", c.UserID, targetID, targetOnline, callID)

		// Store call metadata in Redis
		meta := callMeta{
			CallerID:    c.UserID.String(),
			CalleeID:    targetID.String(),
			CallType:    callType,
			InitiatedAt: time.Now().Unix(),
		}
		if data, err := json.Marshal(meta); err == nil {
			h.redis.Set(context.Background(), "call:"+callID, data, 2*time.Hour)
		}

		h.SendToUser(targetID, OutgoingEvent{
			Type: EventCallIncoming,
			Payload: map[string]any{
				"call_id":     callID,
				"caller_id":   c.UserID,
				"caller_name": callerName,
				"call_type":   callType,
			},
		})

	case EventCallAccept:
		callerID := parseUUID(event.Payload, "caller_id")
		if callerID == uuid.Nil {
			return
		}
		callID, _ := event.Payload["call_id"].(string)
		// Record accepted_at in Redis
		if callID != "" {
			if raw, err := h.redis.Get(context.Background(), "call:"+callID).Bytes(); err == nil {
				var meta callMeta
				if json.Unmarshal(raw, &meta) == nil {
					meta.AcceptedAt = time.Now().Unix()
					if data, err := json.Marshal(meta); err == nil {
						h.redis.Set(context.Background(), "call:"+callID, data, 2*time.Hour)
					}
				}
			}
		}
		h.SendToUser(callerID, OutgoingEvent{
			Type: EventCallAccepted,
			Payload: map[string]any{
				"call_id":   callID,
				"callee_id": c.UserID,
			},
		})

	case EventCallDecline:
		callerID := parseUUID(event.Payload, "caller_id")
		if callerID == uuid.Nil {
			return
		}
		callID, _ := event.Payload["call_id"].(string)
		h.SendToUser(callerID, OutgoingEvent{
			Type: EventCallDeclined,
			Payload: map[string]any{
				"call_id":   callID,
				"callee_id": c.UserID,
			},
		})
		h.finishCall(context.Background(), callID, "declined")

	case EventCallEnd:
		targetID := parseUUID(event.Payload, "target_id")
		if targetID == uuid.Nil {
			return
		}
		callID, _ := event.Payload["call_id"].(string)
		h.SendToUser(targetID, OutgoingEvent{
			Type: EventCallEnded,
			Payload: map[string]any{
				"call_id": callID,
				"by":      c.UserID,
			},
		})
		h.finishCall(context.Background(), callID, "ended")

	// ── WebRTC SIGNALING ───────────────────────────────────────

	case EventWebRTCOffer, EventWebRTCAnswer, EventWebRTCICE:
		targetID := parseUUID(event.Payload, "target_user_id")
		if targetID == uuid.Nil {
			return
		}
		h.SendToUser(targetID, OutgoingEvent{
			Type: EventCallWebRTC,
			Payload: map[string]any{
				"sub_type": event.Type,
				"from":     c.UserID,
				"data":     event.Payload["data"],
				"call_id":  event.Payload["call_id"],
			},
		})

	// ── GROUP CALLS ────────────────────────────────────────────

	case EventGroupCallJoin:
		chatID := parseUUID(event.Payload, "chat_id")
		if chatID == uuid.Nil {
			return
		}
		callID, _ := event.Payload["call_id"].(string)
		userName, _ := event.Payload["user_name"].(string)

		ctx := context.Background()
		key := "group_call:" + chatID.String()

		var meta groupCallMeta
		if raw, err := h.redis.Get(ctx, key).Bytes(); err == nil {
			json.Unmarshal(raw, &meta)
		} else {
			// New call
			if callID == "" {
				callID = uuid.New().String()
			}
			meta = groupCallMeta{
				CallID:    callID,
				ChatID:    chatID.String(),
				StartedAt: time.Now().Unix(),
			}
		}

		// Remove stale entry for this user (reconnect case)
		filtered := meta.Participants[:0]
		for _, p := range meta.Participants {
			if p.UserID != c.UserID.String() {
				filtered = append(filtered, p)
			}
		}
		existing := make([]groupParticipant, len(filtered))
		copy(existing, filtered)

		// Inform the joining user of existing participants BEFORE adding self
		h.SendToUser(c.UserID, OutgoingEvent{
			Type: EventGroupCallJoined,
			Payload: map[string]any{
				"call_id":      meta.CallID,
				"chat_id":      chatID,
				"participants": existing,
			},
		})

		// Add self
		meta.Participants = append(existing, groupParticipant{
			UserID:   c.UserID.String(),
			UserName: userName,
		})
		if data, err := json.Marshal(meta); err == nil {
			h.redis.Set(ctx, key, data, 4*time.Hour)
		}

		// Notify all chat members (for the join banner)
		h.BroadcastToChat(chatID, OutgoingEvent{
			Type: EventGroupCallMemberJoined,
			Payload: map[string]any{
				"call_id":   meta.CallID,
				"chat_id":   chatID,
				"user_id":   c.UserID,
				"user_name": userName,
			},
		}, nil)

	case EventGroupCallLeave:
		chatID := parseUUID(event.Payload, "chat_id")
		callID, _ := event.Payload["call_id"].(string)
		if chatID == uuid.Nil {
			return
		}
		ctx := context.Background()
		key := "group_call:" + chatID.String()

		var meta groupCallMeta
		if raw, err := h.redis.Get(ctx, key).Bytes(); err == nil {
			json.Unmarshal(raw, &meta)
		}

		// Remove participant
		remaining := meta.Participants[:0]
		for _, p := range meta.Participants {
			if p.UserID != c.UserID.String() {
				remaining = append(remaining, p)
			}
		}
		meta.Participants = remaining

		// Broadcast member_left to all in chat
		h.BroadcastToChat(chatID, OutgoingEvent{
			Type: EventGroupCallMemberLeft,
			Payload: map[string]any{
				"call_id": callID,
				"chat_id": chatID,
				"user_id": c.UserID,
			},
		}, nil)

		if len(remaining) == 0 {
			h.redis.Del(ctx, key)
			h.BroadcastToChat(chatID, OutgoingEvent{
				Type: EventGroupCallEnded,
				Payload: map[string]any{"call_id": callID, "chat_id": chatID},
			}, nil)
		} else {
			if data, err := json.Marshal(meta); err == nil {
				h.redis.Set(ctx, key, data, 4*time.Hour)
			}
		}

	// ── GROUP WebRTC SIGNALING ──────────────────────────────────

	case EventGroupWebRTCOffer, EventGroupWebRTCAnswer, EventGroupWebRTCICE:
		targetID := parseUUID(event.Payload, "target_user_id")
		if targetID == uuid.Nil {
			return
		}
		h.SendToUser(targetID, OutgoingEvent{
			Type: EventGroupCallWebRTC,
			Payload: map[string]any{
				"sub_type": event.Type,
				"from":     c.UserID,
				"data":     event.Payload["data"],
				"call_id":  event.Payload["call_id"],
			},
		})
	}
}

func (h *Hub) SubscribeClientToChat(userID, chatID uuid.UUID) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.chatClients[chatID] == nil {
		h.chatClients[chatID] = make(map[uuid.UUID]bool)
	}
	h.chatClients[chatID][userID] = true
	if client, ok := h.clients[userID]; ok {
		client.chatIDs[chatID] = true
	}
}

func (h *Hub) setOnline(userID uuid.UUID, online bool) {
	ctx := context.Background()
	key := "online:" + userID.String()
	if online {
		h.redis.Set(ctx, key, "1", 5*time.Minute)
	} else {
		h.redis.Del(ctx, key)
		h.redis.Set(ctx, "last_seen:"+userID.String(), time.Now().Unix(), 24*time.Hour)
	}
}

func (h *Hub) broadcastPresence(userID uuid.UUID, eventType string) {
	log.Printf("ws: presence %s for user %s", eventType, userID)
}

// finishCall reads call metadata from Redis, creates a service message in the private chat,
// and broadcasts it to both participants.
func (h *Hub) finishCall(ctx context.Context, callID string, reason string) {
	if callID == "" {
		return
	}
	raw, err := h.redis.GetDel(ctx, "call:"+callID).Bytes()
	if err != nil {
		return
	}
	var meta callMeta
	if err := json.Unmarshal(raw, &meta); err != nil {
		return
	}

	callerID, err := uuid.Parse(meta.CallerID)
	if err != nil {
		return
	}
	calleeID, err := uuid.Parse(meta.CalleeID)
	if err != nil {
		return
	}

	chat, err := h.chatService.GetPrivateChat(ctx, callerID, calleeID)
	if err != nil {
		// Chat may not exist yet (call was never established)
		return
	}

	icon := "📞"
	if meta.CallType == "video" {
		icon = "📹"
	}

	var text string
	switch reason {
	case "declined":
		text = icon + " Отклонённый звонок"
	default:
		if meta.AcceptedAt > 0 {
			dur := time.Now().Unix() - meta.AcceptedAt
			mins := dur / 60
			secs := dur % 60
			if meta.CallType == "video" {
				text = fmt.Sprintf("%s Видеозвонок · %d:%02d", icon, mins, secs)
			} else {
				text = fmt.Sprintf("%s Голосовой звонок · %d:%02d", icon, mins, secs)
			}
		} else {
			text = icon + " Пропущенный звонок"
		}
	}

	msg, err := h.chatService.CreateServiceMessage(ctx, chat.ID, text)
	if err != nil {
		log.Printf("ws: finishCall create service message error: %v", err)
		return
	}

	evt := OutgoingEvent{Type: EventNewMessage, Payload: msg}
	h.SendToUser(callerID, evt)
	h.SendToUser(calleeID, evt)
}
