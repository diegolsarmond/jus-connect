CREATE TABLE IF NOT EXISTS public.process_response (
  id BIGSERIAL PRIMARY KEY,
  processo_id INTEGER REFERENCES public.processos(id) ON DELETE SET NULL,
  process_sync_id BIGINT REFERENCES public.process_sync(id) ON DELETE SET NULL,
  integration_api_key_id INTEGER REFERENCES public.integration_api_keys(id) ON DELETE SET NULL,
  delivery_id TEXT,
  source TEXT NOT NULL DEFAULT 'webhook',
  status_code INTEGER,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  headers JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_process_response_delivery
  ON public.process_response (delivery_id)
  WHERE delivery_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_process_response_processo
  ON public.process_response (processo_id);

CREATE INDEX IF NOT EXISTS idx_process_response_sync
  ON public.process_response (process_sync_id);

CREATE INDEX IF NOT EXISTS idx_process_response_integration
  ON public.process_response (integration_api_key_id);
