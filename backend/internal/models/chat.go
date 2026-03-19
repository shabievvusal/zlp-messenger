package models

import (
	"time"

	"github.com/google/uuid"
)

type ChatType string

const (
	ChatTypePrivate  ChatType = "private"
	ChatTypeGroup    ChatType = "group"
	ChatTypeChannel  ChatType = "channel"
	ChatTypeSaved    ChatType = "saved"
)

type MemberRole string

const (
	MemberRoleOwner      MemberRole = "owner"
	MemberRoleAdmin      MemberRole = "admin"
	MemberRoleMember     MemberRole = "member"
	MemberRoleRestricted MemberRole = "restricted"
	MemberRoleLeft       MemberRole = "left"
	MemberRoleBanned     MemberRole = "banned"
)

// ChatPermissions defines what regular members can do in a group
type ChatPermissions struct {
	CanSendMessages bool `json:"can_send_messages"`
	CanSendMedia    bool `json:"can_send_media"`
	CanAddMembers   bool `json:"can_add_members"`
	CanPinMessages  bool `json:"can_pin_messages"`
	CanChangeInfo   bool `json:"can_change_info"`
	CanInviteUsers  bool `json:"can_invite_users"`
}

func DefaultPermissions() ChatPermissions {
	return ChatPermissions{
		CanSendMessages: true,
		CanSendMedia:    true,
		CanAddMembers:   false,
		CanPinMessages:  false,
		CanChangeInfo:   false,
		CanInviteUsers:  true,
	}
}

type Chat struct {
	ID           uuid.UUID  `db:"id" json:"id"`
	NumericID    int64      `db:"numeric_id" json:"numeric_id"`
	Type         ChatType   `db:"type" json:"type"`
	Title        *string    `db:"title" json:"title,omitempty"`
	Description  *string    `db:"description" json:"description,omitempty"`
	Username     *string    `db:"username" json:"username,omitempty"`
	AvatarURL    *string    `db:"avatar_url" json:"avatar_url,omitempty"`
	InviteLink   *string    `db:"invite_link" json:"invite_link,omitempty"`
	IsPublic     bool       `db:"is_public" json:"is_public"`
	MembersCount int        `db:"members_count" json:"members_count"`
	Permissions  *string    `db:"permissions" json:"permissions,omitempty"` // JSONB stored as string
	CreatedBy    *uuid.UUID `db:"created_by" json:"created_by,omitempty"`
	CreatedAt    time.Time  `db:"created_at" json:"created_at"`
	UpdatedAt    time.Time  `db:"updated_at" json:"updated_at"`

	// Joined fields for API responses
	LastMessage  *Message    `db:"-" json:"last_message,omitempty"`
	UnreadCount  int         `db:"-" json:"unread_count"`
	Member       *ChatMember `db:"-" json:"member,omitempty"` // current user's membership
	PeerUserID   *uuid.UUID  `db:"peer_user_id" json:"peer_user_id,omitempty"` // private chats only
}

type AdminAction struct {
	ID        uuid.UUID      `db:"id" json:"id"`
	ChatID    uuid.UUID      `db:"chat_id" json:"chat_id"`
	ActorID   uuid.UUID      `db:"actor_id" json:"actor_id"`
	TargetID  *uuid.UUID     `db:"target_id" json:"target_id,omitempty"`
	Action    string         `db:"action" json:"action"`
	Details   *string        `db:"details" json:"details,omitempty"`
	CreatedAt time.Time      `db:"created_at" json:"created_at"`
	Actor     *PublicUser    `db:"-" json:"actor,omitempty"`
	Target    *PublicUser    `db:"-" json:"target,omitempty"`
}

type ChatMember struct {
	ChatID     uuid.UUID  `db:"chat_id" json:"chat_id"`
	UserID     uuid.UUID  `db:"user_id" json:"user_id"`
	Role       MemberRole `db:"role" json:"role"`
	Title      *string    `db:"title" json:"title,omitempty"`
	JoinedAt   time.Time  `db:"joined_at" json:"joined_at"`
	MutedUntil *time.Time `db:"muted_until" json:"muted_until,omitempty"`

	// Joined
	User *PublicUser `db:"-" json:"user,omitempty"`
}
