DROP TRIGGER IF EXISTS trigger_user_settings ON users;
DROP FUNCTION IF EXISTS create_user_settings;

DROP TABLE IF EXISTS chat_last_message;
DROP TABLE IF EXISTS user_settings;
DROP TABLE IF EXISTS stories;
DROP TABLE IF EXISTS call_participants;
DROP TABLE IF EXISTS calls;
DROP TABLE IF EXISTS poll_votes;
DROP TABLE IF EXISTS poll_options;
DROP TABLE IF EXISTS polls;
DROP TABLE IF EXISTS reactions;
DROP TABLE IF EXISTS message_reads;
DROP TABLE IF EXISTS attachments;
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS chat_members;
DROP TABLE IF EXISTS chats;
DROP TABLE IF EXISTS blocked_users;
DROP TABLE IF EXISTS contacts;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS users;

DROP TYPE IF EXISTS call_type;
DROP TYPE IF EXISTS call_status;
DROP TYPE IF EXISTS attachment_type;
DROP TYPE IF EXISTS message_type;
DROP TYPE IF EXISTS member_role;
DROP TYPE IF EXISTS chat_type;
