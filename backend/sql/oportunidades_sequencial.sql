ALTER TABLE public.oportunidades
  ADD COLUMN IF NOT EXISTS sequencial_empresa INTEGER;

WITH sequencias AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY idempresa
      ORDER BY data_criacao NULLS LAST, id
    ) AS seq
  FROM public.oportunidades
  WHERE idempresa IS NOT NULL
)
UPDATE public.oportunidades o
SET sequencial_empresa = s.seq
FROM sequencias s
WHERE o.id = s.id
  AND (o.sequencial_empresa IS DISTINCT FROM s.seq OR o.sequencial_empresa IS NULL);

ALTER TABLE public.oportunidades
  ALTER COLUMN sequencial_empresa SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_oportunidades_empresa_sequencial
  ON public.oportunidades (idempresa, sequencial_empresa);

CREATE TABLE IF NOT EXISTS public.oportunidade_sequence (
  empresa_id INTEGER PRIMARY KEY,
  atual INTEGER NOT NULL
);

INSERT INTO public.oportunidade_sequence (empresa_id, atual)
SELECT idempresa, MAX(sequencial_empresa)
FROM public.oportunidades
WHERE idempresa IS NOT NULL
GROUP BY idempresa
ON CONFLICT (empresa_id) DO UPDATE SET atual = EXCLUDED.atual;
