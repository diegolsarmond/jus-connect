CREATE TABLE IF NOT EXISTS public.process_sync (
  id BIGSERIAL PRIMARY KEY,
  processo_id INTEGER REFERENCES public.processos(id) ON DELETE CASCADE,
  integration_api_key_id INTEGER REFERENCES public.integration_api_keys(id) ON DELETE SET NULL,
  remote_request_id TEXT,
  request_type TEXT NOT NULL DEFAULT 'manual',
  requested_by INTEGER REFERENCES public.usuarios(id) ON DELETE SET NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  request_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  request_headers JSONB,
  status TEXT NOT NULL DEFAULT 'pending',
  status_reason TEXT,
  completed_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_process_sync_remote_request
  ON public.process_sync (remote_request_id)
  WHERE remote_request_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_process_sync_processo
  ON public.process_sync (processo_id);

CREATE INDEX IF NOT EXISTS idx_process_sync_integration
  ON public.process_sync (integration_api_key_id);

CREATE INDEX IF NOT EXISTS idx_process_sync_status
  ON public.process_sync (status);

CREATE OR REPLACE FUNCTION set_process_sync_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_process_sync_updated_at ON public.process_sync;
CREATE TRIGGER trg_process_sync_updated_at
  BEFORE UPDATE ON public.process_sync
  FOR EACH ROW
  EXECUTE FUNCTION set_process_sync_updated_at();
