import { Request, Response } from 'express';
import pool from '../services/db';
import { fetchAuthenticatedUserEmpresa } from '../utils/authUser';

export const listTemplates = async (req: Request, res: Response) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ error: 'Token inválido.' });
    }

    const empresaLookup = await fetchAuthenticatedUserEmpresa(req.auth.userId);

    if (!empresaLookup.success) {
      return res.status(empresaLookup.status).json({ error: empresaLookup.message });
    }

    const { empresaId } = empresaLookup;

    if (empresaId === null) {
      return res
        .status(403)
        .json({ error: 'Usuário autenticado não possui empresa vinculada.' });
    }

    const result = await pool.query(
      'SELECT id, title, content FROM templates WHERE idempresa IS NOT DISTINCT FROM $1 AND idusuario = $2 ORDER BY id',
      [empresaId, req.auth.userId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

export const getTemplate = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    if (!req.auth) {
      return res.status(401).json({ error: 'Token inválido.' });
    }

    const empresaLookup = await fetchAuthenticatedUserEmpresa(req.auth.userId);

    if (!empresaLookup.success) {
      return res.status(empresaLookup.status).json({ error: empresaLookup.message });
    }

    const result = await pool.query(
      'SELECT id, title, content FROM templates WHERE id = $1 AND idempresa IS NOT DISTINCT FROM $2 AND idusuario = $3',
      [id, empresaLookup.empresaId, req.auth.userId]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Template not found' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

export const createTemplate = async (req: Request, res: Response) => {
  const { title, content } = req.body;
  try {
    if (!req.auth) {
      return res.status(401).json({ error: 'Token inválido.' });
    }

    const empresaLookup = await fetchAuthenticatedUserEmpresa(req.auth.userId);

    if (!empresaLookup.success) {
      return res.status(empresaLookup.status).json({ error: empresaLookup.message });
    }

    const { empresaId } = empresaLookup;

    if (empresaId === null) {
      return res
        .status(403)
        .json({ error: 'Usuário autenticado não possui empresa vinculada.' });
    }

    const result = await pool.query(
      'INSERT INTO templates (title, content, idempresa, idusuario) VALUES ($1, $2, $3, $4) RETURNING id, title, content',
      [title, content, empresaId, req.auth.userId]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

export const updateTemplate = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { title, content } = req.body;
  try {
    if (!req.auth) {
      return res.status(401).json({ error: 'Token inválido.' });
    }

    const empresaLookup = await fetchAuthenticatedUserEmpresa(req.auth.userId);

    if (!empresaLookup.success) {
      return res.status(empresaLookup.status).json({ error: empresaLookup.message });
    }

    const result = await pool.query(
      'UPDATE templates SET title = $1, content = $2 WHERE id = $3 AND idempresa IS NOT DISTINCT FROM $4 AND idusuario = $5 RETURNING id, title, content',
      [title, content, id, empresaLookup.empresaId, req.auth.userId]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Template not found' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

export const deleteTemplate = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    if (!req.auth) {
      return res.status(401).json({ error: 'Token inválido.' });
    }

    const empresaLookup = await fetchAuthenticatedUserEmpresa(req.auth.userId);

    if (!empresaLookup.success) {
      return res.status(empresaLookup.status).json({ error: empresaLookup.message });
    }

    const result = await pool.query(
      'DELETE FROM templates WHERE id = $1 AND idempresa IS NOT DISTINCT FROM $2 AND idusuario = $3',
      [id, empresaLookup.empresaId, req.auth.userId]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Template not found' });
    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

export const generateWithAI = async (_req: Request, res: Response) => {
  res.json({ content: 'Exemplo gerado com IA' });
};
