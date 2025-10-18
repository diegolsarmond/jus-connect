import { Request, Response } from 'express';
import pool from '../services/db';
import { queryEmpresas } from '../services/empresaQueries';

export const listEmpresas = async (_req: Request, res: Response) => {
  try {
    const result = await queryEmpresas();
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getEmpresaById = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const result = await queryEmpresas('WHERE id = $1', [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Empresa não encontrada' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createEmpresa = async (req: Request, res: Response) => {
  const { nome_empresa, cnpj, telefone, email, plano, responsavel, ativo } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO public.empresas (nome_empresa, cnpj, telefone, email, plano, responsavel, ativo, datacadastro) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) RETURNING id, nome_empresa, cnpj, telefone, email, plano, responsavel, ativo, datacadastro',
      [nome_empresa, cnpj, telefone, email, plano, responsavel, ativo]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateEmpresa = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { nome_empresa, cnpj, telefone, email, plano, responsavel, ativo } = req.body;
  try {
    const result = await pool.query(
      'UPDATE public.empresas SET nome_empresa = $1, cnpj = $2, telefone = $3, email = $4, plano = $5, responsavel = $6, ativo = $7 WHERE id = $8 RETURNING id, nome_empresa, cnpj, telefone, email, plano, responsavel, ativo, datacadastro',
      [nome_empresa, cnpj, telefone, email, plano, responsavel, ativo, id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Empresa não encontrada' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteEmpresa = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'DELETE FROM public.empresas WHERE id = $1',
      [id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Empresa não encontrada' });
    }
    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

