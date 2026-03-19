package db

import (
	"context"
	"fmt"
	"log"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
	"github.com/spf13/viper"
)

// publicReadPolicy returns an S3-compatible bucket policy that allows
// anonymous GET on all objects — required so nginx can proxy media files
// to the browser without per-request MinIO authentication.
func publicReadPolicy(bucket string) string {
	return fmt.Sprintf(`{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {"AWS": ["*"]},
    "Action":    ["s3:GetObject"],
    "Resource":  ["arn:aws:s3:::%s/*"]
  }]
}`, bucket)
}

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
	ctx := context.Background()

	exists, err := client.BucketExists(ctx, bucket)
	if err != nil {
		return nil, fmt.Errorf("minio check bucket: %w", err)
	}

	if !exists {
		if err := client.MakeBucket(ctx, bucket, minio.MakeBucketOptions{}); err != nil {
			return nil, fmt.Errorf("minio create bucket: %w", err)
		}
		log.Printf("minio: bucket %q created", bucket)
	}

	// Apply public-read policy every startup so it survives container restarts
	if err := client.SetBucketPolicy(ctx, bucket, publicReadPolicy(bucket)); err != nil {
		log.Printf("minio: warn — could not set public-read policy on %q: %v", bucket, err)
	} else {
		log.Printf("minio: public-read policy applied to bucket %q", bucket)
	}

	return client, nil
}
