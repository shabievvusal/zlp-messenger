FROM golang:1.22-alpine AS builder

WORKDIR /app

RUN apk add --no-cache git

COPY go.mod ./
# Скачиваем зависимости отдельным слоем (кэшируется)
RUN go mod download || true

COPY . .
# tidy + build
RUN go mod tidy && \
    CGO_ENABLED=0 GOOS=linux go build -o /server ./cmd/server/main.go

# ── Runtime ────────────────────────────────────────────────────
FROM alpine:3.19

RUN apk add --no-cache ca-certificates tzdata

WORKDIR /app
COPY --from=builder /server .
COPY migrations/ ./migrations/

EXPOSE 8080
CMD ["./server"]
