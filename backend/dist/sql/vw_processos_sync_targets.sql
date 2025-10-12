CREATE OR REPLACE VIEW public.vw_processos_sync_targets AS
WITH period_bounds AS (
  SELECT
    emp_1.id AS empresa_id,
    COALESCE(emp_1.current_period_start, date_trunc('month', NOW())) AS period_start,
    COALESCE(
      emp_1.current_period_end,
      COALESCE(emp_1.current_period_start, date_trunc('month', NOW())) + INTERVAL '1 month'
    ) AS period_end
  FROM empresas emp_1
)
SELECT
  m.id AS monitor_id,
  m.empresa_id,
  emp.nome_empresa,
  emp.plano AS empresa_plano_codigo,
  pl.id AS plano_id,
  pl.nome AS plano_nome,
  pl.sincronizacao_processos_habilitada,
  pl.sincronizacao_processos_limite,
  pl.limite_advogados_intimacao,
  emp.subscription_cadence,
  period.period_start,
  period.period_end,
  COALESCE(sync_stats.processos_sincronizadas_periodo, 0::bigint) AS processos_sincronizadas_periodo,
  CASE
    WHEN pl.sincronizacao_processos_limite IS NULL THEN NULL::bigint
    ELSE GREATEST(
      pl.sincronizacao_processos_limite - COALESCE(sync_stats.processos_sincronizadas_periodo, 0::bigint),
      0::bigint
    )
  END AS processos_limite_restante,
  m.usuario_id,
  u.nome_completo AS usuario_nome,
  u.email AS usuario_email,
  COALESCE(up.oab_number, NULLIF(u.oab::text, ''::text)) AS usuario_oab_numero,
  up.oab_uf AS usuario_oab_uf,
  u.status AS usuario_ativo,
  m.uf AS monitor_oab_uf,
  m.numero AS monitor_oab_numero,
  m.created_at,
  m.updated_at,
  m.dias_semana
FROM processo_oab_monitoradas m
JOIN empresas emp ON emp.id = m.empresa_id
LEFT JOIN period_bounds period ON period.empresa_id = emp.id
LEFT JOIN planos pl ON pl.id::text = emp.plano::text
LEFT JOIN usuarios u ON u.id = m.usuario_id
LEFT JOIN user_profiles up ON up.user_id = m.usuario_id
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS processos_sincronizadas_periodo
    FROM processos p
   WHERE p.idempresa = emp.id
     AND (period.period_start IS NULL OR p.criado_em >= period.period_start)
     AND (period.period_end IS NULL OR p.criado_em < period.period_end)
) sync_stats ON TRUE
WHERE m.dias_semana IS NULL
   OR cardinality(m.dias_semana) = 0
   OR EXTRACT(ISODOW FROM CURRENT_DATE)::smallint = ANY(m.dias_semana);
