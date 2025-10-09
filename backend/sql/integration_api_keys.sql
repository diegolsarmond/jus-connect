-- Estrutura para armazenamento de chaves de API das integrações
CREATE TABLE IF NOT EXISTS integration_api_keys (
  id BIGSERIAL PRIMARY KEY,
  provider TEXT NOT NULL CHECK (provider IN ('gemini', 'openai', 'asaas')),
  url_api TEXT NULL,
  key_value TEXT NOT NULL,
  environment TEXT NOT NULL CHECK (environment IN ('producao', 'homologacao')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  last_used TIMESTAMPTZ NULL,
  idempresa BIGINT REFERENCES public.empresas(id),
  global BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE integration_api_keys
  ADD COLUMN IF NOT EXISTS url_api TEXT;

ALTER TABLE integration_api_keys
  ADD COLUMN IF NOT EXISTS idempresa BIGINT REFERENCES public.empresas(id);

ALTER TABLE integration_api_keys
  ADD COLUMN IF NOT EXISTS global BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE integration_api_keys
  DROP CONSTRAINT IF EXISTS integration_api_keys_provider_check;

ALTER TABLE integration_api_keys
  ADD CONSTRAINT integration_api_keys_provider_check
  CHECK (provider IN ('gemini', 'openai', 'asaas'));

CREATE INDEX IF NOT EXISTS idx_integration_api_keys_provider
  ON integration_api_keys (provider);

CREATE INDEX IF NOT EXISTS idx_integration_api_keys_active
  ON integration_api_keys (active)
  WHERE active IS TRUE;

CREATE INDEX IF NOT EXISTS idx_integration_api_keys_global_true
  ON integration_api_keys (provider)
  WHERE global IS TRUE;

CREATE INDEX IF NOT EXISTS idx_integration_api_keys_idempresa
  ON integration_api_keys (idempresa)
  WHERE idempresa IS NOT NULL;

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
