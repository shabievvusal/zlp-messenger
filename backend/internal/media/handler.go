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
	notifier    chatpkg.Notifier
}

func NewHandler(service *Service, chatService *chatpkg.Service, chatRepo *chatpkg.Repository, notifier chatpkg.Notifier) *Handler {
	return &Handler{service: service, chatService: chatService, chatRepo: chatRepo, notifier: notifier}
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
				// Embed attachment before broadcasting so WS recipients see the media
				msg.Attachments = []models.Attachment{*attachment}
				if h.notifier != nil {
					h.notifier.BroadcastChat(chatID, "new_message", msg, &userID)
				}
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

// POST /api/media/upload-multiple
// Multipart: files[] + chat_id + text (optional) + reply_to_id (optional)
func (h *Handler) UploadMultiple(c *fiber.Ctx) error {
	userID := auth.GetUserIDFromCtx(c)

	chatIDStr := c.FormValue("chat_id")
	if chatIDStr == "" {
		return fiber.NewError(fiber.StatusBadRequest, "chat_id required")
	}

	chatID, err := uuid.Parse(chatIDStr)
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid chat_id")
	}

	// Get all files
	form, err := c.MultipartForm()
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid form data")
	}

	files := form.File["files"]
	if len(files) == 0 {
		return fiber.NewError(fiber.StatusBadRequest, "no files provided")
	}

	// Create message first
	textVal := c.FormValue("text")
	var text *string
	if textVal != "" {
		text = &textVal
	}

	var replyToID *uuid.UUID
	if replyToIDStr := c.FormValue("reply_to_id"); replyToIDStr != "" {
		if parsed, err := uuid.Parse(replyToIDStr); err == nil {
			replyToID = &parsed
		}
	}

	msg, err := h.chatService.SendMessage(c.Context(), userID, chatpkg.SendMessageInput{
		ChatID:    chatID,
		Type:      "text",
		Text:      text,
		ReplyToID: replyToID,
	})
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to create message")
	}

	// Upload all files and create attachments
	attachments := []models.Attachment{}
	for _, fileHeader := range files {
		if fileHeader.Size > 50*1024*1024 {
			continue // Skip files that are too large
		}

		result, uploadErr := h.service.Upload(c.Context(), fileHeader, userID)
		if uploadErr != nil {
			continue // Skip files that fail to upload
		}

		attachment := &models.Attachment{
			ID:        uuid.New(),
			MessageID: msg.ID,
			Type:      result.Type,
			URL:       result.URL,
			FileName:  &result.FileName,
			FileSize:  &result.Size,
			MimeType:  &result.MimeType,
		}

		if createErr := h.chatRepo.CreateAttachment(c.Context(), attachment); createErr == nil {
			attachments = append(attachments, *attachment)
		}
	}

	if len(attachments) == 0 {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to upload any files")
	}

	// Update message with attachments and broadcast
	msg.Attachments = attachments
	if h.notifier != nil {
		h.notifier.BroadcastChat(chatID, "new_message", msg, &userID)
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"message":     msg,
		"attachments": attachments,
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
