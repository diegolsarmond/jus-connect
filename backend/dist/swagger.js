import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Jus Connect API',
            version: '1.0.0',
        },
    },
    apis: [
        path.join(__dirname, 'routes/*.{ts,js}'),
        path.join(__dirname, 'index.{ts,js}')
    ],
};
export default swaggerOptions;
