import { Request, Response } from 'express';
import pool from '../services/db';
import { createNotification } from '../services/notificationService';
import { fetchAuthenticatedUserEmpresa } from '../utils/authUser';

export const listTarefas = async (req: Request, res: Response) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ error: 'Token inválido.' });
    }

    const empresaLookup = await fetchAuthenticatedUserEmpresa(req.auth.userId);

    if (!empresaLookup.success) {
      return res
        .status(empresaLookup.status)
        .json({ error: empresaLookup.message });
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
              t.idempresa, t.idusuario,
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
         AND EXISTS (
           SELECT 1
             FROM public.tarefas_responsaveis trf
            WHERE trf.id_tarefa = t.id
              AND trf.id_usuario = $2
         )
       GROUP BY t.id
ORDER BY t.concluido ASC, t.data ASC, t.prioridade ASC`,
      [empresaId, req.auth.userId]
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
    if (!req.auth) {
      return res.status(401).json({ error: 'Token inválido.' });
    }

    const empresaLookup = await fetchAuthenticatedUserEmpresa(req.auth.userId);

    if (!empresaLookup.success) {
      return res
        .status(empresaLookup.status)
        .json({ error: empresaLookup.message });
    }

    const result = await pool.query(
      `SELECT t.id, t.id_oportunidades, t.titulo, t.descricao, t.data, t.hora,
              t.dia_inteiro, t.prioridade, t.mostrar_na_agenda, t.privada,
              t.recorrente, t.repetir_quantas_vezes, t.repetir_cada_unidade,
              t.repetir_intervalo, t.criado_em, t.atualizado_em, t.concluido,
              t.idempresa, t.idusuario,
              COALESCE(
                json_agg(json_build_object('id_usuario', tr.id_usuario, 'nome_responsavel', u.nome_completo))
                FILTER (WHERE tr.id_usuario IS NOT NULL),
                '[]'
              ) AS responsaveis
       FROM public.tarefas t
       LEFT JOIN public.tarefas_responsaveis tr ON tr.id_tarefa = t.id
       LEFT JOIN public.usuarios u ON u.id = tr.id_usuario
       WHERE t.id = $1
         AND t.idempresa IS NOT DISTINCT FROM $2
       GROUP BY t.id`,
      [id, empresaLookup.empresaId],
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Tarefa não encontrada' });
    }

    const tarefa = result.rows[0];

    try {
      const responsaveisResult = await pool.query(
        'SELECT id_usuario FROM public.tarefas_responsaveis WHERE id_tarefa = $1',
        [id],
      );

      const recipientIds = new Set<string>();
      if (req.auth?.userId) {
        recipientIds.add(String(req.auth.userId));
      }

      if (typeof tarefa.idusuario === 'number') {
        recipientIds.add(String(tarefa.idusuario));
      }

      for (const row of responsaveisResult.rows) {
        const value = (row as { id_usuario?: unknown }).id_usuario;
        if (typeof value === 'number' && Number.isFinite(value)) {
          recipientIds.add(String(value));
        }
      }

      await Promise.all(
        Array.from(recipientIds).map(async (userId) => {
          try {
            await createNotification({
              userId,
              title: `Tarefa atualizada: ${tarefa.titulo}`,
              message: tarefa.hora
                ? `A tarefa "${tarefa.titulo}" foi atualizada para ${tarefa.data} às ${tarefa.hora}.`
                : `A tarefa "${tarefa.titulo}" foi atualizada para ${tarefa.data}.`,
              category: 'tasks',
              type: 'info',
              metadata: {
                taskId: tarefa.id,
                opportunityId: tarefa.id_oportunidades,
                dueDate: tarefa.data,
                dueTime: tarefa.hora,
                priority: tarefa.prioridade,
                completed: tarefa.concluido,
              },
            });
          } catch (notifyError) {
            console.error('Falha ao enviar notificação de atualização de tarefa', notifyError);
          }
        }),
      );
    } catch (notifyError) {
      console.error('Falha ao preparar destinatários de notificação de tarefa', notifyError);
    }

    res.json(tarefa);
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
    if (!req.auth) {
      return res.status(401).json({ error: 'Token inválido.' });
    }

    const empresaLookup = await fetchAuthenticatedUserEmpresa(req.auth.userId);

    if (!empresaLookup.success) {
      return res
        .status(empresaLookup.status)
        .json({ error: empresaLookup.message });
    }

    const { empresaId } = empresaLookup;

    if (empresaId === null) {
      return res
        .status(400)
        .json({ error: 'Usuário autenticado não possui empresa vinculada.' });
    }

    await client.query('BEGIN');
    const result = await client.query(
      `INSERT INTO public.tarefas (id_oportunidades, titulo, descricao, data, hora, dia_inteiro, prioridade, mostrar_na_agenda, privada, recorrente, repetir_quantas_vezes, repetir_cada_unidade, repetir_intervalo, criado_em, atualizado_em, concluido, idempresa, idusuario)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW(), $14, $15, $16)
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

    const recipientIds = new Set<string>();
    recipientIds.add(String(req.auth.userId));

    if (Array.isArray(responsaveis)) {
      for (const value of responsaveis) {
        if (typeof value === 'number' && Number.isFinite(value)) {
          recipientIds.add(String(value));
        } else if (typeof value === 'string' && value.trim()) {
          recipientIds.add(value.trim());
        }
      }
    }

    const metadata = {
      taskId: tarefa.id,
      opportunityId: tarefa.id_oportunidades,
      dueDate: tarefa.data,
      dueTime: tarefa.hora,
      priority: tarefa.prioridade,
      companyId: tarefa.idempresa,
      creatorId: req.auth.userId,
    } as Record<string, unknown>;

    await Promise.all(
      Array.from(recipientIds).map(async (userId) => {
        try {
          await createNotification({
            userId,
            title: `Nova tarefa: ${tarefa.titulo}`,
            message: tarefa.hora
              ? `A tarefa "${tarefa.titulo}" foi criada para ${tarefa.data} às ${tarefa.hora}.`
              : `A tarefa "${tarefa.titulo}" foi criada para ${tarefa.data}.`,
            category: 'tasks',
            type: 'info',
            metadata: {
              ...metadata,
              assignees: Array.from(recipientIds),
            },
          });
        } catch (notifyError) {
          console.error('Falha ao enviar notificação de criação de tarefa', notifyError);
        }
      }),
    );

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
       RETURNING id, id_oportunidades, titulo, descricao, data, hora, dia_inteiro, prioridade, mostrar_na_agenda, privada, recorrente, repetir_quantas_vezes, repetir_cada_unidade, repetir_intervalo, criado_em, atualizado_em, concluido, idusuario`,
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
