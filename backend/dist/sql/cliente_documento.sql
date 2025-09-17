CREATE TABLE IF NOT EXISTS public.cliente_documento (
  id SERIAL PRIMARY KEY,
  cliente_id INTEGER NOT NULL REFERENCES public.clientes(id),
  tipo_documento_id INTEGER NOT NULL REFERENCES public.tipo_documento(id),
  nome_arquivo VARCHAR(255) NOT NULL,
  arquivo_base64 TEXT NOT NULL,
  data_upload TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);
