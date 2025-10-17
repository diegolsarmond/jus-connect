CREATE TABLE IF NOT EXISTS public.sync_job_status (
  job_name TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  running BOOLEAN NOT NULL DEFAULT FALSE,
  interval_ms BIGINT,
  lookback_ms BIGINT,
  overlap_ms BIGINT,
  last_run_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  last_error_at TIMESTAMPTZ,
  last_error_message TEXT,
  last_result JSONB,
  last_reference_used TIMESTAMPTZ,
  next_reference TIMESTAMPTZ,
  last_manual_trigger_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.sync_job_runs (
  id BIGSERIAL PRIMARY KEY,
  job_name TEXT NOT NULL REFERENCES public.sync_job_status(job_name) ON DELETE CASCADE,
  manual BOOLEAN NOT NULL DEFAULT FALSE,
  reference_used TIMESTAMPTZ,
  next_reference TIMESTAMPTZ,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running',
  error_message TEXT,
  result JSONB
);

CREATE INDEX IF NOT EXISTS idx_sync_job_runs_job_name ON public.sync_job_runs(job_name);
CREATE INDEX IF NOT EXISTS idx_sync_job_runs_status ON public.sync_job_runs(status);
CREATE INDEX IF NOT EXISTS idx_sync_job_runs_started_at ON public.sync_job_runs(started_at);

CREATE OR REPLACE FUNCTION public.set_sync_job_status_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_job_status_updated_at ON public.sync_job_status;
CREATE TRIGGER trg_sync_job_status_updated_at
  BEFORE UPDATE ON public.sync_job_status
  FOR EACH ROW
  EXECUTE FUNCTION public.set_sync_job_status_updated_at();

CREATE OR REPLACE FUNCTION public.sync_job_start(
  p_job_name TEXT,
  p_manual BOOLEAN DEFAULT FALSE,
  p_interval_override BIGINT DEFAULT NULL,
  p_lookback_override BIGINT DEFAULT NULL,
  p_overlap_override BIGINT DEFAULT NULL,
  p_default_interval BIGINT DEFAULT 300000,
  p_default_lookback BIGINT DEFAULT 86400000,
  p_default_overlap BIGINT DEFAULT 60000
)
RETURNS TABLE (
  run_id BIGINT,
  reference_used TIMESTAMPTZ,
  interval_ms BIGINT,
  lookback_ms BIGINT,
  overlap_ms BIGINT
) AS $$
DECLARE
  v_status public.sync_job_status;
  v_interval BIGINT;
  v_lookback BIGINT;
  v_overlap BIGINT;
  v_reference TIMESTAMPTZ;
BEGIN
  IF p_job_name IS NULL OR LENGTH(TRIM(p_job_name)) = 0 THEN
    RAISE EXCEPTION 'Nome do job de sincronização inválido.' USING ERRCODE = '22023';
  END IF;

  SELECT *
    INTO v_status
    FROM public.sync_job_status
   WHERE job_name = p_job_name
   FOR UPDATE;

  v_interval := COALESCE(p_interval_override, v_status.interval_ms, p_default_interval);
  v_lookback := COALESCE(p_lookback_override, v_status.lookback_ms, p_default_lookback);
  v_overlap := COALESCE(p_overlap_override, v_status.overlap_ms, p_default_overlap);

  IF NOT FOUND THEN
    INSERT INTO public.sync_job_status AS s (
      job_name,
      enabled,
      running,
      interval_ms,
      lookback_ms,
      overlap_ms
    ) VALUES (
      p_job_name,
      TRUE,
      FALSE,
      v_interval,
      v_lookback,
      v_overlap
    )
    RETURNING * INTO v_status;
  END IF;

  IF v_status.running THEN
    RAISE EXCEPTION 'Job % já está em execução.', p_job_name USING ERRCODE = '55000';
  END IF;

  v_reference := COALESCE(
    v_status.next_reference,
    NOW() - (v_lookback * INTERVAL '1 millisecond')
  );

  UPDATE public.sync_job_status
     SET running = TRUE,
         last_run_at = NOW(),
         last_manual_trigger_at = CASE WHEN p_manual THEN NOW() ELSE last_manual_trigger_at END,
         interval_ms = v_interval,
         lookback_ms = v_lookback,
         overlap_ms = v_overlap
   WHERE job_name = p_job_name;

  INSERT INTO public.sync_job_runs (
    job_name,
    manual,
    reference_used,
    status
  ) VALUES (
    p_job_name,
    p_manual,
    v_reference,
    'running'
  )
  RETURNING id INTO run_id;

  reference_used := v_reference;
  interval_ms := v_interval;
  lookback_ms := v_lookback;
  overlap_ms := v_overlap;

  RETURN NEXT;
  RETURN;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.sync_job_finish(
  p_run_id BIGINT,
  p_success BOOLEAN,
  p_next_reference TIMESTAMPTZ DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL,
  p_result JSONB DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
  v_run public.sync_job_runs;
  v_status public.sync_job_status;
  v_job_name TEXT;
BEGIN
  IF p_run_id IS NULL THEN
    RAISE EXCEPTION 'Identificador do job inválido.' USING ERRCODE = '22023';
  END IF;

  SELECT *
    INTO v_run
    FROM public.sync_job_runs
   WHERE id = p_run_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Execução % não encontrada.', p_run_id USING ERRCODE = 'P0002';
  END IF;

  v_job_name := v_run.job_name;

  UPDATE public.sync_job_runs
     SET finished_at = NOW(),
         status = CASE WHEN p_success THEN 'success' ELSE 'error' END,
         error_message = CASE WHEN p_success THEN NULL ELSE p_error_message END,
         result = p_result,
         next_reference = p_next_reference
   WHERE id = p_run_id;

  SELECT *
    INTO v_status
    FROM public.sync_job_status
   WHERE job_name = v_job_name
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  UPDATE public.sync_job_status
     SET running = FALSE,
         last_reference_used = v_run.reference_used,
         next_reference = COALESCE(p_next_reference, v_status.next_reference),
         last_result = p_result,
         last_success_at = CASE WHEN p_success THEN NOW() ELSE v_status.last_success_at END,
         last_error_at = CASE WHEN p_success THEN v_status.last_error_at ELSE NOW() END,
         last_error_message = CASE WHEN p_success THEN NULL ELSE p_error_message END
   WHERE job_name = v_job_name;

  RETURN;
END;
$$ LANGUAGE plpgsql;
