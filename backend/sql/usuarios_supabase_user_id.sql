ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS supabase_user_id UUID UNIQUE;
