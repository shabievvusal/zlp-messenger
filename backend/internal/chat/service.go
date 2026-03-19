package chat

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
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
	if _, err := s.repo.GetMember(ctx, chatID, userID); err != nil {
		return nil, ErrNotMember
	}
	return s.repo.GetMembers(ctx, chatID)
}

func (s *Service) AddMember(ctx context.Context, requesterID, chatID, targetUserID uuid.UUID) error {
	member, err := s.repo.GetMember(ctx, chatID, requesterID)
	if err != nil {
		return ErrNotMember
	}
	if member.Role != models.MemberRoleOwner && member.Role != models.MemberRoleAdmin {
		return ErrPermissionDenied
	}
	m := &models.ChatMember{ChatID: chatID, UserID: targetUserID, Role: models.MemberRoleMember}
	if err := s.repo.AddMember(ctx, m); err != nil {
		return err
	}
	_ = s.repo.UpdateMembersCount(ctx, chatID)
	return nil
}

func (s *Service) LeaveChat(ctx context.Context, userID, chatID uuid.UUID) error {
	if _, err := s.repo.GetMember(ctx, chatID, userID); err != nil {
		return ErrNotMember
	}
	if err := s.repo.RemoveMember(ctx, chatID, userID); err != nil {
		return err
	}
	_ = s.repo.UpdateMembersCount(ctx, chatID)
	return nil
}

