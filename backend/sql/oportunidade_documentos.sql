CREATE TABLE IF NOT EXISTS public.oportunidade_documentos (
  id SERIAL PRIMARY KEY,
  oportunidade_id INTEGER NOT NULL REFERENCES public.oportunidades(id) ON DELETE CASCADE,
  template_id INTEGER REFERENCES public.templates(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  variables JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
