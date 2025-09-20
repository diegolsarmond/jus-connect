import { Request, Response } from 'express';
import pool from '../services/db';
import { fetchAuthenticatedUserEmpresa } from '../utils/authUser';

export const listTarefas = async (req: Request, res: Response) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ error: 'Token inválido.' });
    }

    const empresaLookup = await fetchAuthenticatedUserEmpresa(req.auth.userId);

    if (!empresaLookup.success) {
      return res.status(empresaLookup.status).json({ error: empresaLookup.message });
    }

    const { empresaId } = empresaLookup;

    if (empresaId === null) {
      return res.json([]);
    }

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
        WHERE t.ativo IS TRUE
          AND t.idempresa IS NOT DISTINCT FROM $1
          AND t.idusuario = $2
        GROUP BY t.id
    ORDER BY t.concluido ASC, t.data ASC, t.prioridade ASC`,
      [empresaId, req.auth.userId]
    );

    return res.json(result.rows);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const getTarefaById = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    if (!req.auth) {
      return res.status(401).json({ error: 'Token inválido.' });
    }

    const empresaLookup = await fetchAuthenticatedUserEmpresa(req.auth.userId);

    if (!empresaLookup.success) {
      return res.status(empresaLookup.status).json({ error: empresaLookup.message });
    }

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
          AND t.ativo IS TRUE
          AND t.idempresa IS NOT DISTINCT FROM $2
          AND t.idusuario = $3
        GROUP BY t.id`,
      [id, empresaLookup.empresaId, req.auth.userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Tarefa não encontrada' });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const getResponsavelByTarefa = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    if (!req.auth) {
      return res.status(401).json({ error: 'Token inválido.' });
    }

    const empresaLookup = await fetchAuthenticatedUserEmpresa(req.auth.userId);

    if (!empresaLookup.success) {
      return res.status(empresaLookup.status).json({ error: empresaLookup.message });
    }

    const result = await pool.query(
      `SELECT tr.id_tarefa, tr.id_usuario, u.nome_completo AS nome_responsavel
         FROM public.tarefas_responsaveis tr
         JOIN public.usuarios u ON tr.id_usuario = u.id
         JOIN public.tarefas t ON t.id = tr.id_tarefa
        WHERE tr.id_tarefa = $1
          AND t.ativo IS TRUE
          AND t.idempresa IS NOT DISTINCT FROM $2
          AND t.idusuario = $3`,
      [id, empresaLookup.empresaId, req.auth.userId]
    );

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ error: 'Responsável não encontrado para esta tarefa' });
    }

    return res.json(result.rows);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal server error' });
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

  try {
    if (!req.auth) {
      return res.status(401).json({ error: 'Token inválido.' });
    }

    const empresaLookup = await fetchAuthenticatedUserEmpresa(req.auth.userId);

    if (!empresaLookup.success) {
      return res.status(empresaLookup.status).json({ error: empresaLookup.message });
    }

    const { empresaId } = empresaLookup;

    if (empresaId === null) {
      return res
        .status(400)
        .json({ error: 'Usuário autenticado não possui empresa vinculada.' });
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      const result = await client.query(
        `INSERT INTO public.tarefas (id_oportunidades, titulo, descricao, data, hora, dia_inteiro, prioridade, mostrar_na_agenda,
privada, recorrente, repetir_quantas_vezes, repetir_cada_unidade, repetir_intervalo, criado_em, atualizado_em, concluido, idempr
esa, idusuario)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW(), $14, $15, $16)
         RETURNING id, id_oportunidades, titulo, descricao, data, hora, dia_inteiro, prioridade, mostrar_na_agenda, privada, recor
rente, repetir_quantas_vezes, repetir_cada_unidade, repetir_intervalo, criado_em, atualizado_em, concluido, idempresa, idusuario`,
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
          empresaId,
          req.auth.userId,
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

      let responsaveisResult: any[] = [];
      if (Array.isArray(responsaveis) && responsaveis.length > 0) {
        const respResult = await client.query(
          `SELECT tr.id_tarefa, tr.id_usuario, u.nome_completo AS nome_responsavel
             FROM public.tarefas_responsaveis tr
             JOIN public.usuarios u ON tr.id_usuario = u.id
            WHERE tr.id_tarefa = $1`,
          [tarefa.id]
        );
        responsaveisResult = respResult.rows;
      }

      return res.status(201).json({ ...tarefa, responsaveis: responsaveisResult });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(error);
      return res.status(500).json({ error: 'Internal server error' });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal server error' });
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
    if (!req.auth) {
      return res.status(401).json({ error: 'Token inválido.' });
    }

    const empresaLookup = await fetchAuthenticatedUserEmpresa(req.auth.userId);

    if (!empresaLookup.success) {
      return res.status(empresaLookup.status).json({ error: empresaLookup.message });
    }

    const { empresaId } = empresaLookup;

    if (empresaId === null) {
      return res
        .status(400)
        .json({ error: 'Usuário autenticado não possui empresa vinculada.' });
    }

    const result = await pool.query(
      `UPDATE public.tarefas
          SET id_oportunidades = $1,
              titulo = $2,
              descricao = $3,
              data = $4,
              hora = $5,
              dia_inteiro = $6,
              prioridade = $7,
              mostrar_na_agenda = $8,
              privada = $9,
              recorrente = $10,
              repetir_quantas_vezes = $11,
              repetir_cada_unidade = $12,
              repetir_intervalo = $13,
              concluido = $14,
              atualizado_em = NOW()
        WHERE id = $15
          AND idempresa IS NOT DISTINCT FROM $16
          AND idusuario = $17
        RETURNING id, id_oportunidades, titulo, descricao, data, hora, dia_inteiro, prioridade, mostrar_na_agenda, privada, recorrente, repetir_quantas_vezes, repetir_cada_unidade, repetir_intervalo, criado_em, atualizado_em, concluido, idempresa, idusuario`,
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
        empresaId,
        req.auth.userId,
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Tarefa não encontrada' });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const concluirTarefa = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    if (!req.auth) {
      return res.status(401).json({ error: 'Token inválido.' });
    }

    const empresaLookup = await fetchAuthenticatedUserEmpresa(req.auth.userId);

    if (!empresaLookup.success) {
      return res.status(empresaLookup.status).json({ error: empresaLookup.message });
    }

    const { empresaId } = empresaLookup;

    if (empresaId === null) {
      return res
        .status(400)
        .json({ error: 'Usuário autenticado não possui empresa vinculada.' });
    }

    const result = await pool.query(
      `UPDATE public.tarefas
          SET concluido = true,
              atualizado_em = NOW()
        WHERE id = $1
          AND idempresa IS NOT DISTINCT FROM $2
          AND idusuario = $3
        RETURNING id, id_oportunidades, titulo, descricao, data, hora, dia_inteiro, prioridade, mostrar_na_agenda, privada, recorrente, repetir_quantas_vezes, repetir_cada_unidade, repetir_intervalo, criado_em, atualizado_em, concluido, idempresa, idusuario`,
      [id, empresaId, req.auth.userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Tarefa não encontrada' });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteTarefa = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    if (!req.auth) {
      return res.status(401).json({ error: 'Token inválido.' });
    }

    const empresaLookup = await fetchAuthenticatedUserEmpresa(req.auth.userId);

    if (!empresaLookup.success) {
      return res.status(empresaLookup.status).json({ error: empresaLookup.message });
    }

    const { empresaId } = empresaLookup;

    if (empresaId === null) {
      return res
        .status(400)
        .json({ error: 'Usuário autenticado não possui empresa vinculada.' });
    }

    const result = await pool.query(
      'UPDATE public.tarefas SET ativo = FALSE WHERE id = $1 AND idempresa IS NOT DISTINCT FROM $2 AND idusuario = $3',
      [id, empresaId, req.auth.userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Tarefa não encontrada' });
    }

    return res.status(204).send();
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
