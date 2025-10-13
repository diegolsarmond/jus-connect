import pool from './db';
import { MissingDependencyError } from './errors';

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
  dias_semana: unknown;
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
  diasSemana: number[] | null;
}

let ensureTablePromise: Promise<void> | null = null;
let dependencyWarningLogged = false;

const ensureTable = async (): Promise<void> => {
  if (!ensureTablePromise) {
    ensureTablePromise = (async () => {
      const client = await pool.connect();
      let inTransaction = false;

      try {
        const dependencyResult = (await client.query(
          "SELECT to_regclass('public.empresas') AS empresas"
        )) as {
          rows?: Array<{ empresas?: unknown }>;
        };

        const hasEmpresas =
          Array.isArray(dependencyResult.rows) && typeof dependencyResult.rows[0]?.empresas === 'string';

        if (!hasEmpresas) {
          if (!dependencyWarningLogged) {
            dependencyWarningLogged = true;
            console.warn(
              'Ignorando a criação da tabela oab_monitoradas: tabela public.empresas ausente no banco de dados.'
            );
          }

          throw new MissingDependencyError(
            'Tabela public.empresas ausente; não é possível inicializar o schema de oab_monitoradas.',
          );
        }

        await client.query('BEGIN');
        inTransaction = true;
        await client.query("SELECT pg_advisory_xact_lock(hashtext('oab_monitoradas_schema'));");
        await client.query(`
        CREATE TABLE IF NOT EXISTS public.oab_monitoradas (
          id BIGSERIAL PRIMARY KEY,
          empresa_id INTEGER NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
          usuario_id INTEGER REFERENCES public.usuarios(id),
          tipo TEXT NOT NULL,
          uf CHAR(2) NOT NULL,
          numero VARCHAR(20) NOT NULL,
          dias_semana SMALLINT[],
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE UNIQUE INDEX IF NOT EXISTS oab_monitoradas_empresa_tipo_uf_numero_idx
          ON public.oab_monitoradas (empresa_id, tipo, uf, numero);
        ALTER TABLE public.oab_monitoradas
          ADD COLUMN IF NOT EXISTS usuario_id INTEGER REFERENCES public.usuarios(id);
        ALTER TABLE public.oab_monitoradas
          ADD COLUMN IF NOT EXISTS dias_semana SMALLINT[];
        ALTER TABLE public.oab_monitoradas
          ADD COLUMN IF NOT EXISTS tipo TEXT;
        ALTER TABLE public.oab_monitoradas
          ALTER COLUMN tipo SET NOT NULL;
        DO $$
        DECLARE
          processo_has_dias_semana BOOLEAN := EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'processo_oab_monitoradas'
              AND column_name = 'dias_semana'
          );
          intimacoes_has_dias_semana BOOLEAN := EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'intimacoes_oab_monitoradas'
              AND column_name = 'dias_semana'
          );
        BEGIN
          IF to_regclass('public.processo_oab_monitoradas') IS NOT NULL THEN
            IF processo_has_dias_semana THEN
              EXECUTE '
                INSERT INTO public.oab_monitoradas (
                  empresa_id,
                  usuario_id,
                  tipo,
                  uf,
                  numero,
                  dias_semana,
                  created_at,
                  updated_at
                )
                SELECT
                  empresa_id,
                  usuario_id,
                  ''processo'',
                  uf,
                  numero,
                  dias_semana,
                  created_at,
                  updated_at
                  FROM public.processo_oab_monitoradas
                ON CONFLICT (empresa_id, tipo, uf, numero) DO UPDATE
                  SET usuario_id = EXCLUDED.usuario_id,
                      dias_semana = COALESCE(EXCLUDED.dias_semana, public.oab_monitoradas.dias_semana),
                      created_at = LEAST(public.oab_monitoradas.created_at, EXCLUDED.created_at),
                      updated_at = GREATEST(public.oab_monitoradas.updated_at, EXCLUDED.updated_at);
              ';
            ELSE
              EXECUTE '
                INSERT INTO public.oab_monitoradas (
                  empresa_id,
                  usuario_id,
                  tipo,
                  uf,
                  numero,
                  dias_semana,
                  created_at,
                  updated_at
                )
                SELECT
                  empresa_id,
                  usuario_id,
                  ''processo'',
                  uf,
                  numero,
                  NULL::smallint[],
                  created_at,
                  updated_at
                  FROM public.processo_oab_monitoradas
                ON CONFLICT (empresa_id, tipo, uf, numero) DO UPDATE
                  SET usuario_id = EXCLUDED.usuario_id,
                      dias_semana = COALESCE(EXCLUDED.dias_semana, public.oab_monitoradas.dias_semana),
                      created_at = LEAST(public.oab_monitoradas.created_at, EXCLUDED.created_at),
                      updated_at = GREATEST(public.oab_monitoradas.updated_at, EXCLUDED.updated_at);
              ';
            END IF;
            EXECUTE '
              WITH seq AS (
                SELECT COALESCE(MAX(id), 0) AS max_id FROM public.oab_monitoradas
              )
              SELECT setval(
                ''public.oab_monitoradas_id_seq'',
                CASE WHEN seq.max_id = 0 THEN 1 ELSE seq.max_id END,
                seq.max_id <> 0
              )
              FROM seq;
            ';
            EXECUTE 'DROP TABLE IF EXISTS public.processo_oab_monitoradas;';
          END IF;
          IF to_regclass('public.intimacoes_oab_monitoradas') IS NOT NULL THEN
            IF intimacoes_has_dias_semana THEN
              EXECUTE '
                INSERT INTO public.oab_monitoradas (
                  empresa_id,
                  usuario_id,
                  tipo,
                  uf,
                  numero,
                  dias_semana,
                  created_at,
                  updated_at
                )
                SELECT
                  empresa_id,
                  usuario_id,
                  ''intimacao'',
                  uf,
                  numero,
                  dias_semana,
                  created_at,
                  updated_at
                  FROM public.intimacoes_oab_monitoradas
                ON CONFLICT (empresa_id, tipo, uf, numero) DO UPDATE
                  SET usuario_id = EXCLUDED.usuario_id,
                      dias_semana = COALESCE(EXCLUDED.dias_semana, public.oab_monitoradas.dias_semana),
                      created_at = LEAST(public.oab_monitoradas.created_at, EXCLUDED.created_at),
                      updated_at = GREATEST(public.oab_monitoradas.updated_at, EXCLUDED.updated_at);
              ';
            ELSE
              EXECUTE '
                INSERT INTO public.oab_monitoradas (
                  empresa_id,
                  usuario_id,
                  tipo,
                  uf,
                  numero,
                  dias_semana,
                  created_at,
                  updated_at
                )
                SELECT
                  empresa_id,
                  usuario_id,
                  ''intimacao'',
                  uf,
                  numero,
                  NULL::smallint[],
                  created_at,
                  updated_at
                  FROM public.intimacoes_oab_monitoradas
                ON CONFLICT (empresa_id, tipo, uf, numero) DO UPDATE
                  SET usuario_id = EXCLUDED.usuario_id,
                      dias_semana = COALESCE(EXCLUDED.dias_semana, public.oab_monitoradas.dias_semana),
                      created_at = LEAST(public.oab_monitoradas.created_at, EXCLUDED.created_at),
                      updated_at = GREATEST(public.oab_monitoradas.updated_at, EXCLUDED.updated_at);
              ';
            END IF;
            EXECUTE '
              WITH seq AS (
                SELECT COALESCE(MAX(id), 0) AS max_id FROM public.oab_monitoradas
              )
              SELECT setval(
                ''public.oab_monitoradas_id_seq'',
                CASE WHEN seq.max_id = 0 THEN 1 ELSE seq.max_id END,
                seq.max_id <> 0
              )
              FROM seq;
            ';
            EXECUTE 'DROP TABLE IF EXISTS public.intimacoes_oab_monitoradas;';
          END IF;
        END
        $$;
      `);
        await client.query('COMMIT');
        inTransaction = false;
      } catch (error) {
        if (inTransaction) {
          await client.query('ROLLBACK').catch(() => undefined);
        }
        throw error;
      } finally {
        client.release();
      }
    })()
      .catch((error) => {
        ensureTablePromise = null;
        throw error;
      });
  }

  await ensureTablePromise;
};

