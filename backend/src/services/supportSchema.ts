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

const DEFAULT_RETRY_BASE_DELAY_MS = 1_000;
const DEFAULT_RETRY_MAX_DELAY_MS = 30_000;

type EnsureSupportSchemaOptions = {
  /**
   * Allows tests to customize the retry delay strategy.
   */
  delay?: (attempt: number) => Promise<void>;
  retryBaseDelayMs?: number;
  retryMaxDelayMs?: number;
};

function createDelay({
  retryBaseDelayMs = DEFAULT_RETRY_BASE_DELAY_MS,
  retryMaxDelayMs = DEFAULT_RETRY_MAX_DELAY_MS,
  delay,
}: EnsureSupportSchemaOptions): (attempt: number) => Promise<void> {
  if (delay) {
    return delay;
  }

  return async (attempt: number) => {
    const exponent = Math.min(attempt, 10);
    const computedDelay = Math.min(
      retryMaxDelayMs,
      retryBaseDelayMs * 2 ** exponent,
    );

    await new Promise((resolve) => setTimeout(resolve, computedDelay));
  };
}

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

export async function ensureSupportSchema(
  client: Queryable = pool,
  options: EnsureSupportSchemaOptions = {},
): Promise<void> {
  if (!initializationPromise) {
    const delay = createDelay(options);

    const initialize = async (attempt = 0): Promise<void> => {
      try {
        await executeSchema(client);
        connectionWarningLogged = false;
      } catch (error) {
        const errno = (error as NodeJS.ErrnoException).code;

        if (errno && CONNECTION_ERROR_CODES.has(errno)) {
          if (!connectionWarningLogged) {
            connectionWarningLogged = true;
            console.warn(
              'Ignorando a criação do esquema de suporte: falha ao conectar ao banco de dados. Retentando...',
              error,
            );
          }

          await delay(attempt);
          return initialize(attempt + 1);
        }

        throw error;
      }
    };

    initializationPromise = initialize().catch((error) => {
      initializationPromise = null;
      throw error;
    });
  }

  await initializationPromise;
}

