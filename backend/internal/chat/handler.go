package chat

import (
	"strconv"
	"time"

	"github.com/go-playground/validator/v10"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/zlp-messenger/backend/internal/auth"
	"github.com/zlp-messenger/backend/internal/models"
)

type Handler struct {
	service  *Service
	validate *validator.Validate
	notifier Notifier
}

func NewHandler(service *Service, notifier Notifier) *Handler {
	return &Handler{service: service, validate: validator.New(), notifier: notifier}
}

// GET /api/chats
func (h *Handler) GetChats(c *fiber.Ctx) error {
	userID := auth.GetUserIDFromCtx(c)
	chats, err := h.service.GetUserChats(c.Context(), userID)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to get chats")
	}
	return c.JSON(chats)
}

// POST /api/chats/private
func (h *Handler) CreatePrivateChat(c *fiber.Ctx) error {
	userID := auth.GetUserIDFromCtx(c)
	var body struct {
		TargetID uuid.UUID `json:"target_id" validate:"required"`
	}
	if err := c.BodyParser(&body); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid body")
	}

	ch, err := h.service.GetOrCreatePrivateChat(c.Context(), userID, body.TargetID)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to create chat")
	}

	// Subscribe both users to the new chat for real-time events
	if h.notifier != nil {
		h.notifier.SubscribeToChat(userID, ch.ID)
		h.notifier.SubscribeToChat(body.TargetID, ch.ID)
	}

	return c.Status(fiber.StatusCreated).JSON(ch)
}

// POST /api/chats/group
func (h *Handler) CreateGroup(c *fiber.Ctx) error {
	userID := auth.GetUserIDFromCtx(c)
	var in CreateGroupInput
	if err := c.BodyParser(&in); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid body")
	}
	if err := h.validate.Struct(in); err != nil {
		return fiber.NewError(fiber.StatusUnprocessableEntity, err.Error())
	}

	chat, err := h.service.CreateGroup(c.Context(), userID, in)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to create group")
	}
	return c.Status(fiber.StatusCreated).JSON(chat)
}

