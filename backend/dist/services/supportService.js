"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupportService = exports.ValidationError = exports.SUPPORT_STATUS_VALUES = void 0;
const db_1 = __importDefault(require("./db"));
const node_buffer_1 = require("node:buffer");
exports.SUPPORT_STATUS_VALUES = ['open', 'in_progress', 'resolved', 'closed', 'cancelled'];
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
const SUPPORT_REQUEST_RETURNING_FIELDS = [
    'id',
    'subject',
    'description',
    'status',
    'requester_id',
    'requester_name',
    'requester_email',
    'support_agent_id',
    'support_agent_name',
    'created_at',
    'updated_at',
];
function normalizeText(value) {
    if (value === null || value === undefined) {
        return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}
function normalizeEmail(value) {
    if (value === null || value === undefined) {
        return null;
    }
    const trimmed = value.trim();
    if (!trimmed) {
        return null;
    }
    return trimmed.toLowerCase();
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
        requesterId: row.requester_id ?? null,
        requesterName: row.requester_name,
        requesterEmail: row.requester_email,
        supportAgentId: row.support_agent_id ?? null,
        supportAgentName: row.support_agent_name,
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
        const requesterId = typeof input.requesterId === 'number' && Number.isInteger(input.requesterId) && input.requesterId > 0
            ? input.requesterId
            : null;
        const requesterName = normalizeText(input.requesterName);
        const requesterEmail = normalizeEmail(input.requesterEmail);
        const columns = ['subject', 'description', 'status'];
        const values = [subject, description, status];
        if (requesterId != null) {
            columns.push('requester_id');
            values.push(requesterId);
        }
        if (requesterName !== null) {
            columns.push('requester_name');
            values.push(requesterName);
        }
        if (requesterEmail !== null) {
            columns.push('requester_email');
            values.push(requesterEmail);
        }
        const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');
        const returningFields = SUPPORT_REQUEST_RETURNING_FIELDS.join(', ');
        const result = await this.db.query(`INSERT INTO support_requests (${columns.join(', ')})
       VALUES (${placeholders})
       RETURNING ${returningFields}`, values);
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
        const requesterEmail = normalizeEmail(options.requesterEmail);
        if (options.requesterId != null || requesterEmail) {
            const requesterConditions = [];
            if (options.requesterId != null) {
                values.push(options.requesterId);
                requesterConditions.push(`requester_id = $${values.length}`);
            }
            if (requesterEmail) {
                values.push(requesterEmail);
                requesterConditions.push(`LOWER(requester_email) = $${values.length}`);
            }
            if (requesterConditions.length > 0) {
                conditions.push(`(${requesterConditions.join(' OR ')})`);
            }
        }
        if (options.search) {
            const searchValue = `%${options.search.trim()}%`;
            values.push(searchValue);
            conditions.push(`(subject ILIKE $${values.length} OR description ILIKE $${values.length})`);
        }
        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const baseQuery = `SELECT id, subject, description, status, requester_id, requester_name, requester_email, support_agent_id, support_agent_name, created_at, updated_at
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
        const result = await this.db.query(`SELECT id, subject, description, status, requester_id, requester_name, requester_email, support_agent_id, support_agent_name, created_at, updated_at
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
    async createMessage(requestId, input, context) {
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
        const attachmentsByMessageId = new Map();
        attachmentsByMessageId.set(messageRow.id, attachmentRows);
        let hasSupportAgentUpdate = false;
        if (sender === 'support' && context) {
            const hasAgentId = Object.prototype.hasOwnProperty.call(context, 'supportAgentId');
            const hasAgentName = Object.prototype.hasOwnProperty.call(context, 'supportAgentName');
            if (hasAgentId || hasAgentName) {
                const updatePayload = {};
                if (hasAgentId) {
                    updatePayload.supportAgentId = context.supportAgentId ?? null;
                }
                if (hasAgentName) {
                    updatePayload.supportAgentName = context.supportAgentName ?? null;
                }
                await this.update(requestId, updatePayload);
                hasSupportAgentUpdate = true;
            }
        }
        if (!hasSupportAgentUpdate) {
            await this.db.query('UPDATE support_requests SET updated_at = NOW() WHERE id = $1', [requestId]);
        }
        return mapMessageRow(messageRow, attachmentsByMessageId);
    }
    async getAttachment(messageId, attachmentId) {
        const result = await this.db.query(`SELECT a.id,
              a.message_id,
              a.filename,
              a.content_type,
              a.file_size,
              a.created_at,
              a.data,
              m.support_request_id,
              r.requester_id,
              r.requester_email
         FROM support_request_attachments a
         JOIN support_request_messages m ON m.id = a.message_id
         JOIN support_requests r ON r.id = m.support_request_id
         WHERE a.id = $1 AND a.message_id = $2`, [attachmentId, messageId]);
        if (result.rowCount === 0) {
            return null;
        }
        const row = result.rows[0];
        const content = row.data ?? node_buffer_1.Buffer.alloc(0);
        return {
            id: row.id,
            messageId: row.message_id,
            supportRequestId: row.support_request_id,
            requesterId: row.requester_id ?? null,
            requesterEmail: row.requester_email ?? null,
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
            const email = normalizeEmail(updates.requesterEmail);
            fields.push(`requester_email = $${index}`);
            values.push(email);
            index += 1;
        }
        if (updates.supportAgentId !== undefined) {
            const agentId = updates.supportAgentId;
            if (agentId === null) {
                fields.push('support_agent_id = NULL');
            }
            else if (typeof agentId === 'number' && Number.isInteger(agentId) && agentId > 0) {
                fields.push(`support_agent_id = $${index}`);
                values.push(agentId);
                index += 1;
            }
            else {
                throw new ValidationError('Support agent id must be a positive integer');
            }
        }
        if (updates.supportAgentName !== undefined) {
            const agentName = normalizeText(updates.supportAgentName);
            fields.push(`support_agent_name = $${index}`);
            values.push(agentName);
            index += 1;
        }
        if (fields.length === 0) {
            throw new ValidationError('No fields provided to update');
        }
        const query = `UPDATE support_requests
      SET ${fields.join(', ')}, updated_at = NOW()
      WHERE id = $${index}
      RETURNING ${SUPPORT_REQUEST_RETURNING_FIELDS.join(', ')}`;
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
