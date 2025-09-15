"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const url_1 = require("url");
const __filename = (0, url_1.fileURLToPath)(import.meta.url);
const __dirname = path_1.default.dirname(__filename);
const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Jus Connect API',
            version: '1.0.0',
        },
    },
    apis: [
        path_1.default.join(__dirname, 'routes/*.{ts,js}'),
        path_1.default.join(__dirname, 'index.{ts,js}')
    ],
};
exports.default = swaggerOptions;
