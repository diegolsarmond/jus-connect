import { Request, Response } from 'express';
import pool from '../services/db';
import { ensureAuthenticatedEmpresaId } from '../middlewares/ensureAuthenticatedEmpresa';

export const listTemplates = async (req: Request, res: Response) => {
  try {
    const empresaId = await ensureAuthenticatedEmpresaId(req, res);
    if (empresaId === undefined) {
      return;
    }
    const userId = req.auth!.userId;

    const result = await pool.query(
      'SELECT id, title, content FROM templates WHERE idempresa IS NOT DISTINCT FROM $1 AND idusuario = $2 ORDER BY id',
      [empresaId, userId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getTemplate = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const empresaId = await ensureAuthenticatedEmpresaId(req, res);
    if (empresaId === undefined) {
      return;
    }
    const userId = req.auth!.userId;

    const result = await pool.query(
      'SELECT id, title, content FROM templates WHERE id = $1 AND idempresa IS NOT DISTINCT FROM $2 AND idusuario = $3',
      [id, empresaId, userId]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Template not found' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createTemplate = async (req: Request, res: Response) => {
  const { title, content } = req.body;
  try {
    const empresaId = await ensureAuthenticatedEmpresaId(req, res);
    if (empresaId === undefined) {
      return;
    }
    const userId = req.auth!.userId;

    const result = await pool.query(
      'INSERT INTO templates (title, content, idempresa, idusuario) VALUES ($1, $2, $3, $4) RETURNING id, title, content',
      [title, content, empresaId, userId]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateTemplate = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { title, content } = req.body;
  try {
    const empresaId = await ensureAuthenticatedEmpresaId(req, res);
    if (empresaId === undefined) {
      return;
    }
    const userId = req.auth!.userId;

    const result = await pool.query(
      'UPDATE templates SET title = $1, content = $2 WHERE id = $3 AND idempresa IS NOT DISTINCT FROM $4 AND idusuario = $5 RETURNING id, title, content',
      [title, content, id, empresaId, userId]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Template not found' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteTemplate = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const empresaId = await ensureAuthenticatedEmpresaId(req, res);
    if (empresaId === undefined) {
      return;
    }
    const userId = req.auth!.userId;

    const result = await pool.query(
      'DELETE FROM templates WHERE id = $1 AND idempresa IS NOT DISTINCT FROM $2 AND idusuario = $3',
      [id, empresaId, userId]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Template not found' });
    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const generateWithAI = async (_req: Request, res: Response) => {
  res.json({ content: 'Exemplo gerado com IA' });
};
