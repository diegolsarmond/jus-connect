CREATE TABLE IF NOT EXISTS public.fornecedores (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  tipo TEXT,
  documento TEXT,
  email TEXT,
  telefone TEXT,
  cep TEXT,
  rua TEXT,
  numero TEXT,
  complemento TEXT,
  bairro TEXT,
  cidade TEXT,
  uf TEXT,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  idempresa INTEGER REFERENCES public.empresas(id) ON DELETE CASCADE,
  datacadastro TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS fornecedores_idempresa_idx ON public.fornecedores(idempresa);