func (s *Service) KickMember(ctx context.Context, requesterID, chatID, targetUserID uuid.UUID) error {
	member, err := s.repo.GetMember(ctx, chatID, requesterID)
	if err != nil {
		return ErrNotMember
	}
	if member.Role != models.MemberRoleOwner && member.Role != models.MemberRoleAdmin {
		return ErrPermissionDenied
	}
	if err := s.repo.RemoveMember(ctx, chatID, targetUserID); err != nil {
		return err
	}
	_ = s.repo.UpdateMembersCount(ctx, chatID)
	return nil
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

	// When forwarding, embed original sender info
	if in.ForwardFromID != nil {
		if origMsg, err := s.repo.GetMessageByID(ctx, *in.ForwardFromID); err == nil && origMsg.SenderID != nil {
			if origUser, err := s.repo.GetUserByID(ctx, *origMsg.SenderID); err == nil {
				pub := origUser.ToPublic()
				msg.ForwardSender = &pub
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

func (s *Service) UpdateGroup(ctx context.Context, requesterID, chatID uuid.UUID, title, description *string, isPublic *bool) error {
	member, err := s.repo.GetMember(ctx, chatID, requesterID)
	if err != nil {
		return ErrNotMember
	}
	if member.Role != models.MemberRoleOwner && member.Role != models.MemberRoleAdmin {
		return ErrPermissionDenied
	}
	return s.repo.UpdateChat(ctx, chatID, title, description, isPublic)
}

func (s *Service) DeleteGroup(ctx context.Context, requesterID, chatID uuid.UUID) error {
	member, err := s.repo.GetMember(ctx, chatID, requesterID)
	if err != nil {
		return ErrNotMember
	}
	if member.Role != models.MemberRoleOwner {
		return ErrPermissionDenied
	}
	return s.repo.DeleteChat(ctx, chatID)
}

// ============================================================
// INVITE LINKS
// ============================================================

func (s *Service) GetOrGenerateInviteLink(ctx context.Context, requesterID, chatID uuid.UUID) (string, error) {
	member, err := s.repo.GetMember(ctx, chatID, requesterID)
	if err != nil {
		return "", ErrNotMember
	}
	if member.Role != models.MemberRoleOwner && member.Role != models.MemberRoleAdmin {
		return "", ErrPermissionDenied
	}
	chat, err := s.repo.GetChatByID(ctx, chatID)
	if err != nil {
		return "", err
	}
	if chat.InviteLink != nil && *chat.InviteLink != "" {
		return *chat.InviteLink, nil
	}
	return s.generateInviteLink(ctx, chatID)
}

func (s *Service) RegenerateInviteLink(ctx context.Context, requesterID, chatID uuid.UUID) (string, error) {
	member, err := s.repo.GetMember(ctx, chatID, requesterID)
	if err != nil {
		return "", ErrNotMember
	}
	if member.Role != models.MemberRoleOwner && member.Role != models.MemberRoleAdmin {
		return "", ErrPermissionDenied
	}
	return s.generateInviteLink(ctx, chatID)
}

func (s *Service) generateInviteLink(ctx context.Context, chatID uuid.UUID) (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	link := "https://zlp.me/join/" + hex.EncodeToString(b)
	if err := s.repo.SetInviteLink(ctx, chatID, link); err != nil {
		return "", err
	}
	return link, nil
}

// ============================================================
// PERMISSIONS
// ============================================================

func (s *Service) GetPermissions(ctx context.Context, userID, chatID uuid.UUID) (*models.ChatPermissions, error) {
	if _, err := s.repo.GetMember(ctx, chatID, userID); err != nil {
		return nil, ErrNotMember
	}
	chat, err := s.repo.GetChatByID(ctx, chatID)
	if err != nil {
		return nil, err
	}
	perms := models.DefaultPermissions()
	if chat.Permissions != nil {
		_ = json.Unmarshal([]byte(*chat.Permissions), &perms)
	}
	return &perms, nil
}

func (s *Service) UpdatePermissions(ctx context.Context, requesterID, chatID uuid.UUID, perms models.ChatPermissions) error {
	member, err := s.repo.GetMember(ctx, chatID, requesterID)
	if err != nil {
		return ErrNotMember
	}
	if member.Role != models.MemberRoleOwner && member.Role != models.MemberRoleAdmin {
		return ErrPermissionDenied
	}
	b, err := json.Marshal(perms)
	if err != nil {
		return err
	}
	return s.repo.UpdatePermissions(ctx, chatID, string(b))
}

// ============================================================
// ADMIN MANAGEMENT
// ============================================================

func (s *Service) SetMemberRole(ctx context.Context, requesterID, chatID, targetID uuid.UUID, role models.MemberRole, title *string) error {
	requester, err := s.repo.GetMember(ctx, chatID, requesterID)
	if err != nil {
		return ErrNotMember
	}
	if requester.Role != models.MemberRoleOwner && requester.Role != models.MemberRoleAdmin {
		return ErrPermissionDenied
	}
	// Only owner can promote to admin or demote admins
	if role == models.MemberRoleAdmin || role == models.MemberRoleOwner {
		if requester.Role != models.MemberRoleOwner {
			return ErrPermissionDenied
		}
	}
	target, err := s.repo.GetMember(ctx, chatID, targetID)
	if err != nil {
		return ErrNotMember
	}
	// Cannot change owner's role
	if target.Role == models.MemberRoleOwner {
		return ErrPermissionDenied
	}
	if err := s.repo.SetMemberRole(ctx, chatID, targetID, role, title); err != nil {
		return err
	}
	// Log action
	action := "promote"
	if role == models.MemberRoleMember {
		action = "demote"
	}
	_ = s.repo.LogAdminAction(ctx, &models.AdminAction{
		ID:       uuid.New(),
		ChatID:   chatID,
		ActorID:  requesterID,
		TargetID: &targetID,
		Action:   action,
	})
	return nil
}

func (s *Service) GetAdminActions(ctx context.Context, userID, chatID uuid.UUID, limit int) ([]models.AdminAction, error) {
	member, err := s.repo.GetMember(ctx, chatID, userID)
	if err != nil {
		return nil, ErrNotMember
	}
	if member.Role != models.MemberRoleOwner && member.Role != models.MemberRoleAdmin {
		return nil, ErrPermissionDenied
	}
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	return s.repo.GetAdminActions(ctx, chatID, limit)
}

func (s *Service) GetSharedFiles(ctx context.Context, userID, chatID uuid.UUID, limit, offset int) ([]models.Attachment, error) {
	if _, err := s.repo.GetMember(ctx, chatID, userID); err != nil {
		return nil, ErrNotMember
	}
	return s.repo.GetSharedFiles(ctx, chatID, limit, offset)
}
