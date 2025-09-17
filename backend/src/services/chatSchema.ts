import { readFile } from 'node:fs/promises';
import path from 'node:path';
import pool from './db';

type Queryable = {
  query: (text: string, params?: unknown[]) => Promise<unknown>;
};

let cachedSql: string | null = null;
let initializationPromise: Promise<void> | null = null;

const resolveSchemaPath = () => path.resolve(__dirname, '../..', 'sql', 'chat.sql');

async function loadSchemaSql(): Promise<string> {
  if (cachedSql) {
    return cachedSql;
  }

  const schemaPath = resolveSchemaPath();
  const sql = await readFile(schemaPath, 'utf-8');
  cachedSql = sql;
  return sql;
}

async function executeSchema(client: Queryable): Promise<void> {
  const sql = await loadSchemaSql();
  await client.query(sql);
}

export async function ensureChatSchema(client: Queryable = pool): Promise<void> {
  if (!initializationPromise) {
    initializationPromise = executeSchema(client).catch((error) => {
      initializationPromise = null;
      throw error;
    });
  }

  await initializationPromise;
}

