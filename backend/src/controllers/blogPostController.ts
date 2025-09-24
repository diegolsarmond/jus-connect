import { randomUUID } from 'node:crypto';
import { Request, Response } from 'express';
import pool from '../services/db';

const BLOG_POST_COLUMNS = `
  id,
  title,
  description,
  content,
  author,
  published_at,
  read_time,
  category,
  image,
  slug,
  tags,
  featured,
  created_at,
  updated_at
`;

type BlogPostRow = {
  id: string;
  title: string;
  description: string;
  content: string | null;
  author: string;
  published_at: Date | string | null;
  read_time: string;
  category: string;
  image: string | null;
  slug: string;
  tags: string[] | null;
  featured: boolean | null;
  created_at: Date | string | null;
  updated_at: Date | string | null;
};

const toIsoString = (value: Date | string | null | undefined): string | undefined => {
  if (!value) {
    return undefined;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
};

const mapBlogPostRow = (row: BlogPostRow) => ({
  id: row.id,
  title: row.title,
  description: row.description,
  content: row.content ?? undefined,
  author: row.author,
  date: toIsoString(row.published_at),
  readTime: row.read_time,
  category: row.category,
  image: row.image ?? undefined,
  slug: row.slug,
  tags: Array.isArray(row.tags) ? row.tags : [],
  featured: row.featured ?? false,
  createdAt: toIsoString(row.created_at),
  updatedAt: toIsoString(row.updated_at),
});

class ValidationError extends Error {}

const ensureNonEmptyString = (value: unknown, fieldName: string): string => {
  if (typeof value !== 'string') {
    throw new ValidationError(`O campo "${fieldName}" é obrigatório.`);
  }

  const trimmed = value.trim();

  if (!trimmed) {
    throw new ValidationError(`O campo "${fieldName}" é obrigatório.`);
  }

  return trimmed;
};

const parseOptionalString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const parseBoolean = (value: unknown): boolean | undefined => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }

  return undefined;
};

const parseTags = (value: unknown): string[] => {
  if (value == null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new ValidationError('O campo "tags" deve ser um array de strings.');
  }

  const normalized: string[] = [];

  for (const tag of value) {
    if (typeof tag !== 'string') {
      throw new ValidationError('O campo "tags" deve ser um array de strings.');
    }

    const trimmed = tag.trim();
    if (trimmed) {
      normalized.push(trimmed);
    }
  }

  return normalized;
};

const parsePublishedAt = (value: unknown): Date => {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new ValidationError('O campo "date" é inválido.');
    }
    return value;
  }

  if (typeof value !== 'string') {
    throw new ValidationError('O campo "date" é obrigatório.');
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new ValidationError('O campo "date" é inválido.');
  }

  return parsed;
};

const buildBlogPostPayload = (body: unknown) => {
  if (typeof body !== 'object' || body === null) {
    throw new ValidationError('Corpo da requisição inválido.');
  }

  const data = body as Record<string, unknown>;

  const title = ensureNonEmptyString(data.title, 'title');
  const description = ensureNonEmptyString(data.description, 'description');
  const author = ensureNonEmptyString(data.author, 'author');
  const readTime = ensureNonEmptyString(data.readTime ?? data.read_time, 'readTime');
  const category = ensureNonEmptyString(data.category, 'category');
  const slug = ensureNonEmptyString(data.slug, 'slug');
  const publishedAt = parsePublishedAt(data.date ?? data.publishedAt ?? data.published_at);
  const tags = parseTags(data.tags);
  const content = parseOptionalString(data.content);
  const image = parseOptionalString(data.image);
  const featured = parseBoolean(data.featured) ?? false;

  return {
    title,
    description,
    author,
    readTime,
    category,
    slug,
    publishedAt,
    tags,
    content,
    image,
    featured,
  };
};

const handleDatabaseError = (error: unknown, res: Response) => {
  if (error && typeof error === 'object' && 'code' in error) {
    const pgError = error as { code?: string; detail?: string };
    if (pgError.code === '23505') {
      res.status(409).json({ error: 'Já existe um artigo com o mesmo slug.' });
      return true;
    }
  }

  return false;
};

