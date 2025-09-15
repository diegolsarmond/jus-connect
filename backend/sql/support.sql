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
