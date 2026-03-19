package ws

import "github.com/google/uuid"

// Client → Server
const (
	EventTyping         = "typing"
	EventStopTyping     = "stop_typing"
	EventMarkRead       = "mark_read"
	EventCallInitiate   = "call_initiate"  // начать звонок
	EventCallAccept     = "call_accept"    // принять
	EventCallDecline    = "call_decline"   // отклонить
	EventCallEnd        = "call_end"       // завершить
	EventWebRTCOffer    = "webrtc_offer"
	EventWebRTCAnswer   = "webrtc_answer"
	EventWebRTCICE      = "webrtc_ice"

	// Group calls
	EventGroupCallJoin    = "group_call_join"    // вступить/начать групповой звонок
	EventGroupCallLeave   = "group_call_leave"   // покинуть
	EventGroupWebRTCOffer  = "group_webrtc_offer"
	EventGroupWebRTCAnswer = "group_webrtc_answer"
	EventGroupWebRTCICE    = "group_webrtc_ice"
)

// Server → Client
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
	EventCallIncoming   = "call_incoming"   // входящий
	EventCallAccepted   = "call_accepted"   // принят
	EventCallDeclined   = "call_declined"   // отклонён
	EventCallEnded      = "call_ended"      // завершён
	EventCallWebRTC     = "call_webrtc"     // WebRTC сигналинг
	EventError          = "error"
	EventMention        = "mention"         // упоминание @username

	// Group calls
	EventGroupCallJoined       = "group_call_joined"        // ты вошёл + список участников
	EventGroupCallMemberJoined = "group_call_member_joined" // кто-то вошёл
	EventGroupCallMemberLeft   = "group_call_member_left"   // кто-то ушёл
	EventGroupCallEnded        = "group_call_ended"         // звонок завершён
	EventGroupCallWebRTC       = "group_call_webrtc"        // WebRTC сигналинг
)

type IncomingEvent struct {
	Type    string         `json:"type"`
	Payload map[string]any `json:"payload"`
}

type OutgoingEvent struct {
	Type    string `json:"type"`
	Payload any    `json:"payload"`
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
