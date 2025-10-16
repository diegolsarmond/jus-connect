import pool from './db';

type Queryable = {
  query: (text: string, params?: unknown[]) => Promise<{ rows?: Array<Record<string, unknown>> }>;
};

let ensureIndexesPromise: Promise<void> | null = null;

async function hasProcessosTable(client: Queryable): Promise<boolean> {
  const result = await client.query("SELECT to_regclass('public.processos') AS processos");
  const rows = Array.isArray(result.rows) ? result.rows : [];
  const regclass = rows[0]?.processos;
  return typeof regclass === 'string' && regclass.length > 0;
}

async function createEmpresaIndex(client: Queryable): Promise<void> {
  await client.query(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_processos_idempresa
      ON public.processos (idempresa)
      WHERE idempresa IS NOT NULL;
  `);
}

export async function ensureProcessosIndexes(client: Queryable = pool): Promise<void> {
  if (!ensureIndexesPromise) {
    ensureIndexesPromise = (async () => {
      if (!(await hasProcessosTable(client))) {
        ensureIndexesPromise = null;
        return;
      }

      await createEmpresaIndex(client);
    })().catch((error) => {
      ensureIndexesPromise = null;
      throw error;
    });
  }

  await ensureIndexesPromise;
}
