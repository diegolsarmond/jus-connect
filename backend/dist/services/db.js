import { Pool } from 'pg';
import { readFileSync } from 'fs';
let connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    try {
        const config = JSON.parse(readFileSync(new URL('../../appsettings.json', import.meta.url), 'utf-8'));
        connectionString = config.ConnectionStrings?.DefaultConnection;
    }
    catch (error) {
        // appsettings.json is optional; we'll handle missing config below
    }
}
if (!connectionString) {
    throw new Error('Database connection string not provided. Set DATABASE_URL or add appsettings.json.');
}
const pool = new Pool({
    connectionString,
});
export default pool;
