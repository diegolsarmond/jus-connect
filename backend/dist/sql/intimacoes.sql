-- Estrutura para armazenamento das intimações sincronizadas a partir de integrações externas
CREATE TABLE IF NOT EXISTS intimacoes (
  id BIGSERIAL PRIMARY KEY,
  origem TEXT NOT NULL DEFAULT 'projudi',
  external_id TEXT NOT NULL,
  numero_processo TEXT NULL,
  orgao TEXT NULL,
  assunto TEXT NULL,
  status TEXT NULL,
  prazo TIMESTAMPTZ NULL,
  recebida_em TIMESTAMPTZ NULL,
  fonte_criada_em TIMESTAMPTZ NULL,
  fonte_atualizada_em TIMESTAMPTZ NULL,
  payload JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_intimacoes_origem_external
  ON intimacoes (origem, external_id);

CREATE INDEX IF NOT EXISTS idx_intimacoes_status
  ON intimacoes (status)
  WHERE status IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_intimacoes_prazo
  ON intimacoes (prazo)
  WHERE prazo IS NOT NULL;

-- Atualiza automaticamente o campo updated_at a cada modificação
CREATE OR REPLACE FUNCTION set_intimacoes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_intimacoes_updated_at ON intimacoes;
CREATE TRIGGER trg_intimacoes_updated_at
  BEFORE UPDATE ON intimacoes
  FOR EACH ROW
  EXECUTE FUNCTION set_intimacoes_updated_at();
