package models

import (
	"time"

	"github.com/google/uuid"
)

type MessageType string

const (
	MessageTypeText      MessageType = "text"
	MessageTypePhoto     MessageType = "photo"
	MessageTypeVideo     MessageType = "video"
	MessageTypeVoice     MessageType = "voice"
	MessageTypeVideoNote MessageType = "video_note"
	MessageTypeAudio     MessageType = "audio"
	MessageTypeDocument  MessageType = "document"
	MessageTypeSticker   MessageType = "sticker"
	MessageTypeGIF       MessageType = "gif"
	MessageTypeLocation  MessageType = "location"
	MessageTypeContact   MessageType = "contact"
	MessageTypePoll      MessageType = "poll"
	MessageTypeService   MessageType = "service"
)

type AttachmentType string

const (
	AttachmentTypePhoto    AttachmentType = "photo"
	AttachmentTypeVideo    AttachmentType = "video"
	AttachmentTypeAudio    AttachmentType = "audio"
	AttachmentTypeVoice    AttachmentType = "voice"
	AttachmentTypeDocument AttachmentType = "document"
	AttachmentTypeSticker  AttachmentType = "sticker"
	AttachmentTypeGIF      AttachmentType = "gif"
)

type Message struct {
	ID            uuid.UUID   `db:"id" json:"id"`
	ChatID        uuid.UUID   `db:"chat_id" json:"chat_id"`
	SenderID      *uuid.UUID  `db:"sender_id" json:"sender_id,omitempty"`
	Type          MessageType `db:"type" json:"type"`
	Text          *string     `db:"text" json:"text,omitempty"`
	ReplyToID     *uuid.UUID  `db:"reply_to_id" json:"reply_to_id,omitempty"`
	ForwardFromID *uuid.UUID  `db:"forward_from_id" json:"forward_from_id,omitempty"`
	ForwardChatID *uuid.UUID  `db:"forward_chat_id" json:"forward_chat_id,omitempty"`
	IsEdited      bool        `db:"is_edited" json:"is_edited"`
	IsDeleted     bool        `db:"is_deleted" json:"is_deleted"`
	IsPinned      bool        `db:"is_pinned" json:"is_pinned"`
	Views         int         `db:"views" json:"views"`
	CreatedAt     time.Time   `db:"created_at" json:"created_at"`
	EditedAt      *time.Time  `db:"edited_at" json:"edited_at,omitempty"`

	// Joined fields
	Sender      *PublicUser   `db:"-" json:"sender,omitempty"`
	Attachments []Attachment  `db:"-" json:"attachments,omitempty"`
	Reactions   []Reaction    `db:"-" json:"reactions,omitempty"`
	ReplyTo     *Message      `db:"-" json:"reply_to,omitempty"`
	IsRead      bool          `db:"-" json:"is_read"`

	// Transient: populated by SendMessage for mention broadcasting; not persisted or serialized
	MentionedUserIDs []uuid.UUID `db:"-" json:"-"`
}

type Attachment struct {
	ID        uuid.UUID      `db:"id" json:"id"`
	MessageID uuid.UUID      `db:"message_id" json:"message_id"`
	Type      AttachmentType `db:"type" json:"type"`
	URL       string         `db:"url" json:"url"`
	FileName  *string        `db:"file_name" json:"file_name,omitempty"`
	FileSize  *int64         `db:"file_size" json:"file_size,omitempty"`
	MimeType  *string        `db:"mime_type" json:"mime_type,omitempty"`
	Width     *int           `db:"width" json:"width,omitempty"`
	Height    *int           `db:"height" json:"height,omitempty"`
	Duration  *int           `db:"duration" json:"duration,omitempty"`
	Thumbnail *string        `db:"thumbnail" json:"thumbnail,omitempty"`
	CreatedAt time.Time      `db:"created_at" json:"created_at"`
}

type Reaction struct {
	MessageID uuid.UUID `db:"message_id" json:"message_id"`
	UserID    uuid.UUID `db:"user_id" json:"user_id"`
	Emoji     string    `db:"emoji" json:"emoji"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
}

// ReactionCount — aggregated for API response
type ReactionCount struct {
	Emoji   string      `json:"emoji"`
	Count   int         `json:"count"`
	UserIDs []uuid.UUID `json:"user_ids"`
}
