"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupportService = exports.ValidationError = exports.SUPPORT_STATUS_VALUES = void 0;
const db_1 = __importDefault(require("./db"));
exports.SUPPORT_STATUS_VALUES = ['open', 'in_progress', 'resolved', 'closed'];
class ValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ValidationError';
    }
}
exports.ValidationError = ValidationError;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
function normalizeText(value) {
    if (value === null || value === undefined) {
        return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}
function assertValidStatus(status) {
    if (!exports.SUPPORT_STATUS_VALUES.includes(status)) {
        throw new ValidationError('Invalid status provided');
    }
}
function formatDate(value) {
    if (value instanceof Date) {
        return value.toISOString();
    }
    return new Date(value).toISOString();
}
function mapRow(row) {
    return {
        id: row.id,
        subject: row.subject,
        description: row.description,
        status: row.status,
        requesterName: row.requester_name,
        requesterEmail: row.requester_email,
        createdAt: formatDate(row.created_at),
        updatedAt: formatDate(row.updated_at),
    };
}
class SupportService {
    constructor(db = db_1.default) {
        this.db = db;
    }
    async create(input) {
        const subject = normalizeText(input.subject ?? null);
        const description = normalizeText(input.description ?? null);
        if (!subject) {
            throw new ValidationError('Subject is required');
        }
        if (!description) {
            throw new ValidationError('Description is required');
        }
        const status = input.status ?? 'open';
        assertValidStatus(status);
        const requesterName = normalizeText(input.requesterName);
        const requesterEmail = normalizeText(input.requesterEmail);
        const result = await this.db.query(`INSERT INTO support_requests (subject, description, status, requester_name, requester_email)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, subject, description, status, requester_name, requester_email, created_at, updated_at`, [subject, description, status, requesterName, requesterEmail]);
        return mapRow(result.rows[0]);
    }
    async list(options = {}) {
        const page = options.page && options.page > 0 ? Math.floor(options.page) : 1;
        const pageSizeRaw = options.pageSize && options.pageSize > 0 ? Math.floor(options.pageSize) : DEFAULT_PAGE_SIZE;
        const pageSize = Math.min(pageSizeRaw, MAX_PAGE_SIZE);
        const offset = (page - 1) * pageSize;
        const conditions = [];
        const values = [];
        if (options.status) {
            assertValidStatus(options.status);
            values.push(options.status);
            conditions.push(`status = $${values.length}`);
        }
        if (options.search) {
            const searchValue = `%${options.search.trim()}%`;
            values.push(searchValue);
            conditions.push(`(subject ILIKE $${values.length} OR description ILIKE $${values.length})`);
        }
        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const baseQuery = `SELECT id, subject, description, status, requester_name, requester_email, created_at, updated_at
      FROM support_requests
      ${whereClause}
      ORDER BY created_at DESC`;
        const dataQuery = `${baseQuery}
      LIMIT $${values.length + 1}
      OFFSET $${values.length + 2}`;
        const dataValues = [...values, pageSize, offset];
        const itemsResult = await this.db.query(dataQuery, dataValues);
        const totalResult = await this.db.query(`SELECT COUNT(*)::int AS total FROM support_requests ${whereClause}`, values);
        const totalRow = totalResult.rows[0];
        const total = totalRow ? Number(totalRow.total) : 0;
        return {
            items: itemsResult.rows.map(mapRow),
            total,
            page,
            pageSize,
        };
    }
    async findById(id) {
        const result = await this.db.query(`SELECT id, subject, description, status, requester_name, requester_email, created_at, updated_at
       FROM support_requests
       WHERE id = $1`, [id]);
        if (result.rowCount === 0) {
            return null;
        }
        return mapRow(result.rows[0]);
    }
    async update(id, updates) {
        const fields = [];
        const values = [];
        let index = 1;
        if (typeof updates.subject === 'string') {
            const subject = normalizeText(updates.subject);
            if (!subject) {
                throw new ValidationError('Subject cannot be empty');
            }
            fields.push(`subject = $${index}`);
            values.push(subject);
            index += 1;
        }
        if (typeof updates.description === 'string') {
            const description = normalizeText(updates.description);
            if (!description) {
                throw new ValidationError('Description cannot be empty');
            }
            fields.push(`description = $${index}`);
            values.push(description);
            index += 1;
        }
        if (updates.status !== undefined) {
            assertValidStatus(updates.status);
            fields.push(`status = $${index}`);
            values.push(updates.status);
            index += 1;
        }
        if (updates.requesterName !== undefined) {
            const name = normalizeText(updates.requesterName);
            fields.push(`requester_name = $${index}`);
            values.push(name);
            index += 1;
        }
        if (updates.requesterEmail !== undefined) {
            const email = normalizeText(updates.requesterEmail);
            fields.push(`requester_email = $${index}`);
            values.push(email);
            index += 1;
        }
        if (fields.length === 0) {
            throw new ValidationError('No fields provided to update');
        }
        const query = `UPDATE support_requests
      SET ${fields.join(', ')}, updated_at = NOW()
      WHERE id = $${index}
      RETURNING id, subject, description, status, requester_name, requester_email, created_at, updated_at`;
        values.push(id);
        const result = await this.db.query(query, values);
        if (result.rowCount === 0) {
            return null;
        }
        return mapRow(result.rows[0]);
    }
}
exports.SupportService = SupportService;
exports.default = SupportService;
