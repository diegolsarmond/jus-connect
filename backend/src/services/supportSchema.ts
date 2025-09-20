import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import pool from './db';

type Queryable = {
  query: (text: string, params?: unknown[]) => Promise<unknown>;
};

let cachedSql: string | null = null;
let initializationPromise: Promise<void> | null = null;
let cachedSchemaPath: string | null = null;

async function resolveSchemaPath(): Promise<string> {
  if (cachedSchemaPath) {
    return cachedSchemaPath;
  }

  const candidatePaths = [
    path.resolve(__dirname, '..', 'sql', 'support.sql'),
    path.resolve(__dirname, '../..', 'sql', 'support.sql'),
    path.resolve(process.cwd(), 'sql', 'support.sql'),
    path.resolve(process.cwd(), 'backend', 'sql', 'support.sql'),
  ];

  for (const candidate of candidatePaths) {
    try {
      await access(candidate, constants.R_OK);
      cachedSchemaPath = candidate;
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
    `Support schema file not found. Checked: ${candidatePaths
      .map((candidate) => `"${candidate}"`)
      .join(', ')}`,
  );
}

async function loadSchemaSql(): Promise<string> {
  if (cachedSql) {
    return cachedSql;
  }

  const schemaPath = await resolveSchemaPath();
  const sql = await readFile(schemaPath, 'utf-8');
  cachedSql = sql;
  return sql;
}

async function executeSchema(client: Queryable): Promise<void> {
  const sql = await loadSchemaSql();
  await client.query(sql);
}

export async function ensureSupportSchema(client: Queryable = pool): Promise<void> {
  if (!initializationPromise) {
    initializationPromise = executeSchema(client).catch((error) => {
      initializationPromise = null;
      throw error;
    });
  }

  await initializationPromise;
}

