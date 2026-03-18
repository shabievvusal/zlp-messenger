package chat

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"github.com/zlp-messenger/backend/internal/models"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// ============================================================
// CHATS
// ============================================================

func (r *Repository) CreateChat(ctx context.Context, chat *models.Chat) error {
	query := `
		INSERT INTO chats (id, type, title, description, username, is_public, created_by)
		VALUES (:id, :type, :title, :description, :username, :is_public, :created_by)
		RETURNING created_at, updated_at`
	rows, err := r.db.NamedQueryContext(ctx, query, chat)
	if err != nil {
		return err
	}
	defer rows.Close()
	if rows.Next() {
		return rows.Scan(&chat.CreatedAt, &chat.UpdatedAt)
	}
	return nil
}

func (r *Repository) GetChatByID(ctx context.Context, id uuid.UUID) (*models.Chat, error) {
	var chat models.Chat
	err := r.db.GetContext(ctx, &chat, `SELECT * FROM chats WHERE id = $1`, id)
	return &chat, err
}

// GetUserChats returns all chats where user is a member, with last message
func (r *Repository) GetUserChats(ctx context.Context, userID uuid.UUID) ([]models.Chat, error) {
	query := `
		SELECT c.*
		FROM chats c
		INNER JOIN chat_members cm ON cm.chat_id = c.id
		WHERE cm.user_id = $1 AND cm.role NOT IN ('left', 'banned')
		ORDER BY (
			SELECT created_at FROM messages
			WHERE chat_id = c.id AND is_deleted = FALSE
			ORDER BY created_at DESC LIMIT 1
		) DESC NULLS LAST`

	var chats []models.Chat
	err := r.db.SelectContext(ctx, &chats, query, userID)
	return chats, err
}

func (r *Repository) GetPrivateChat(ctx context.Context, userA, userB uuid.UUID) (*models.Chat, error) {
	var chat models.Chat
	err := r.db.GetContext(ctx, &chat, `
		SELECT c.* FROM chats c
		INNER JOIN chat_members a ON a.chat_id = c.id AND a.user_id = $1
		INNER JOIN chat_members b ON b.chat_id = c.id AND b.user_id = $2
		WHERE c.type = 'private'
		LIMIT 1`, userA, userB)
	return &chat, err
}

// ============================================================
// CHAT MEMBERS
// ============================================================

func (r *Repository) AddMember(ctx context.Context, m *models.ChatMember) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO chat_members (chat_id, user_id, role)
		VALUES ($1, $2, $3)
		ON CONFLICT (chat_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
		m.ChatID, m.UserID, m.Role)
	return err
}

func (r *Repository) GetMember(ctx context.Context, chatID, userID uuid.UUID) (*models.ChatMember, error) {
	var m models.ChatMember
	err := r.db.GetContext(ctx, &m, `
		SELECT * FROM chat_members WHERE chat_id = $1 AND user_id = $2`, chatID, userID)
	return &m, err
}

func (r *Repository) GetMembers(ctx context.Context, chatID uuid.UUID) ([]models.ChatMember, error) {
	var members []models.ChatMember
	err := r.db.SelectContext(ctx, &members, `
		SELECT cm.*, u.username, u.first_name, u.last_name, u.avatar_url
		FROM chat_members cm
		INNER JOIN users u ON u.id = cm.user_id
		WHERE cm.chat_id = $1 AND cm.role NOT IN ('left', 'banned')
		ORDER BY cm.joined_at`, chatID)
	return members, err
}

func (r *Repository) RemoveMember(ctx context.Context, chatID, userID uuid.UUID) error {
	_, err := r.db.ExecContext(ctx, `
		UPDATE chat_members SET role = 'left' WHERE chat_id = $1 AND user_id = $2`,
		chatID, userID)
	return err
}

func (r *Repository) UpdateMembersCount(ctx context.Context, chatID uuid.UUID) error {
	_, err := r.db.ExecContext(ctx, `
		UPDATE chats SET members_count = (
			SELECT COUNT(*) FROM chat_members
			WHERE chat_id = $1 AND role NOT IN ('left', 'banned')
		) WHERE id = $1`, chatID)
	return err
}

// ============================================================
// MESSAGES
// ============================================================

func (r *Repository) CreateMessage(ctx context.Context, msg *models.Message) error {
	query := `
		INSERT INTO messages (id, chat_id, sender_id, type, text, reply_to_id, forward_from_id, forward_chat_id)
		VALUES (:id, :chat_id, :sender_id, :type, :text, :reply_to_id, :forward_from_id, :forward_chat_id)
		RETURNING created_at`
	rows, err := r.db.NamedQueryContext(ctx, query, msg)
	if err != nil {
		return err
	}
	defer rows.Close()
	if rows.Next() {
		return rows.Scan(&msg.CreatedAt)
	}
	return nil
}

