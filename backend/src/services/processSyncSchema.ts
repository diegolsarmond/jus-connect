import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import pool from './db';

const SCHEMA_FILES = [
  'process_sync.sql',
  'process_response.sql',
  'sync_audit.sql',
  'vw_processos_sync_targets.sql',
  'sync_jobs.sql',
] as const;

type Queryable = {
  query: (text: string, params?: unknown[]) => Promise<unknown>;
};

type CachedSqlEntry = {
  file: string;
  sql: string;
};

let cachedEntries: CachedSqlEntry[] | null = null;
let initializationPromise: Promise<void> | null = null;
let dependencyWarningLogged = false;

async function resolveFilePath(file: string): Promise<string> {
  const candidatePaths = [
    path.resolve(__dirname, '..', 'sql', file),
    path.resolve(__dirname, '../..', 'sql', file),
    path.resolve(process.cwd(), 'sql', file),
    path.resolve(process.cwd(), 'backend', 'sql', file),
  ];

  for (const candidate of candidatePaths) {
    try {
      await access(candidate, constants.R_OK);
      return candidate;
    } catch (error) {
      const errno = (error as NodeJS.ErrnoException).code;
      if (errno && ['ENOENT', 'ENOTDIR'].includes(errno)) {
        continue;
      }
      throw error;
    }
  }

  throw new Error(
    `Process sync schema file "${file}" not found. Checked: ${candidatePaths
      .map((candidate) => `"${candidate}"`)
      .join(', ')}`,
  );
}

async function loadSchemaSql(): Promise<CachedSqlEntry[]> {
  if (cachedEntries) {
    return cachedEntries;
  }

  const entries: CachedSqlEntry[] = [];

  for (const file of SCHEMA_FILES) {
    const schemaPath = await resolveFilePath(file);
    const sql = await readFile(schemaPath, 'utf-8');
    entries.push({ file, sql });
  }

  cachedEntries = entries;
  return entries;
}

async function executeSchemas(client: Queryable): Promise<void> {
  const entries = await loadSchemaSql();

  for (const entry of entries) {
    await client.query(entry.sql);
  }
}

async function ensureDependencies(client: Queryable): Promise<boolean> {
  const result = (await client.query("SELECT to_regclass('public.processos') AS processos")) as {
    rows?: Array<{ processos?: unknown }>;
  };

  const hasProcessos = Array.isArray(result.rows) && typeof result.rows[0]?.processos === 'string';

  if (!hasProcessos) {
    if (!dependencyWarningLogged) {
      dependencyWarningLogged = true;
      console.warn(
        'Ignorando a criação do esquema de sincronização de processos: tabela public.processos ausente.'
      );
    }

    return false;
  }

  return true;
}

export async function ensureProcessSyncSchema(client: Queryable = pool): Promise<void> {
  if (!initializationPromise) {
    initializationPromise = (async () => {
      if (!(await ensureDependencies(client))) {
        initializationPromise = null;
        return;
      }

      await executeSchemas(client);
    })().catch((error) => {
      initializationPromise = null;
      throw error;
    });
  }

  await initializationPromise;
}
