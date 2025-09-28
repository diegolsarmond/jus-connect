CREATE TABLE IF NOT EXISTS asaas_charges (
  id BIGSERIAL PRIMARY KEY,
  financial_flow_id INTEGER NOT NULL REFERENCES financial_flows(id) ON DELETE CASCADE,
  cliente_id INTEGER REFERENCES public.clientes(id),
  integration_api_key_id BIGINT REFERENCES integration_api_keys(id),
  credential_id BIGINT REFERENCES asaas_credentials(id),
  asaas_charge_id TEXT NOT NULL,
  billing_type TEXT NOT NULL CHECK (billing_type IN ('PIX','BOLETO','CREDIT_CARD')),
  status TEXT NOT NULL,
  due_date DATE NOT NULL,
  value NUMERIC NOT NULL,
  invoice_url TEXT,
  last_event TEXT,
  payload JSONB,
  paid_at TIMESTAMPTZ,
  pix_payload TEXT,
  pix_qr_code TEXT,
  boleto_url TEXT,
  card_last4 TEXT,
  card_brand TEXT,
  raw_response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_asaas_charges_financial_flow UNIQUE (financial_flow_id)
);

CREATE INDEX IF NOT EXISTS idx_asaas_charges_asaas_charge_id
  ON asaas_charges (asaas_charge_id);

CREATE INDEX IF NOT EXISTS idx_asaas_charges_status
  ON asaas_charges (status);

CREATE OR REPLACE FUNCTION set_asaas_charges_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_asaas_charges_updated_at ON asaas_charges;
CREATE TRIGGER trg_asaas_charges_updated_at
  BEFORE UPDATE ON asaas_charges
  FOR EACH ROW
  EXECUTE FUNCTION set_asaas_charges_updated_at();

ALTER TABLE asaas_charges
  ADD COLUMN IF NOT EXISTS credential_id BIGINT REFERENCES asaas_credentials(id);

ALTER TABLE asaas_charges
  ADD COLUMN IF NOT EXISTS last_event TEXT;

ALTER TABLE asaas_charges
  ADD COLUMN IF NOT EXISTS payload JSONB;

ALTER TABLE asaas_charges
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
