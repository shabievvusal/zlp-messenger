-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- for full-text search

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE users (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username    VARCHAR(32) UNIQUE NOT NULL,
    email       VARCHAR(255) UNIQUE,
    phone       VARCHAR(20) UNIQUE,
    password    VARCHAR(255) NOT NULL,
    first_name  VARCHAR(64) NOT NULL,
    last_name   VARCHAR(64),
    bio         TEXT,
    avatar_url  VARCHAR(512),
    is_bot      BOOLEAN DEFAULT FALSE,
    is_verified BOOLEAN DEFAULT FALSE,
    is_banned   BOOLEAN DEFAULT FALSE,
    last_seen   TIMESTAMPTZ,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_username ON users USING gin (username gin_trgm_ops);
CREATE INDEX idx_users_phone ON users (phone);
CREATE INDEX idx_users_email ON users (email);

-- ============================================================
-- SESSIONS
-- ============================================================
CREATE TABLE sessions (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token TEXT NOT NULL UNIQUE,
    device_name   VARCHAR(128),
    device_type   VARCHAR(32), -- web | desktop | android | ios
    ip_address    INET,
    user_agent    TEXT,
    expires_at    TIMESTAMPTZ NOT NULL,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sessions_user_id ON sessions (user_id);
CREATE INDEX idx_sessions_refresh_token ON sessions (refresh_token);

-- ============================================================
-- CONTACTS & BLOCKING
-- ============================================================
CREATE TABLE contacts (
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    contact_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    nickname    VARCHAR(64),
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, contact_id)
);

CREATE TABLE blocked_users (
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    blocked_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, blocked_id)
);

-- ============================================================
-- CHATS
-- ============================================================
CREATE TYPE chat_type AS ENUM ('private', 'group', 'channel', 'saved');

