package auth

import (
	"context"
	"fmt"

	"github.com/jmoiron/sqlx"
	"github.com/zlp-messenger/backend/internal/models"
)

type SearchRepository struct {
	db *sqlx.DB
}

func NewSearchRepository(db *sqlx.DB) *SearchRepository {
	return &SearchRepository{db: db}
}

func (r *SearchRepository) SearchUsers(ctx context.Context, query string, limit int) ([]models.PublicUser, error) {
	if limit <= 0 || limit > 50 {
		limit = 20
	}
	pattern := fmt.Sprintf("%%%s%%", query)

	rows, err := r.db.QueryxContext(ctx, `
		SELECT id, numeric_id, username, first_name, last_name, bio, avatar_url, is_bot, last_seen
		FROM users
		WHERE is_banned = FALSE
		  AND (
		    username ILIKE $1
		    OR first_name ILIKE $1
		    OR last_name ILIKE $1
		  )
		ORDER BY
		  CASE WHEN username ILIKE $2 THEN 0 ELSE 1 END,
		  username
		LIMIT $3`,
		pattern, query, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []models.PublicUser
	for rows.Next() {
		var u models.User
		if err := rows.StructScan(&u); err != nil {
			continue
		}
		users = append(users, u.ToPublic())
	}
	return users, nil
}
