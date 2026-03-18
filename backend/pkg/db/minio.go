package db

import (
	"context"
	"fmt"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
	"github.com/spf13/viper"
)

func NewMinio() (*minio.Client, error) {
	client, err := minio.New(
		viper.GetString("MINIO_ENDPOINT"),
		&minio.Options{
			Creds:  credentials.NewStaticV4(viper.GetString("MINIO_ACCESS_KEY"), viper.GetString("MINIO_SECRET_KEY"), ""),
			Secure: viper.GetBool("MINIO_USE_SSL"),
		},
	)
	if err != nil {
		return nil, fmt.Errorf("minio init: %w", err)
	}

	bucket := viper.GetString("MINIO_BUCKET")
	exists, err := client.BucketExists(context.Background(), bucket)
	if err != nil {
		return nil, fmt.Errorf("minio check bucket: %w", err)
	}

	if !exists {
		if err := client.MakeBucket(context.Background(), bucket, minio.MakeBucketOptions{}); err != nil {
			return nil, fmt.Errorf("minio create bucket: %w", err)
		}
	}

	return client, nil
}
