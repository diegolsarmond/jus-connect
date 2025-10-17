import 'dotenv/config';
import { Pool } from 'pg';

const supabaseConnectionString = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;

if (!supabaseConnectionString) {
  console.error('Defina SUPABASE_DATABASE_URL ou DATABASE_URL.');
  process.exit(1);
}

const pool = new Pool({ connectionString: supabaseConnectionString });

const normalizeEmail = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.toLowerCase();
};

const formatEmailList = (values: Array<{ email: unknown }>): string => {
  return values
    .map((entry) => normalizeEmail(entry.email))
    .filter((value): value is string => Boolean(value))
    .join(', ');
};

const main = async () => {
  const client = await pool.connect();

  try {
    const tableLookup = await client.query<{
      regclass: string | null;
    }>("SELECT to_regclass('auth.users')::text AS regclass");

    if (!tableLookup.rows[0]?.regclass) {
      throw new Error('Tabela auth.users não encontrada. Execute no banco Supabase.');
    }

    const duplicateEmails = await client.query<{
      email: string | null;
      total: string | null;
    }>(
      `SELECT LOWER(email) AS email, COUNT(*)::text AS total
         FROM auth.users
        WHERE email IS NOT NULL
        GROUP BY LOWER(email)
       HAVING COUNT(*) > 1`
    );

    if (duplicateEmails.rowCount && duplicateEmails.rowCount > 0) {
      const duplicates = duplicateEmails.rows
        .map((row) => `${row.email ?? 'desconhecido'} (${row.total ?? '0'})`)
        .join(', ');
      throw new Error(`Existem e-mails duplicados em auth.users: ${duplicates}`);
    }

    await client.query('BEGIN');
    let transactionActive = true;

    try {
      const updateResult = await client.query<{
        id: number;
        email: string | null;
        supabase_user_id: string | null;
      }>(
        `UPDATE public.usuarios u
            SET supabase_user_id = au.id
           FROM auth.users au
          WHERE au.email IS NOT NULL
            AND LOWER(au.email) = LOWER(u.email)
            AND (u.supabase_user_id IS DISTINCT FROM au.id OR u.supabase_user_id IS NULL)
      RETURNING u.id, u.email, u.supabase_user_id`
      );

      const clearedResult = await client.query<{
        id: number;
        email: string | null;
      }>(
        `UPDATE public.usuarios u
            SET supabase_user_id = NULL
          WHERE supabase_user_id IS NOT NULL
            AND NOT EXISTS (
              SELECT 1 FROM auth.users au WHERE au.id = u.supabase_user_id
            )
      RETURNING u.id, u.email`
      );

      await client.query('COMMIT');
      transactionActive = false;

      console.log(`Usuários vinculados: ${updateResult.rowCount ?? 0}`);

      if (clearedResult.rowCount && clearedResult.rowCount > 0) {
        console.log(
          `Vínculos removidos por inexistência no Supabase: ${clearedResult.rowCount}. Usuários: ${formatEmailList(
            clearedResult.rows
          )}`
        );
      }

      const missingUsers = await client.query<{
        email: string | null;
      }>(
        `SELECT u.email
           FROM public.usuarios u
          WHERE u.email IS NOT NULL
            AND u.supabase_user_id IS NULL
            AND NOT EXISTS (
              SELECT 1
                FROM auth.users au
               WHERE au.email IS NOT NULL
                 AND LOWER(au.email) = LOWER(u.email)
            )
          ORDER BY u.email`);

      if (missingUsers.rowCount && missingUsers.rowCount > 0) {
        console.warn(
          `Usuários sem correspondência no Supabase: ${formatEmailList(missingUsers.rows)}`
        );
      }
    } catch (error) {
      if (transactionActive) {
        await client.query('ROLLBACK');
      }
      throw error;
    }
  } catch (error) {
    console.error('Falha ao sincronizar usuários com o Supabase.', error);
    process.exitCode = 1;
  } finally {
    client.release();
  }
};

main()
  .catch((error) => {
    console.error('Erro inesperado durante a sincronização do Supabase.', error);
    process.exitCode = 1;
  })
  .finally(() => {
    void pool.end();
  });
