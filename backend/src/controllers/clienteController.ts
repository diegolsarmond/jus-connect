import { Request, Response } from 'express';
import pool from '../services/db';

export const listClientes = async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT id, nome, tipo, documento, email, telefone, cep, rua, numero, complemento, bairro, cidade, uf, ativo, foto, datacadastro FROM public.clientes'
    );
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const countClientesAtivos = async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT COUNT(*) AS total_clientes_ativos FROM public.clientes WHERE ativo = TRUE'
    );
    res.json({
      total_clientes_ativos: parseInt(result.rows[0].total_clientes_ativos, 10),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createCliente = async (req: Request, res: Response) => {
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
    foto,
  } = req.body;

  try {
    const result = await pool.query(
      'INSERT INTO public.clientes (nome, tipo, documento, email, telefone, cep, rua, numero, complemento, bairro, cidade, uf, ativo, foto, datacadastro) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW()) RETURNING id, nome, tipo, documento, email, telefone, cep, rua, numero, complemento, bairro, cidade, uf, ativo, foto, datacadastro',
      [
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
        foto,
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateCliente = async (req: Request, res: Response) => {
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
    foto,
  } = req.body;

  try {
    const result = await pool.query(
      'UPDATE public.clientes SET nome = $1, tipo = $2, documento = $3, email = $4, telefone = $5, cep = $6, rua = $7, numero = $8, complemento = $9, bairro = $10, cidade = $11, uf = $12, ativo = $13, foto = $14 WHERE id = $15 RETURNING id, nome, tipo, documento, email, telefone, cep, rua, numero, complemento, bairro, cidade, uf, ativo, foto, datacadastro',
      [
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
        foto,
        id,
      ]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteCliente = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'DELETE FROM public.clientes WHERE id = $1',
      [id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }
    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

