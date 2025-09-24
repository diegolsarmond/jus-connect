import { Router } from 'express';
import {
  listBlogPosts,
  getBlogPostById,
  createBlogPost,
  updateBlogPost,
  deleteBlogPost,
} from '../controllers/blogPostController';

const router = Router();
export const publicBlogPostRoutes = Router();

/**
 * @swagger
 * tags:
 *   - name: Blog
 *     description: Endpoints para gerenciamento dos artigos do blog institucional
 * components:
 *   schemas:
 *     BlogPost:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         title:
 *           type: string
 *         description:
 *           type: string
 *         content:
 *           type: string
 *           nullable: true
 *         author:
 *           type: string
 *         date:
 *           type: string
 *           format: date-time
 *           description: Data de publicação do artigo
 *         readTime:
 *           type: string
 *         category:
 *           type: string
 *         image:
 *           type: string
 *           nullable: true
 *         slug:
 *           type: string
 *         tags:
 *           type: array
 *           items:
 *             type: string
 *         featured:
 *           type: boolean
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     BlogPostInput:
 *       type: object
 *       required:
 *         - title
 *         - description
 *         - author
 *         - date
 *         - readTime
 *         - category
 *         - slug
 *         - tags
 *       properties:
 *         title:
 *           type: string
 *         description:
 *           type: string
 *         author:
 *           type: string
 *         date:
 *           type: string
 *           format: date-time
 *         readTime:
 *           type: string
 *         category:
 *           type: string
 *         slug:
 *           type: string
 *           description: Identificador único utilizado na URL do artigo
 *         image:
 *           type: string
 *           nullable: true
 *         content:
 *           type: string
 *           nullable: true
 *         tags:
 *           type: array
 *           items:
 *             type: string
 *         featured:
 *           type: boolean
 */

/**
 * @swagger
 * /api/posts:
 *   get:
 *     summary: Lista os artigos do blog
 *     tags: [Blog]
 *     parameters:
 *       - in: query
 *         name: slug
 *         schema:
 *           type: string
 *         required: false
 *         description: Filtra o resultado pelo slug do artigo
 *     responses:
 *       200:
 *         description: Lista de artigos publicados
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/BlogPost'
 */
publicBlogPostRoutes.get('/posts', listBlogPosts);

/**
 * @swagger
 * /api/posts/{id}:
 *   get:
 *     summary: Obtém um artigo do blog pelo identificador
 *     tags: [Blog]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Artigo encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BlogPost'
 *       404:
 *         description: Artigo não encontrado
 */
router.get('/posts/:id', getBlogPostById);

/**
 * @swagger
 * /api/posts:
 *   post:
 *     summary: Cria um novo artigo para o blog
 *     tags: [Blog]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BlogPostInput'
 *     responses:
 *       201:
 *         description: Artigo criado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BlogPost'
 *       400:
 *         description: Requisição inválida
 *       409:
 *         description: Já existe um artigo com o slug informado
 */
router.post('/posts', createBlogPost);

/**
 * @swagger
 * /api/posts/{id}:
 *   put:
 *     summary: Atualiza um artigo existente do blog
 *     tags: [Blog]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BlogPostInput'
 *     responses:
 *       200:
 *         description: Artigo atualizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BlogPost'
 *       400:
 *         description: Requisição inválida
 *       404:
 *         description: Artigo não encontrado
 *       409:
 *         description: Já existe um artigo com o slug informado
 */
router.put('/posts/:id', updateBlogPost);

/**
 * @swagger
 * /api/posts/{id}:
 *   delete:
 *     summary: Remove um artigo do blog
 *     tags: [Blog]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       204:
 *         description: Artigo removido com sucesso
 *       404:
 *         description: Artigo não encontrado
 */
router.delete('/posts/:id', deleteBlogPost);

export default router;
