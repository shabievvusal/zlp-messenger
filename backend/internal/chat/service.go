package chat

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"time"

	"github.com/google/uuid"
	"github.com/zlp-messenger/backend/internal/models"
)

var mentionRe = regexp.MustCompile(`@(\w+)`)

var (
	ErrChatNotFound    = errors.New("chat not found")
	ErrNotMember       = errors.New("not a chat member")
	ErrPermissionDenied = errors.New("permission denied")
	ErrMessageNotFound = errors.New("message not found")
)

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

// ============================================================
// CHATS
// ============================================================

func (s *Service) GetOrCreatePrivateChat(ctx context.Context, userID, targetID uuid.UUID) (*models.Chat, error) {
	// Try to find existing private chat
	chat, err := s.repo.GetPrivateChat(ctx, userID, targetID)
	if err == nil {
		return chat, nil
	}

	// Create new private chat
	chat = &models.Chat{
		ID:        uuid.New(),
		Type:      models.ChatTypePrivate,
		CreatedBy: &userID,
	}
	if err := s.repo.CreateChat(ctx, chat); err != nil {
		return nil, fmt.Errorf("create private chat: %w", err)
	}

	// Add both members
	for _, uid := range []uuid.UUID{userID, targetID} {
		if err := s.repo.AddMember(ctx, &models.ChatMember{
			ChatID: chat.ID,
			UserID: uid,
			Role:   models.MemberRoleMember,
		}); err != nil {
			return nil, fmt.Errorf("add member: %w", err)
		}
	}

	return chat, nil
}

type CreateGroupInput struct {
	Title       string      `json:"title" validate:"required,min=1,max=128"`
	Description string      `json:"description" validate:"max=255"`
	MemberIDs   []uuid.UUID `json:"member_ids"`
	IsChannel   bool        `json:"is_channel"`
}

func (s *Service) CreateGroup(ctx context.Context, creatorID uuid.UUID, in CreateGroupInput) (*models.Chat, error) {
	chatType := models.ChatTypeGroup
	if in.IsChannel {
		chatType = models.ChatTypeChannel
	}

	chat := &models.Chat{
		ID:        uuid.New(),
		Type:      chatType,
		Title:     &in.Title,
		CreatedBy: &creatorID,
	}
	if in.Description != "" {
		chat.Description = &in.Description
	}

	if err := s.repo.CreateChat(ctx, chat); err != nil {
		return nil, fmt.Errorf("create group: %w", err)
	}

	// Add creator as owner
	if err := s.repo.AddMember(ctx, &models.ChatMember{
		ChatID: chat.ID,
		UserID: creatorID,
		Role:   models.MemberRoleOwner,
	}); err != nil {
		return nil, err
	}

	// Add initial members
	for _, uid := range in.MemberIDs {
		_ = s.repo.AddMember(ctx, &models.ChatMember{
			ChatID: chat.ID,
			UserID: uid,
			Role:   models.MemberRoleMember,
		})
	}

	_ = s.repo.UpdateMembersCount(ctx, chat.ID)

	return chat, nil
}

func (s *Service) GetUserChats(ctx context.Context, userID uuid.UUID) ([]models.Chat, error) {
	return s.repo.GetUserChats(ctx, userID)
}

func (s *Service) GetMembers(ctx context.Context, userID, chatID uuid.UUID) ([]models.ChatMember, error) {
	// Проверяем что пользователь — участник чата
	if _, err := s.repo.GetMember(ctx, chatID, userID); err != nil {
		return nil, ErrNotMember
	}
	return s.repo.GetMembers(ctx, chatID)
}

// ============================================================
// MESSAGES
// ============================================================

type SendMessageInput struct {
	ChatID        uuid.UUID   `json:"chat_id" validate:"required"`
	Text          *string     `json:"text"`
	Type          string      `json:"type"`
	ReplyToID     *uuid.UUID  `json:"reply_to_id"`
	ForwardFromID *uuid.UUID  `json:"forward_from_id"`
	ForwardChatID *uuid.UUID  `json:"forward_chat_id"`
}

func (s *Service) SendMessage(ctx context.Context, senderID uuid.UUID, in SendMessageInput) (*models.Message, error) {
	// Check membership
	member, err := s.repo.GetMember(ctx, in.ChatID, senderID)
	if err != nil {
		return nil, ErrNotMember
	}
	if member.Role == models.MemberRoleLeft || member.Role == models.MemberRoleBanned {
		return nil, ErrPermissionDenied
	}

	msgType := models.MessageType(in.Type)
	if msgType == "" {
		msgType = models.MessageTypeText
	}

	msg := &models.Message{
		ID:            uuid.New(),
		ChatID:        in.ChatID,
		SenderID:      &senderID,
		Type:          msgType,
		Text:          in.Text,
		ReplyToID:     in.ReplyToID,
		ForwardFromID: in.ForwardFromID,
		ForwardChatID: in.ForwardChatID,
	}

	if err := s.repo.CreateMessage(ctx, msg); err != nil {
		return nil, fmt.Errorf("create message: %w", err)
	}

	// Detect @mentions in message text
	if in.Text != nil {
		matches := mentionRe.FindAllStringSubmatch(*in.Text, -1)
		if len(matches) > 0 {
			usernames := make([]string, 0, len(matches))
			seen := make(map[string]bool)
			for _, m := range matches {
				u := m[1]
				if !seen[u] {
					seen[u] = true
					usernames = append(usernames, u)
				}
			}
			resolved, _ := s.repo.GetMentionedUserIDs(ctx, in.ChatID, usernames)
			for _, uid := range resolved {
				if uid == senderID {
					continue // skip self-mention
				}
				mention := &models.Mention{
					ID:              uuid.New(),
					MessageID:       msg.ID,
					ChatID:          in.ChatID,
					SenderID:        &senderID,
					MentionedUserID: uid,
				}
				_ = s.repo.CreateMention(ctx, mention)
				msg.MentionedUserIDs = append(msg.MentionedUserIDs, uid)
			}
		}
	}

	// When forwarding, copy attachments from the original message so recipients see media
	if in.ForwardFromID != nil {
		origAttachments, _ := s.repo.GetAttachments(ctx, *in.ForwardFromID)
		for _, a := range origAttachments {
			newA := models.Attachment{
				ID:        uuid.New(),
				MessageID: msg.ID,
				Type:      a.Type,
				URL:       a.URL,
				FileName:  a.FileName,
				FileSize:  a.FileSize,
				MimeType:  a.MimeType,
				Width:     a.Width,
				Height:    a.Height,
				Duration:  a.Duration,
				Thumbnail: a.Thumbnail,
			}
			if err := s.repo.CreateAttachment(ctx, &newA); err == nil {
				msg.Attachments = append(msg.Attachments, newA)
			}
		}
	}

	// Attach sender info so WebSocket broadcast includes the user object
	if u, err := s.repo.GetUserByID(ctx, senderID); err == nil {
		pub := u.ToPublic()
		msg.Sender = &pub
	}

	return msg, nil
}

