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

	url := fmt.Sprintf("http://%s/%s/%s",
		viper.GetString("MINIO_ENDPOINT"), s.bucket, objectName)

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

	return fmt.Sprintf("http://%s/%s/%s",
		viper.GetString("MINIO_ENDPOINT"), s.bucket, objectName), nil
}

func detectType(mimeType, filename string) models.AttachmentType {
	mime := strings.ToLower(mimeType)
	ext := strings.ToLower(filepath.Ext(filename))

	switch {
	case strings.HasPrefix(mime, "image/gif") || ext == ".gif":
		return models.AttachmentTypeGIF
	case strings.HasPrefix(mime, "image/"):
		return models.AttachmentTypePhoto
	case strings.HasPrefix(mime, "video/"):
		return models.AttachmentTypeVideo
	case mime == "audio/ogg" || mime == "audio/webm" || ext == ".ogg":
		return models.AttachmentTypeVoice
	case strings.HasPrefix(mime, "audio/"):
		return models.AttachmentTypeAudio
	default:
		return models.AttachmentTypeDocument
	}
}
