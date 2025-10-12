"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureProcessSyncSchema = ensureProcessSyncSchema;
const promises_1 = require("node:fs/promises");
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const db_1 = __importDefault(require("./db"));
const SCHEMA_FILES = ['process_sync.sql', 'process_response.sql', 'sync_audit.sql', 'vw_processos_sync_targets.sql'];
let cachedEntries = null;
let initializationPromise = null;
async function resolveFilePath(file) {
    const candidatePaths = [
        node_path_1.default.resolve(__dirname, '..', 'sql', file),
        node_path_1.default.resolve(__dirname, '../..', 'sql', file),
        node_path_1.default.resolve(process.cwd(), 'sql', file),
        node_path_1.default.resolve(process.cwd(), 'backend', 'sql', file),
    ];
    for (const candidate of candidatePaths) {
        try {
            await (0, promises_1.access)(candidate, node_fs_1.constants.R_OK);
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
    throw new Error(`Process sync schema file "${file}" not found. Checked: ${candidatePaths
        .map((candidate) => `"${candidate}"`)
        .join(', ')}`);
}
async function loadSchemaSql() {
    if (cachedEntries) {
        return cachedEntries;
    }
    const entries = [];
    for (const file of SCHEMA_FILES) {
        const schemaPath = await resolveFilePath(file);
        const sql = await (0, promises_1.readFile)(schemaPath, 'utf-8');
        entries.push({ file, sql });
    }
    cachedEntries = entries;
    return entries;
}
async function executeSchemas(client) {
    const entries = await loadSchemaSql();
    for (const entry of entries) {
        await client.query(entry.sql);
    }
}
async function ensureProcessSyncSchema(client = db_1.default) {
    if (!initializationPromise) {
        initializationPromise = executeSchemas(client).catch((error) => {
            initializationPromise = null;
            throw error;
        });
    }
    await initializationPromise;
}
