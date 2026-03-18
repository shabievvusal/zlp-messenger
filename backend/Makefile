BINARY=bin/server
MAIN=cmd/server/main.go

.PHONY: run build tidy migrate-up migrate-down

run:
	go run $(MAIN)

build:
	go build -o $(BINARY) $(MAIN)

tidy:
	go mod tidy

migrate-up:
	go run $(MAIN) migrate up

migrate-down:
	go run $(MAIN) migrate down
