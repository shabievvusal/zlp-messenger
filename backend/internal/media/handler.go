package media

import (
	"github.com/gofiber/fiber/v2"
	"github.com/zlp-messenger/backend/internal/auth"
	chatpkg "github.com/zlp-messenger/backend/internal/chat"
	"github.com/zlp-messenger/backend/internal/models"
	"github.com/google/uuid"
)

type Handler struct {
	service     *Service
	chatService *chatpkg.Service
	chatRepo    *chatpkg.Repository
}

func NewHandler(service *Service, chatService *chatpkg.Service, chatRepo *chatpkg.Repository) *Handler {
	return &Handler{service: service, chatService: chatService, chatRepo: chatRepo}
}

// POST /api/media/upload
// Multipart: file + chat_id + message_type
func (h *Handler) Upload(c *fiber.Ctx) error {
	userID := auth.GetUserIDFromCtx(c)

	file, err := c.FormFile("file")
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "file required")
	}

	// 50MB limit
	if file.Size > 50*1024*1024 {
		return fiber.NewError(fiber.StatusRequestEntityTooLarge, "file too large (max 50MB)")
	}

	result, err := h.service.Upload(c.Context(), file, userID)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "upload failed")
	}

	// If chat_id provided — create message with attachment automatically
	chatIDStr := c.FormValue("chat_id")
	if chatIDStr != "" {
		chatID, parseErr := uuid.Parse(chatIDStr)
		if parseErr == nil {
			textVal := c.FormValue("caption")
			var text *string
			if textVal != "" {
				text = &textVal
			}

			msg, sendErr := h.chatService.SendMessage(c.Context(), userID, chatpkg.SendMessageInput{
				ChatID: chatID,
				Type:   string(result.Type),
				Text:   text,
			})
			if sendErr == nil {
				attachment := &models.Attachment{
					ID:        uuid.New(),
					MessageID: msg.ID,
					Type:      result.Type,
					URL:       result.URL,
					FileName:  &result.FileName,
					FileSize:  &result.Size,
					MimeType:  &result.MimeType,
				}
				_ = h.chatRepo.CreateAttachment(c.Context(), attachment)
				return c.Status(fiber.StatusCreated).JSON(fiber.Map{
					"message":    msg,
					"attachment": attachment,
				})
			}
		}
	}

	return c.JSON(fiber.Map{
		"url":       result.URL,
		"file_name": result.FileName,
		"size":      result.Size,
		"mime_type": result.MimeType,
		"type":      result.Type,
	})
}

// POST /api/media/avatar
func (h *Handler) UploadAvatar(c *fiber.Ctx) error {
	userID := auth.GetUserIDFromCtx(c)

	file, err := c.FormFile("file")
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "file required")
	}

	if file.Size > 5*1024*1024 {
		return fiber.NewError(fiber.StatusRequestEntityTooLarge, "avatar too large (max 5MB)")
	}

	url, err := h.service.UploadAvatar(c.Context(), file, userID)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "upload failed")
	}

	return c.JSON(fiber.Map{"avatar_url": url})
}
