import { Pool } from 'pg';
import { readFileSync } from 'fs';

const config = JSON.parse(
  readFileSync(new URL('../../appsettings.json', import.meta.url), 'utf-8')
);

const pool = new Pool({
  connectionString: config.ConnectionStrings.DefaultConnection,
});

export default pool;

