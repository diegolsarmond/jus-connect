"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const pg_1 = require("pg");
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
let connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    try {
        const configPath = path_1.default.resolve(__dirname, '../../appsettings.json');
        const config = JSON.parse((0, fs_1.readFileSync)(configPath, 'utf-8'));
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
