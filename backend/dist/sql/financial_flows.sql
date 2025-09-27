CREATE TABLE IF NOT EXISTS financial_flows (
  id SERIAL PRIMARY KEY,
  tipo TEXT NOT NULL CHECK (tipo IN ('receita','despesa')),
  conta_id INTEGER,
  categoria_id INTEGER,
  cliente_id INTEGER,
  fornecedor_id INTEGER,
  idempresa INTEGER REFERENCES public.empresas(id),
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
ALTER TABLE financial_flows ADD COLUMN IF NOT EXISTS idempresa INTEGER REFERENCES public.empresas(id);

DO $$
DECLARE
  legacy_column TEXT;
BEGIN
  FOR legacy_column IN
    SELECT cols.column_name AS legacy_column
      FROM information_schema.columns AS cols
     WHERE cols.table_schema = 'public'
       AND cols.table_name = 'financial_flows'
       AND cols.column_name IN ('empresa_id', 'empresa')
  LOOP
    EXECUTE format(
      'UPDATE public.financial_flows
          SET idempresa = TRIM(%1$I::text)::INTEGER
        WHERE idempresa IS NULL
          AND %1$I IS NOT NULL
          AND TRIM(%1$I::text) ~ ''^[0-9]+$''',
      legacy_column
    );
  END LOOP;
END $$;
