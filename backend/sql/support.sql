CREATE TABLE IF NOT EXISTS support_requests (
  id SERIAL PRIMARY KEY,
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  requester_name TEXT,
  requester_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_requests_status ON support_requests (status);
CREATE INDEX IF NOT EXISTS idx_support_requests_created_at ON support_requests (created_at DESC);

CREATE TABLE IF NOT EXISTS support_request_messages (
  id SERIAL PRIMARY KEY,
  support_request_id INTEGER NOT NULL REFERENCES support_requests(id) ON DELETE CASCADE,
  sender TEXT NOT NULL CHECK (sender IN ('requester', 'support')),
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_request_messages_request ON support_request_messages (support_request_id);
CREATE INDEX IF NOT EXISTS idx_support_request_messages_created ON support_request_messages (created_at);

CREATE TABLE IF NOT EXISTS support_request_attachments (
  id SERIAL PRIMARY KEY,
  message_id INTEGER NOT NULL REFERENCES support_request_messages(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  content_type TEXT,
  file_size INTEGER,
  data BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_request_attachments_message ON support_request_attachments (message_id);
