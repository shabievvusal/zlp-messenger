package main

import (
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
	fiberws "github.com/gofiber/websocket/v2"
	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	"github.com/spf13/viper"

	"github.com/zlp-messenger/backend/internal/auth"
	"github.com/zlp-messenger/backend/internal/chat"
	"github.com/zlp-messenger/backend/internal/media"
	"github.com/zlp-messenger/backend/internal/middleware"
	"github.com/zlp-messenger/backend/internal/ws"
	"github.com/zlp-messenger/backend/pkg/db"
)

func main() {
	loadConfig()

	// ── Database connections ──────────────────────────────────
	postgres, err := db.NewPostgres()
	if err != nil {
		log.Fatalf("postgres: %v", err)
	}
	defer postgres.Close()

	redisClient, err := db.NewRedis()
	if err != nil {
		log.Fatalf("redis: %v", err)
	}
	defer redisClient.Close()

	minioClient, err := db.NewMinio()
	if err != nil {
		log.Fatalf("minio: %v", err)
	}

	// ── Run migrations ────────────────────────────────────────
	runMigrations()

	// ── Services ──────────────────────────────────────────────
	authRepo := auth.NewRepository(postgres)
	authService := auth.NewService(authRepo)
	authHandler := auth.NewHandler(authService)

	chatRepo := chat.NewRepository(postgres)
	chatService := chat.NewService(chatRepo)
	chatHandler := chat.NewHandler(chatService)

	mediaService := media.NewService(minioClient)
	mediaHandler := media.NewHandler(mediaService, chatService, chatRepo)

	hub := ws.NewHub(chatService, redisClient)
	go hub.Run()
	wsHandler := ws.NewHandler(hub)

	// ── Fiber app ─────────────────────────────────────────────
	app := fiber.New(fiber.Config{
		ErrorHandler: errorHandler,
		BodyLimit:    50 * 1024 * 1024, // 50MB
	})

	app.Use(recover.New())
	app.Use(logger.New(logger.Config{
		Format: "[${time}] ${status} ${method} ${path} - ${latency}\n",
	}))
	app.Use(cors.New(cors.Config{
		AllowOrigins:     viper.GetString("CORS_ORIGINS"),
		AllowHeaders:     "Origin, Content-Type, Accept, Authorization, X-Device-Name, X-Device-Type",
		AllowMethods:     "GET, POST, PUT, PATCH, DELETE, OPTIONS",
		AllowCredentials: true,
	}))

	// ── Routes ────────────────────────────────────────────────
	api := app.Group("/api")

	// Auth (public)
	authGroup := api.Group("/auth")
	authGroup.Post("/register", authHandler.Register)
	authGroup.Post("/login", authHandler.Login)
	authGroup.Post("/refresh", authHandler.Refresh)
	authGroup.Post("/logout", authHandler.Logout)

	// Auth (protected)
	protected := api.Group("", middleware.RequireAuth)

	protected.Get("/auth/me", authHandler.Me)

	// Chats
	protected.Get("/chats", chatHandler.GetChats)
	protected.Post("/chats/private", chatHandler.CreatePrivateChat)
	protected.Post("/chats/group", chatHandler.CreateGroup)

	protected.Get("/chats/:chatID/messages", chatHandler.GetMessages)
	protected.Post("/chats/:chatID/messages", chatHandler.SendMessage)
	protected.Get("/chats/:chatID/messages/search", chatHandler.SearchMessages)

	protected.Patch("/messages/:msgID", chatHandler.EditMessage)
	protected.Delete("/messages/:msgID", chatHandler.DeleteMessage)
	protected.Post("/messages/:msgID/react", chatHandler.AddReaction)
	protected.Delete("/messages/:msgID/react", chatHandler.RemoveReaction)

	// Media
	protected.Post("/media/upload", mediaHandler.Upload)
	protected.Post("/media/avatar", mediaHandler.UploadAvatar)

	// WebSocket
	app.Use("/ws", wsHandler.Upgrade)
	app.Get("/ws", fiberws.New(wsHandler.Handle))

	// Health check
	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok"})
	})

	// ── Graceful shutdown ─────────────────────────────────────
	port := viper.GetString("SERVER_PORT")
	if port == "" {
		port = "8080"
	}

	go func() {
		if err := app.Listen(":" + port); err != nil {
			log.Fatalf("server: %v", err)
		}
	}()

	log.Printf("🚀 ZLP Messenger backend running on :%s", port)

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down...")
	_ = app.Shutdown()
}

func loadConfig() {
	viper.SetConfigFile(".env")
	viper.AutomaticEnv()

	_ = viper.ReadInConfig()

	// Defaults
	viper.SetDefault("SERVER_PORT", "8080")
	viper.SetDefault("POSTGRES_HOST", "localhost")
	viper.SetDefault("POSTGRES_PORT", 5432)
	viper.SetDefault("POSTGRES_DB", "zlp_messenger")
	viper.SetDefault("POSTGRES_USER", "zlp")
	viper.SetDefault("POSTGRES_PASSWORD", "zlp_secret")
	viper.SetDefault("REDIS_HOST", "localhost")
	viper.SetDefault("REDIS_PORT", 6379)
	viper.SetDefault("MINIO_ENDPOINT", "localhost:9000")
	viper.SetDefault("MINIO_ACCESS_KEY", "minioadmin")
	viper.SetDefault("MINIO_SECRET_KEY", "minioadmin")
	viper.SetDefault("MINIO_BUCKET", "zlp-media")
	viper.SetDefault("MINIO_USE_SSL", false)
	viper.SetDefault("JWT_SECRET", "change_me_in_production")
	viper.SetDefault("JWT_ACCESS_TTL", "15m")
	viper.SetDefault("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000")
}

func runMigrations() {
	dsn := fmt.Sprintf(
		"postgres://%s:%s@%s:%d/%s?sslmode=disable",
		viper.GetString("POSTGRES_USER"),
		viper.GetString("POSTGRES_PASSWORD"),
		viper.GetString("POSTGRES_HOST"),
		viper.GetInt("POSTGRES_PORT"),
		viper.GetString("POSTGRES_DB"),
	)

	m, err := migrate.New("file://migrations", dsn)
	if err != nil {
		log.Fatalf("migrate init: %v", err)
	}

	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
		log.Fatalf("migrate up: %v", err)
	}

	log.Println("✅ Migrations applied")
}

func errorHandler(c *fiber.Ctx, err error) error {
	code := fiber.StatusInternalServerError
	msg := "internal server error"

	if e, ok := err.(*fiber.Error); ok {
		code = e.Code
		msg = e.Message
	}

	return c.Status(code).JSON(fiber.Map{"error": msg})
}
