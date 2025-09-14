import { Request, Response } from 'express';
import pool from '../services/db';

export const listTarefas = async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT t.id, t.id_oportunidades, t.titulo, t.descricao, t.data, t.hora,
              t.dia_inteiro, t.prioridade, t.mostrar_na_agenda, t.privada,
              t.recorrente, t.repetir_quantas_vezes, t.repetir_cada_unidade,
              t.repetir_intervalo, t.criado_em, t.atualizado_em, t.concluido,
              COALESCE(
                json_agg(json_build_object('id_usuario', tr.id_usuario, 'nome_responsavel', u.nome_completo))
                FILTER (WHERE tr.id_usuario IS NOT NULL),
                '[]'
              ) AS responsaveis
       FROM public.tarefas t
       LEFT JOIN public.tarefas_responsaveis tr ON tr.id_tarefa = t.id
       LEFT JOIN public.usuarios u ON u.id = tr.id_usuario
       GROUP BY t.id
ORDER BY t.concluido ASC, t.data ASC, t.prioridade ASC`
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
      `SELECT t.id, t.id_oportunidades, t.titulo, t.descricao, t.data, t.hora,
              t.dia_inteiro, t.prioridade, t.mostrar_na_agenda, t.privada,
              t.recorrente, t.repetir_quantas_vezes, t.repetir_cada_unidade,
              t.repetir_intervalo, t.criado_em, t.atualizado_em, t.concluido,
              COALESCE(
                json_agg(json_build_object('id_usuario', tr.id_usuario, 'nome_responsavel', u.nome_completo))
                FILTER (WHERE tr.id_usuario IS NOT NULL),
                '[]'
              ) AS responsaveis
       FROM public.tarefas t
       LEFT JOIN public.tarefas_responsaveis tr ON tr.id_tarefa = t.id
       LEFT JOIN public.usuarios u ON u.id = tr.id_usuario
       WHERE t.id = $1
       GROUP BY t.id`,
      [id],
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

export const getResponsavelByTarefa = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT tr.id_tarefa, tr.id_usuario, u.nome_completo AS nome_responsavel
       FROM public.tarefas_responsaveis tr
       JOIN public.usuarios u ON tr.id_usuario = u.id
       WHERE tr.id_tarefa = $1`,
      [id],
    );
    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ error: 'Responsável não encontrado para esta tarefa' });
    }
    res.json(result.rows);
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
    concluido = false,
    responsaveis,
  } = req.body;

  const unidadeFormatada = repetir_cada_unidade
    ? repetir_cada_unidade.charAt(0).toUpperCase() + repetir_cada_unidade.slice(1).toLowerCase()
    : null;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
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
        unidadeFormatada,
        repetir_intervalo,
        concluido,
      ]
    );

    const tarefa = result.rows[0];

    if (Array.isArray(responsaveis) && responsaveis.length > 0) {
      const values = responsaveis
        .map((_r: number, idx: number) => `($1, $${idx + 2})`)
        .join(', ');
      await client.query(
        `INSERT INTO public.tarefas_responsaveis (id_tarefa, id_usuario) VALUES ${values}`,
        [tarefa.id, ...responsaveis],
      );
    }

    await client.query('COMMIT');

    let resp = [] as any[];
    if (Array.isArray(responsaveis) && responsaveis.length > 0) {
      const respResult = await client.query(
        `SELECT tr.id_tarefa, tr.id_usuario, u.nome_completo AS nome_responsavel
         FROM public.tarefas_responsaveis tr
         JOIN public.usuarios u ON tr.id_usuario = u.id
         WHERE tr.id_tarefa = $1`,
        [tarefa.id],
      );
      resp = respResult.rows;
    }

    res.status(201).json({ ...tarefa, responsaveis: resp });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
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
    concluido = false,
  } = req.body;

  const unidadeFormatada = repetir_cada_unidade
    ? repetir_cada_unidade.charAt(0).toUpperCase() + repetir_cada_unidade.slice(1).toLowerCase()
    : null;

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
        unidadeFormatada,
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

export const concluirTarefa = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `UPDATE public.tarefas SET concluido = true, atualizado_em = NOW() WHERE id = $1 RETURNING id, id_oportunidades, titulo, descricao, data, hora, dia_inteiro, prioridade, mostrar_na_agenda, privada, recorrente, repetir_quantas_vezes, repetir_cada_unidade, repetir_intervalo, criado_em, atualizado_em, concluido`,
      [id],
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
    const result = await pool.query('UPDATE public.tarefas SET ativo = FALSE WHERE id = $1', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Tarefa não encontrada' });
    }
    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
