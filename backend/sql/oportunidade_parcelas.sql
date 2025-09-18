CREATE TABLE IF NOT EXISTS public.oportunidade_parcelas (
    id SERIAL PRIMARY KEY,
    oportunidade_id INTEGER NOT NULL REFERENCES public.oportunidades(id) ON DELETE CASCADE,
    numero_parcela INTEGER NOT NULL,
    valor NUMERIC(14, 2) NOT NULL,
    valor_pago NUMERIC(14, 2) DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pendente',
    data_prevista DATE,
    quitado_em TIMESTAMPTZ,
    faturamento_id INTEGER REFERENCES public.oportunidade_faturamentos(id) ON DELETE SET NULL,
    criado_em TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_oportunidade_parcelas_unique
    ON public.oportunidade_parcelas (oportunidade_id, numero_parcela);

CREATE INDEX IF NOT EXISTS idx_oportunidade_parcelas_status
    ON public.oportunidade_parcelas (oportunidade_id, status);
