FROM golang:1.22-alpine AS builder

WORKDIR /app

RUN apk add --no-cache git

# Копируем только go.mod сначала (go.sum сгенерируется сам)
COPY go.mod ./
COPY . .

# go mod tidy скачает зависимости и создаст go.sum
RUN go mod tidy && \
    CGO_ENABLED=0 GOOS=linux go build -o /server ./cmd/server/main.go

# ── Runtime image ──────────────────────────────────────────────
FROM alpine:3.19

RUN apk add --no-cache ca-certificates tzdata

WORKDIR /app

COPY --from=builder /server .
COPY migrations/ ./migrations/

EXPOSE 8080

CMD ["./server"]
