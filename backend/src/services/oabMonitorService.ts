import pool from './db';

interface OabMonitorRow {
  id: number;
  empresa_id: number;
  uf: string;
  numero: string;
  created_at: string | null;
  updated_at: string | null;
}

export interface CompanyOabMonitor {
  id: number;
  uf: string;
  numero: string;
  createdAt: string | null;
  updatedAt: string | null;
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
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE UNIQUE INDEX IF NOT EXISTS processo_oab_monitoradas_empresa_uf_numero_idx
          ON public.processo_oab_monitoradas (empresa_id, uf, numero);
        ALTER TABLE public.processo_oab_monitoradas
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

const mapRow = (row: OabMonitorRow): CompanyOabMonitor => ({
  id: row.id,
  uf: row.uf,
  numero: row.numero,
  createdAt: row.created_at ?? null,
  updatedAt: row.updated_at ?? null,
});

export const listCompanyOabMonitors = async (
  empresaId: number,
): Promise<CompanyOabMonitor[]> => {
  await ensureTable();

  const result = await pool.query<OabMonitorRow>(
    `SELECT id, empresa_id, uf, numero, created_at, updated_at
       FROM public.processo_oab_monitoradas
      WHERE empresa_id = $1
      ORDER BY created_at DESC, id DESC`,
    [empresaId],
  );

  return result.rows.map(mapRow);
};

export const createCompanyOabMonitor = async (
  empresaId: number,
  uf: string,
  numero: string,
): Promise<CompanyOabMonitor> => {
  await ensureTable();

  const sanitizedUf = sanitizeUf(uf);
  const sanitizedNumero = sanitizeNumero(numero);

  if (!sanitizedUf || sanitizedUf.length !== 2) {
    throw new Error('UF da OAB inválida.');
  }

  if (!sanitizedNumero) {
    throw new Error('Número da OAB inválido.');
  }

  const result = await pool.query<OabMonitorRow>(
    `INSERT INTO public.processo_oab_monitoradas (empresa_id, uf, numero)
     VALUES ($1, $2, $3)
     ON CONFLICT (empresa_id, uf, numero) DO UPDATE
       SET updated_at = NOW()
     RETURNING id, empresa_id, uf, numero, created_at, updated_at`,
    [empresaId, sanitizedUf, sanitizedNumero],
  );

  return mapRow(result.rows[0]);
};
