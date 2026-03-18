package models

import (
	"time"

	"github.com/google/uuid"
)

type CallStatus string
type CallType string

const (
	CallStatusRinging  CallStatus = "ringing"
	CallStatusActive   CallStatus = "active"
	CallStatusEnded    CallStatus = "ended"
	CallStatusMissed   CallStatus = "missed"
	CallStatusDeclined CallStatus = "declined"

	CallTypeVoice      CallType = "voice"
	CallTypeVideo      CallType = "video"
	CallTypeGroupVoice CallType = "group_voice"
)

type Call struct {
	ID          uuid.UUID  `db:"id" json:"id"`
	ChatID      uuid.UUID  `db:"chat_id" json:"chat_id"`
	InitiatedBy uuid.UUID  `db:"initiated_by" json:"initiated_by"`
	Type        CallType   `db:"type" json:"type"`
	Status      CallStatus `db:"status" json:"status"`
	StartedAt   *time.Time `db:"started_at" json:"started_at,omitempty"`
	EndedAt     *time.Time `db:"ended_at" json:"ended_at,omitempty"`
	CreatedAt   time.Time  `db:"created_at" json:"created_at"`

	Participants []CallParticipant `db:"-" json:"participants,omitempty"`
}

type CallParticipant struct {
	CallID   uuid.UUID  `db:"call_id" json:"call_id"`
	UserID   uuid.UUID  `db:"user_id" json:"user_id"`
	JoinedAt *time.Time `db:"joined_at" json:"joined_at,omitempty"`
	LeftAt   *time.Time `db:"left_at" json:"left_at,omitempty"`

	User *PublicUser `db:"-" json:"user,omitempty"`
}
