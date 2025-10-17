import { Pool } from 'pg';
import { existsSync, readFileSync } from 'fs';
import path from 'path';

let connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  const configPaths = [
    path.resolve(__dirname, '../../appsettings.json'),
    path.resolve(process.cwd(), 'appsettings.json'),
  ];

  for (const configPath of configPaths) {
    if (!existsSync(configPath)) {
      continue;
    }

    try {
      const config = JSON.parse(readFileSync(configPath, 'utf-8'));
      connectionString = config.ConnectionStrings?.DefaultConnection;
      if (connectionString) {
        break;
      }
    } catch (error) {
      // appsettings.json is optional; we'll handle missing config below
    }
  }
}

const dockerDbHost = 'base-de-dados_postgres';
const isRunningInsideContainer = existsSync('/.dockerenv');
const localDbHostOverride = process.env.LOCAL_DB_HOST;

if (connectionString && localDbHostOverride && !process.env.DATABASE_URL) {
  try {
    const parsed = new URL(connectionString);
    if (parsed.hostname !== localDbHostOverride) {
      parsed.hostname = localDbHostOverride;
      connectionString = parsed.toString();
    }
  } catch {
    const pattern = /@([^/:]+)(:\d+)?\//;
    if (pattern.test(connectionString)) {
      connectionString = connectionString.replace(
        pattern,
        `@${localDbHostOverride}$2/`
      );
    }
  }
}

if (
  connectionString &&
  connectionString.includes(dockerDbHost) &&
  !process.env.DATABASE_URL
) {
  const replacementHost = localDbHostOverride || (isRunningInsideContainer ? '' : 'localhost');

  if (replacementHost) {
    connectionString = connectionString.replace(dockerDbHost, replacementHost);
  }
}

if (!connectionString) {
  throw new Error(
    'Database connection string not provided. Set DATABASE_URL or add appsettings.json.'
  );
}

const pool = new Pool({
  connectionString,
});

export default pool;

