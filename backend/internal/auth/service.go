package auth

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/zlp-messenger/backend/internal/models"
	"golang.org/x/crypto/bcrypt"
)

var (
	ErrUserExists        = errors.New("user already exists")
	ErrInvalidCredentials = errors.New("invalid credentials")
	ErrUserBanned        = errors.New("user is banned")
	ErrSessionExpired    = errors.New("session expired")
)

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

type RegisterInput struct {
	Username  string  `json:"username" validate:"required,min=3,max=32,alphanum"`
	Email     *string `json:"email" validate:"omitempty,email"`
	Phone     *string `json:"phone" validate:"omitempty"`
	Password  string  `json:"password" validate:"required,min=8"`
	FirstName string  `json:"first_name" validate:"required,max=64"`
	LastName  *string `json:"last_name" validate:"omitempty,max=64"`
}

type LoginInput struct {
	Login    string `json:"login" validate:"required"` // username | email | phone
	Password string `json:"password" validate:"required"`
}

type AuthResponse struct {
	AccessToken  string      `json:"access_token"`
	RefreshToken string      `json:"refresh_token"`
	User         models.User `json:"user"`
}

func (s *Service) Register(ctx context.Context, in RegisterInput) (*AuthResponse, error) {
	// Check username uniqueness
	if _, err := s.repo.GetUserByUsername(ctx, in.Username); err == nil {
		return nil, ErrUserExists
	}

	// Check email uniqueness
	if in.Email != nil {
		if _, err := s.repo.GetUserByEmail(ctx, *in.Email); err == nil {
			return nil, fmt.Errorf("email already in use")
		}
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(in.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("hash password: %w", err)
	}

	user := &models.User{
		ID:        uuid.New(),
		Username:  in.Username,
		Email:     in.Email,
		Phone:     in.Phone,
		Password:  string(hash),
		FirstName: in.FirstName,
		LastName:  in.LastName,
	}

	if err := s.repo.CreateUser(ctx, user); err != nil {
		return nil, fmt.Errorf("create user: %w", err)
	}

	return s.issueTokens(ctx, user, nil, nil, nil)
}

func (s *Service) Login(ctx context.Context, in LoginInput, deviceName, deviceType, ip, ua string) (*AuthResponse, error) {
	var (
		user *models.User
		err  error
	)

	// Try to find user by username, email, or phone
	user, err = s.repo.GetUserByUsername(ctx, in.Login)
	if err != nil {
		user, err = s.repo.GetUserByEmail(ctx, in.Login)
	}
	if err != nil {
		user, err = s.repo.GetUserByPhone(ctx, in.Login)
	}
	if err != nil {
		return nil, ErrInvalidCredentials
	}

	if user.IsBanned {
		return nil, ErrUserBanned
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(in.Password)); err != nil {
		return nil, ErrInvalidCredentials
	}

	dn := &deviceName
	dt := &deviceType
	ipPtr := &ip
	return s.issueTokens(ctx, user, dn, dt, ipPtr)
}

func (s *Service) RefreshTokens(ctx context.Context, refreshToken string) (*AuthResponse, error) {
	session, err := s.repo.GetSessionByRefreshToken(ctx, refreshToken)
	if err != nil {
		return nil, ErrSessionExpired
	}

	user, err := s.repo.GetUserByID(ctx, session.UserID)
	if err != nil {
		return nil, fmt.Errorf("get user: %w", err)
	}

	// Delete old session
	_ = s.repo.DeleteSession(ctx, session.ID)

	return s.issueTokens(ctx, user, session.DeviceName, session.DeviceType, session.IPAddress)
}

func (s *Service) Logout(ctx context.Context, refreshToken string) error {
	session, err := s.repo.GetSessionByRefreshToken(ctx, refreshToken)
	if err != nil {
		return nil // already gone
	}
	return s.repo.DeleteSession(ctx, session.ID)
}

func (s *Service) issueTokens(ctx context.Context, user *models.User, deviceName, deviceType, ip *string) (*AuthResponse, error) {
	accessToken, err := GenerateAccessToken(user.ID, user.Username)
	if err != nil {
		return nil, fmt.Errorf("generate access token: %w", err)
	}

	refreshToken := GenerateRefreshToken()

	session := &models.Session{
		ID:           uuid.New(),
		UserID:       user.ID,
		RefreshToken: refreshToken,
		DeviceName:   deviceName,
		DeviceType:   deviceType,
		IPAddress:    ip,
		ExpiresAt:    time.Now().Add(30 * 24 * time.Hour),
	}

	if err := s.repo.CreateSession(ctx, session); err != nil {
		return nil, fmt.Errorf("create session: %w", err)
	}

	_ = s.repo.UpdateLastSeen(ctx, user.ID)

	return &AuthResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		User:         *user,
	}, nil
}