CREATE TABLE chats (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type          chat_type NOT NULL,
    title         VARCHAR(128),
    description   TEXT,
    username      VARCHAR(32) UNIQUE, -- public @username for groups/channels
    avatar_url    VARCHAR(512),
    invite_link   VARCHAR(128) UNIQUE,
    is_public     BOOLEAN DEFAULT FALSE,
    members_count INTEGER DEFAULT 0,
    created_by    UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_chats_username ON chats (username);
CREATE INDEX idx_chats_type ON chats (type);

-- ============================================================
-- CHAT MEMBERS
-- ============================================================
CREATE TYPE member_role AS ENUM ('owner', 'admin', 'member', 'restricted', 'left', 'banned');

CREATE TABLE chat_members (
    chat_id     UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role        member_role DEFAULT 'member',
    title       VARCHAR(32), -- custom admin title
    joined_at   TIMESTAMPTZ DEFAULT NOW(),
    muted_until TIMESTAMPTZ,
    PRIMARY KEY (chat_id, user_id)
);

CREATE INDEX idx_chat_members_user_id ON chat_members (user_id);

-- ============================================================
-- MESSAGES
-- ============================================================
CREATE TYPE message_type AS ENUM (
    'text', 'photo', 'video', 'voice', 'video_note',
    'audio', 'document', 'sticker', 'gif', 'location',
    'contact', 'poll', 'service'
);

CREATE TABLE messages (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chat_id         UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    sender_id       UUID REFERENCES users(id) ON DELETE SET NULL,
    type            message_type DEFAULT 'text',
    text            TEXT,
    reply_to_id     UUID REFERENCES messages(id) ON DELETE SET NULL,
    forward_from_id UUID REFERENCES messages(id) ON DELETE SET NULL,
    forward_chat_id UUID REFERENCES chats(id) ON DELETE SET NULL,
    is_edited       BOOLEAN DEFAULT FALSE,
    is_deleted      BOOLEAN DEFAULT FALSE,
    is_pinned       BOOLEAN DEFAULT FALSE,
    views           INTEGER DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    edited_at       TIMESTAMPTZ
);

CREATE INDEX idx_messages_chat_id ON messages (chat_id, created_at DESC);
CREATE INDEX idx_messages_sender_id ON messages (sender_id);
CREATE INDEX idx_messages_text ON messages USING gin (text gin_trgm_ops);

-- ============================================================
-- ATTACHMENTS
-- ============================================================
CREATE TYPE attachment_type AS ENUM ('photo', 'video', 'audio', 'voice', 'document', 'sticker', 'gif');

CREATE TABLE attachments (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id  UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    type        attachment_type NOT NULL,
    url         VARCHAR(512) NOT NULL,
    file_name   VARCHAR(255),
    file_size   BIGINT,
    mime_type   VARCHAR(128),
    width       INTEGER,
    height      INTEGER,
    duration    INTEGER, -- seconds (audio/video)
    thumbnail   VARCHAR(512),
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_attachments_message_id ON attachments (message_id);

-- ============================================================
-- MESSAGE READS (delivery + read receipts)
-- ============================================================
CREATE TABLE message_reads (
    message_id  UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    read_at     TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (message_id, user_id)
);

-- ============================================================
-- REACTIONS
-- ============================================================
CREATE TABLE reactions (
    message_id  UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    emoji       VARCHAR(16) NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (message_id, user_id)
);

-- ============================================================
-- POLLS
-- ============================================================
CREATE TABLE polls (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id  UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    question    TEXT NOT NULL,
    is_quiz     BOOLEAN DEFAULT FALSE,
    is_closed   BOOLEAN DEFAULT FALSE,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE poll_options (
    id      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    poll_id UUID NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
    text    VARCHAR(100) NOT NULL,
    votes   INTEGER DEFAULT 0
);

CREATE TABLE poll_votes (
    poll_id    UUID NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
    option_id  UUID NOT NULL REFERENCES poll_options(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (poll_id, user_id)
);

-- ============================================================
-- CALLS
-- ============================================================
CREATE TYPE call_status AS ENUM ('ringing', 'active', 'ended', 'missed', 'declined');
CREATE TYPE call_type AS ENUM ('voice', 'video', 'group_voice');

CREATE TABLE calls (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chat_id     UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    initiated_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type        call_type NOT NULL,
    status      call_status DEFAULT 'ringing',
    started_at  TIMESTAMPTZ,
    ended_at    TIMESTAMPTZ,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE call_participants (
    call_id     UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at   TIMESTAMPTZ,
    left_at     TIMESTAMPTZ,
    PRIMARY KEY (call_id, user_id)
);

-- ============================================================
-- STORIES
-- ============================================================
CREATE TABLE stories (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    media_url   VARCHAR(512) NOT NULL,
    media_type  VARCHAR(16) NOT NULL, -- photo | video
    text        TEXT,
    views       INTEGER DEFAULT 0,
    expires_at  TIMESTAMPTZ NOT NULL, -- 24 hours
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_stories_user_id ON stories (user_id, expires_at);

-- ============================================================
-- USER SETTINGS / PRIVACY
-- ============================================================
CREATE TABLE user_settings (
    user_id             UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    -- Privacy
    phone_visibility    VARCHAR(16) DEFAULT 'contacts', -- everyone | contacts | nobody
    last_seen_visibility VARCHAR(16) DEFAULT 'everyone',
    avatar_visibility   VARCHAR(16) DEFAULT 'everyone',
    -- Notifications
    notifications_enabled BOOLEAN DEFAULT TRUE,
    -- Theme
    theme               VARCHAR(16) DEFAULT 'system', -- light | dark | system
    language            VARCHAR(8) DEFAULT 'en',
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-insert settings on user create
CREATE OR REPLACE FUNCTION create_user_settings()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_settings (user_id) VALUES (NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_user_settings
AFTER INSERT ON users
FOR EACH ROW EXECUTE FUNCTION create_user_settings();

-- ============================================================
-- CHAT LAST MESSAGE (denormalized for sidebar performance)
-- ============================================================
CREATE TABLE chat_last_message (
    chat_id     UUID PRIMARY KEY REFERENCES chats(id) ON DELETE CASCADE,
    message_id  UUID REFERENCES messages(id) ON DELETE SET NULL,
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);
