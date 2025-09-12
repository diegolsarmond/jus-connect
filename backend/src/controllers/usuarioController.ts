import { Request, Response } from 'express';
import pool from '../services/db';

export const listUsuarios = async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT id, nome_completo, cpf, email, perfil, empresa, escritorio, oab, status, senha, telefone, ultimo_login, observacoes, datacriacao 	FROM public."vw.usuarios"'    );
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createUsuario = async (req: Request, res: Response) => {
  const {
    nome_completo,
    cpf,
    email,
    perfil,
    empresa,
    escritorio,
    oab,
    status,
    senha,
    telefone,
    ultimo_login,
    observacoes,
  } = req.body;

  try {
    const result = await pool.query(
      'INSERT INTO public.usuarios (nome_completo, cpf, email, perfil, empresa, escritorio, oab, status, senha, telefone, ultimo_login, observacoes, datacriacao) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW()) RETURNING id, nome_completo, cpf, email, perfil, empresa, escritorio, oab, status, senha, telefone, ultimo_login, observacoes, datacriacao',
      [
        nome_completo,
        cpf,
        email,
        perfil,
        empresa,
        escritorio,
        oab,
        status,
        senha,
        telefone,
        ultimo_login,
        observacoes,
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateUsuario = async (req: Request, res: Response) => {
  const { id } = req.params;
  const {
    nome_completo,
    cpf,
    email,
    perfil,
    empresa,
    escritorio,
    oab,
    status,
    senha,
    telefone,
    ultimo_login,
    observacoes,
  } = req.body;

  try {
    const result = await pool.query(
      'UPDATE public.usuarios SET nome_completo = $1, cpf = $2, email = $3, perfil = $4, empresa = $5, escritorio = $6, oab = $7, status = $8, senha = $9, telefone = $10, ultimo_login = $11, observacoes = $12 WHERE id = $13 RETURNING id, nome_completo, cpf, email, perfil, empresa, escritorio, oab, status, senha, telefone, ultimo_login, observacoes, datacriacao',
      [
        nome_completo,
        cpf,
        email,
        perfil,
        empresa,
        escritorio,
        oab,
        status,
        senha,
        telefone,
        ultimo_login,
        observacoes,
        id,
      ]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteUsuario = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'DELETE FROM public.usuarios WHERE id = $1',
      [id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

