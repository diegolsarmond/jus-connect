-- Estrutura para armazenamento de conversas e mensagens sincronizadas via WAHA
CREATE TABLE IF NOT EXISTS chat_conversations (
  id TEXT PRIMARY KEY,
  contact_identifier TEXT NOT NULL,
  contact_name TEXT,
  contact_avatar TEXT,
  short_status TEXT,
  description TEXT,
  pinned BOOLEAN NOT NULL DEFAULT FALSE,
  phone_number TEXT,
  responsible_id INTEGER,
  responsible_snapshot JSONB,
  tags JSONB,
  client_name TEXT,
  is_linked_to_client BOOLEAN NOT NULL DEFAULT FALSE,
  custom_attributes JSONB,
  is_private BOOLEAN NOT NULL DEFAULT FALSE,
  internal_notes JSONB,
  unread_count INTEGER NOT NULL DEFAULT 0,
  last_message_id TEXT,
  last_message_preview TEXT,
  last_message_timestamp TIMESTAMPTZ,
  last_message_sender TEXT,
  last_message_type TEXT,
  last_message_status TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES chat_conversations (id) ON DELETE CASCADE,
  external_id TEXT,
  sender TEXT NOT NULL,
  content TEXT NOT NULL,
  message_type TEXT NOT NULL,
  status TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  attachments JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_conversations_last_activity
  ON chat_conversations (last_message_timestamp DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_created
  ON chat_messages (conversation_id, created_at DESC);

CREATE OR REPLACE FUNCTION set_chat_conversations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_chat_conversations_updated_at ON chat_conversations;
CREATE TRIGGER trg_chat_conversations_updated_at
  BEFORE UPDATE ON chat_conversations
  FOR EACH ROW
  EXECUTE FUNCTION set_chat_conversations_updated_at();

-- Ensure legacy databases receive the new metadata columns used by the CRM
ALTER TABLE chat_conversations
  ADD COLUMN IF NOT EXISTS phone_number TEXT,
  ADD COLUMN IF NOT EXISTS responsible_id INTEGER,
  ADD COLUMN IF NOT EXISTS responsible_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS tags JSONB,
  ADD COLUMN IF NOT EXISTS client_name TEXT,
  ADD COLUMN IF NOT EXISTS is_linked_to_client BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS custom_attributes JSONB,
  ADD COLUMN IF NOT EXISTS is_private BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS internal_notes JSONB;
