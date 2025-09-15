import { Pool } from 'pg';
import { readFileSync } from 'fs';

const config = JSON.parse(
  readFileSync(new URL('../../appsettings.json', import.meta.url), 'utf-8')
);

const connectionString =
  process.env.DATABASE_URL || config.ConnectionStrings.DefaultConnection;

const pool = new Pool({
  connectionString,
});

export default pool;

