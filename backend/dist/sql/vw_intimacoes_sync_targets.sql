CREATE OR REPLACE VIEW public.vw_intimacoes_sync_targets AS
WITH period_bounds AS (
  SELECT
    emp.id AS empresa_id,
    COALESCE(emp.current_period_start, date_trunc('month', NOW())) AS period_start,
    COALESCE(
      emp.current_period_end,
      COALESCE(emp.current_period_start, date_trunc('month', NOW())) + INTERVAL '1 month'
    ) AS period_end
  FROM public.empresas emp
)
SELECT
  m.id AS monitor_id,
  m.empresa_id,
  emp.nome_empresa,
  emp.plano AS empresa_plano_codigo,
  pl.id AS plano_id,
  pl.nome AS plano_nome,
  pl.sincronizacao_intimacoes_habilitada,
  pl.sincronizacao_intimacoes_limite,
  pl.limite_advogados_intimacao,
  emp.subscription_cadence,
  period.period_start,
  period.period_end,
  COALESCE(sync_stats.intimacoes_sincronizadas_periodo, 0) AS intimacoes_sincronizadas_periodo,
  CASE
    WHEN pl.sincronizacao_intimacoes_limite IS NULL THEN NULL
    ELSE GREATEST(
      pl.sincronizacao_intimacoes_limite - COALESCE(sync_stats.intimacoes_sincronizadas_periodo, 0),
      0
    )
  END AS intimacoes_limite_restante,
  m.usuario_id,
  u.nome_completo AS usuario_nome,
  u.email AS usuario_email,
  COALESCE(up.oab_number, NULLIF(u.oab, '')) AS usuario_oab_numero,
  up.oab_uf AS usuario_oab_uf,
  u.status AS usuario_ativo,
  m.uf AS monitor_oab_uf,
  m.numero AS monitor_oab_numero,
  m.created_at,
  m.updated_at,
  m.dias_semana
FROM public.oab_monitoradas m
JOIN public.empresas emp ON emp.id = m.empresa_id
LEFT JOIN period_bounds period ON period.empresa_id = emp.id
LEFT JOIN public.planos pl ON pl.id::text = emp.plano::text
LEFT JOIN public.usuarios u ON u.id = m.usuario_id
LEFT JOIN public.user_profiles up ON up.user_id = m.usuario_id
LEFT JOIN LATERAL (
  SELECT COUNT(*)::bigint AS intimacoes_sincronizadas_periodo
    FROM public.intimacoes i
   WHERE i.idempresa = emp.id
     AND (period.period_start IS NULL OR i.created_at >= period.period_start)
     AND (period.period_end IS NULL OR i.created_at < period.period_end)
) sync_stats ON TRUE
WHERE m.tipo = 'intimacao'
  AND (m.dias_semana IS NULL
   OR cardinality(m.dias_semana) = 0
   OR EXTRACT(ISODOW FROM CURRENT_DATE)::smallint = ANY(m.dias_semana));
