import pool from './db';

const fetchIntimacaoSyncTargets = async (empresaId: number) => {
  const result = await pool.query(
    `SELECT monitor_id,
            empresa_id,
            nome_empresa,
            empresa_plano_codigo,
            plano_id,
            plano_nome,
            sincronizacao_intimacoes_habilitada,
            sincronizacao_intimacoes_limite,
            limite_advogados_intimacao,
            subscription_cadence,
            period_start,
            period_end,
            intimacoes_sincronizadas_periodo,
            intimacoes_limite_restante,
            usuario_id,
            usuario_nome,
            usuario_email,
            usuario_oab_numero,
            usuario_oab_uf,
            usuario_ativo,
            monitor_oab_uf,
            monitor_oab_numero,
            created_at,
            updated_at,
            dias_semana
       FROM public.vw_intimacoes_sync_targets
      WHERE empresa_id = $1`,
    [empresaId],
  );

  return result.rows;
};

const fetchIntegrationApiUrl = async (): Promise<string | null> => {
  const result = await pool.query<{ url_api: unknown }>(
    'SELECT url_api FROM public.integration_api_keys WHERE id = 19 LIMIT 1',
  );

  const value = result.rows?.[0]?.url_api;
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

export const notifyIntimacaoSyncTargets = async (empresaId: number): Promise<void> => {
  const url = await fetchIntegrationApiUrl();
  if (!url) {
    return;
  }

  const rows = await fetchIntimacaoSyncTargets(empresaId);
  if (!rows.length) {
    return;
  }

  const fetchImpl = (globalThis as { fetch?: typeof fetch }).fetch;
  if (!fetchImpl) {
    console.error('Fetch API indisponível para notificar intimações sincronizadas', { empresaId });
    return;
  }

  try {
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ event: 'intimacoes.sync.targets', payload: rows }),
    });

    if (!response.ok) {
      console.error('Falha ao notificar intimações sincronizadas', {
        empresaId,
        status: response.status,
        statusText: response.statusText,
      });
    }
  } catch (error) {
    console.error('Erro ao notificar intimações sincronizadas', error, { empresaId });
  }
};
