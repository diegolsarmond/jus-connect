import { Request, Response } from 'express';
import pool from '../services/db';

const parseOptionalId = (value: unknown): number | null | 'invalid' => {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') {
      return null;
    }

    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
      return 'invalid';
    }

    return parsed;
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value) || !Number.isInteger(value)) {
      return 'invalid';
    }

    return value;
  }

  return 'invalid';
};

const parseStatus = (value: unknown): boolean | 'invalid' => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    if (value === 1) {
      return true;
    }

    if (value === 0) {
      return false;
    }

    return 'invalid';
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();

    if (normalized === '') {
      return 'invalid';
    }

    if (
      [
        'true',
        '1',
        't',
        'y',
        'yes',
        'sim',
        'ativo',
        'active',
      ].includes(normalized)
    ) {
      return true;
    }

    if (
      [
        'false',
        '0',
        'f',
        'n',
        'no',
        'nao',
        'não',
        'inativo',
        'inactive',
      ].includes(normalized)
    ) {
      return false;
    }

    return 'invalid';
  }

  return 'invalid';
};

const baseUsuarioSelect =
  'SELECT id, nome_completo, cpf, email, perfil, empresa, setor, oab, status, senha, telefone, ultimo_login, observacoes, datacriacao FROM public.vw_usuarios';

export const listUsuarios = async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(baseUsuarioSelect);
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getUsuarioById = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const result = await pool.query(`${baseUsuarioSelect} WHERE id = $1`, [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    res.json(result.rows[0]);
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
    setor,
    oab,
    status,
    senha,
    telefone,
    ultimo_login,
    observacoes,
  } = req.body;

  try {
    if (!req.auth) {
      return res.status(401).json({ error: 'Token inválido.' });
    }

    const parsedStatus = parseStatus(status);
    if (parsedStatus === 'invalid') {
      return res.status(400).json({ error: 'Status inválido' });
    }

    const empresaIdResult = parseOptionalId(empresa);
    if (empresaIdResult === 'invalid') {
      return res.status(400).json({ error: 'ID de empresa inválido' });
    }

    const empresaUsuarioResult = await pool.query(
      'SELECT empresa FROM public.usuarios WHERE id = $1 LIMIT 1',
      [req.auth.userId]
    );

    if (empresaUsuarioResult.rowCount === 0) {
      return res.status(404).json({ error: 'Usuário autenticado não encontrado' });
    }

    const empresaAtualResult = parseOptionalId(
      (empresaUsuarioResult.rows[0] as { empresa: unknown }).empresa
    );

    if (empresaAtualResult === 'invalid') {
      return res
        .status(500)
        .json({ error: 'Não foi possível identificar a empresa do usuário autenticado.' });
    }

    if (empresaIdResult !== null && empresaAtualResult !== null && empresaIdResult !== empresaAtualResult) {
      return res
        .status(403)
        .json({ error: 'Usuários só podem criar usuários vinculados à sua própria empresa.' });
    }

    if (empresaIdResult !== null && empresaAtualResult === null) {
      return res
        .status(403)
        .json({ error: 'Usuário autenticado não possui empresa vinculada.' });
    }

    const empresaId = empresaAtualResult;

    if (empresaId !== null) {
      const empresaExists = await pool.query(
        'SELECT 1 FROM public.empresas WHERE id = $1',
        [empresaId]
      );
      if (empresaExists.rowCount === 0) {
        return res.status(400).json({ error: 'Empresa informada não existe' });
      }
    }

    const setorIdResult = parseOptionalId(setor);
    if (setorIdResult === 'invalid') {
      return res.status(400).json({ error: 'ID de setor inválido' });
    }
    const setorId = setorIdResult;

    if (setorId !== null) {
      const setorExists = await pool.query(
        'SELECT 1 FROM public.escritorios WHERE id = $1',
        [setorId]
      );
      if (setorExists.rowCount === 0) {
        return res
          .status(400)
          .json({ error: 'Setor informado não existe' });
      }
    }

    const result = await pool.query(
      'INSERT INTO public.usuarios (nome_completo, cpf, email, perfil, empresa, setor, oab, status, senha, telefone, ultimo_login, observacoes, datacriacao) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW()) RETURNING id, nome_completo, cpf, email, perfil, empresa, setor, oab, status, senha, telefone, ultimo_login, observacoes, datacriacao',
      [
        nome_completo,
        cpf,
        email,
        perfil,
        empresaId,
        setorId,
        oab,
        parsedStatus,
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
    setor,
    oab,
    status,
    senha,
    telefone,
    ultimo_login,
    observacoes,
  } = req.body;

  try {
    const parsedStatus = parseStatus(status);
    if (parsedStatus === 'invalid') {
      return res.status(400).json({ error: 'Status inválido' });
    }

    const empresaIdResult = parseOptionalId(empresa);
    if (empresaIdResult === 'invalid') {
      return res.status(400).json({ error: 'ID de empresa inválido' });
    }
    const empresaId = empresaIdResult;

    if (empresaId !== null) {
      const empresaExists = await pool.query(
        'SELECT 1 FROM public.empresas WHERE id = $1',
        [empresaId]
      );
      if (empresaExists.rowCount === 0) {
        return res.status(400).json({ error: 'Empresa informada não existe' });
      }
    }

    const setorIdResult = parseOptionalId(setor);
    if (setorIdResult === 'invalid') {
      return res.status(400).json({ error: 'ID de setor inválido' });
    }
    const setorId = setorIdResult;

    if (setorId !== null) {
      const setorExists = await pool.query(
        'SELECT 1 FROM public.escritorios WHERE id = $1',
        [setorId]
      );
      if (setorExists.rowCount === 0) {
        return res
          .status(400)
          .json({ error: 'Setor informado não existe' });
      }
    }

    const result = await pool.query(
      'UPDATE public.usuarios SET nome_completo = $1, cpf = $2, email = $3, perfil = $4, empresa = $5, setor = $6, oab = $7, status = $8, senha = $9, telefone = $10, ultimo_login = $11, observacoes = $12 WHERE id = $13 RETURNING id, nome_completo, cpf, email, perfil, empresa, setor, oab, status, senha, telefone, ultimo_login, observacoes, datacriacao',
      [
        nome_completo,
        cpf,
        email,
        perfil,
        empresaId,
        setorId,
        oab,
        parsedStatus,
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

