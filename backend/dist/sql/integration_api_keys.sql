-- Estrutura para armazenamento de chaves de API das integrações
CREATE TABLE IF NOT EXISTS integration_api_keys (
  id BIGSERIAL PRIMARY KEY,
  provider TEXT NOT NULL CHECK (provider IN ('gemini', 'openai', 'waha')),
  key_value TEXT NOT NULL,
  environment TEXT NOT NULL CHECK (environment IN ('producao', 'homologacao')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  last_used TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_integration_api_keys_provider
  ON integration_api_keys (provider);

CREATE INDEX IF NOT EXISTS idx_integration_api_keys_active
  ON integration_api_keys (active)
  WHERE active IS TRUE;

-- Atualiza automaticamente o campo updated_at a cada modificação
CREATE OR REPLACE FUNCTION set_integration_api_keys_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_integration_api_keys_updated_at ON integration_api_keys;
CREATE TRIGGER trg_integration_api_keys_updated_at
  BEFORE UPDATE ON integration_api_keys
  FOR EACH ROW
  EXECUTE FUNCTION set_integration_api_keys_updated_at();