export const bootstrapOabMonitoradas = async (): Promise<void> => {
  try {
    await ensureTable();
  } catch (error) {
    if (error instanceof MissingDependencyError) {
      return;
    }

    throw error;
  }
};

const sanitizeUf = (input: string): string => input.replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase();

const sanitizeNumero = (input: string): string => input.replace(/\D/g, '').slice(0, 12);

const parseDiasSemanaColumn = (value: unknown): number[] | null => {
  if (!value && value !== 0) {
    return null;
  }

  const collect = (items: unknown[]): number[] => {
    const set = new Set<number>();

    for (const item of items) {
      let parsed: number | null = null;

      if (typeof item === 'number' && Number.isInteger(item)) {
        parsed = item;
      } else if (typeof item === 'string') {
        const trimmed = item.trim();
        if (trimmed) {
          const candidate = Number.parseInt(trimmed, 10);
          if (Number.isInteger(candidate)) {
            parsed = candidate;
          }
        }
      }

      if (parsed != null && parsed >= 1 && parsed <= 7) {
        set.add(parsed);
      }
    }

    if (set.size === 0) {
      return [];
    }

    return Array.from(set).sort((a, b) => a - b);
  };

  if (Array.isArray(value)) {
    return collect(value);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return [];
    }

    const normalized = trimmed.replace(/[{}]/g, '');
    if (!normalized) {
      return [];
    }

    return collect(normalized.split(',').map((item) => item.trim()));
  }

  return null;
};

