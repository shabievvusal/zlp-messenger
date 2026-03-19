package chat

import (
	"context"
	"fmt"
	"strings"
	"time"

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

func (r *Repository) GetUserByID(ctx context.Context, id uuid.UUID) (*models.User, error) {
	var u models.User
	err := r.db.GetContext(ctx, &u, `SELECT * FROM users WHERE id = $1`, id)
	return &u, err
}

func (r *Repository) GetChatByID(ctx context.Context, id uuid.UUID) (*models.Chat, error) {
	var chat models.Chat
	err := r.db.GetContext(ctx, &chat, `SELECT * FROM chats WHERE id = $1`, id)
	return &chat, err
}

// GetUserChats returns all chats where user is a member, with last message
func (r *Repository) GetUserChats(ctx context.Context, userID uuid.UUID) ([]models.Chat, error) {
	query := `
		SELECT
			c.id, c.type,
			CASE WHEN c.type = 'private' THEN
				(SELECT u.first_name || COALESCE(' ' || u.last_name, '')
				 FROM users u INNER JOIN chat_members cm2 ON cm2.user_id = u.id
				 WHERE cm2.chat_id = c.id AND u.id != $1
				   AND cm2.role NOT IN ('left','banned') LIMIT 1)
			ELSE c.title END AS title,
			CASE WHEN c.type = 'private' THEN
				(SELECT u.avatar_url FROM users u INNER JOIN chat_members cm2 ON cm2.user_id = u.id
				 WHERE cm2.chat_id = c.id AND u.id != $1
				   AND cm2.role NOT IN ('left','banned') LIMIT 1)
			ELSE c.avatar_url END AS avatar_url,
			c.description, c.username, c.invite_link, c.is_public,
			c.members_count, c.created_by, c.created_at, c.updated_at,
			(SELECT cm2.user_id FROM chat_members cm2
			 WHERE cm2.chat_id = c.id AND cm2.user_id != $1
			   AND c.type = 'private' AND cm2.role NOT IN ('left','banned')
			 LIMIT 1) AS peer_user_id
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

func (r *Repository) UpdateChat(ctx context.Context, chatID uuid.UUID, title, description *string, isPublic *bool) error {
	parts := []string{}
	args := []interface{}{}
	idx := 1

	if title != nil {
		parts = append(parts, fmt.Sprintf("title = $%d", idx))
		args = append(args, *title)
		idx++
	}
	if description != nil {
		parts = append(parts, fmt.Sprintf("description = $%d", idx))
		args = append(args, *description)
		idx++
	}
	if isPublic != nil {
		parts = append(parts, fmt.Sprintf("is_public = $%d", idx))
		args = append(args, *isPublic)
		idx++
	}
	if len(parts) == 0 {
		return nil
	}
	args = append(args, chatID)
	query := fmt.Sprintf("UPDATE chats SET %s, updated_at = NOW() WHERE id = $%d",
		strings.Join(parts, ", "), idx)
	_, err := r.db.ExecContext(ctx, query, args...)
	return err
}

func (r *Repository) DeleteChat(ctx context.Context, chatID uuid.UUID) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM chats WHERE id = $1`, chatID)
	return err
}

func (r *Repository) SetInviteLink(ctx context.Context, chatID uuid.UUID, link string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE chats SET invite_link = $1, updated_at = NOW() WHERE id = $2`, link, chatID)
	return err
}

func (r *Repository) UpdatePermissions(ctx context.Context, chatID uuid.UUID, permJSON string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE chats SET permissions = $1::jsonb, updated_at = NOW() WHERE id = $2`, permJSON, chatID)
	return err
}

func (r *Repository) SetMemberRole(ctx context.Context, chatID, userID uuid.UUID, role models.MemberRole, title *string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE chat_members SET role = $1, title = $2 WHERE chat_id = $3 AND user_id = $4`,
		role, title, chatID, userID)
	return err
}

func (r *Repository) LogAdminAction(ctx context.Context, a *models.AdminAction) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO admin_actions (id, chat_id, actor_id, target_id, action, details)
		 VALUES ($1, $2, $3, $4, $5, $6)`,
		a.ID, a.ChatID, a.ActorID, a.TargetID, a.Action, a.Details)
	return err
}

