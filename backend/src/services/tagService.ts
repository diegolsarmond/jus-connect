import type { QueryResultRow } from 'pg';
import pool from './db';

type TagRecord = QueryResultRow & {
  id: number;
  key: string;
  label: string;
  example: string | null;
  group_name: string | null;
};

type TagInput = {
  key: string;
  label: string;
  example: string | null;
  group_name: string | null;
};

const toQueryError = (error: unknown, message: string) => {
  if (error instanceof Error) {
    return new Error(message, { cause: error });
  }
  return new Error(message);
};

export const listTags = async (): Promise<TagRecord[]> => {
  try {
    const result = await pool.query<TagRecord>(
      'SELECT id, key, label, example, group_name FROM tags ORDER BY group_name, label'
    );
    return result.rows;
  } catch (error) {
    throw toQueryError(error, 'Falha ao listar tags');
  }
};

export const createTag = async (input: TagInput): Promise<TagRecord> => {
  try {
    const result = await pool.query<TagRecord>(
      'INSERT INTO tags (key, label, example, group_name) VALUES ($1, $2, $3, $4) RETURNING id, key, label, example, group_name',
      [input.key, input.label, input.example, input.group_name]
    );
    return result.rows[0];
  } catch (error) {
    throw toQueryError(error, 'Falha ao criar tag');
  }
};

export const updateTag = async (
  id: string,
  input: TagInput
): Promise<TagRecord | null> => {
  try {
    const result = await pool.query<TagRecord>(
      'UPDATE tags SET key = $1, label = $2, example = $3, group_name = $4 WHERE id = $5 RETURNING id, key, label, example, group_name',
      [input.key, input.label, input.example, input.group_name, id]
    );
    if (result.rowCount === 0) {
      return null;
    }
    return result.rows[0];
  } catch (error) {
    throw toQueryError(error, 'Falha ao atualizar tag');
  }
};

export const deleteTag = async (id: string): Promise<boolean> => {
  try {
    const result = await pool.query('DELETE FROM tags WHERE id = $1', [id]);
    return result.rowCount > 0;
  } catch (error) {
    throw toQueryError(error, 'Falha ao excluir tag');
  }
};