func (s *Service) GetMessageByID(ctx context.Context, msgID uuid.UUID) (*models.Message, error) {
	return s.repo.GetMessageByID(ctx, msgID)
}

func (s *Service) GetMessages(ctx context.Context, userID, chatID uuid.UUID, limit, offset int) ([]models.Message, error) {
	if _, err := s.repo.GetMember(ctx, chatID, userID); err != nil {
		return nil, ErrNotMember
	}

	if limit <= 0 || limit > 100 {
		limit = 50
	}

	return s.repo.GetMessages(ctx, chatID, limit, offset, userID)
}

func (s *Service) EditMessage(ctx context.Context, userID, msgID uuid.UUID, text string) (*models.Message, error) {
	msg, err := s.repo.GetMessageByID(ctx, msgID)
	if err != nil {
		return nil, ErrMessageNotFound
	}
	if msg.SenderID == nil || *msg.SenderID != userID {
		return nil, ErrPermissionDenied
	}
	if err := s.repo.EditMessage(ctx, msgID, text); err != nil {
		return nil, err
	}
	msg.Text = &text
	msg.IsEdited = true
	return msg, nil
}

func (s *Service) DeleteMessage(ctx context.Context, userID, msgID uuid.UUID) (*models.Message, error) {
	msg, err := s.repo.GetMessageByID(ctx, msgID)
	if err != nil {
		return nil, ErrMessageNotFound
	}

	// Owner can delete; admin can delete in group
	if msg.SenderID == nil || *msg.SenderID != userID {
		member, err := s.repo.GetMember(ctx, msg.ChatID, userID)
		if err != nil || (member.Role != models.MemberRoleAdmin && member.Role != models.MemberRoleOwner) {
			return nil, ErrPermissionDenied
		}
	}

	if err := s.repo.DeleteMessage(ctx, msgID); err != nil {
		return nil, err
	}
	return msg, nil
}

func (s *Service) AddReaction(ctx context.Context, userID, msgID uuid.UUID, emoji string) error {
	return s.repo.AddReaction(ctx, msgID, userID, emoji)
}

func (s *Service) RemoveReaction(ctx context.Context, userID, msgID uuid.UUID) error {
	return s.repo.RemoveReaction(ctx, msgID, userID)
}

func (s *Service) MarkRead(ctx context.Context, userID, msgID uuid.UUID) error {
	return s.repo.MarkRead(ctx, msgID, userID)
}

func (s *Service) GetPrivateChat(ctx context.Context, userA, userB uuid.UUID) (*models.Chat, error) {
	return s.repo.GetPrivateChat(ctx, userA, userB)
}

func (s *Service) CreateServiceMessage(ctx context.Context, chatID uuid.UUID, text string) (*models.Message, error) {
	t := text
	msg := &models.Message{
		ID:     uuid.New(),
		ChatID: chatID,
		Type:   models.MessageTypeService,
		Text:   &t,
	}
	if err := s.repo.CreateMessage(ctx, msg); err != nil {
		return nil, err
	}
	return msg, nil
}

func (s *Service) SearchMessages(ctx context.Context, userID, chatID uuid.UUID, query string) ([]models.Message, error) {
	if _, err := s.repo.GetMember(ctx, chatID, userID); err != nil {
		return nil, ErrNotMember
	}
	return s.repo.SearchMessages(ctx, chatID, query)
}

func (s *Service) MuteChat(ctx context.Context, userID, chatID uuid.UUID, until *time.Time) error {
	if _, err := s.repo.GetMember(ctx, chatID, userID); err != nil {
		return ErrNotMember
	}
	return s.repo.UpdateMutedUntil(ctx, chatID, userID, until)
}

func (s *Service) GetSharedMedia(ctx context.Context, userID, chatID uuid.UUID, limit, offset int) ([]models.Attachment, error) {
	if _, err := s.repo.GetMember(ctx, chatID, userID); err != nil {
		return nil, ErrNotMember
	}
	return s.repo.GetSharedMedia(ctx, chatID, limit, offset)
}

func (s *Service) GetSharedFiles(ctx context.Context, userID, chatID uuid.UUID, limit, offset int) ([]models.Attachment, error) {
	if _, err := s.repo.GetMember(ctx, chatID, userID); err != nil {
		return nil, ErrNotMember
	}
	return s.repo.GetSharedFiles(ctx, chatID, limit, offset)
}