const sanitizeDiasSemana = (diasSemana: number[] | null | undefined): number[] | null => {
  if (!diasSemana) {
    return null;
  }

  const filtered = diasSemana
    .filter((item) => Number.isInteger(item) && item >= 1 && item <= 7)
    .map((item) => Math.trunc(item));

  if (filtered.length === 0) {
    return null;
  }

  const unique = Array.from(new Set(filtered));
  unique.sort((a, b) => a - b);
  return unique;
};

const mapRow = (row: OabMonitorRow): CompanyOabMonitor => ({
  id: row.id,
  uf: row.uf,
  numero: row.numero,
  createdAt: row.created_at ?? null,
  updatedAt: row.updated_at ?? null,
  usuarioId: row.usuario_id ?? null,
  usuarioNome: row.usuario_nome ?? null,
  usuarioOab: row.usuario_oab ?? null,
  diasSemana: parseDiasSemanaColumn(row.dias_semana),
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
            m.dias_semana,
            u.nome_completo AS usuario_nome,
            u.oab AS usuario_oab
       FROM public.oab_monitoradas m
       LEFT JOIN public.usuarios u ON u.id = m.usuario_id
      WHERE m.empresa_id = $1
        AND m.tipo = 'processo'
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
  diasSemana: number[] | null,
): Promise<CompanyOabMonitor> => {
  await ensureTable();

  const sanitizedUf = sanitizeUf(uf);
  const sanitizedNumero = sanitizeNumero(numero);
  const sanitizedUsuarioId =
    typeof usuarioId === 'number' && Number.isFinite(usuarioId)
      ? Math.trunc(usuarioId)
      : null;
  const sanitizedDiasSemana = sanitizeDiasSemana(diasSemana);

  if (!sanitizedUf || sanitizedUf.length !== 2) {
    throw new Error('UF da OAB inválida.');
  }

  if (!sanitizedNumero) {
    throw new Error('Número da OAB inválido.');
  }

  const result = await pool.query<OabMonitorRow>(
    `INSERT INTO public.oab_monitoradas (empresa_id, uf, numero, usuario_id, dias_semana, tipo)
     VALUES ($1, $2, $3, $4, $5, 'processo')
     ON CONFLICT (empresa_id, tipo, uf, numero) DO UPDATE

       SET updated_at = NOW(),
           usuario_id = EXCLUDED.usuario_id,
           dias_semana = EXCLUDED.dias_semana
     RETURNING id,
               empresa_id,
               uf,
               numero,
               created_at,
               updated_at,
               usuario_id,
               dias_semana,
               (SELECT nome_completo FROM public.usuarios WHERE id = usuario_id) AS usuario_nome,
               (SELECT oab FROM public.usuarios WHERE id = usuario_id) AS usuario_oab`,
    [empresaId, sanitizedUf, sanitizedNumero, sanitizedUsuarioId, sanitizedDiasSemana],
  );

  return mapRow(result.rows[0]);
};

export const deleteCompanyOabMonitor = async (
  empresaId: number,
  monitorId: number,
): Promise<boolean> => {
  await ensureTable();

  const result = await pool.query(
    `DELETE FROM public.oab_monitoradas
      WHERE empresa_id = $1 AND id = $2 AND tipo = 'processo'`,
    [empresaId, monitorId],
  );

  return (result.rowCount ?? 0) > 0;
};
