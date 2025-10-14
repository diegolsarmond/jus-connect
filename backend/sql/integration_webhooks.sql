-- Estrutura para armazenamento de webhooks configurados pelas integrações
CREATE TABLE IF NOT EXISTS integration_webhooks (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  target_url TEXT NOT NULL,
  events TEXT[] NOT NULL DEFAULT '{}'::text[],
  secret TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  last_delivery TIMESTAMPTZ NULL,
  idempresa BIGINT REFERENCES public.empresas(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE integration_webhooks
  ADD COLUMN IF NOT EXISTS events TEXT[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE integration_webhooks
  ADD COLUMN IF NOT EXISTS target_url TEXT;

ALTER TABLE integration_webhooks
  ADD COLUMN IF NOT EXISTS secret TEXT;

ALTER TABLE integration_webhooks
  ADD COLUMN IF NOT EXISTS last_delivery TIMESTAMPTZ NULL;

ALTER TABLE integration_webhooks
  ADD COLUMN IF NOT EXISTS idempresa BIGINT REFERENCES public.empresas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_integration_webhooks_idempresa
  ON integration_webhooks (idempresa)
  WHERE idempresa IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_integration_webhooks_active
  ON integration_webhooks (active)
  WHERE active IS TRUE;

CREATE OR REPLACE FUNCTION set_integration_webhooks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_integration_webhooks_updated_at ON integration_webhooks;
CREATE TRIGGER trg_integration_webhooks_updated_at
  BEFORE UPDATE ON integration_webhooks
  FOR EACH ROW
  EXECUTE FUNCTION set_integration_webhooks_updated_at();
