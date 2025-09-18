CREATE TABLE IF NOT EXISTS public.oportunidade_faturamentos (
    id SERIAL PRIMARY KEY,
    oportunidade_id INTEGER NOT NULL REFERENCES public.oportunidades(id) ON DELETE CASCADE,
    forma_pagamento TEXT NOT NULL,
    condicao_pagamento TEXT,
    valor NUMERIC(14, 2),
    parcelas INTEGER,
    observacoes TEXT,
    data_faturamento TIMESTAMPTZ DEFAULT NOW(),
    criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_oportunidade_faturamentos_oportunidade
    ON public.oportunidade_faturamentos (oportunidade_id);
