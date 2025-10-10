import pool from './db';

interface OabMonitorRow {
  id: number;
  empresa_id: number;
  uf: string;
  numero: string;
  created_at: string | null;
  updated_at: string | null;
  usuario_id: number | null;
  usuario_nome: string | null;
  usuario_oab: string | null;
}

export interface CompanyOabMonitor {
  id: number;
  uf: string;
  numero: string;
  createdAt: string | null;
  updatedAt: string | null;
  usuarioId: number | null;
  usuarioNome: string | null;
  usuarioOab: string | null;
}

let ensureTablePromise: Promise<void> | null = null;

const ensureTable = async (): Promise<void> => {
  if (!ensureTablePromise) {
    ensureTablePromise = pool
      .query(`
        CREATE TABLE IF NOT EXISTS public.processo_oab_monitoradas (
          id BIGSERIAL PRIMARY KEY,
          empresa_id INTEGER NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
          uf CHAR(2) NOT NULL,
          numero VARCHAR(20) NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          usuario_id INTEGER NULL REFERENCES public.usuarios(id)
        );
        CREATE UNIQUE INDEX IF NOT EXISTS processo_oab_monitoradas_empresa_uf_numero_idx
          ON public.processo_oab_monitoradas (empresa_id, uf, numero);
        ALTER TABLE public.processo_oab_monitoradas
          ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
        ALTER TABLE public.processo_oab_monitoradas
          ADD COLUMN IF NOT EXISTS usuario_id INTEGER NULL REFERENCES public.usuarios(id);
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

const mapRow = (row: OabMonitorRow): CompanyOabMonitor => ({
  id: row.id,
  uf: row.uf,
  numero: row.numero,
  createdAt: row.created_at ?? null,
  updatedAt: row.updated_at ?? null,
  usuarioId: row.usuario_id ?? null,
  usuarioNome: row.usuario_nome ?? null,
  usuarioOab: row.usuario_oab ?? null,
});

export const listCompanyOabMonitors = async (
  empresaId: number,
): Promise<CompanyOabMonitor[]> => {
  await ensureTable();

  const result = await pool.query<OabMonitorRow>(
    `SELECT m.id,
            m.empresa_id,
            m.uf,
            m.numero,
            m.created_at,
            m.updated_at,
            m.usuario_id,
            u.nome_completo AS usuario_nome,
            u.oab AS usuario_oab
       FROM public.processo_oab_monitoradas m
       LEFT JOIN public.usuarios u ON u.id = m.usuario_id
      WHERE m.empresa_id = $1
      ORDER BY m.created_at DESC, m.id DESC`,
    [empresaId],
  );

  return result.rows.map(mapRow);
};

export const createCompanyOabMonitor = async (
  empresaId: number,
  uf: string,
  numero: string,
  usuarioId: number | null,
): Promise<CompanyOabMonitor> => {
  await ensureTable();

  const sanitizedUf = sanitizeUf(uf);
  const sanitizedNumero = sanitizeNumero(numero);
  const sanitizedUsuarioId =
    typeof usuarioId === 'number' && Number.isFinite(usuarioId)
      ? Math.trunc(usuarioId)
      : null;

  if (!sanitizedUf || sanitizedUf.length !== 2) {
    throw new Error('UF da OAB inválida.');
  }

  if (!sanitizedNumero) {
    throw new Error('Número da OAB inválido.');
  }

  const result = await pool.query<OabMonitorRow>(
    `INSERT INTO public.processo_oab_monitoradas (empresa_id, uf, numero, usuario_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (empresa_id, uf, numero) DO UPDATE
       SET updated_at = NOW(),
           usuario_id = EXCLUDED.usuario_id
     RETURNING id,
               empresa_id,
               uf,
               numero,
               created_at,
               updated_at,
               usuario_id,
               (SELECT nome_completo FROM public.usuarios WHERE id = EXCLUDED.usuario_id) AS usuario_nome,
               (SELECT oab FROM public.usuarios WHERE id = EXCLUDED.usuario_id) AS usuario_oab`,
    [empresaId, sanitizedUf, sanitizedNumero, sanitizedUsuarioId],
  );

  return mapRow(result.rows[0]);
};

export const deleteCompanyOabMonitor = async (
  empresaId: number,
  monitorId: number,
): Promise<boolean> => {
  await ensureTable();

  const result = await pool.query(
    `DELETE FROM public.processo_oab_monitoradas
      WHERE empresa_id = $1 AND id = $2`,
    [empresaId, monitorId],
  );

  return result.rowCount > 0;
};
