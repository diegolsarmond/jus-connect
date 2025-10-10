import { Request, Response } from 'express';
import pool from '../services/db';
import { fetchAuthenticatedUserEmpresa } from '../utils/authUser';

export const listIntimacoesHandler = async (req: Request, res: Response) => {
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
      `SELECT id,
              "siglaTribunal",
              external_id,
              numero_processo,
              "nomeOrgao",
              "tipoComunicacao",
              texto,
              prazo,
              data_disponibilizacao,
              created_at,
              updated_at,
              meio,
              link,
              tipodocumento,
              nomeclasse,
              codigoclasse,
              numerocomunicacao,
              ativo,
              hash,
              status,
              motivo_cancelamento,
              data_cancelamento,
              destinatarios,
              destinatarios_advogados,
              idusuario,
              idempresa,
              nao_lida,
              arquivada
         FROM public.intimacoes
        WHERE idempresa = $1
        ORDER BY data_disponibilizacao DESC NULLS LAST,
                 created_at DESC NULLS LAST,
                 id DESC`,
      [empresaId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Failed to list intimações', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const archiveIntimacaoHandler = async (req: Request, res: Response) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ error: 'Token inválido.' });
    }

    const intimacaoId = Number(req.params.id);

    if (!Number.isInteger(intimacaoId) || intimacaoId <= 0) {
      return res.status(400).json({ error: 'Identificador de intimação inválido.' });
    }

    const empresaLookup = await fetchAuthenticatedUserEmpresa(req.auth.userId);

    if (!empresaLookup.success) {
      return res.status(empresaLookup.status).json({ error: empresaLookup.message });
    }

    const { empresaId } = empresaLookup;

    if (empresaId === null) {
      return res.status(404).json({ error: 'Empresa não encontrada para o usuário autenticado.' });
    }

    const result = await pool.query(
      `UPDATE public.intimacoes
          SET arquivada = TRUE,
              updated_at = NOW()
        WHERE id = $1
          AND idempresa = $2
        RETURNING id,
                  arquivada,
                  updated_at`,
      [intimacaoId, empresaId],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Intimação não encontrada.' });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    console.error('Failed to archive intimação', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const markIntimacaoAsReadHandler = async (req: Request, res: Response) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ error: 'Token inválido.' });
    }

    const intimacaoId = Number(req.params.id);

    if (!Number.isInteger(intimacaoId) || intimacaoId <= 0) {
      return res.status(400).json({ error: 'Identificador de intimação inválido.' });
    }

    const empresaLookup = await fetchAuthenticatedUserEmpresa(req.auth.userId);

    if (!empresaLookup.success) {
      return res.status(empresaLookup.status).json({ error: empresaLookup.message });
    }

    const { empresaId } = empresaLookup;

    if (empresaId === null) {
      return res.status(404).json({ error: 'Empresa não encontrada para o usuário autenticado.' });
    }

    const result = await pool.query(
      `UPDATE public.intimacoes
          SET nao_lida = FALSE,
              updated_at = NOW()
        WHERE id = $1
          AND idempresa = $2
        RETURNING id,
                  nao_lida,
                  updated_at`,
      [intimacaoId, empresaId],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Intimação não encontrada.' });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    console.error('Failed to mark intimação as read', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
