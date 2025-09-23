CREATE TABLE IF NOT EXISTS financial_flows (
  id SERIAL PRIMARY KEY,
  tipo TEXT NOT NULL CHECK (tipo IN ('receita','despesa')),
  conta_id INTEGER,
  categoria_id INTEGER,
  cliente_id INTEGER,
  fornecedor_id INTEGER,
  descricao TEXT NOT NULL,
  vencimento DATE NOT NULL,
  pagamento DATE,
  valor NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','pago')),
  external_provider TEXT,
  external_reference_id TEXT
);

ALTER TABLE financial_flows ADD COLUMN IF NOT EXISTS external_provider TEXT;
ALTER TABLE financial_flows ADD COLUMN IF NOT EXISTS external_reference_id TEXT;
ALTER TABLE financial_flows ADD COLUMN IF NOT EXISTS cliente_id INTEGER;
ALTER TABLE financial_flows ADD COLUMN IF NOT EXISTS fornecedor_id INTEGER;
