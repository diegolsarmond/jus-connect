import { Request, Response } from 'express';
import pool from '../services/db';

export const listTiposEvento = async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT id, nome, ativo, datacriacao, exibe_agenda, exibe_tarefa FROM public.tipo_evento'
    );
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createTipoEvento = async (req: Request, res: Response) => {
  const { nome, ativo, exibe_agenda = true, exibe_tarefa = true } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO public.tipo_evento (nome, ativo, exibe_agenda, exibe_tarefa, datacriacao) VALUES ($1, $2, $3, $4, NOW()) RETURNING id, nome, ativo, exibe_agenda, exibe_tarefa, datacriacao',
      [nome, ativo, exibe_agenda, exibe_tarefa]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateTipoEvento = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { nome, ativo, exibe_agenda = true, exibe_tarefa = true } = req.body;
  try {
    const result = await pool.query(
      'UPDATE public.tipo_evento SET nome = $1, ativo = $2, exibe_agenda = $3, exibe_tarefa = $4 WHERE id = $5 RETURNING id, nome, ativo, exibe_agenda, exibe_tarefa, datacriacao',
      [nome, ativo, exibe_agenda, exibe_tarefa, id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Tipo de evento não encontrado' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteTipoEvento = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'DELETE FROM public.tipo_evento WHERE id = $1',
      [id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Tipo de evento não encontrado' });
    }
    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

