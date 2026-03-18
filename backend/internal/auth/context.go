package auth

import (
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

func GetUserIDFromCtx(c *fiber.Ctx) uuid.UUID {
	return c.Locals("user_id").(uuid.UUID)
}

func GetUsernameFromCtx(c *fiber.Ctx) string {
	return c.Locals("username").(string)
}

// GetUserFromCtx returns a minimal user map for /me endpoint
func GetUserFromCtx(c *fiber.Ctx) fiber.Map {
	return fiber.Map{
		"id":       GetUserIDFromCtx(c),
		"username": GetUsernameFromCtx(c),
	}
}
