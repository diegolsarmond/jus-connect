"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const node_assert_1 = __importDefault(require("node:assert"));
const templateService_1 = require("../services/templateService");
(0, node_test_1.default)('replaceVariables replaces placeholders with provided values', () => {
    const content = 'Olá {{cliente}}';
    const result = (0, templateService_1.replaceVariables)(content, { cliente: 'Maria' });
    node_assert_1.default.strictEqual(result, 'Olá Maria');
});
