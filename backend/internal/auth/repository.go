package auth

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"github.com/zlp-messenger/backend/internal/models"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) CreateUser(ctx context.Context, u *models.User) error {
	query := `
		INSERT INTO users (id, username, email, phone, password, first_name, last_name)
		VALUES (:id, :username, :email, :phone, :password, :first_name, :last_name)
		RETURNING numeric_id, created_at, updated_at`
	rows, err := r.db.NamedQueryContext(ctx, query, u)
	if err != nil {
		return err
	}
	defer rows.Close()
	if rows.Next() {
		return rows.Scan(&u.NumericID, &u.CreatedAt, &u.UpdatedAt)
	}
	return nil
}

func (r *Repository) GetUserByID(ctx context.Context, id uuid.UUID) (*models.User, error) {
	var u models.User
	err := r.db.GetContext(ctx, &u, `SELECT * FROM users WHERE id = $1 AND is_banned = FALSE`, id)
	return &u, err
}

func (r *Repository) GetUserByUsername(ctx context.Context, username string) (*models.User, error) {
	var u models.User
	err := r.db.GetContext(ctx, &u, `SELECT * FROM users WHERE username = $1`, username)
	return &u, err
}

func (r *Repository) GetUserByEmail(ctx context.Context, email string) (*models.User, error) {
	var u models.User
	err := r.db.GetContext(ctx, &u, `SELECT * FROM users WHERE email = $1`, email)
	return &u, err
}

func (r *Repository) GetUserByPhone(ctx context.Context, phone string) (*models.User, error) {
	var u models.User
	err := r.db.GetContext(ctx, &u, `SELECT * FROM users WHERE phone = $1`, phone)
	return &u, err
}

func (r *Repository) CreateSession(ctx context.Context, s *models.Session) error {
	_, err := r.db.NamedExecContext(ctx, `
		INSERT INTO sessions (id, user_id, refresh_token, device_name, device_type, ip_address, user_agent, expires_at)
		VALUES (:id, :user_id, :refresh_token, :device_name, :device_type, :ip_address, :user_agent, :expires_at)`,
		s)
	return err
}

func (r *Repository) GetSessionByRefreshToken(ctx context.Context, token string) (*models.Session, error) {
	var s models.Session
	err := r.db.GetContext(ctx, &s, `SELECT * FROM sessions WHERE refresh_token = $1 AND expires_at > NOW()`, token)
	return &s, err
}

func (r *Repository) DeleteSession(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM sessions WHERE id = $1`, id)
	return err
}

func (r *Repository) DeleteAllUserSessions(ctx context.Context, userID uuid.UUID) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM sessions WHERE user_id = $1`, userID)
	return err
}

func (r *Repository) UpdateLastSeen(ctx context.Context, userID uuid.UUID) error {
	_, err := r.db.ExecContext(ctx, `UPDATE users SET last_seen = $1 WHERE id = $2`, time.Now(), userID)
	return err
}

func (r *Repository) UpdateAvatar(ctx context.Context, userID uuid.UUID, url string) error {
	_, err := r.db.ExecContext(ctx, `UPDATE users SET avatar_url = $1, updated_at = NOW() WHERE id = $2`, url, userID)
	return err
}

func (r *Repository) UpdateProfile(ctx context.Context, userID uuid.UUID, firstName, lastName, bio string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE users SET first_name = $1, last_name = $2, bio = $3, updated_at = NOW() WHERE id = $4`,
		firstName, lastName, bio, userID)
	return err
}
