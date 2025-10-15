import { Request, Response } from 'express';
import { resolveAuthenticatedEmpresa } from '../utils/authUser';
import {
  findFornecedorById,
  listFornecedoresByEmpresaId,
} from '../services/fornecedorRepository';
import pool from '../services/db';
import { sanitizeDigits } from '../utils/sanitizeDigits';

export const listFornecedores = async (req: Request, res: Response) => {
  try {
    const authResult = await resolveAuthenticatedEmpresa(req);

    if (!authResult.success) {
      return res.status(authResult.status).json({ error: authResult.message });
    }

    const { empresaId } = authResult;

    if (empresaId === null) {
      return res.json([]);
    }

    const fornecedores = await listFornecedoresByEmpresaId(empresaId);

    return res.json(fornecedores);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const getFornecedorById = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const authResult = await resolveAuthenticatedEmpresa(req);

    if (!authResult.success) {
      return res.status(authResult.status).json({ error: authResult.message });
    }

    const fornecedor = await findFornecedorById(id, authResult.empresaId);

    if (!fornecedor) {
      return res.status(404).json({ error: 'Fornecedor não encontrado' });
    }

    return res.json(fornecedor);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const createFornecedor = async (req: Request, res: Response) => {
  const {
    nome,
    tipo,
    documento,
    email,
    telefone,
    cep,
    rua,
    numero,
    complemento,
    bairro,
    cidade,
    uf,
    ativo,
  } = req.body ?? {};

  try {
    const authResult = await resolveAuthenticatedEmpresa(req);

    if (!authResult.success) {
      return res.status(authResult.status).json({ error: authResult.message });
    }

    const { empresaId } = authResult;

    if (empresaId === null) {
      return res
        .status(400)
        .json({ error: 'Usuário autenticado não possui empresa vinculada.' });
    }

    const documentoLimpo = sanitizeDigits(documento);
    const telefoneLimpo = sanitizeDigits(telefone);

    const result = await pool.query(
      `INSERT INTO public.fornecedores
        (nome, tipo, documento, email, telefone, cep, rua, numero, complemento, bairro, cidade, uf, ativo, idempresa, datacadastro)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, COALESCE($13, TRUE), $14, NOW())
    RETURNING id, nome, tipo, documento, email, telefone, cep, rua, numero, complemento, bairro, cidade, uf, ativo, idempresa, datacadastro`,
      [
        nome,
        tipo,
        documentoLimpo,
        email,
        telefoneLimpo,
        cep,
        rua,
        numero,
        complemento,
        bairro,
        cidade,
        uf,
        ativo,
        empresaId,
      ]
    );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateFornecedor = async (req: Request, res: Response) => {
  const { id } = req.params;
  const {
    nome,
    tipo,
    documento,
    email,
    telefone,
    cep,
    rua,
    numero,
    complemento,
    bairro,
    cidade,
    uf,
    ativo,
  } = req.body ?? {};

  try {
    const authResult = await resolveAuthenticatedEmpresa(req);

    if (!authResult.success) {
      return res.status(authResult.status).json({ error: authResult.message });
    }

    const { empresaId } = authResult;

    if (empresaId === null) {
      return res
        .status(400)
        .json({ error: 'Usuário autenticado não possui empresa vinculada.' });
    }

    const documentoLimpo = sanitizeDigits(documento);
    const telefoneLimpo = sanitizeDigits(telefone);

    const result = await pool.query(
      `UPDATE public.fornecedores
          SET nome = $1,
              tipo = $2,
              documento = $3,
              email = $4,
              telefone = $5,
              cep = $6,
              rua = $7,
              numero = $8,
              complemento = $9,
              bairro = $10,
              cidade = $11,
              uf = $12,
              ativo = $13,
              idempresa = $14
        WHERE id = $15
          AND idempresa IS NOT DISTINCT FROM $16
      RETURNING id, nome, tipo, documento, email, telefone, cep, rua, numero, complemento, bairro, cidade, uf, ativo, idempresa, datacadastro`,
      [
        nome,
        tipo,
        documentoLimpo,
        email,
        telefoneLimpo,
        cep,
        rua,
        numero,
        complemento,
        bairro,
        cidade,
        uf,
        ativo,
        empresaId,
        id,
        empresaId,
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Fornecedor não encontrado' });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteFornecedor = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const authResult = await resolveAuthenticatedEmpresa(req);

    if (!authResult.success) {
      return res.status(authResult.status).json({ error: authResult.message });
    }

    const { empresaId } = authResult;

    if (empresaId === null) {
      return res
        .status(400)
        .json({ error: 'Usuário autenticado não possui empresa vinculada.' });
    }

    const result = await pool.query(
      `UPDATE public.fornecedores
          SET ativo = NOT ativo
        WHERE id = $1
          AND idempresa IS NOT DISTINCT FROM $2
      RETURNING ativo`,
      [id, empresaId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Fornecedor não encontrado' });
    }

    return res.json({ ativo: result.rows[0].ativo });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
