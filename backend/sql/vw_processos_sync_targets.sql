-- View que consolida os dados necessários para a automação de sincronização de processos
-- Inclui informações da empresa, plano, limites vigentes e dados do advogado relacionado ao processo
CREATE OR REPLACE VIEW public.vw_processos_sync_targets AS
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
  proc.id AS processo_id,
  proc.cliente_id,
  proc.idempresa AS empresa_id,
  emp.nome_empresa,
  emp.plano AS empresa_plano_codigo,
  pl.id AS plano_id,
  pl.nome AS plano_nome,
  pl.sincronizacao_processos_habilitada,
  pl.sincronizacao_processos_limite,
  emp.subscription_cadence,
  period.period_start,
  period.period_end,
  COALESCE(usage_stats.processos_sincronizados_periodo, 0) AS processos_sincronizados_periodo,
  CASE
    WHEN pl.sincronizacao_processos_limite IS NULL THEN NULL
    ELSE GREATEST(
      pl.sincronizacao_processos_limite - COALESCE(usage_stats.processos_sincronizados_periodo, 0),
      0
    )
  END AS processos_limite_restante,
  proc.numero AS processo_numero,
  proc.uf AS processo_uf,
  proc.municipio AS processo_municipio,
  proc.orgao_julgador,
  proc.tipo AS processo_tipo,
  proc.status AS processo_status,
  proc.classe_judicial,
  proc.assunto AS processo_assunto,
  proc.jurisdicao,
  proc.advogado_responsavel,
  proc.data_distribuicao,
  proc.criado_em AS processo_criado_em,
  proc.atualizado_em AS processo_atualizado_em,
  proc.ultima_sincronizacao,
  proc.consultas_api_count,
  pa.usuario_id,
  pa.criado_em AS processo_advogado_criado_em,
  pa.atualizado_em AS processo_advogado_atualizado_em,
  u.nome_completo AS usuario_nome,
  u.email AS usuario_email,
  COALESCE(up.oab_number, NULLIF(u.oab, '')) AS usuario_oab_numero,
  up.oab_uf AS usuario_oab_uf,
  u.status AS usuario_ativo
FROM public.processos proc
LEFT JOIN public.processo_advogados pa ON pa.processo_id = proc.id
LEFT JOIN public.empresas emp ON emp.id = proc.idempresa
LEFT JOIN period_bounds period ON period.empresa_id = emp.id
LEFT JOIN public.planos pl ON pl.id::text = emp.plano::text
LEFT JOIN public.usuarios u ON u.id = pa.usuario_id
LEFT JOIN public.user_profiles up ON up.user_id = pa.usuario_id
LEFT JOIN LATERAL (
  SELECT
    COALESCE(sync_count.total, 0) + COALESCE(api_count.total, 0) AS processos_sincronizados_periodo
  FROM (
    SELECT COUNT(*)::bigint AS total
    FROM public.process_sync ps
    JOIN public.processos p_sync ON p_sync.id = ps.processo_id
    WHERE p_sync.idempresa = emp.id
      AND (period.period_start IS NULL OR COALESCE(ps.requested_at, ps.created_at) >= period.period_start)
      AND (period.period_end IS NULL OR COALESCE(ps.requested_at, ps.created_at) < period.period_end)
  ) sync_count,
  (
    SELECT COUNT(*)::bigint AS total
    FROM public.processo_consultas_api pca
    JOIN public.processos p_consulta ON p_consulta.id = pca.processo_id
    WHERE p_consulta.idempresa = emp.id
      AND (period.period_start IS NULL OR pca.consultado_em >= period.period_start)
      AND (period.period_end IS NULL OR pca.consultado_em < period.period_end)
  ) api_count
) usage_stats ON TRUE;
