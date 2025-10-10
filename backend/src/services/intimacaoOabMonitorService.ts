import pool from './db';

interface IntimacaoOabMonitorRow {
  id: number;
  empresa_id: number;
  usuario_id: number | null;
  uf: string;
  numero: string;
  created_at: string | null;
  updated_at: string | null;
  usuario_nome: string | null;
  usuario_oab_numero: string | null;
  usuario_oab_uf: string | null;
}

export interface IntimacaoOabMonitor {
  id: number;
  uf: string;
  numero: string;
  usuarioId: number | null;
  usuarioNome: string | null;
  usuarioOabNumero: string | null;
  usuarioOabUf: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

let ensureTablePromise: Promise<void> | null = null;

const ensureTable = async (): Promise<void> => {
  if (!ensureTablePromise) {
    ensureTablePromise = pool
      .query(`
        CREATE TABLE IF NOT EXISTS public.intimacoes_oab_monitoradas (
          id BIGSERIAL PRIMARY KEY,
          usuario_id INTEGER REFERENCES public.usuarios(id),
          empresa_id INTEGER NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
          uf CHAR(2) NOT NULL,
          numero VARCHAR(20) NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE UNIQUE INDEX IF NOT EXISTS intimacoes_oab_monitoradas_empresa_uf_numero_idx
          ON public.intimacoes_oab_monitoradas (empresa_id, uf, numero);
        ALTER TABLE public.intimacoes_oab_monitoradas
          ADD COLUMN IF NOT EXISTS usuario_id INTEGER REFERENCES public.usuarios(id);
        ALTER TABLE public.intimacoes_oab_monitoradas
          ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
      `)
      .then(() => undefined)
      .catch((error) => {
        ensureTablePromise = null;
        throw error;
      });
  }

  await ensureTablePromise;
};

const sanitizeUf = (input: string): string => input.replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase();

const sanitizeNumero = (input: string): string => input.replace(/\D/g, '').slice(0, 12);

const mapRow = (row: IntimacaoOabMonitorRow): IntimacaoOabMonitor => ({
  id: row.id,
  uf: row.uf,
  numero: row.numero,
  usuarioId: row.usuario_id ?? null,
  usuarioNome: row.usuario_nome ?? null,
  usuarioOabNumero: row.usuario_oab_numero ?? null,
  usuarioOabUf: row.usuario_oab_uf ?? null,
  createdAt: row.created_at ?? null,
  updatedAt: row.updated_at ?? null,
});

const assertCompanyUser = async (empresaId: number, usuarioId: number): Promise<void> => {
  const result = await pool.query<{ empresa: number | null }>(
    `SELECT empresa FROM public.usuarios WHERE id = $1 LIMIT 1`,
    [usuarioId],
  );

  if (result.rowCount === 0) {
    throw new Error('Usuário não encontrado.');
  }

  const { empresa } = result.rows[0];

  if (empresa === null || empresa !== empresaId) {
    throw new Error('Usuário não pertence à empresa informada.');
  }
};

export const listIntimacaoOabMonitors = async (
  empresaId: number,
): Promise<IntimacaoOabMonitor[]> => {
  await ensureTable();

  const result = await pool.query<IntimacaoOabMonitorRow>(
    `SELECT m.id,
            m.empresa_id,
            m.usuario_id,
            m.uf,
            m.numero,
            m.created_at,
            m.updated_at,
            u.nome_completo AS usuario_nome,
            COALESCE(p.oab_number, NULLIF(u.oab, '')) AS usuario_oab_numero,
            p.oab_uf AS usuario_oab_uf
       FROM public.intimacoes_oab_monitoradas m
  LEFT JOIN public.usuarios u ON u.id = m.usuario_id
  LEFT JOIN public.user_profiles p ON p.user_id = m.usuario_id
      WHERE m.empresa_id = $1
      ORDER BY m.created_at DESC NULLS LAST, m.id DESC`,
    [empresaId],
  );

  return result.rows.map(mapRow);
};

export const createIntimacaoOabMonitor = async (
  empresaId: number,
  usuarioId: number,
  uf: string,
  numero: string,
): Promise<IntimacaoOabMonitor> => {
  await ensureTable();

  if (!Number.isInteger(usuarioId) || usuarioId <= 0) {
    throw new Error('Usuário inválido.');
  }

  await assertCompanyUser(empresaId, usuarioId);

  const sanitizedUf = sanitizeUf(uf);
  const sanitizedNumero = sanitizeNumero(numero);

  if (!sanitizedUf || sanitizedUf.length !== 2) {
    throw new Error('UF da OAB inválida.');
  }

  if (!sanitizedNumero) {
    throw new Error('Número da OAB inválido.');
  }

  const result = await pool.query<IntimacaoOabMonitorRow>(
    `WITH upsert AS (
       INSERT INTO public.intimacoes_oab_monitoradas (empresa_id, usuario_id, uf, numero)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (empresa_id, uf, numero) DO UPDATE
         SET usuario_id = EXCLUDED.usuario_id,
             updated_at = NOW()
       RETURNING id, empresa_id, usuario_id, uf, numero, created_at, updated_at
     )
     SELECT u.id AS usuario_id,
            u.nome_completo AS usuario_nome,
            COALESCE(p.oab_number, NULLIF(u.oab, '')) AS usuario_oab_numero,
            p.oab_uf AS usuario_oab_uf,
            upsert.id,
            upsert.empresa_id,
            upsert.uf,
            upsert.numero,
            upsert.created_at,
            upsert.updated_at
       FROM upsert
  LEFT JOIN public.usuarios u ON u.id = upsert.usuario_id
  LEFT JOIN public.user_profiles p ON p.user_id = upsert.usuario_id`,
    [empresaId, usuarioId, sanitizedUf, sanitizedNumero],
  );

  return mapRow(result.rows[0]);
};

export const deleteIntimacaoOabMonitor = async (
  empresaId: number,
  monitorId: number,
): Promise<boolean> => {
  await ensureTable();

  const result = await pool.query(
    `DELETE FROM public.intimacoes_oab_monitoradas
      WHERE id = $1 AND empresa_id = $2
      RETURNING id`,
    [monitorId, empresaId],
  );

  return (result.rowCount ?? 0) > 0;
};
