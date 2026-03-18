package ws

import (
	"context"
	"encoding/json"
	"log"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"github.com/zlp-messenger/backend/internal/chat"
)

// Hub maintains connected clients and broadcasts messages
type Hub struct {
	mu          sync.RWMutex
	clients     map[uuid.UUID]*Client        // userID → client
	chatClients map[uuid.UUID]map[uuid.UUID]bool // chatID → set of userIDs

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

// BroadcastToChat sends event to all members of a chat
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

// SendToUser sends event to a specific user (if online)
func (h *Hub) SendToUser(userID uuid.UUID, event OutgoingEvent) {
	h.mu.RLock()
	client, ok := h.clients[userID]
	h.mu.RUnlock()
	if ok {
		client.SendEvent(event.Type, event.Payload)
	}
}

// IsOnline checks if user is currently connected
func (h *Hub) IsOnline(userID uuid.UUID) bool {
	h.mu.RLock()
	defer h.mu.RUnlock()
	_, ok := h.clients[userID]
	return ok
}

// handleEvent processes incoming events from a client
func (h *Hub) handleEvent(c *Client, event IncomingEvent) {
	switch event.Type {

	case EventTyping:
		chatID := parseUUID(event.Payload, "chat_id")
		if chatID == uuid.Nil {
			return
		}
		h.BroadcastToChat(chatID, OutgoingEvent{
			Type: EventUserTyping,
			Payload: map[string]any{
				"chat_id": chatID,
				"user_id": c.UserID,
			},
		}, &c.UserID)

	case EventStopTyping:
		chatID := parseUUID(event.Payload, "chat_id")
		if chatID == uuid.Nil {
			return
		}
		h.BroadcastToChat(chatID, OutgoingEvent{
			Type: EventUserStopTyping,
			Payload: map[string]any{
				"chat_id": chatID,
				"user_id": c.UserID,
			},
		}, &c.UserID)

	case EventMarkRead:
		msgID := parseUUID(event.Payload, "message_id")
		if msgID == uuid.Nil {
			return
		}
		_ = h.chatService.MarkRead(context.Background(), c.UserID, msgID)

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
	// TODO: broadcast to all users who have this user in contacts
	// For now just log
	log.Printf("ws: presence event %s for user %s", eventType, userID)
}

func parseUUID(payload map[string]any, key string) uuid.UUID {
	val, ok := payload[key]
	if !ok {
		return uuid.Nil
	}
	str, ok := val.(string)
	if !ok {
		return uuid.Nil
	}
	id, err := uuid.Parse(str)
	if err != nil {
		return uuid.Nil
	}
	return id
}
