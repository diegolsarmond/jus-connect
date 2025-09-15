"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSupportRequest = createSupportRequest;
const supportRequests = [];
function createSupportRequest(req, res) {
    const { subject, description } = req.body;
    if (!subject || !description) {
        return res.status(400).json({ message: 'Subject and description are required' });
    }
    const request = {
        id: supportRequests.length + 1,
        subject,
        description,
        createdAt: new Date().toISOString(),
    };
    supportRequests.push(request);
    return res.status(201).json(request);
}
