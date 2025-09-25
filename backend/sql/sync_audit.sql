CREATE TABLE IF NOT EXISTS public.sync_audit (
  id BIGSERIAL PRIMARY KEY,
  processo_id INTEGER REFERENCES public.processos(id) ON DELETE SET NULL,
  process_sync_id BIGINT REFERENCES public.process_sync(id) ON DELETE SET NULL,
  process_response_id BIGINT REFERENCES public.process_response(id) ON DELETE SET NULL,
  integration_api_key_id INTEGER REFERENCES public.integration_api_keys(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  event_details JSONB NOT NULL DEFAULT '{}'::jsonb,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sync_audit_processo
  ON public.sync_audit (processo_id);

CREATE INDEX IF NOT EXISTS idx_sync_audit_sync
  ON public.sync_audit (process_sync_id);

CREATE INDEX IF NOT EXISTS idx_sync_audit_response
  ON public.sync_audit (process_response_id);
