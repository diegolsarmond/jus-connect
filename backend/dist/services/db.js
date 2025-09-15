"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const pg_1 = require("pg");
const fs_1 = require("fs");
let connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    try {
        const config = JSON.parse((0, fs_1.readFileSync)(new URL('../../appsettings.json', import.meta.url), 'utf-8'));
        connectionString = config.ConnectionStrings?.DefaultConnection;
    }
    catch (error) {
        // appsettings.json is optional; we'll handle missing config below
    }
}
if (!connectionString) {
    throw new Error('Database connection string not provided. Set DATABASE_URL or add appsettings.json.');
}
const pool = new pg_1.Pool({
    connectionString,
});
exports.default = pool;
