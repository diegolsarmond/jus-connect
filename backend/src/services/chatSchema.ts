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
let dependencyWarningLogged = false;

async function resolveSchemaPath(): Promise<string> {
  if (cachedSchemaPath) {
    return cachedSchemaPath;
  }

  const candidatePaths = [
    // Preferred location when the build copies SQL assets next to the compiled files.
    path.resolve(__dirname, '..', 'sql', 'chat.sql'),
    // Falls back to the source tree when running via tsx or ts-node.
    path.resolve(__dirname, '../..', 'sql', 'chat.sql'),
    // Allows running from monorepo root or packaged dist-only deployments.
    path.resolve(process.cwd(), 'sql', 'chat.sql'),
    path.resolve(process.cwd(), 'backend', 'sql', 'chat.sql'),
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
    `Chat schema file not found. Checked: ${candidatePaths.map((candidate) => `"${candidate}"`).join(', ')}`,
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

async function ensureDependencies(client: Queryable): Promise<boolean> {
  let result: { rows?: Array<{ clientes?: unknown }> };

  try {
    result = (await client.query("SELECT to_regclass('public.clientes') AS clientes")) as {
      rows?: Array<{ clientes?: unknown }>;
    };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code && ['ENOTFOUND', 'ECONNREFUSED', 'EAI_AGAIN'].includes(code)) {
      if (!dependencyWarningLogged) {
        dependencyWarningLogged = true;
        console.warn('Ignorando a criação do esquema de chat: conexão com o banco indisponível.');
      }

      return false;
    }

    throw error;
  }

  const hasClientes = Array.isArray(result.rows) && typeof result.rows[0]?.clientes === 'string';

  if (!hasClientes) {
    if (!dependencyWarningLogged) {
      dependencyWarningLogged = true;
      console.warn(
        'Ignorando a criação do esquema de chat: tabela public.clientes ausente no banco de dados.'
      );
    }

    return false;
  }

  return true;
}

async function executeSchema(client: Queryable): Promise<void> {
  const sql = await loadSchemaSql();
  await client.query(sql);
}

export async function ensureChatSchema(client: Queryable = pool): Promise<void> {
  if (process.env.SKIP_CHAT_SCHEMA === 'true') {
    return;
  }

  if (!initializationPromise) {
    initializationPromise = (async () => {
      if (!(await ensureDependencies(client))) {
        initializationPromise = null;
        return;
      }

      await executeSchema(client);
    })().catch((error) => {
      initializationPromise = null;
      throw error;
    });
  }

  await initializationPromise;
}

