"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.upload = void 0;
const upload = async (_req, res) => {
    // Stub implementation for uploads. In a real scenario, this would upload to S3/MinIO.
    res.json({ key: 'stub', url: 'https://example.com/stub', name: 'file', size: 0 });
};
exports.upload = upload;
