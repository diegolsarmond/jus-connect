-- Estrutura das tabelas de perfil do usuário utilizadas pela tela "Meu Perfil"
-- Crie essas tabelas em um banco PostgreSQL antes de iniciar o backend.

-- Tabela principal com os dados do perfil do usuário autenticado.
CREATE TABLE IF NOT EXISTS public.user_profiles (
    user_id INTEGER PRIMARY KEY REFERENCES public.usuarios(id) ON DELETE CASCADE,
    title TEXT,
    bio TEXT,
    office TEXT,
    oab_number TEXT,
    oab_uf TEXT,
    specialties TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
    hourly_rate NUMERIC(12, 2),
    timezone TEXT,
    language TEXT,
    linkedin_url TEXT,
    website_url TEXT,
    address_street TEXT,
    address_city TEXT,
    address_state TEXT,
    address_zip TEXT,
    notifications_security_alerts BOOLEAN NOT NULL DEFAULT TRUE,
    notifications_agenda_reminders BOOLEAN NOT NULL DEFAULT TRUE,
    notifications_newsletter BOOLEAN NOT NULL DEFAULT FALSE,
    security_two_factor BOOLEAN NOT NULL DEFAULT FALSE,
    security_login_alerts BOOLEAN NOT NULL DEFAULT FALSE,
    security_device_approval BOOLEAN NOT NULL DEFAULT FALSE,
    security_two_factor_secret TEXT,
    security_two_factor_activated_at TIMESTAMPTZ,
    security_two_factor_backup_codes TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
    avatar_url TEXT,
    member_since TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_updated_at ON public.user_profiles(updated_at DESC);

-- Função utilitária para atualizar automaticamente o campo updated_at.
CREATE OR REPLACE FUNCTION public.user_profile_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_user_profiles_updated_at
BEFORE UPDATE ON public.user_profiles
FOR EACH ROW EXECUTE FUNCTION public.user_profile_set_updated_at();

-- Histórico de auditoria do perfil.
CREATE TABLE IF NOT EXISTS public.user_profile_audit_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    description TEXT NOT NULL,
    performed_by INTEGER REFERENCES public.usuarios(id) ON DELETE SET NULL,
    performed_by_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_profile_audit_logs_user_created
    ON public.user_profile_audit_logs(user_id, created_at DESC);

-- Sessões de login e dispositivos autorizados.
CREATE TABLE IF NOT EXISTS public.user_profile_sessions (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    device TEXT NOT NULL,
    location TEXT,
    last_activity TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_approved BOOLEAN NOT NULL DEFAULT FALSE,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_user_profile_sessions_user_active
    ON public.user_profile_sessions(user_id, is_active, last_activity DESC);
