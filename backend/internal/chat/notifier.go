package chat

import "github.com/google/uuid"

// Notifier abstracts WebSocket broadcasting so the chat package
// does not depend on the ws package.
type Notifier interface {
	BroadcastChat(chatID uuid.UUID, eventType string, payload any, excludeUserID *uuid.UUID)
	SubscribeToChat(userID, chatID uuid.UUID)
}
