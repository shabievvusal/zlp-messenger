# ZLP Messenger

Telegram-like cross-platform messenger.

## Stack

| Layer | Technology |
|---|---|
| Web | React + Vite + TypeScript + Tailwind |
| Desktop | Tauri (planned) |
| Mobile | React Native / Expo (planned) |
| Backend | Go + Fiber |
| Realtime | WebSocket (gorilla) |
| Database | PostgreSQL |
| Cache | Redis |
| Media | MinIO (S3-compatible) |
| Queue | NATS |
| Calls | WebRTC + Coturn |

## Quick Start

### 1. Infrastructure

```bash
cp .env.example .env
cd infra
docker-compose up -d
```

### 2. Backend

```bash
cd backend
cp ../.env.example .env
go mod tidy
go run cmd/server/main.go
```

### 3. Web

```bash
cd apps/web
npm install
npm run dev
```

Open http://localhost:5173

## API

| Method | Path | Description |
|---|---|---|
| POST | /api/auth/register | Register |
| POST | /api/auth/login | Login |
| POST | /api/auth/refresh | Refresh tokens |
| POST | /api/auth/logout | Logout |
| GET | /api/auth/me | Current user |
| GET | /api/chats | My chats |
| POST | /api/chats/private | Open private chat |
| POST | /api/chats/group | Create group/channel |
| GET | /api/chats/:id/messages | Get messages |
| POST | /api/chats/:id/messages | Send message |
| PATCH | /api/messages/:id | Edit message |
| DELETE | /api/messages/:id | Delete message |
| POST | /api/messages/:id/react | Add reaction |
| DELETE | /api/messages/:id/react | Remove reaction |
| GET | /api/chats/:id/messages/search | Search messages |
| POST | /api/media/upload | Upload file |
| POST | /api/media/avatar | Upload avatar |
| WS | /ws?token=... | WebSocket connection |

## WebSocket Events

**Client → Server:**
- `typing` / `stop_typing` — { chat_id }
- `mark_read` — { message_id }
- `webrtc_offer` / `webrtc_answer` / `webrtc_ice` — { target_user_id, call_id, data }

**Server → Client:**
- `new_message` — Message object
- `message_edited` / `message_deleted`
- `reaction`
- `user_online` / `user_offline`
- `user_typing` / `user_stop_typing`
- `message_read`
- `call_incoming` / `call_accepted` / `call_declined` / `call_ended`
- `call_webrtc` — WebRTC signaling
