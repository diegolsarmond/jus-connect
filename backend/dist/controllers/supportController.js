"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSupportRequest = createSupportRequest;
exports.listSupportRequests = listSupportRequests;
exports.getSupportRequest = getSupportRequest;
exports.updateSupportRequest = updateSupportRequest;
const supportService_1 = __importStar(require("../services/supportService"));
const supportService = new supportService_1.default();
function parseIdParam(param) {
    const value = Number(param);
    if (!Number.isInteger(value) || value <= 0) {
        return null;
    }
    return value;
}
function extractStatus(value) {
    if (typeof value !== 'string') {
        return undefined;
    }
    const normalized = value.trim().toLowerCase();
    return normalized ? normalized : undefined;
}
async function createSupportRequest(req, res) {
    const { subject, description, requesterName, requesterEmail, status } = req.body;
    const input = {
        subject: subject ?? '',
        description: description ?? '',
        requesterName: requesterName ?? undefined,
        requesterEmail: requesterEmail ?? undefined,
    };
    if (typeof status === 'string' && status.trim()) {
        input.status = status.trim().toLowerCase();
    }
    try {
        const request = await supportService.create(input);
        return res.status(201).json(request);
    }
    catch (error) {
        if (error instanceof supportService_1.ValidationError) {
            return res.status(400).json({ error: error.message });
        }
        console.error('Failed to create support request:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
async function listSupportRequests(req, res) {
    const options = {};
    const pageParam = req.query.page;
    const pageSizeParam = req.query.pageSize ?? req.query.limit; // allow limit alias
    if (typeof pageParam === 'string') {
        const parsed = Number(pageParam);
        if (Number.isFinite(parsed) && parsed > 0) {
            options.page = Math.floor(parsed);
        }
        else {
            return res.status(400).json({ error: 'Invalid page parameter' });
        }
    }
    if (typeof pageSizeParam === 'string') {
        const parsed = Number(pageSizeParam);
        if (Number.isFinite(parsed) && parsed > 0) {
            options.pageSize = Math.floor(parsed);
        }
        else {
            return res.status(400).json({ error: 'Invalid pageSize parameter' });
        }
    }
    const statusFilter = extractStatus(req.query.status);
    if (statusFilter) {
        options.status = statusFilter;
    }
    if (typeof req.query.search === 'string') {
        options.search = req.query.search;
    }
    try {
        const result = await supportService.list(options);
        return res.json(result);
    }
    catch (error) {
        if (error instanceof supportService_1.ValidationError) {
            return res.status(400).json({ error: error.message });
        }
        console.error('Failed to list support requests:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
async function getSupportRequest(req, res) {
    const requestId = parseIdParam(req.params.id);
    if (!requestId) {
        return res.status(400).json({ error: 'Invalid support request id' });
    }
    try {
        const request = await supportService.findById(requestId);
        if (!request) {
            return res.status(404).json({ error: 'Support request not found' });
        }
        return res.json(request);
    }
    catch (error) {
        console.error('Failed to fetch support request:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
async function updateSupportRequest(req, res) {
    const requestId = parseIdParam(req.params.id);
    if (!requestId) {
        return res.status(400).json({ error: 'Invalid support request id' });
    }
    const { subject, description, requesterName, requesterEmail, status } = req.body;
    const updates = {};
    if (subject !== undefined) {
        updates.subject = subject;
    }
    if (description !== undefined) {
        updates.description = description;
    }
    if (requesterName !== undefined) {
        updates.requesterName = requesterName;
    }
    if (requesterEmail !== undefined) {
        updates.requesterEmail = requesterEmail;
    }
    if (typeof status === 'string' && status.trim()) {
        updates.status = status.trim().toLowerCase();
    }
    try {
        const updated = await supportService.update(requestId, updates);
        if (!updated) {
            return res.status(404).json({ error: 'Support request not found' });
        }
        return res.json(updated);
    }
    catch (error) {
        if (error instanceof supportService_1.ValidationError) {
            return res.status(400).json({ error: error.message });
        }
        console.error('Failed to update support request:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
