CREATE TABLE IF NOT EXISTS public.processos (
  id SERIAL PRIMARY KEY,
  cliente_id INTEGER NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  numero VARCHAR(30) NOT NULL,
  uf VARCHAR(2) NOT NULL,
  municipio VARCHAR(255) NOT NULL,
  orgao_julgador TEXT NOT NULL,
  tipo VARCHAR(100),
  status VARCHAR(100),
  classe_judicial TEXT,
  assunto TEXT,
  jurisdicao TEXT,
  advogado_responsavel TEXT,
  data_distribuicao TIMESTAMP WITHOUT TIME ZONE,
  criado_em TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
  idempresa INTEGER REFERENCES public.empresas(id)
);

CREATE INDEX IF NOT EXISTS idx_processos_cliente_id ON public.processos(cliente_id);
