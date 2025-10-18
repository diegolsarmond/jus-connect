import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import pool from './db';

type Queryable = {
  query: (text: string, params?: unknown[]) => Promise<unknown>;
};

const CONNECTION_ERROR_CODES = new Set(['ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'ECONNRESET']);

let cachedSql: string | null = null;
let initializationPromise: Promise<void> | null = null;
let cachedSchemaPath: string | null = null;
let connectionWarningLogged = false;

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
    let shouldReset = false;

    const promise = (async () => {
      try {
        await executeSchema(client);
      } catch (error) {
        const errno = (error as NodeJS.ErrnoException).code;

        if (errno && CONNECTION_ERROR_CODES.has(errno)) {
          if (!connectionWarningLogged) {
            connectionWarningLogged = true;
            console.warn(
              'Ignorando a criação do esquema de suporte: falha ao conectar ao banco de dados.',
              error,
            );
          }

          shouldReset = true;
          return;
        }

        throw error;
      }
    })()
      .catch((error) => {
        initializationPromise = null;
        throw error;
      })
      .finally(() => {
        if (shouldReset) {
          initializationPromise = null;
        }
      });

    initializationPromise = promise;
  }

  await initializationPromise;
}

