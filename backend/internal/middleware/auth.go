package middleware

import (
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/zlp-messenger/backend/internal/auth"
)

func RequireAuth(c *fiber.Ctx) error {
	header := c.Get("Authorization")
	if header == "" {
		return fiber.NewError(fiber.StatusUnauthorized, "authorization required")
	}

	parts := strings.SplitN(header, " ", 2)
	if len(parts) != 2 || parts[0] != "Bearer" {
		return fiber.NewError(fiber.StatusUnauthorized, "invalid authorization format")
	}

	claims, err := auth.ParseAccessToken(parts[1])
	if err != nil {
		return fiber.NewError(fiber.StatusUnauthorized, "invalid or expired token")
	}

	c.Locals("user_id", claims.UserID)
	c.Locals("username", claims.Username)
	return c.Next()
}
