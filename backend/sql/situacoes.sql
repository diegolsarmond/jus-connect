-- Estruturas auxiliares para as situações de clientes, propostas e processos
CREATE TABLE IF NOT EXISTS public.situacao_cliente (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL UNIQUE,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  datacriacao TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.situacao_proposta (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL UNIQUE,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  datacriacao TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.situacao_processo (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL UNIQUE,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  datacriacao TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

-- Dados iniciais para facilitar o uso do sistema em ambientes novos
INSERT INTO public.situacao_cliente (id, nome, ativo)
VALUES
  (1, 'Ativo', TRUE),
  (2, 'Inativo', TRUE),
  (3, 'Em prospecção', TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.situacao_proposta (id, nome, ativo)
VALUES
  (1, 'Em análise', TRUE),
  (2, 'Aprovada', TRUE),
  (3, 'Rejeitada', TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.situacao_processo (id, nome, ativo)
VALUES
  (1, 'Em andamento', TRUE),
  (2, 'Suspenso', TRUE),
  (3, 'Arquivado', TRUE),
  (4, 'Concluído', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Ajusta as sequências para continuarem após os registros inseridos
SELECT setval(
  pg_get_serial_sequence('public.situacao_cliente', 'id'),
  COALESCE((SELECT MAX(id) FROM public.situacao_cliente), 0)
);

SELECT setval(
  pg_get_serial_sequence('public.situacao_proposta', 'id'),
  COALESCE((SELECT MAX(id) FROM public.situacao_proposta), 0)
);

SELECT setval(
  pg_get_serial_sequence('public.situacao_processo', 'id'),
  COALESCE((SELECT MAX(id) FROM public.situacao_processo), 0)
);
