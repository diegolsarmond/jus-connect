import { Request, Response } from 'express';
import pool from '../services/db';

// Lista os usuários responsáveis por uma tarefa
export const listResponsaveis = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT tr.id_tarefa, tr.id_usuario, u.nome_completo AS nome_responsavel
       FROM public.tarefas_responsaveis tr
       JOIN public.usuarios u ON tr.id_usuario = u.id
       WHERE tr.id_tarefa = $1`,
      [id],
    );
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

// Adiciona usuários responsáveis a uma tarefa
export const addResponsaveis = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { responsaveis } = req.body as { responsaveis: number[] };

  if (!Array.isArray(responsaveis) || responsaveis.length === 0) {
    return res
      .status(400)
      .json({ error: 'responsaveis deve ser um array de IDs de usuários' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const values = responsaveis
      .map((_r, idx) => `($1, $${idx + 2})`)
      .join(', ');
    await client.query(
      `INSERT INTO public.tarefas_responsaveis (id_tarefa, id_usuario) VALUES ${values}`,
      [id, ...responsaveis],
    );
    await client.query('COMMIT');
    res.status(201).json({ id_tarefa: Number(id), responsaveis });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  } finally {
    client.release();
  }
};

