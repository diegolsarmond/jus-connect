"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.replaceVariables = replaceVariables;
function replaceVariables(content, values) {
    return content.replace(/{{\s*([\w\.]+)\s*}}/g, (_match, key) => {
        const value = values[key];
        return value !== undefined ? String(value) : `{{${key}}}`;
    });
}
