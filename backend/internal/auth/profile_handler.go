package auth

import (
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/zlp-messenger/backend/internal/models"
)

type ProfileHandler struct {
	repo *Repository
}

func NewProfileHandler(repo *Repository) *ProfileHandler {
	return &ProfileHandler{repo: repo}
}

// GET /api/users/:id
func (h *ProfileHandler) GetPublicUser(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid user id")
	}
	user, err := h.repo.GetUserByID(c.Context(), id)
	if err != nil {
		return fiber.NewError(fiber.StatusNotFound, "user not found")
	}
	return c.JSON(models.PublicUser{
		ID:        user.ID,
		Username:  user.Username,
		FirstName: user.FirstName,
		LastName:  user.LastName,
		Bio:       user.Bio,
		AvatarURL: user.AvatarURL,
		IsBot:     user.IsBot,
		LastSeen:  user.LastSeen,
	})
}

// PATCH /api/users/me
func (h *ProfileHandler) UpdateProfile(c *fiber.Ctx) error {
	userID := GetUserIDFromCtx(c)

	var body struct {
		FirstName string `json:"first_name"`
		LastName  string `json:"last_name"`
		Bio       string `json:"bio"`
	}
	if err := c.BodyParser(&body); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid body")
	}

	if err := h.repo.UpdateProfile(c.Context(), userID, body.FirstName, body.LastName, body.Bio); err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to update profile")
	}

	user, err := h.repo.GetUserByID(c.Context(), userID)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to fetch user")
	}

	return c.JSON(user)
}
