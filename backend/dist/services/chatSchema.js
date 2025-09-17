"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureChatSchema = ensureChatSchema;
const promises_1 = require("node:fs/promises");
const node_path_1 = __importDefault(require("node:path"));
const db_1 = __importDefault(require("./db"));
let cachedSql = null;
let initializationPromise = null;
const resolveSchemaPath = () => node_path_1.default.resolve(__dirname, '../..', 'sql', 'chat.sql');
async function loadSchemaSql() {
    if (cachedSql) {
        return cachedSql;
    }
    const schemaPath = resolveSchemaPath();
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
