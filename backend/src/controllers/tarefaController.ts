import { Request, Response } from 'express';
import pool from '../services/db';

export const listTarefas = async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT id, id_oportunidades, titulo, descricao, data, hora, dia_inteiro, prioridade, mostrar_na_agenda, privada, recorrente, repetir_quantas_vezes, repetir_cada_unidade, repetir_intervalo, criado_em, atualizado_em, concluido FROM public.tarefas'
    );
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getTarefaById = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'SELECT id, id_oportunidades, titulo, descricao, data, hora, dia_inteiro, prioridade, mostrar_na_agenda, privada, recorrente, repetir_quantas_vezes, repetir_cada_unidade, repetir_intervalo, criado_em, atualizado_em, concluido FROM public.tarefas WHERE id = $1',
      [id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Tarefa não encontrada' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createTarefa = async (req: Request, res: Response) => {
  const {
    id_oportunidades,
    titulo,
    descricao,
    data,
    hora,
    dia_inteiro = false,
    prioridade,
    mostrar_na_agenda = true,
    privada = true,
    recorrente = false,
    repetir_quantas_vezes = 1,
    repetir_cada_unidade,
    repetir_intervalo = 1,
    concluido = true,
  } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO public.tarefas (id_oportunidades, titulo, descricao, data, hora, dia_inteiro, prioridade, mostrar_na_agenda, privada, recorrente, repetir_quantas_vezes, repetir_cada_unidade, repetir_intervalo, criado_em, atualizado_em, concluido)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW(), $14)
       RETURNING id, id_oportunidades, titulo, descricao, data, hora, dia_inteiro, prioridade, mostrar_na_agenda, privada, recorrente, repetir_quantas_vezes, repetir_cada_unidade, repetir_intervalo, criado_em, atualizado_em, concluido`,
      [
        id_oportunidades,
        titulo,
        descricao,
        data,
        hora,
        dia_inteiro,
        prioridade,
        mostrar_na_agenda,
        privada,
        recorrente,
        repetir_quantas_vezes,
        repetir_cada_unidade,
        repetir_intervalo,
        concluido,
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateTarefa = async (req: Request, res: Response) => {
  const { id } = req.params;
  const {
    id_oportunidades,
    titulo,
    descricao,
    data,
    hora,
    dia_inteiro = false,
    prioridade,
    mostrar_na_agenda = true,
    privada = true,
    recorrente = false,
    repetir_quantas_vezes = 1,
    repetir_cada_unidade,
    repetir_intervalo = 1,
    concluido = true,
  } = req.body;

  try {
    const result = await pool.query(
      `UPDATE public.tarefas SET id_oportunidades = $1, titulo = $2, descricao = $3, data = $4, hora = $5, dia_inteiro = $6, prioridade = $7, mostrar_na_agenda = $8, privada = $9, recorrente = $10, repetir_quantas_vezes = $11, repetir_cada_unidade = $12, repetir_intervalo = $13, concluido = $14, atualizado_em = NOW() WHERE id = $15
       RETURNING id, id_oportunidades, titulo, descricao, data, hora, dia_inteiro, prioridade, mostrar_na_agenda, privada, recorrente, repetir_quantas_vezes, repetir_cada_unidade, repetir_intervalo, criado_em, atualizado_em, concluido`,
      [
        id_oportunidades,
        titulo,
        descricao,
        data,
        hora,
        dia_inteiro,
        prioridade,
        mostrar_na_agenda,
        privada,
        recorrente,
        repetir_quantas_vezes,
        repetir_cada_unidade,
        repetir_intervalo,
        concluido,
        id,
      ]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Tarefa não encontrada' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteTarefa = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM public.tarefas WHERE id = $1', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Tarefa não encontrada' });
    }
    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
