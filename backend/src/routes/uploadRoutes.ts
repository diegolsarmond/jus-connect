import { Router } from 'express';
import { upload } from '../controllers/uploadController';
import { singleFileUpload } from '../middlewares/uploadMiddleware';

const router = Router();

/**
 * @openapi
 * /uploads:
 *   post:
 *     summary: Faz upload de um arquivo.
 *     tags:
 *       - Uploads
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Upload concluído.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 key:
 *                   type: string
 *                 url:
 *                   type: string
 *                   format: uri
 *                 name:
 *                   type: string
 *                 size:
 *                   type: integer
 *                 mimeType:
 *                   type: string
 *       400:
 *         description: Erro de validação no upload.
 *       413:
 *         description: Arquivo excede o limite configurado.
 *       501:
 *         description: Armazenamento de arquivos indisponível.
 *       500:
 *         description: Erro inesperado ao processar o upload.
 */
router.post('/uploads', singleFileUpload, upload);

export default router;
