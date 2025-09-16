CREATE TABLE IF NOT EXISTS public.perfis (
    id SERIAL PRIMARY KEY,
    nome TEXT NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    datacriacao TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.perfil_modulos (
    perfil_id INTEGER NOT NULL REFERENCES public.perfis(id) ON DELETE CASCADE,
    modulo TEXT NOT NULL,
    PRIMARY KEY (perfil_id, modulo)
);
