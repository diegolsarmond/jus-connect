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
  dias_semana: unknown;
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
  diasSemana: number[] | null;
}

let ensureTablePromise: Promise<void> | null = null;

const ensureTable = async (): Promise<void> => {
  if (!ensureTablePromise) {
    ensureTablePromise = pool
      .query(`
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
  diasSemana: parseDiasSemanaColumn(row.dias_semana),
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
            m.dias_semana,
            u.nome_completo AS usuario_nome,
            COALESCE(p.oab_number, NULLIF(u.oab, '')) AS usuario_oab_numero,
            p.oab_uf AS usuario_oab_uf
       FROM public.oab_monitoradas m
  LEFT JOIN public.usuarios u ON u.id = m.usuario_id
  LEFT JOIN public.user_profiles p ON p.user_id = m.usuario_id
      WHERE m.empresa_id = $1
        AND m.tipo = 'intimacao'
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
  diasSemana: number[] | null,
): Promise<IntimacaoOabMonitor> => {
  await ensureTable();

  if (!Number.isInteger(usuarioId) || usuarioId <= 0) {
    throw new Error('Usuário inválido.');
  }

  await assertCompanyUser(empresaId, usuarioId);

  const sanitizedUf = sanitizeUf(uf);
  const sanitizedNumero = sanitizeNumero(numero);
  const sanitizedDiasSemana = sanitizeDiasSemana(diasSemana);

  if (!sanitizedUf || sanitizedUf.length !== 2) {
    throw new Error('UF da OAB inválida.');
  }

  if (!sanitizedNumero) {
    throw new Error('Número da OAB inválido.');
  }

  const result = await pool.query<IntimacaoOabMonitorRow>(
    `WITH upsert AS (
       INSERT INTO public.oab_monitoradas (empresa_id, usuario_id, uf, numero, dias_semana, tipo)
       VALUES ($1, $2, $3, $4, $5, 'intimacao')
       ON CONFLICT (empresa_id, tipo, uf, numero) DO UPDATE

         SET usuario_id = EXCLUDED.usuario_id,
             updated_at = NOW(),
             dias_semana = EXCLUDED.dias_semana
       RETURNING id, empresa_id, usuario_id, uf, numero, created_at, updated_at, dias_semana
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
            upsert.updated_at,
            upsert.dias_semana
       FROM upsert
  LEFT JOIN public.usuarios u ON u.id = upsert.usuario_id
  LEFT JOIN public.user_profiles p ON p.user_id = upsert.usuario_id`,
    [empresaId, usuarioId, sanitizedUf, sanitizedNumero, sanitizedDiasSemana],
  );

  return mapRow(result.rows[0]);
};

export const deleteIntimacaoOabMonitor = async (
  empresaId: number,
  monitorId: number,
): Promise<boolean> => {
  await ensureTable();

  const result = await pool.query(
    `DELETE FROM public.oab_monitoradas
      WHERE id = $1 AND empresa_id = $2 AND tipo = 'intimacao'
      RETURNING id`,
    [monitorId, empresaId],
  );

  return (result.rowCount ?? 0) > 0;
};
