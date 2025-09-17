"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureChatSchema = ensureChatSchema;
const promises_1 = require("node:fs/promises");
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const db_1 = __importDefault(require("./db"));
let cachedSql = null;
let initializationPromise = null;
let cachedSchemaPath = null;
async function resolveSchemaPath() {
    if (cachedSchemaPath) {
        return cachedSchemaPath;
    }
    const candidatePaths = [
        // Preferred location when the build copies SQL assets next to the compiled files.
        node_path_1.default.resolve(__dirname, '..', 'sql', 'chat.sql'),
        // Falls back to the source tree when running via tsx or ts-node.
        node_path_1.default.resolve(__dirname, '../..', 'sql', 'chat.sql'),
        // Allows running from monorepo root or packaged dist-only deployments.
        node_path_1.default.resolve(process.cwd(), 'sql', 'chat.sql'),
        node_path_1.default.resolve(process.cwd(), 'backend', 'sql', 'chat.sql'),
    ];
    for (const candidate of candidatePaths) {
        try {
            await (0, promises_1.access)(candidate, node_fs_1.constants.R_OK);
            cachedSchemaPath = candidate;
            return candidate;
        }
        catch (error) {
            const errno = error.code;
            if (errno && ['ENOENT', 'ENOTDIR'].includes(errno)) {
                continue;
            }
            throw error;
        }
    }
    throw new Error(`Chat schema file not found. Checked: ${candidatePaths.map((candidate) => `"${candidate}"`).join(', ')}`);
}
async function loadSchemaSql() {
    if (cachedSql) {
        return cachedSql;
    }
    const schemaPath = await resolveSchemaPath();
    const sql = await (0, promises_1.readFile)(schemaPath, 'utf-8');
    cachedSql = sql;
    return sql;
}
async function executeSchema(client) {
    const sql = await loadSchemaSql();
    await client.query(sql);
}
async function ensureChatSchema(client = db_1.default) {
    if (!initializationPromise) {
        initializationPromise = executeSchema(client).catch((error) => {
            initializationPromise = null;
            throw error;
        });
    }
    await initializationPromise;
}
