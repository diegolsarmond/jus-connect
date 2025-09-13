import { Request, Response } from 'express';
import pool from '../services/db';

export const listFlows = async (req: Request, res: Response) => {
  const { page = '1', limit = '10' } = req.query;
  const pageNum = parseInt(page as string, 10);
  const limitNum = parseInt(limit as string, 10);
  const offset = (pageNum - 1) * limitNum;
  try {
    const items = await pool.query(
      'SELECT * FROM financial_flows ORDER BY vencimento DESC LIMIT $1 OFFSET $2',
      [limitNum, offset],
    );
    const totalResult = await pool.query('SELECT COUNT(*) FROM financial_flows');
    res.json({
      items: items.rows,
      total: parseInt(totalResult.rows[0].count, 10),
      page: pageNum,
      limit: limitNum,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getFlow = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const result = await pool.query('SELECT * FROM financial_flows WHERE id = $1', [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Flow not found' });
    res.json({ flow: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createFlow = async (req: Request, res: Response) => {
  const { tipo, descricao, valor, vencimento } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO financial_flows (tipo, descricao, valor, vencimento, status) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [tipo, descricao, valor, vencimento, 'pendente'],
    );
    res.status(201).json({ flow: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateFlow = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { tipo, descricao, valor, vencimento, pagamento, status } = req.body;
  try {
    const result = await pool.query(
      'UPDATE financial_flows SET tipo=$1, descricao=$2, valor=$3, vencimento=$4, pagamento=$5, status=$6 WHERE id=$7 RETURNING *',
      [tipo, descricao, valor, vencimento, pagamento, status, id],
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Flow not found' });
    res.json({ flow: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteFlow = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM financial_flows WHERE id=$1', [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Flow not found' });
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const settleFlow = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { pagamentoData } = req.body;
  try {
    const result = await pool.query(
      "UPDATE financial_flows SET pagamento=$1, status='pago' WHERE id=$2 RETURNING *",
      [pagamentoData, id],
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Flow not found' });
    res.json({ flow: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};