func (r *Repository) GetAdminActions(ctx context.Context, chatID uuid.UUID, limit int) ([]models.AdminAction, error) {
	var actions []models.AdminAction
	err := r.db.SelectContext(ctx, &actions, `
		SELECT id, chat_id, actor_id, target_id, action, details, created_at
		FROM admin_actions WHERE chat_id = $1
		ORDER BY created_at DESC LIMIT $2`, chatID, limit)
	if err != nil || len(actions) == 0 {
		return actions, err
	}

	// Collect unique user IDs
	ids := map[uuid.UUID]bool{}
	for _, a := range actions {
		ids[a.ActorID] = true
		if a.TargetID != nil {
			ids[*a.TargetID] = true
		}
	}
	uids := make([]uuid.UUID, 0, len(ids))
	for id := range ids {
		uids = append(uids, id)
	}

	// Batch fetch users
	if len(uids) > 0 {
		ph := make([]string, len(uids))
		args := make([]interface{}, len(uids))
		for i, id := range uids {
			ph[i] = fmt.Sprintf("$%d", i+1)
			args[i] = id
		}
		q := fmt.Sprintf(
			`SELECT id, username, first_name, last_name, avatar_url FROM users WHERE id IN (%s)`,
			strings.Join(ph, ","))
		type row struct {
			ID        uuid.UUID `db:"id"`
			Username  string    `db:"username"`
			FirstName string    `db:"first_name"`
			LastName  *string   `db:"last_name"`
			AvatarURL *string   `db:"avatar_url"`
		}
		var rows []row
		if err := r.db.SelectContext(ctx, &rows, q, args...); err == nil {
			userMap := map[uuid.UUID]*models.PublicUser{}
			for _, u := range rows {
				pu := &models.PublicUser{
					ID: u.ID, Username: u.Username,
					FirstName: u.FirstName, AvatarURL: u.AvatarURL,
				}
				if u.LastName != nil {
					pu.LastName = u.LastName
				}
				userMap[u.ID] = pu
			}
			for i := range actions {
				actions[i].Actor = userMap[actions[i].ActorID]
				if actions[i].TargetID != nil {
					actions[i].Target = userMap[*actions[i].TargetID]
				}
			}
		}
	}
	return actions, nil
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
		SELECT cm.chat_id, cm.user_id, cm.role, cm.title, cm.joined_at, cm.muted_until
		FROM chat_members cm
		WHERE cm.chat_id = $1 AND cm.role NOT IN ('left', 'banned')
		ORDER BY cm.joined_at`, chatID)
	if err != nil || len(members) == 0 {
		return members, err
	}
	// Populate User field
	args := make([]interface{}, len(members))
	placeholders := make([]string, len(members))
	for i, m := range members {
		args[i] = m.UserID
		placeholders[i] = fmt.Sprintf("$%d", i+1)
	}
	query := fmt.Sprintf(
		`SELECT id, username, first_name, last_name, bio, avatar_url, is_bot, last_seen
		 FROM users WHERE id IN (%s)`,
		strings.Join(placeholders, ","),
	)
	type userRow struct {
		ID        uuid.UUID  `db:"id"`
		Username  string     `db:"username"`
		FirstName string     `db:"first_name"`
		LastName  *string    `db:"last_name"`
		Bio       *string    `db:"bio"`
		AvatarURL *string    `db:"avatar_url"`
		IsBot     bool       `db:"is_bot"`
		LastSeen  *time.Time `db:"last_seen"`
	}
	var users []userRow
	if err := r.db.SelectContext(ctx, &users, query, args...); err == nil {
		uMap := make(map[uuid.UUID]userRow, len(users))
		for _, u := range users {
			uMap[u.ID] = u
		}
		for i := range members {
			if u, ok := uMap[members[i].UserID]; ok {
				members[i].User = &models.PublicUser{
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
		}
	}
	return members, nil
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

func (r *Repository) GetMessages(ctx context.Context, chatID uuid.UUID, limit, offset int, viewerID uuid.UUID) ([]models.Message, error) {
	var msgs []models.Message
	err := r.db.SelectContext(ctx, &msgs, `
		SELECT * FROM messages
		WHERE chat_id = $1 AND is_deleted = FALSE
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3`, chatID, limit, offset)
	if err != nil || len(msgs) == 0 {
		return msgs, err
	}
	_ = r.populateAttachments(ctx, msgs)
	_ = r.populateSenders(ctx, msgs)
	_ = r.populateReadStatus(ctx, msgs, viewerID)
	return msgs, nil
}

// populateReadStatus marks IsRead=true on messages sent by viewerID that have been read by someone else.
func (r *Repository) populateReadStatus(ctx context.Context, msgs []models.Message, viewerID uuid.UUID) error {
	// Collect own message IDs
	var ownIDs []interface{}
	var placeholders []string
	for _, m := range msgs {
		if m.SenderID != nil && *m.SenderID == viewerID {
			ownIDs = append(ownIDs, m.ID)
			placeholders = append(placeholders, fmt.Sprintf("$%d", len(ownIDs)))
		}
	}
	if len(ownIDs) == 0 {
		return nil
	}
	query := fmt.Sprintf(
		`SELECT DISTINCT message_id FROM message_reads WHERE message_id IN (%s) AND user_id != $%d`,
		strings.Join(placeholders, ","), len(ownIDs)+1,
	)
	ownIDs = append(ownIDs, viewerID)
	var readIDs []uuid.UUID
	if err := r.db.SelectContext(ctx, &readIDs, query, ownIDs...); err != nil {
		return err
	}
	readSet := make(map[uuid.UUID]struct{}, len(readIDs))
	for _, id := range readIDs {
		readSet[id] = struct{}{}
	}
	for i := range msgs {
		if _, ok := readSet[msgs[i].ID]; ok {
			msgs[i].IsRead = true
		}
	}
	return nil
}

// populateSenders fetches sender info (and forward sender info) for a slice of messages in one query.
func (r *Repository) populateSenders(ctx context.Context, msgs []models.Message) error {
	idSet := make(map[uuid.UUID]struct{})
	for _, m := range msgs {
		if m.SenderID != nil {
			idSet[*m.SenderID] = struct{}{}
		}
		// Also collect IDs of original senders for forwarded messages
		if m.ForwardFromID != nil {
			// We need to look up the original message's sender_id
			idSet[*m.ForwardFromID] = struct{}{} // will resolve below via sub-query
		}
	}

	// Collect forward_from_id message IDs and resolve their sender_ids
	fwdMsgIDs := make([]uuid.UUID, 0)
	for _, m := range msgs {
		if m.ForwardFromID != nil {
			fwdMsgIDs = append(fwdMsgIDs, *m.ForwardFromID)
		}
	}
	// Map: original_message_id → sender_id
	fwdSenderMap := map[uuid.UUID]uuid.UUID{}
	if len(fwdMsgIDs) > 0 {
		ph := make([]string, len(fwdMsgIDs))
		args := make([]interface{}, len(fwdMsgIDs))
		for i, id := range fwdMsgIDs {
			ph[i] = fmt.Sprintf("$%d", i+1)
			args[i] = id
		}
		q := fmt.Sprintf(`SELECT id, sender_id FROM messages WHERE id IN (%s)`, strings.Join(ph, ","))
		type fwdRow struct {
			ID       uuid.UUID  `db:"id"`
			SenderID *uuid.UUID `db:"sender_id"`
		}
		var fwdRows []fwdRow
		if err := r.db.SelectContext(ctx, &fwdRows, q, args...); err == nil {
			for _, fr := range fwdRows {
				if fr.SenderID != nil {
					fwdSenderMap[fr.ID] = *fr.SenderID
					idSet[*fr.SenderID] = struct{}{}
				}
			}
		}
	}
	// Remove forward_from_ids that got added (not actual user IDs)
	for _, m := range msgs {
		if m.ForwardFromID != nil {
			delete(idSet, *m.ForwardFromID)
		}
	}
	if len(idSet) == 0 {
		return nil
	}
	ids := make([]interface{}, 0, len(idSet))
	placeholders := make([]string, 0, len(idSet))
	i := 1
	for id := range idSet {
		ids = append(ids, id)
		placeholders = append(placeholders, fmt.Sprintf("$%d", i))
		i++
	}
	query := fmt.Sprintf(
		`SELECT id, username, first_name, last_name, avatar_url FROM users WHERE id IN (%s)`,
		strings.Join(placeholders, ","),
	)
	type row struct {
		ID        uuid.UUID `db:"id"`
		Username  string    `db:"username"`
		FirstName string    `db:"first_name"`
		LastName  *string   `db:"last_name"`
		AvatarURL *string   `db:"avatar_url"`
	}
	var rows []row
	if err := r.db.SelectContext(ctx, &rows, query, ids...); err != nil {
		return err
	}
	userMap := make(map[uuid.UUID]row, len(rows))
	for _, u := range rows {
		userMap[u.ID] = u
	}
	for i := range msgs {
		if msgs[i].SenderID != nil {
			if u, ok := userMap[*msgs[i].SenderID]; ok {
				msgs[i].Sender = &models.PublicUser{
					ID: u.ID, Username: u.Username,
					FirstName: u.FirstName, LastName: u.LastName, AvatarURL: u.AvatarURL,
				}
			}
		}
		if msgs[i].ForwardFromID != nil {
			if senderID, ok := fwdSenderMap[*msgs[i].ForwardFromID]; ok {
				if u, ok := userMap[senderID]; ok {
					msgs[i].ForwardSender = &models.PublicUser{
						ID: u.ID, Username: u.Username,
						FirstName: u.FirstName, LastName: u.LastName, AvatarURL: u.AvatarURL,
					}
				}
			}
		}
	}
	return nil
}

// populateAttachments fetches attachments for a slice of messages in one query
// and sets msg.Attachments on each matching message.
func (r *Repository) populateAttachments(ctx context.Context, msgs []models.Message) error {
	if len(msgs) == 0 {
		return nil
	}
	args := make([]interface{}, len(msgs))
	placeholders := make([]string, len(msgs))
	for i, m := range msgs {
		args[i] = m.ID
		placeholders[i] = fmt.Sprintf("$%d", i+1)
	}
	query := fmt.Sprintf(
		`SELECT * FROM attachments WHERE message_id IN (%s) ORDER BY created_at`,
		strings.Join(placeholders, ","),
	)
	var attachments []models.Attachment
	if err := r.db.SelectContext(ctx, &attachments, query, args...); err != nil {
		return err
	}
	aMap := make(map[uuid.UUID][]models.Attachment)
	for _, a := range attachments {
		aMap[a.MessageID] = append(aMap[a.MessageID], a)
	}
	for i := range msgs {
		if atts, ok := aMap[msgs[i].ID]; ok {
			msgs[i].Attachments = atts
		}
	}
	return nil
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
	if err != nil || len(msgs) == 0 {
		return msgs, err
	}
	_ = r.populateAttachments(ctx, msgs)
	return msgs, nil
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

// ============================================================
// MUTE
// ============================================================

func (r *Repository) UpdateMutedUntil(ctx context.Context, chatID, userID uuid.UUID, until *time.Time) error {
	_, err := r.db.ExecContext(ctx, `
		UPDATE chat_members SET muted_until = $3
		WHERE chat_id = $1 AND user_id = $2`, chatID, userID, until)
	return err
}

// ============================================================
// MENTIONS
// ============================================================

func (r *Repository) CreateMention(ctx context.Context, m *models.Mention) error {
	_, err := r.db.NamedExecContext(ctx, `
		INSERT INTO mentions (id, message_id, chat_id, sender_id, mentioned_user_id)
		VALUES (:id, :message_id, :chat_id, :sender_id, :mentioned_user_id)`, m)
	return err
}

// GetMentionedUserIDs resolves @usernames to user IDs for members of a given chat.
func (r *Repository) GetMentionedUserIDs(ctx context.Context, chatID uuid.UUID, usernames []string) (map[string]uuid.UUID, error) {
	if len(usernames) == 0 {
		return nil, nil
	}
	args := make([]interface{}, 0, len(usernames)+1)
	args = append(args, chatID)
	placeholders := make([]string, len(usernames))
	for i, u := range usernames {
		args = append(args, u)
		placeholders[i] = fmt.Sprintf("$%d", i+2)
	}
	query := fmt.Sprintf(`
		SELECT u.username, u.id FROM users u
		INNER JOIN chat_members cm ON cm.user_id = u.id
		WHERE cm.chat_id = $1 AND u.username IN (%s)
		  AND cm.role NOT IN ('left','banned')`,
		strings.Join(placeholders, ","),
	)
	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := make(map[string]uuid.UUID)
	for rows.Next() {
		var username string
		var id uuid.UUID
		if err := rows.Scan(&username, &id); err == nil {
			result[username] = id
		}
	}
	return result, nil
}

// ============================================================
// SHARED MEDIA
// ============================================================

func (r *Repository) GetSharedMedia(ctx context.Context, chatID uuid.UUID, limit, offset int) ([]models.Attachment, error) {
	var items []models.Attachment
	err := r.db.SelectContext(ctx, &items, `
		SELECT a.* FROM attachments a
		JOIN messages m ON m.id = a.message_id
		WHERE m.chat_id = $1 AND m.is_deleted = FALSE
		  AND a.type IN ('photo','video','gif')
		ORDER BY a.created_at DESC
		LIMIT $2 OFFSET $3`, chatID, limit, offset)
	return items, err
}

func (r *Repository) GetSharedFiles(ctx context.Context, chatID uuid.UUID, limit, offset int) ([]models.Attachment, error) {
	var items []models.Attachment
	err := r.db.SelectContext(ctx, &items, `
		SELECT a.* FROM attachments a
		JOIN messages m ON m.id = a.message_id
		WHERE m.chat_id = $1 AND m.is_deleted = FALSE
		  AND a.type = 'document'
		ORDER BY a.created_at DESC
		LIMIT $2 OFFSET $3`, chatID, limit, offset)
	return items, err
}
