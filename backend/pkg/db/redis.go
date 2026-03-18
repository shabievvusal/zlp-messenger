package db

import (
	"context"
	"fmt"

	"github.com/redis/go-redis/v9"
	"github.com/spf13/viper"
)

func NewRedis() (*redis.Client, error) {
	client := redis.NewClient(&redis.Options{
		Addr:     fmt.Sprintf("%s:%d", viper.GetString("REDIS_HOST"), viper.GetInt("REDIS_PORT")),
		Password: viper.GetString("REDIS_PASSWORD"),
		DB:       0,
	})

	if err := client.Ping(context.Background()).Err(); err != nil {
		return nil, fmt.Errorf("redis connect: %w", err)
	}

	return client, nil
}
