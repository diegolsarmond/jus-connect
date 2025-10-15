import pool from './db';

type SyncEventType = 'intimacoes.sync.targets' | 'processos.sync.targets';

const SYNC_TARGET_QUERIES: Record<SyncEventType, string> = {
  'intimacoes.sync.targets': `SELECT monitor_id,
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
  'processos.sync.targets': `SELECT monitor_id,
                                    empresa_id,
                                    nome_empresa,
                                    empresa_plano_codigo,
                                    plano_id,
                                    plano_nome,
                                    sincronizacao_processos_habilitada,
                                    sincronizacao_processos_limite,
                                    limite_advogados_intimacao,
                                    subscription_cadence,
                                    period_start,
                                    period_end,
                                    processos_sincronizadas_periodo,
                                    processos_limite_restante,
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
                               FROM public.vw_processos_sync_targets
                              WHERE empresa_id = $1`,
};

const fetchSyncTargets = async (empresaId: number, eventType: SyncEventType) => {
  const result = await pool.query(SYNC_TARGET_QUERIES[eventType], [empresaId]);


  return result.rows;
};

const fetchIntegrationApiUrl = async (): Promise<string | null> => {
  const result = await pool.query<{ url_api: unknown; active: unknown }>(
    'SELECT url_api, active FROM public.integration_api_keys WHERE id = 19 AND active IS TRUE LIMIT 1',
  );

  const row = result.rows?.[0];
  if (!row) {
    return null;
  }

  if (row.active !== true) {
    return null;
  }

  const value = row.url_api;
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

export const notifyIntimacaoSyncTargets = async (
  empresaId: number,
  eventType: SyncEventType = 'intimacoes.sync.targets',
): Promise<void> => {

  const url = await fetchIntegrationApiUrl();
  if (!url) {
    return;
  }

  const rows = await fetchSyncTargets(empresaId, eventType);
  if (!rows.length) {
    return;
  }

  const fetchImpl = (globalThis as { fetch?: typeof fetch }).fetch;
  if (!fetchImpl) {
    console.error('Fetch API indisponível para notificar sincronização', { empresaId, eventType });
    return;
  }

  try {
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ event: eventType, payload: rows }),
    });

    if (!response.ok) {
      console.error('Falha ao notificar sincronização', {
        empresaId,
        eventType,
        status: response.status,
        statusText: response.statusText,
      });
    }
  } catch (error) {
    console.error('Erro ao notificar sincronização', error, { empresaId, eventType });
  }
};
