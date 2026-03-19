package ws

import (
	"context"
	"encoding/json"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/websocket/v2"
	"github.com/google/uuid"
	"github.com/zlp-messenger/backend/internal/auth"
)

type Handler struct {
	hub         *Hub
}

func NewHandler(hub *Hub) *Handler {
	return &Handler{hub: hub}
}

// Upgrade middleware — check auth before upgrade
func (h *Handler) Upgrade(c *fiber.Ctx) error {
	if !websocket.IsWebSocketUpgrade(c) {
		return fiber.ErrUpgradeRequired
	}
	// Auth via query param (WS can't set headers easily)
	token := c.Query("token")
	if token == "" {
		return fiber.NewError(fiber.StatusUnauthorized, "token required")
	}
	claims, err := auth.ParseAccessToken(token)
	if err != nil {
		return fiber.NewError(fiber.StatusUnauthorized, "invalid token")
	}

	c.Locals("user_id", claims.UserID)
	c.Locals("username", claims.Username)
	return c.Next()
}

// Handle — WebSocket connection handler
func (h *Handler) Handle(c *websocket.Conn) {
	userID := c.Locals("user_id").(uuid.UUID)

	client := NewClient(h.hub, c, userID)
	h.hub.register <- client

	// Subscribe client to all their chats
	go h.subscribeUserChats(client)

	go client.WritePump()
	client.ReadPump() // blocks until disconnect
}

func (h *Handler) subscribeUserChats(client *Client) {
	chats, err := h.hub.chatService.GetUserChats(context.Background(), client.UserID)
	if err != nil {
		return
	}
	for _, chat := range chats {
		h.hub.SubscribeClientToChat(client.UserID, chat.ID)
	}
}

// GET /api/chats/:chatID/call — returns current group call state (if any)
func (h *Handler) GetGroupCallState(c *fiber.Ctx) error {
	chatID, err := uuid.Parse(c.Params("chatID"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid chat id")
	}
	key := "group_call:" + chatID.String()
	raw, err := h.hub.redis.Get(context.Background(), key).Bytes()
	if err != nil {
		// No active call
		return c.JSON(map[string]any{"active": false})
	}
	var meta groupCallMeta
	if err := json.Unmarshal(raw, &meta); err != nil {
		return c.JSON(map[string]any{"active": false})
	}
	return c.JSON(map[string]any{
		"active":       true,
		"call_id":      meta.CallID,
		"participants": meta.Participants,
		"started_at":   meta.StartedAt,
	})
}
