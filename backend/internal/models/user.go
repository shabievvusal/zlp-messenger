package models

import (
	"time"

	"github.com/google/uuid"
)

type User struct {
	ID         uuid.UUID  `db:"id" json:"id"`
	Username   string     `db:"username" json:"username"`
	Email      *string    `db:"email" json:"email,omitempty"`
	Phone      *string    `db:"phone" json:"phone,omitempty"`
	Password   string     `db:"password" json:"-"`
	FirstName  string     `db:"first_name" json:"first_name"`
	LastName   *string    `db:"last_name" json:"last_name,omitempty"`
	Bio        *string    `db:"bio" json:"bio,omitempty"`
	AvatarURL  *string    `db:"avatar_url" json:"avatar_url,omitempty"`
	IsBot      bool       `db:"is_bot" json:"is_bot"`
	IsVerified bool       `db:"is_verified" json:"is_verified"`
	IsBanned   bool       `db:"is_banned" json:"is_banned"`
	LastSeen   *time.Time `db:"last_seen" json:"last_seen,omitempty"`
	CreatedAt  time.Time  `db:"created_at" json:"created_at"`
	UpdatedAt  time.Time  `db:"updated_at" json:"updated_at"`
}

// PublicUser — safe to send to other users (no private fields)
type PublicUser struct {
	ID        uuid.UUID  `json:"id"`
	Username  string     `json:"username"`
	FirstName string     `json:"first_name"`
	LastName  *string    `json:"last_name,omitempty"`
	Bio       *string    `json:"bio,omitempty"`
	AvatarURL *string    `json:"avatar_url,omitempty"`
	IsBot     bool       `json:"is_bot"`
	LastSeen  *time.Time `json:"last_seen,omitempty"`
}

func (u *User) ToPublic() PublicUser {
	return PublicUser{
		ID:        u.ID,
		Username:  u.Username,
		FirstName: u.FirstName,
		LastName:  u.LastName,
		Bio:       u.Bio,
		AvatarURL: u.AvatarURL,
		IsBot:     u.IsBot,
		LastSeen:  u.LastSeen,
	}
}

type Session struct {
	ID           uuid.UUID `db:"id" json:"id"`
	UserID       uuid.UUID `db:"user_id" json:"user_id"`
	RefreshToken string    `db:"refresh_token" json:"-"`
	DeviceName   *string   `db:"device_name" json:"device_name,omitempty"`
	DeviceType   *string   `db:"device_type" json:"device_type,omitempty"`
	IPAddress    *string   `db:"ip_address" json:"ip_address,omitempty"`
	UserAgent    *string   `db:"user_agent" json:"user_agent,omitempty"`
	ExpiresAt    time.Time `db:"expires_at" json:"expires_at"`
	CreatedAt    time.Time `db:"created_at" json:"created_at"`
}

type UserSettings struct {
	UserID               uuid.UUID `db:"user_id" json:"user_id"`
	PhoneVisibility      string    `db:"phone_visibility" json:"phone_visibility"`
	LastSeenVisibility   string    `db:"last_seen_visibility" json:"last_seen_visibility"`
	AvatarVisibility     string    `db:"avatar_visibility" json:"avatar_visibility"`
	NotificationsEnabled bool      `db:"notifications_enabled" json:"notifications_enabled"`
	Theme                string    `db:"theme" json:"theme"`
	Language             string    `db:"language" json:"language"`
	UpdatedAt            time.Time `db:"updated_at" json:"updated_at"`
}