func (r *Repository) GetMessageByID(ctx context.Context, id uuid.UUID) (*models.Message, error) {
	var msg models.Message
	err := r.db.GetContext(ctx, &msg, `SELECT * FROM messages WHERE id = $1 AND is_deleted = FALSE`, id)
	return &msg, err
}

func (r *Repository) GetMessages(ctx context.Context, chatID uuid.UUID, limit, offset int) ([]models.Message, error) {
	var msgs []models.Message
	err := r.db.SelectContext(ctx, &msgs, `
		SELECT * FROM messages
		WHERE chat_id = $1 AND is_deleted = FALSE
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3`, chatID, limit, offset)
	return msgs, err
}

func (r *Repository) EditMessage(ctx context.Context, id uuid.UUID, text string) error {
	_, err := r.db.ExecContext(ctx, `
		UPDATE messages SET text = $1, is_edited = TRUE, edited_at = NOW()
		WHERE id = $2`, text, id)
	return err
}

func (r *Repository) DeleteMessage(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.ExecContext(ctx, `
		UPDATE messages SET is_deleted = TRUE WHERE id = $1`, id)
	return err
}

func (r *Repository) PinMessage(ctx context.Context, chatID, msgID uuid.UUID) error {
	_, err := r.db.ExecContext(ctx, `
		UPDATE messages SET is_pinned = TRUE WHERE id = $1 AND chat_id = $2`, msgID, chatID)
	return err
}

func (r *Repository) GetPinnedMessages(ctx context.Context, chatID uuid.UUID) ([]models.Message, error) {
	var msgs []models.Message
	err := r.db.SelectContext(ctx, &msgs, `
		SELECT * FROM messages WHERE chat_id = $1 AND is_pinned = TRUE AND is_deleted = FALSE
		ORDER BY created_at DESC`, chatID)
	return msgs, err
}

func (r *Repository) SearchMessages(ctx context.Context, chatID uuid.UUID, query string) ([]models.Message, error) {
	var msgs []models.Message
	err := r.db.SelectContext(ctx, &msgs, `
		SELECT * FROM messages
		WHERE chat_id = $1 AND is_deleted = FALSE AND text ILIKE $2
		ORDER BY created_at DESC LIMIT 50`,
		chatID, fmt.Sprintf("%%%s%%", query))
	return msgs, err
}

// ============================================================
// ATTACHMENTS
// ============================================================

func (r *Repository) CreateAttachment(ctx context.Context, a *models.Attachment) error {
	_, err := r.db.NamedExecContext(ctx, `
		INSERT INTO attachments (id, message_id, type, url, file_name, file_size, mime_type, width, height, duration, thumbnail)
		VALUES (:id, :message_id, :type, :url, :file_name, :file_size, :mime_type, :width, :height, :duration, :thumbnail)`, a)
	return err
}

func (r *Repository) GetAttachments(ctx context.Context, messageID uuid.UUID) ([]models.Attachment, error) {
	var attachments []models.Attachment
	err := r.db.SelectContext(ctx, &attachments, `
		SELECT * FROM attachments WHERE message_id = $1`, messageID)
	return attachments, err
}

// ============================================================
// REACTIONS
// ============================================================

func (r *Repository) AddReaction(ctx context.Context, msgID, userID uuid.UUID, emoji string) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO reactions (message_id, user_id, emoji)
		VALUES ($1, $2, $3)
		ON CONFLICT (message_id, user_id) DO UPDATE SET emoji = EXCLUDED.emoji`,
		msgID, userID, emoji)
	return err
}

func (r *Repository) RemoveReaction(ctx context.Context, msgID, userID uuid.UUID) error {
	_, err := r.db.ExecContext(ctx, `
		DELETE FROM reactions WHERE message_id = $1 AND user_id = $2`, msgID, userID)
	return err
}

func (r *Repository) GetReactions(ctx context.Context, msgID uuid.UUID) ([]models.Reaction, error) {
	var reactions []models.Reaction
	err := r.db.SelectContext(ctx, &reactions, `
		SELECT * FROM reactions WHERE message_id = $1`, msgID)
	return reactions, err
}

// ============================================================
// READ RECEIPTS
// ============================================================

func (r *Repository) MarkRead(ctx context.Context, msgID, userID uuid.UUID) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO message_reads (message_id, user_id)
		VALUES ($1, $2)
		ON CONFLICT DO NOTHING`, msgID, userID)
	return err
}

func (r *Repository) GetUnreadCount(ctx context.Context, chatID, userID uuid.UUID) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count, `
		SELECT COUNT(*) FROM messages m
		WHERE m.chat_id = $1
		AND m.sender_id != $2
		AND m.is_deleted = FALSE
		AND NOT EXISTS (
			SELECT 1 FROM message_reads mr
			WHERE mr.message_id = m.id AND mr.user_id = $2
		)`, chatID, userID)
	return count, err
}
