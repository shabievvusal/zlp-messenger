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

type Chat struct {
	ID           uuid.UUID  `db:"id" json:"id"`
	Type         ChatType   `db:"type" json:"type"`
	Title        *string    `db:"title" json:"title,omitempty"`
	Description  *string    `db:"description" json:"description,omitempty"`
	Username     *string    `db:"username" json:"username,omitempty"`
	AvatarURL    *string    `db:"avatar_url" json:"avatar_url,omitempty"`
	InviteLink   *string    `db:"invite_link" json:"invite_link,omitempty"`
	IsPublic     bool       `db:"is_public" json:"is_public"`
	MembersCount int        `db:"members_count" json:"members_count"`
	CreatedBy    *uuid.UUID `db:"created_by" json:"created_by,omitempty"`
	CreatedAt    time.Time  `db:"created_at" json:"created_at"`
	UpdatedAt    time.Time  `db:"updated_at" json:"updated_at"`

	// Joined fields for API responses
	LastMessage  *Message    `db:"-" json:"last_message,omitempty"`
	UnreadCount  int         `db:"-" json:"unread_count"`
	Member       *ChatMember `db:"-" json:"member,omitempty"` // current user's membership
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
