CREATE TABLE IF NOT EXISTS public.processos (
  id SERIAL PRIMARY KEY,
  cliente_id INTEGER NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  numero VARCHAR(30) NOT NULL,
  uf VARCHAR(2) NOT NULL,
  municipio VARCHAR(255) NOT NULL,
  orgao_julgador TEXT,
  tipo VARCHAR(100),
  status VARCHAR(100),
  classe_judicial TEXT,
  assunto TEXT,
  jurisdicao TEXT,
  oportunidade_id INTEGER REFERENCES public.oportunidades(id),
  advogado_responsavel TEXT,
  data_distribuicao TIMESTAMP WITHOUT TIME ZONE,
  criado_em TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
  idempresa INTEGER REFERENCES public.empresas(id),
  ultima_sincronizacao TIMESTAMP WITHOUT TIME ZONE,
  consultas_api_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_processos_cliente_id ON public.processos(cliente_id);

CREATE TABLE IF NOT EXISTS public.processo_advogados (
  id SERIAL PRIMARY KEY,
  processo_id INTEGER NOT NULL REFERENCES public.processos(id) ON DELETE CASCADE,
  usuario_id INTEGER NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  criado_em TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE (processo_id, usuario_id)
);

CREATE INDEX IF NOT EXISTS idx_processo_advogados_processo_id ON public.processo_advogados(processo_id);
CREATE INDEX IF NOT EXISTS idx_processo_advogados_usuario_id ON public.processo_advogados(usuario_id);

CREATE TABLE IF NOT EXISTS public.processo_movimentacoes (
  id BIGINT PRIMARY KEY,
  processo_id INTEGER NOT NULL REFERENCES public.processos(id) ON DELETE CASCADE,
  data DATE,
  tipo VARCHAR(100),
  tipo_publicacao VARCHAR(255),
  classificacao_predita JSONB,
  conteudo TEXT,
  texto_categoria TEXT,
  fonte JSONB,
  criado_em TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_processo_movimentacoes_processo_id ON public.processo_movimentacoes(processo_id);
CREATE INDEX IF NOT EXISTS idx_processo_movimentacoes_data ON public.processo_movimentacoes(data);

CREATE TABLE IF NOT EXISTS public.processo_consultas_api (
  id SERIAL PRIMARY KEY,
  processo_id INTEGER NOT NULL REFERENCES public.processos(id) ON DELETE CASCADE,
  consultado_em TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
  sucesso BOOLEAN NOT NULL DEFAULT TRUE,
  detalhes TEXT
);

CREATE INDEX IF NOT EXISTS idx_processo_consultas_api_processo_id ON public.processo_consultas_api(processo_id);
CREATE INDEX IF NOT EXISTS idx_processo_consultas_api_consultado_em ON public.processo_consultas_api(consultado_em);

ALTER TABLE public.processos
  ADD COLUMN IF NOT EXISTS judit_tracking_id TEXT,
  ADD COLUMN IF NOT EXISTS judit_tracking_hour_range TEXT;

CREATE TABLE IF NOT EXISTS public.processo_sync (
  id SERIAL PRIMARY KEY,
  processo_id INTEGER NOT NULL REFERENCES public.processos(id) ON DELETE CASCADE,
  provider VARCHAR(100) NOT NULL,
  status VARCHAR(50),
  tracking_id TEXT,
  hour_range TEXT,
  last_request_id TEXT,
  last_request_status VARCHAR(50),
  last_request_payload JSONB,
  last_synced_at TIMESTAMP WITHOUT TIME ZONE,
  criado_em TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE (processo_id, provider)
);

CREATE TABLE IF NOT EXISTS public.processo_sync_history (
  id SERIAL PRIMARY KEY,
  processo_id INTEGER NOT NULL REFERENCES public.processos(id) ON DELETE CASCADE,
  provider VARCHAR(100) NOT NULL,
  request_id TEXT,
  event_type VARCHAR(100),
  payload JSONB,
  criado_em TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_processo_sync_provider ON public.processo_sync(provider);
CREATE INDEX IF NOT EXISTS idx_processo_sync_history_provider ON public.processo_sync_history(provider);
CREATE INDEX IF NOT EXISTS idx_processo_sync_history_request ON public.processo_sync_history(request_id);

CREATE TABLE IF NOT EXISTS public.processo_judit_requests (
  id SERIAL PRIMARY KEY,
  processo_id INTEGER NOT NULL REFERENCES public.processos(id) ON DELETE CASCADE,
  request_id TEXT NOT NULL,
  status VARCHAR(50) NOT NULL,
  source VARCHAR(50) NOT NULL DEFAULT 'unknown',
  result JSONB,
  criado_em TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE (request_id)
);

CREATE INDEX IF NOT EXISTS idx_processo_judit_requests_processo ON public.processo_judit_requests(processo_id);
