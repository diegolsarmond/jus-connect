CREATE TABLE IF NOT EXISTS public.perfil_modulos (
    perfil_id INTEGER NOT NULL REFERENCES public.perfis(id) ON DELETE CASCADE,
    modulo TEXT NOT NULL,
    PRIMARY KEY (perfil_id, modulo)
);

ALTER TABLE public.perfis
  ADD COLUMN IF NOT EXISTS ver_todas_conversas BOOLEAN NOT NULL DEFAULT TRUE;
