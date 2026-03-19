-- Sequences for numeric IDs (start high to look realistic)
CREATE SEQUENCE IF NOT EXISTS user_numeric_id_seq START WITH 100000000 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS chat_numeric_id_seq START WITH 100000000 INCREMENT BY 1;

-- Add numeric_id columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS numeric_id BIGINT UNIQUE DEFAULT NULL;
ALTER TABLE chats ADD COLUMN IF NOT EXISTS numeric_id BIGINT UNIQUE DEFAULT NULL;

-- Populate existing rows
UPDATE users SET numeric_id = nextval('user_numeric_id_seq') WHERE numeric_id IS NULL;
UPDATE chats SET numeric_id = nextval('chat_numeric_id_seq') WHERE numeric_id IS NULL;

-- Make non-nullable with default for new rows
ALTER TABLE users ALTER COLUMN numeric_id SET DEFAULT nextval('user_numeric_id_seq');
ALTER TABLE chats ALTER COLUMN numeric_id SET DEFAULT nextval('chat_numeric_id_seq');
