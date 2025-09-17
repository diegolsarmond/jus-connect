-- Configurações da integração com WAHA
CREATE TABLE IF NOT EXISTS waha_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  base_url TEXT NOT NULL,
  api_key TEXT NOT NULL,
  webhook_secret TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION set_waha_settings_timestamps()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_waha_settings_updated_at ON waha_settings;
CREATE TRIGGER trg_waha_settings_updated_at
  BEFORE UPDATE ON waha_settings
  FOR EACH ROW
  EXECUTE FUNCTION set_waha_settings_timestamps();