// GET /api/chats/:chatID/members
func (h *Handler) GetMembers(c *fiber.Ctx) error {
	userID := auth.GetUserIDFromCtx(c)
	chatID, err := uuid.Parse(c.Params("chatID"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid chat id")
	}

	members, err := h.service.GetMembers(c.Context(), userID, chatID)
	if err != nil {
		switch err {
		case ErrNotMember:
			return fiber.NewError(fiber.StatusForbidden, "not a member")
		default:
			return fiber.NewError(fiber.StatusInternalServerError, "failed to get members")
		}
	}
	return c.JSON(members)
}

// GET /api/chats/:chatID/messages
func (h *Handler) GetMessages(c *fiber.Ctx) error {
	userID := auth.GetUserIDFromCtx(c)
	chatID, err := uuid.Parse(c.Params("chatID"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid chat id")
	}

	limit, _ := strconv.Atoi(c.Query("limit", "50"))
	offset, _ := strconv.Atoi(c.Query("offset", "0"))

	msgs, err := h.service.GetMessages(c.Context(), userID, chatID, limit, offset)
	if err != nil {
		switch err {
		case ErrNotMember:
			return fiber.NewError(fiber.StatusForbidden, "not a member")
		default:
			return fiber.NewError(fiber.StatusInternalServerError, "failed to get messages")
		}
	}
	return c.JSON(msgs)
}

// POST /api/chats/:chatID/messages
func (h *Handler) SendMessage(c *fiber.Ctx) error {
	userID := auth.GetUserIDFromCtx(c)
	chatID, err := uuid.Parse(c.Params("chatID"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid chat id")
	}

	var in SendMessageInput
	if err := c.BodyParser(&in); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid body")
	}
	in.ChatID = chatID

	msg, err := h.service.SendMessage(c.Context(), userID, in)
	if err != nil {
		switch err {
		case ErrNotMember, ErrPermissionDenied:
			return fiber.NewError(fiber.StatusForbidden, err.Error())
		default:
			return fiber.NewError(fiber.StatusInternalServerError, "failed to send message")
		}
	}

	if h.notifier != nil {
		h.notifier.BroadcastChat(chatID, "new_message", msg, &userID)
		// Notify each mentioned user individually
		for _, mentionedUID := range msg.MentionedUserIDs {
			h.notifier.NotifyUser(mentionedUID, "mention", map[string]any{
				"message_id": msg.ID,
				"chat_id":    msg.ChatID,
				"sender_id":  userID,
				"text":       msg.Text,
			})
		}
	}

	return c.Status(fiber.StatusCreated).JSON(msg)
}

// PATCH /api/messages/:msgID
func (h *Handler) EditMessage(c *fiber.Ctx) error {
	userID := auth.GetUserIDFromCtx(c)
	msgID, err := uuid.Parse(c.Params("msgID"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid message id")
	}

	var body struct {
		Text string `json:"text" validate:"required"`
	}
	if err := c.BodyParser(&body); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid body")
	}

	msg, err := h.service.EditMessage(c.Context(), userID, msgID, body.Text)
	if err != nil {
		switch err {
		case ErrPermissionDenied:
			return fiber.NewError(fiber.StatusForbidden, err.Error())
		case ErrMessageNotFound:
			return fiber.NewError(fiber.StatusNotFound, err.Error())
		default:
			return fiber.NewError(fiber.StatusInternalServerError, "failed to edit message")
		}
	}

	if h.notifier != nil {
		h.notifier.BroadcastChat(msg.ChatID, "message_edited", msg, nil)
	}

	return c.SendStatus(fiber.StatusNoContent)
}

// DELETE /api/messages/:msgID
func (h *Handler) DeleteMessage(c *fiber.Ctx) error {
	userID := auth.GetUserIDFromCtx(c)
	msgID, err := uuid.Parse(c.Params("msgID"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid message id")
	}

	msg, err := h.service.DeleteMessage(c.Context(), userID, msgID)
	if err != nil {
		switch err {
		case ErrPermissionDenied:
			return fiber.NewError(fiber.StatusForbidden, err.Error())
		case ErrMessageNotFound:
			return fiber.NewError(fiber.StatusNotFound, err.Error())
		default:
			return fiber.NewError(fiber.StatusInternalServerError, "failed to delete message")
		}
	}

	if h.notifier != nil {
		h.notifier.BroadcastChat(msg.ChatID, "message_deleted",
			map[string]any{"chat_id": msg.ChatID, "message_id": msg.ID}, nil)
	}

	return c.SendStatus(fiber.StatusNoContent)
}

// POST /api/messages/:msgID/react
func (h *Handler) AddReaction(c *fiber.Ctx) error {
	userID := auth.GetUserIDFromCtx(c)
	msgID, err := uuid.Parse(c.Params("msgID"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid message id")
	}

	var body struct {
		Emoji string `json:"emoji" validate:"required"`
	}
	if err := c.BodyParser(&body); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid body")
	}

	if err := h.service.AddReaction(c.Context(), userID, msgID, body.Emoji); err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to add reaction")
	}
	return c.SendStatus(fiber.StatusNoContent)
}

// DELETE /api/messages/:msgID/react
func (h *Handler) RemoveReaction(c *fiber.Ctx) error {
	userID := auth.GetUserIDFromCtx(c)
	msgID, err := uuid.Parse(c.Params("msgID"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid message id")
	}

	if err := h.service.RemoveReaction(c.Context(), userID, msgID); err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to remove reaction")
	}
	return c.SendStatus(fiber.StatusNoContent)
}

// PATCH /api/chats/:chatID/mute
func (h *Handler) MuteChat(c *fiber.Ctx) error {
	userID := auth.GetUserIDFromCtx(c)
	chatID, err := uuid.Parse(c.Params("chatID"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid chat id")
	}

	var body struct {
		Until *string `json:"until"`
	}
	_ = c.BodyParser(&body)

	var until *time.Time
	if body.Until != nil {
		t, err := time.Parse(time.RFC3339, *body.Until)
		if err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "invalid until format, use RFC3339")
		}
		until = &t
	}

	if err := h.service.MuteChat(c.Context(), userID, chatID, until); err != nil {
		if err == ErrNotMember {
			return fiber.NewError(fiber.StatusForbidden, err.Error())
		}
		return fiber.NewError(fiber.StatusInternalServerError, "mute failed")
	}
	return c.SendStatus(fiber.StatusNoContent)
}

// GET /api/chats/:chatID/media
func (h *Handler) GetSharedMedia(c *fiber.Ctx) error {
	userID := auth.GetUserIDFromCtx(c)
	chatID, err := uuid.Parse(c.Params("chatID"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid chat id")
	}

	mediaType := c.Query("type", "photo")
	limit, _ := strconv.Atoi(c.Query("limit", "20"))
	offset, _ := strconv.Atoi(c.Query("offset", "0"))
	if limit <= 0 || limit > 100 {
		limit = 20
	}

	var items interface{}
	if mediaType == "document" {
		items, err = h.service.GetSharedFiles(c.Context(), userID, chatID, limit, offset)
	} else {
		items, err = h.service.GetSharedMedia(c.Context(), userID, chatID, limit, offset)
	}
	if err != nil {
		if err == ErrNotMember {
			return fiber.NewError(fiber.StatusForbidden, err.Error())
		}
		return fiber.NewError(fiber.StatusInternalServerError, "failed to get media")
	}
	return c.JSON(items)
}

// POST /api/chats/:chatID/members
func (h *Handler) AddMember(c *fiber.Ctx) error {
	userID := auth.GetUserIDFromCtx(c)
	chatID, err := uuid.Parse(c.Params("chatID"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid chat id")
	}
	var body struct {
		UserID string `json:"user_id"`
	}
	if err := c.BodyParser(&body); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid body")
	}
	targetID, err := uuid.Parse(body.UserID)
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid user_id")
	}
	if err := h.service.AddMember(c.Context(), userID, chatID, targetID); err != nil {
		switch err {
		case ErrNotMember, ErrPermissionDenied:
			return fiber.NewError(fiber.StatusForbidden, err.Error())
		}
		return fiber.NewError(fiber.StatusInternalServerError, "failed to add member")
	}
	return c.SendStatus(fiber.StatusNoContent)
}

// DELETE /api/chats/:chatID/leave
func (h *Handler) LeaveChat(c *fiber.Ctx) error {
	userID := auth.GetUserIDFromCtx(c)
	chatID, err := uuid.Parse(c.Params("chatID"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid chat id")
	}
	if err := h.service.LeaveChat(c.Context(), userID, chatID); err != nil {
		return fiber.NewError(fiber.StatusForbidden, err.Error())
	}
	return c.SendStatus(fiber.StatusNoContent)
}

// DELETE /api/chats/:chatID/members/:userID
func (h *Handler) KickMember(c *fiber.Ctx) error {
	userID := auth.GetUserIDFromCtx(c)
	chatID, err := uuid.Parse(c.Params("chatID"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid chat id")
	}
	targetID, err := uuid.Parse(c.Params("userID"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid user id")
	}
	if err := h.service.KickMember(c.Context(), userID, chatID, targetID); err != nil {
		switch err {
		case ErrNotMember, ErrPermissionDenied:
			return fiber.NewError(fiber.StatusForbidden, err.Error())
		}
		return fiber.NewError(fiber.StatusInternalServerError, "failed to kick member")
	}
	return c.SendStatus(fiber.StatusNoContent)
}

// PATCH /api/chats/:chatID
func (h *Handler) UpdateGroup(c *fiber.Ctx) error {
	userID := auth.GetUserIDFromCtx(c)
	chatID, err := uuid.Parse(c.Params("chatID"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid chat id")
	}

	var body struct {
		Title       *string `json:"title"`
		Description *string `json:"description"`
		IsPublic    *bool   `json:"is_public"`
	}
	if err := c.BodyParser(&body); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid body")
	}

	if err := h.service.UpdateGroup(c.Context(), userID, chatID, body.Title, body.Description, body.IsPublic); err != nil {
		switch err {
		case ErrNotMember, ErrPermissionDenied:
			return fiber.NewError(fiber.StatusForbidden, err.Error())
		default:
			return fiber.NewError(fiber.StatusInternalServerError, "failed to update group")
		}
	}

	if h.notifier != nil {
		h.notifier.BroadcastChat(chatID, "chat_updated", map[string]any{
			"chat_id":     chatID,
			"title":       body.Title,
			"description": body.Description,
			"is_public":   body.IsPublic,
		}, nil)
	}

	return c.SendStatus(fiber.StatusNoContent)
}

// DELETE /api/chats/:chatID
func (h *Handler) DeleteGroup(c *fiber.Ctx) error {
	userID := auth.GetUserIDFromCtx(c)
	chatID, err := uuid.Parse(c.Params("chatID"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid chat id")
	}

	if err := h.service.DeleteGroup(c.Context(), userID, chatID); err != nil {
		switch err {
		case ErrNotMember, ErrPermissionDenied:
			return fiber.NewError(fiber.StatusForbidden, err.Error())
		default:
			return fiber.NewError(fiber.StatusInternalServerError, "failed to delete group")
		}
	}

	return c.SendStatus(fiber.StatusNoContent)
}

// GET /api/chats/:chatID/invite-link
func (h *Handler) GetInviteLink(c *fiber.Ctx) error {
	userID := auth.GetUserIDFromCtx(c)
	chatID, err := uuid.Parse(c.Params("chatID"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid chat id")
	}
	link, err := h.service.GetOrGenerateInviteLink(c.Context(), userID, chatID)
	if err != nil {
		switch err {
		case ErrNotMember, ErrPermissionDenied:
			return fiber.NewError(fiber.StatusForbidden, err.Error())
		default:
			return fiber.NewError(fiber.StatusInternalServerError, "failed to get invite link")
		}
	}
	return c.JSON(fiber.Map{"invite_link": link})
}

// POST /api/chats/:chatID/invite-link/reset
func (h *Handler) ResetInviteLink(c *fiber.Ctx) error {
	userID := auth.GetUserIDFromCtx(c)
	chatID, err := uuid.Parse(c.Params("chatID"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid chat id")
	}
	link, err := h.service.RegenerateInviteLink(c.Context(), userID, chatID)
	if err != nil {
		switch err {
		case ErrNotMember, ErrPermissionDenied:
			return fiber.NewError(fiber.StatusForbidden, err.Error())
		default:
			return fiber.NewError(fiber.StatusInternalServerError, "failed to reset invite link")
		}
	}
	return c.JSON(fiber.Map{"invite_link": link})
}

// GET /api/chats/:chatID/permissions
func (h *Handler) GetPermissions(c *fiber.Ctx) error {
	userID := auth.GetUserIDFromCtx(c)
	chatID, err := uuid.Parse(c.Params("chatID"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid chat id")
	}
	perms, err := h.service.GetPermissions(c.Context(), userID, chatID)
	if err != nil {
		return fiber.NewError(fiber.StatusForbidden, err.Error())
	}
	return c.JSON(perms)
}

// PATCH /api/chats/:chatID/permissions
func (h *Handler) UpdatePermissions(c *fiber.Ctx) error {
	userID := auth.GetUserIDFromCtx(c)
	chatID, err := uuid.Parse(c.Params("chatID"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid chat id")
	}
	var perms models.ChatPermissions
	if err := c.BodyParser(&perms); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid body")
	}
	if err := h.service.UpdatePermissions(c.Context(), userID, chatID, perms); err != nil {
		switch err {
		case ErrNotMember, ErrPermissionDenied:
			return fiber.NewError(fiber.StatusForbidden, err.Error())
		default:
			return fiber.NewError(fiber.StatusInternalServerError, "failed to update permissions")
		}
	}
	if h.notifier != nil {
		h.notifier.BroadcastChat(chatID, "permissions_updated", perms, nil)
	}
	return c.SendStatus(fiber.StatusNoContent)
}

// PATCH /api/chats/:chatID/members/:userID/role
func (h *Handler) SetMemberRole(c *fiber.Ctx) error {
	userID := auth.GetUserIDFromCtx(c)
	chatID, err := uuid.Parse(c.Params("chatID"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid chat id")
	}
	targetID, err := uuid.Parse(c.Params("userID"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid user id")
	}
	var body struct {
		Role  string  `json:"role"`
		Title *string `json:"title"`
	}
	if err := c.BodyParser(&body); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid body")
	}
	role := models.MemberRole(body.Role)
	if role != models.MemberRoleAdmin && role != models.MemberRoleMember {
		return fiber.NewError(fiber.StatusBadRequest, "role must be admin or member")
	}
	if err := h.service.SetMemberRole(c.Context(), userID, chatID, targetID, role, body.Title); err != nil {
		switch err {
		case ErrNotMember, ErrPermissionDenied:
			return fiber.NewError(fiber.StatusForbidden, err.Error())
		default:
			return fiber.NewError(fiber.StatusInternalServerError, "failed to set role")
		}
	}
	return c.SendStatus(fiber.StatusNoContent)
}

// GET /api/chats/:chatID/admin-actions
func (h *Handler) GetAdminActions(c *fiber.Ctx) error {
	userID := auth.GetUserIDFromCtx(c)
	chatID, err := uuid.Parse(c.Params("chatID"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid chat id")
	}
	limit, _ := strconv.Atoi(c.Query("limit", "50"))
	actions, err := h.service.GetAdminActions(c.Context(), userID, chatID, limit)
	if err != nil {
		switch err {
		case ErrNotMember, ErrPermissionDenied:
			return fiber.NewError(fiber.StatusForbidden, err.Error())
		default:
			return fiber.NewError(fiber.StatusInternalServerError, "failed to get admin actions")
		}
	}
	return c.JSON(actions)
}

// POST /api/chats/:chatID/read  — mark all messages in the chat as read
func (h *Handler) MarkAllRead(c *fiber.Ctx) error {
	userID := auth.GetUserIDFromCtx(c)
	chatID, err := uuid.Parse(c.Params("chatID"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid chat id")
	}
	senderIDs, err := h.service.MarkAllRead(c.Context(), userID, chatID)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to mark as read")
	}
	if h.notifier != nil {
		payload := map[string]any{"chat_id": chatID}
		for _, sid := range senderIDs {
			h.notifier.NotifyUser(sid, "chat_messages_read", payload)
		}
	}
	return c.SendStatus(fiber.StatusNoContent)
}

// GET /api/messages/:msgID/reads  — who has read this message
func (h *Handler) GetMessageReads(c *fiber.Ctx) error {
	msgID, err := uuid.Parse(c.Params("msgID"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid message id")
	}
	readers, err := h.service.GetMessageReads(c.Context(), msgID)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to get reads")
	}
	return c.JSON(readers)
}

// GET /api/chats/:chatID/messages/search
func (h *Handler) SearchMessages(c *fiber.Ctx) error {
	userID := auth.GetUserIDFromCtx(c)
	chatID, err := uuid.Parse(c.Params("chatID"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid chat id")
	}

	query := c.Query("q")
	if query == "" {
		return fiber.NewError(fiber.StatusBadRequest, "query required")
	}

	msgs, err := h.service.SearchMessages(c.Context(), userID, chatID, query)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "search failed")
	}
	return c.JSON(msgs)
}
