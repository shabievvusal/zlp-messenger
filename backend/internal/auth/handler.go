package auth

import (
	"github.com/go-playground/validator/v10"
	"github.com/gofiber/fiber/v2"
)

type Handler struct {
	service  *Service
	validate *validator.Validate
}

func NewHandler(service *Service) *Handler {
	return &Handler{
		service:  service,
		validate: validator.New(),
	}
}

// POST /api/auth/register
func (h *Handler) Register(c *fiber.Ctx) error {
	var in RegisterInput
	if err := c.BodyParser(&in); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid body")
	}
	if err := h.validate.Struct(in); err != nil {
		return fiber.NewError(fiber.StatusUnprocessableEntity, err.Error())
	}

	resp, err := h.service.Register(c.Context(), in)
	if err != nil {
		switch err {
		case ErrUserExists:
			return fiber.NewError(fiber.StatusConflict, err.Error())
		default:
			return fiber.NewError(fiber.StatusInternalServerError, "registration failed")
		}
	}

	setRefreshCookie(c, resp.RefreshToken)
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"access_token": resp.AccessToken,
		"user":         resp.User,
	})
}

// POST /api/auth/login
func (h *Handler) Login(c *fiber.Ctx) error {
	var in LoginInput
	if err := c.BodyParser(&in); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid body")
	}
	if err := h.validate.Struct(in); err != nil {
		return fiber.NewError(fiber.StatusUnprocessableEntity, err.Error())
	}

	deviceName := c.Get("X-Device-Name", "Unknown")
	deviceType := c.Get("X-Device-Type", "web")
	ip := c.IP()
	ua := c.Get("User-Agent")

	resp, err := h.service.Login(c.Context(), in, deviceName, deviceType, ip, ua)
	if err != nil {
		switch err {
		case ErrInvalidCredentials:
			return fiber.NewError(fiber.StatusUnauthorized, "invalid credentials")
		case ErrUserBanned:
			return fiber.NewError(fiber.StatusForbidden, "account banned")
		default:
			return fiber.NewError(fiber.StatusInternalServerError, "login failed")
		}
	}

	setRefreshCookie(c, resp.RefreshToken)
	return c.JSON(fiber.Map{
		"access_token": resp.AccessToken,
		"user":         resp.User,
	})
}

// POST /api/auth/refresh
func (h *Handler) Refresh(c *fiber.Ctx) error {
	refreshToken := c.Cookies("refresh_token")
	if refreshToken == "" {
		return fiber.NewError(fiber.StatusUnauthorized, "refresh token missing")
	}

	resp, err := h.service.RefreshTokens(c.Context(), refreshToken)
	if err != nil {
		return fiber.NewError(fiber.StatusUnauthorized, "session expired")
	}

	setRefreshCookie(c, resp.RefreshToken)
	return c.JSON(fiber.Map{
		"access_token": resp.AccessToken,
		"user":         resp.User,
	})
}

// POST /api/auth/logout
func (h *Handler) Logout(c *fiber.Ctx) error {
	refreshToken := c.Cookies("refresh_token")
	_ = h.service.Logout(c.Context(), refreshToken)
	c.ClearCookie("refresh_token")
	return c.SendStatus(fiber.StatusNoContent)
}

// GET /api/auth/me
func (h *Handler) Me(c *fiber.Ctx) error {
	user := GetUserFromCtx(c)
	return c.JSON(user)
}

func setRefreshCookie(c *fiber.Ctx, token string) {
	c.Cookie(&fiber.Cookie{
		Name:     "refresh_token",
		Value:    token,
		HTTPOnly: true,
		Secure:   false, // true in production
		SameSite: "Lax",
		MaxAge:   30 * 24 * 60 * 60,
	})
}
