package ws

import "github.com/google/uuid"

// Event types — client → server
const (
	EventTyping       = "typing"
	EventStopTyping   = "stop_typing"
	EventMarkRead     = "mark_read"
	EventJoinCall     = "join_call"
	EventLeaveCall    = "leave_call"
	EventWebRTCOffer  = "webrtc_offer"
	EventWebRTCAnswer = "webrtc_answer"
	EventWebRTCICE    = "webrtc_ice"
)

// Event types — server → client
const (
	EventNewMessage     = "new_message"
	EventMessageEdited  = "message_edited"
	EventMessageDeleted = "message_deleted"
	EventReaction       = "reaction"
	EventUserOnline     = "user_online"
	EventUserOffline    = "user_offline"
	EventUserTyping     = "user_typing"
	EventUserStopTyping = "user_stop_typing"
	EventMessageRead    = "message_read"
	EventCallIncoming   = "call_incoming"
	EventCallAccepted   = "call_accepted"
	EventCallDeclined   = "call_declined"
	EventCallEnded      = "call_ended"
	EventCallWebRTC     = "call_webrtc"
	EventError          = "error"
)

// IncomingEvent — from client
type IncomingEvent struct {
	Type    string          `json:"type"`
	Payload map[string]any  `json:"payload"`
}

// OutgoingEvent — to client
type OutgoingEvent struct {
	Type    string `json:"type"`
	Payload any    `json:"payload"`
}

// Specific payloads

type TypingPayload struct {
	ChatID uuid.UUID `json:"chat_id"`
}

type MarkReadPayload struct {
	MessageID uuid.UUID `json:"message_id"`
}

type WebRTCPayload struct {
	TargetUserID uuid.UUID `json:"target_user_id"`
	CallID       uuid.UUID `json:"call_id"`
	Data         any       `json:"data"`
}
