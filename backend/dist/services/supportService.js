"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupportService = exports.ValidationError = exports.SUPPORT_STATUS_VALUES = void 0;
const db_1 = __importDefault(require("./db"));
const node_buffer_1 = require("node:buffer");
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
const MAX_ATTACHMENTS_PER_MESSAGE = 5;
const MAX_ATTACHMENT_SIZE_BYTES = 5 * 1024 * 1024;
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
function sanitizeFilename(filename) {
    return filename.replace(/[\r\n\t\\]/g, '').trim();
}
function mapAttachmentRow(row) {
    return {
        id: row.id,
        messageId: row.message_id,
        filename: row.filename,
        contentType: row.content_type ?? null,
        fileSize: row.file_size ?? null,
        createdAt: formatDate(row.created_at),
    };
}
function mapMessageRow(row, attachmentsByMessageId) {
    const relatedAttachments = attachmentsByMessageId.get(row.id) ?? [];
    return {
        id: row.id,
        supportRequestId: row.support_request_id,
        sender: row.sender,
        message: row.message,
        createdAt: formatDate(row.created_at),
        attachments: relatedAttachments.map(mapAttachmentRow),
    };
}
class SupportService {
    constructor(db = db_1.default) {
        this.db = db;
    }
    async supportRequestExists(id) {
        const result = await this.db.query('SELECT 1 FROM support_requests WHERE id = $1', [id]);
        return result.rowCount > 0;
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
    async listMessagesForRequest(requestId) {
        const exists = await this.supportRequestExists(requestId);
        if (!exists) {
            return null;
        }
        const messagesResult = await this.db.query(`SELECT id, support_request_id, sender, message, created_at
         FROM support_request_messages
         WHERE support_request_id = $1
         ORDER BY created_at ASC`, [requestId]);
        if (messagesResult.rowCount === 0) {
            return [];
        }
        const messageRows = messagesResult.rows;
        const messageIds = messageRows.map((row) => row.id);
        const attachmentsByMessageId = new Map();
        if (messageIds.length > 0) {
            const attachmentsResult = await this.db.query(`SELECT id, message_id, filename, content_type, file_size, created_at
           FROM support_request_attachments
           WHERE message_id = ANY($1::int[])
           ORDER BY id ASC`, [messageIds]);
            for (const row of attachmentsResult.rows) {
                const current = attachmentsByMessageId.get(row.message_id);
                if (current) {
                    current.push(row);
                }
                else {
                    attachmentsByMessageId.set(row.message_id, [row]);
                }
            }
        }
        return messageRows.map((row) => mapMessageRow(row, attachmentsByMessageId));
    }
    async createMessage(requestId, input) {
        const exists = await this.supportRequestExists(requestId);
        if (!exists) {
            return null;
        }
        const normalizedMessage = normalizeText(input.message ?? null);
        const attachments = Array.isArray(input.attachments) ? input.attachments : [];
        if (!normalizedMessage && attachments.length === 0) {
            throw new ValidationError('Message content or attachments are required');
        }
        if (attachments.length > MAX_ATTACHMENTS_PER_MESSAGE) {
            throw new ValidationError(`A maximum of ${MAX_ATTACHMENTS_PER_MESSAGE} attachments is allowed per message`);
        }
        const sender = input.sender ?? 'requester';
        if (sender !== 'requester' && sender !== 'support') {
            throw new ValidationError('Invalid message sender');
        }
        let storedMessage = normalizedMessage ?? '';
        if (!storedMessage) {
            storedMessage = 'Arquivo(s) enviado(s)';
        }
        const messageResult = await this.db.query(`INSERT INTO support_request_messages (support_request_id, sender, message)
         VALUES ($1, $2, $3)
         RETURNING id, support_request_id, sender, message, created_at`, [requestId, sender, storedMessage]);
        const messageRow = messageResult.rows[0];
        const attachmentRows = [];
        if (attachments.length > 0) {
            try {
                for (const attachment of attachments) {
                    const filename = sanitizeFilename(attachment.filename ?? '');
                    if (!filename) {
                        throw new ValidationError('Attachment filename is required');
                    }
                    if (!node_buffer_1.Buffer.isBuffer(attachment.content)) {
                        throw new ValidationError('Attachment content must be a Buffer');
                    }
                    const buffer = attachment.content;
                    if (buffer.length === 0) {
                        throw new ValidationError(`Attachment "${filename}" is empty`);
                    }
                    if (buffer.length > MAX_ATTACHMENT_SIZE_BYTES) {
                        throw new ValidationError(`Attachment "${filename}" exceeds the maximum allowed size of ${Math.floor(MAX_ATTACHMENT_SIZE_BYTES / (1024 * 1024))}MB`);
                    }
                    const size = typeof attachment.size === 'number' && Number.isFinite(attachment.size)
                        ? Math.max(0, Math.floor(attachment.size))
                        : buffer.length;
                    const insertResult = await this.db.query(`INSERT INTO support_request_attachments (message_id, filename, content_type, file_size, data)
               VALUES ($1, $2, $3, $4, $5)
               RETURNING id, message_id, filename, content_type, file_size, created_at`, [messageRow.id, filename, attachment.contentType ?? null, size, buffer]);
                    attachmentRows.push(insertResult.rows[0]);
                }
            }
            catch (error) {
                await this.db.query('DELETE FROM support_request_messages WHERE id = $1', [messageRow.id]);
                throw error;
            }
        }
        await this.db.query('UPDATE support_requests SET updated_at = NOW() WHERE id = $1', [requestId]);
        const attachmentsByMessageId = new Map();
        attachmentsByMessageId.set(messageRow.id, attachmentRows);
        return mapMessageRow(messageRow, attachmentsByMessageId);
    }
    async getAttachment(messageId, attachmentId) {
        const result = await this.db.query(`SELECT id, message_id, filename, content_type, file_size, created_at, data
         FROM support_request_attachments
         WHERE id = $1 AND message_id = $2`, [attachmentId, messageId]);
        if (result.rowCount === 0) {
            return null;
        }
        const row = result.rows[0];
        const content = row.data ?? node_buffer_1.Buffer.alloc(0);
        return {
            id: row.id,
            messageId: row.message_id,
            filename: row.filename,
            contentType: row.content_type ?? null,
            fileSize: row.file_size ?? content.length,
            createdAt: formatDate(row.created_at),
            content,
        };
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
