import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import pool from './db';

const SCHEMA_FILES = [
  'process_sync.sql',
  'process_response.sql',
  'sync_audit.sql',
  'vw_processos_sync_targets.sql',
] as const;

type Queryable = {
  query: (text: string) => Promise<unknown>;
};

type CachedSqlEntry = {
  file: string;
  sql: string;
};

let cachedEntries: CachedSqlEntry[] | null = null;
let initializationPromise: Promise<void> | null = null;

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

export async function ensureProcessSyncSchema(client: Queryable = pool): Promise<void> {
  if (!initializationPromise) {
    initializationPromise = executeSchemas(client).catch((error) => {
      initializationPromise = null;
      throw error;
    });
  }

  await initializationPromise;
}
