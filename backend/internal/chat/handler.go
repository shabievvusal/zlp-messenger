package chat

import (
	"strconv"

	"github.com/go-playground/validator/v10"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/zlp-messenger/backend/internal/auth"
)

type Handler struct {
	service  *Service
	validate *validator.Validate
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service, validate: validator.New()}
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

	chat, err := h.service.GetOrCreatePrivateChat(c.Context(), userID, body.TargetID)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to create chat")
	}
	return c.Status(fiber.StatusCreated).JSON(chat)
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

	if err := h.service.EditMessage(c.Context(), userID, msgID, body.Text); err != nil {
		switch err {
		case ErrPermissionDenied:
			return fiber.NewError(fiber.StatusForbidden, err.Error())
		case ErrMessageNotFound:
			return fiber.NewError(fiber.StatusNotFound, err.Error())
		default:
			return fiber.NewError(fiber.StatusInternalServerError, "failed to edit message")
		}
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

	if err := h.service.DeleteMessage(c.Context(), userID, msgID); err != nil {
		switch err {
		case ErrPermissionDenied:
			return fiber.NewError(fiber.StatusForbidden, err.Error())
		case ErrMessageNotFound:
			return fiber.NewError(fiber.StatusNotFound, err.Error())
		default:
			return fiber.NewError(fiber.StatusInternalServerError, "failed to delete message")
		}
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