export const listBlogPosts = async (req: Request, res: Response) => {
  try {
    const slug = typeof req.query.slug === 'string' ? req.query.slug.trim() : '';

    if (slug) {
      const result = await pool.query(
        `SELECT ${BLOG_POST_COLUMNS} FROM blog_posts WHERE slug = $1 ORDER BY published_at DESC NULLS LAST, created_at DESC`,
        [slug]
      );
      const posts = result.rows.map(mapBlogPostRow);
      res.json(posts);
      return;
    }

    const result = await pool.query(
      `SELECT ${BLOG_POST_COLUMNS} FROM blog_posts ORDER BY published_at DESC NULLS LAST, created_at DESC`
    );

    res.json(result.rows.map(mapBlogPostRow));
  } catch (error) {
    console.error('Erro ao listar artigos do blog', error);
    res.status(500).json({ error: 'Erro interno ao listar artigos do blog.' });
  }
};

export const getBlogPostById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT ${BLOG_POST_COLUMNS} FROM blog_posts WHERE id = $1`,
      [id]
    );

    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Artigo não encontrado.' });
      return;
    }

    res.json(mapBlogPostRow(result.rows[0] as BlogPostRow));
  } catch (error) {
    console.error('Erro ao buscar artigo do blog', error);
    res.status(500).json({ error: 'Erro interno ao buscar artigo do blog.' });
  }
};

export const createBlogPost = async (req: Request, res: Response) => {
  try {
    const payload = buildBlogPostPayload(req.body);
    const id = randomUUID();

    const result = await pool.query(
      `INSERT INTO blog_posts (
        id, title, description, content, author, published_at, read_time, category, image, slug, tags, featured
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
      ) RETURNING ${BLOG_POST_COLUMNS}`,
      [
        id,
        payload.title,
        payload.description,
        payload.content ?? null,
        payload.author,
        payload.publishedAt.toISOString(),
        payload.readTime,
        payload.category,
        payload.image ?? null,
        payload.slug,
        payload.tags,
        payload.featured,
      ]
    );

    res.status(201).json(mapBlogPostRow(result.rows[0] as BlogPostRow));
  } catch (error) {
    if (handleDatabaseError(error, res)) {
      return;
    }

    if (error instanceof ValidationError) {
      res.status(400).json({ error: error.message });
      return;
    }

    console.error('Erro ao criar artigo do blog', error);
    res.status(500).json({ error: 'Erro interno ao criar artigo do blog.' });
  }
};

export const updateBlogPost = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const payload = buildBlogPostPayload(req.body);

    const result = await pool.query(
      `UPDATE blog_posts SET
        title = $1,
        description = $2,
        content = $3,
        author = $4,
        published_at = $5,
        read_time = $6,
        category = $7,
        image = $8,
        slug = $9,
        tags = $10,
        featured = $11,
        updated_at = NOW()
      WHERE id = $12
      RETURNING ${BLOG_POST_COLUMNS}`,
      [
        payload.title,
        payload.description,
        payload.content ?? null,
        payload.author,
        payload.publishedAt.toISOString(),
        payload.readTime,
        payload.category,
        payload.image ?? null,
        payload.slug,
        payload.tags,
        payload.featured,
        id,
      ]
    );

    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Artigo não encontrado.' });
      return;
    }

    res.json(mapBlogPostRow(result.rows[0] as BlogPostRow));
  } catch (error) {
    if (handleDatabaseError(error, res)) {
      return;
    }

    if (error instanceof ValidationError) {
      res.status(400).json({ error: error.message });
      return;
    }

    console.error('Erro ao atualizar artigo do blog', error);
    res.status(500).json({ error: 'Erro interno ao atualizar artigo do blog.' });
  }
};

export const deleteBlogPost = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query('DELETE FROM blog_posts WHERE id = $1', [id]);

    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Artigo não encontrado.' });
      return;
    }

    res.status(204).send();
  } catch (error) {
    console.error('Erro ao remover artigo do blog', error);
    res.status(500).json({ error: 'Erro interno ao remover artigo do blog.' });
  }
};
