CREATE TABLE IF NOT EXISTS asaas_credentials (
  id BIGSERIAL PRIMARY KEY,
  integration_api_key_id BIGINT UNIQUE REFERENCES integration_api_keys(id) ON DELETE CASCADE,
  webhook_secret TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  idempresa INTEGER REFERENCES public.empresas(id)
);

CREATE OR REPLACE FUNCTION set_asaas_credentials_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_asaas_credentials_updated_at ON asaas_credentials;
CREATE TRIGGER trg_asaas_credentials_updated_at
  BEFORE UPDATE ON asaas_credentials
  FOR EACH ROW
  EXECUTE FUNCTION set_asaas_credentials_updated_at();

ALTER TABLE asaas_credentials
  ADD COLUMN IF NOT EXISTS integration_api_key_id BIGINT REFERENCES integration_api_keys(id) ON DELETE CASCADE;

ALTER TABLE asaas_credentials
  ADD COLUMN IF NOT EXISTS webhook_secret TEXT;

ALTER TABLE asaas_credentials
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE asaas_credentials
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE asaas_credentials
  ADD CONSTRAINT IF NOT EXISTS asaas_credentials_integration_api_key_id_key UNIQUE (integration_api_key_id);

ALTER TABLE asaas_credentials
  ADD COLUMN IF NOT EXISTS idempresa INTEGER REFERENCES public.empresas(id);

ALTER TABLE asaas_credentials
  ADD CONSTRAINT IF NOT EXISTS asaas_credentials_empresas_fk FOREIGN KEY (idempresa) REFERENCES public.empresas(id);
