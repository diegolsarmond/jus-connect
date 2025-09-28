ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS email_confirmed_at TIMESTAMPTZ;

UPDATE public.usuarios
   SET email_confirmed_at = COALESCE(email_confirmed_at, NOW());

CREATE TABLE IF NOT EXISTS public.email_confirmation_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (token_hash)
);

CREATE INDEX IF NOT EXISTS idx_email_confirmation_tokens_user_active
    ON public.email_confirmation_tokens (user_id)
    WHERE used_at IS NULL;
