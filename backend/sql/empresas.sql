ALTER TABLE IF EXISTS public.empresas
  ALTER COLUMN plano DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS current_period_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS grace_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS subscription_cadence TEXT CHECK (subscription_cadence IN ('monthly','annual')),
  ALTER COLUMN subscription_cadence SET DEFAULT 'monthly';

UPDATE public.empresas
   SET trial_started_at = COALESCE(trial_started_at, datacadastro),
       trial_ends_at = COALESCE(trial_ends_at, datacadastro + INTERVAL '14 days'),
       current_period_start = COALESCE(current_period_start, datacadastro),
       current_period_end = COALESCE(current_period_end, datacadastro + INTERVAL '30 days'),
       grace_expires_at = COALESCE(grace_expires_at, datacadastro + INTERVAL '37 days'),
       subscription_cadence = COALESCE(subscription_cadence, 'monthly')
 WHERE datacadastro IS NOT NULL;
