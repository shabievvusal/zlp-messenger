package media

import (
	"context"
	"fmt"
	"mime/multipart"
	"path/filepath"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/minio/minio-go/v7"
	"github.com/spf13/viper"
	"github.com/zlp-messenger/backend/internal/models"
)

type Service struct {
	client *minio.Client
	bucket string
}

func NewService(client *minio.Client) *Service {
	return &Service{
		client: client,
		bucket: viper.GetString("MINIO_BUCKET"),
	}
}

type UploadResult struct {
	URL      string
	FileName string
	Size     int64
	MimeType string
	Type     models.AttachmentType
}

func (s *Service) Upload(ctx context.Context, file *multipart.FileHeader, userID uuid.UUID) (*UploadResult, error) {
	src, err := file.Open()
	if err != nil {
		return nil, fmt.Errorf("open file: %w", err)
	}
	defer src.Close()

	mimeType := file.Header.Get("Content-Type")
	attachType := detectType(mimeType, file.Filename)

	// Build path: media/{type}/{year}/{month}/{uuid}.ext
	ext := filepath.Ext(file.Filename)
	now := time.Now()
	objectName := fmt.Sprintf("media/%s/%d/%02d/%s%s",
		attachType, now.Year(), now.Month(), uuid.New().String(), ext)

	_, err = s.client.PutObject(ctx, s.bucket, objectName, src, file.Size,
		minio.PutObjectOptions{ContentType: mimeType})
	if err != nil {
		return nil, fmt.Errorf("upload to minio: %w", err)
	}

	// Route through backend (/api/media/file/*) — backend has MinIO credentials,
	// so no bucket policy or nginx→MinIO proxy is needed.
	url := fmt.Sprintf("/api/media/file/%s", objectName)

	return &UploadResult{
		URL:      url,
		FileName: file.Filename,
		Size:     file.Size,
		MimeType: mimeType,
		Type:     attachType,
	}, nil
}

func (s *Service) UploadAvatar(ctx context.Context, file *multipart.FileHeader, userID uuid.UUID) (string, error) {
	src, err := file.Open()
	if err != nil {
		return "", err
	}
	defer src.Close()

	mimeType := file.Header.Get("Content-Type")
	ext := filepath.Ext(file.Filename)
	objectName := fmt.Sprintf("avatars/%s%s", userID.String(), ext)

	_, err = s.client.PutObject(ctx, s.bucket, objectName, src, file.Size,
		minio.PutObjectOptions{ContentType: mimeType})
	if err != nil {
		return "", err
	}

	return fmt.Sprintf("/api/media/file/%s", objectName), nil
}

// GetObject fetches a raw object from MinIO for streaming to the client.
func (s *Service) GetObject(ctx context.Context, objectPath string, rangeStart, rangeEnd int64) (interface{ Read([]byte) (int, error); Close() error }, *minio.ObjectInfo, error) {
	opts := minio.GetObjectOptions{}
	if rangeEnd > 0 {
		_ = opts.SetRange(rangeStart, rangeEnd)
	}
	obj, err := s.client.GetObject(ctx, s.bucket, objectPath, opts)
	if err != nil {
		return nil, nil, err
	}
	stat, err := obj.Stat()
	if err != nil {
		obj.Close()
		return nil, nil, err
	}
	return obj, &stat, nil
}

func detectType(mimeType, filename string) models.AttachmentType {
	mime := strings.ToLower(mimeType)
	ext := strings.ToLower(filepath.Ext(filename))
	base := strings.ToLower(filepath.Base(filename))

	// Voice recordings are named voice_*.ext by the frontend recorder
	if strings.HasPrefix(base, "voice_") {
		return models.AttachmentTypeVoice
	}

	switch {
	case strings.HasPrefix(mime, "image/gif") || ext == ".gif":
		return models.AttachmentTypeGIF
	case strings.HasPrefix(mime, "image/"):
		return models.AttachmentTypePhoto
	case strings.HasPrefix(mime, "video/"):
		return models.AttachmentTypeVideo
	// audio/webm;codecs=opus, audio/ogg;codecs=opus, audio/webm, audio/ogg, .webm, .ogg
	case strings.HasPrefix(mime, "audio/webm") || strings.HasPrefix(mime, "audio/ogg") ||
		ext == ".ogg" || ext == ".webm":
		return models.AttachmentTypeVoice
	case strings.HasPrefix(mime, "audio/"):
		return models.AttachmentTypeAudio
	default:
		return models.AttachmentTypeDocument
	}
}
