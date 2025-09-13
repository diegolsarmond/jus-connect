import { Request, Response } from 'express';
import pool from '../services/db';

export const listOportunidades = async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT id, tipo_processo_id, area_atuacao_id, responsavel_id, numero_processo_cnj, numero_protocolo,
              vara_ou_orgao, comarca, fase_id, etapa_id, prazo_proximo, status_id, solicitante_id,
              valor_causa, valor_honorarios, percentual_honorarios, forma_pagamento, contingenciamento,
              detalhes, documentos_anexados, criado_por, data_criacao, ultima_atualizacao
       FROM public.oportunidades`
    );
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const listOportunidadesByFase = async (req: Request, res: Response) => {
  const { faseId } = req.params;
  try {
    const result = await pool.query(
      `SELECT id, tipo_processo_id, area_atuacao_id, responsavel_id, numero_processo_cnj, numero_protocolo,
              vara_ou_orgao, comarca, fase_id, etapa_id, prazo_proximo, status_id, solicitante_id,
              valor_causa, valor_honorarios, percentual_honorarios, forma_pagamento, contingenciamento,
              detalhes, documentos_anexados, criado_por, data_criacao, ultima_atualizacao
       FROM public.oportunidades WHERE fase_id = $1`,
      [faseId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getOportunidadeById = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const oportunidadeResult = await pool.query(
      `SELECT id, tipo_processo_id, area_atuacao_id, responsavel_id, numero_processo_cnj, numero_protocolo,
              vara_ou_orgao, comarca, fase_id, etapa_id, prazo_proximo, status_id, solicitante_id,
              valor_causa, valor_honorarios, percentual_honorarios, forma_pagamento, contingenciamento,
              detalhes, documentos_anexados, criado_por, data_criacao, ultima_atualizacao
       FROM public.oportunidades WHERE id = $1`,
      [id]
    );
    if (oportunidadeResult.rowCount === 0) {
      return res.status(404).json({ error: 'Oportunidade não encontrada' });
    }
    const envolvidosResult = await pool.query(
      `SELECT nome, documento, telefone, endereco, relacao
       FROM public.oportunidade_envolvidos
       WHERE oportunidade_id = $1`,
      [id]
    );
    const oportunidade = oportunidadeResult.rows[0];
    oportunidade.envolvidos = envolvidosResult.rows.map((env) => ({
      nome: env.nome,
      cpf_cnpj: env.documento,
      telefone: env.telefone,
      endereco: env.endereco,
      relacao: env.relacao,
    }));
    res.json(oportunidade);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const listEnvolvidosByOportunidade = async (
  req: Request,
  res: Response,
) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT id, oportunidade_id, nome, documento, telefone, endereco, relacao
       FROM public.oportunidade_envolvidos
       WHERE oportunidade_id = $1`,
      [id],
    );
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createOportunidade = async (req: Request, res: Response) => {
  const {
    tipo_processo_id,
    area_atuacao_id,
    responsavel_id,
    numero_processo_cnj,
    numero_protocolo,
    vara_ou_orgao,
    comarca,
    fase_id,
    etapa_id,
    prazo_proximo,
    status_id,
    solicitante_id,
    valor_causa,
    valor_honorarios,
    percentual_honorarios,
    forma_pagamento,
    contingenciamento,
    detalhes,
    documentos_anexados,
    criado_por,
    envolvidos,
  } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO public.oportunidades
       (tipo_processo_id, area_atuacao_id, responsavel_id, numero_processo_cnj, numero_protocolo,
        vara_ou_orgao, comarca, fase_id, etapa_id, prazo_proximo, status_id, solicitante_id,
        valor_causa, valor_honorarios, percentual_honorarios, forma_pagamento, contingenciamento,
        detalhes, documentos_anexados, criado_por, data_criacao, ultima_atualizacao)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,NOW(),NOW())
       RETURNING id, tipo_processo_id, area_atuacao_id, responsavel_id, numero_processo_cnj, numero_protocolo,
                 vara_ou_orgao, comarca, fase_id, etapa_id, prazo_proximo, status_id, solicitante_id,
                 valor_causa, valor_honorarios, percentual_honorarios, forma_pagamento, contingenciamento,
                 detalhes, documentos_anexados, criado_por, data_criacao, ultima_atualizacao`,
      [
        tipo_processo_id,
        area_atuacao_id,
        responsavel_id,
        numero_processo_cnj,
        numero_protocolo,
        vara_ou_orgao,
        comarca,
        fase_id,
        etapa_id,
        prazo_proximo,
        status_id,
        solicitante_id,
        valor_causa,
        valor_honorarios,
        percentual_honorarios,
        forma_pagamento,
        contingenciamento,
        detalhes,
        documentos_anexados,
        criado_por,
      ]
    );
    const oportunidade = result.rows[0];
    if (Array.isArray(envolvidos) && envolvidos.length > 0) {
      const queries = envolvidos.map((env: any) =>
        pool.query(
          `INSERT INTO public.oportunidade_envolvidos
           (oportunidade_id, nome, documento, telefone, endereco, relacao)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            oportunidade.id,
            env.nome || null,
            env.cpf_cnpj || null,
            env.telefone || null,
            env.endereco || null,
            env.relacao || null,
          ]
        )
      );
      await Promise.all(queries);
    }
    res.status(201).json(oportunidade);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateOportunidade = async (req: Request, res: Response) => {
  const { id } = req.params;
  const {
    tipo_processo_id,
    area_atuacao_id,
    responsavel_id,
    numero_processo_cnj,
    numero_protocolo,
    vara_ou_orgao,
    comarca,
    fase_id,
    etapa_id,
    prazo_proximo,
    status_id,
    solicitante_id,
    valor_causa,
    valor_honorarios,
    percentual_honorarios,
    forma_pagamento,
    contingenciamento,
    detalhes,
    documentos_anexados,
    criado_por,
    envolvidos,
  } = req.body;

  try {
    const result = await pool.query(
      `UPDATE public.oportunidades SET
         tipo_processo_id = $1,
         area_atuacao_id = $2,
         responsavel_id = $3,
         numero_processo_cnj = $4,
         numero_protocolo = $5,
         vara_ou_orgao = $6,
         comarca = $7,
         fase_id = $8,
         etapa_id = $9,
         prazo_proximo = $10,
         status_id = $11,
         solicitante_id = $12,
         valor_causa = $13,
         valor_honorarios = $14,
         percentual_honorarios = $15,
         forma_pagamento = $16,
         contingenciamento = $17,
         detalhes = $18,
         documentos_anexados = $19,
         criado_por = $20,
         ultima_atualizacao = NOW()
       WHERE id = $21
       RETURNING id, tipo_processo_id, area_atuacao_id, responsavel_id, numero_processo_cnj, numero_protocolo,
                 vara_ou_orgao, comarca, fase_id, etapa_id, prazo_proximo, status_id, solicitante_id,
                 valor_causa, valor_honorarios, percentual_honorarios, forma_pagamento, contingenciamento,
                 detalhes, documentos_anexados, criado_por, data_criacao, ultima_atualizacao`,
      [
        tipo_processo_id,
        area_atuacao_id,
        responsavel_id,
        numero_processo_cnj,
        numero_protocolo,
        vara_ou_orgao,
        comarca,
        fase_id,
        etapa_id,
        prazo_proximo,
        status_id,
        solicitante_id,
        valor_causa,
        valor_honorarios,
        percentual_honorarios,
        forma_pagamento,
        contingenciamento,
        detalhes,
        documentos_anexados,
        criado_por,
        id,
      ]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Oportunidade não encontrada' });
    }
    if (Array.isArray(envolvidos)) {
      await pool.query(
        'DELETE FROM public.oportunidade_envolvidos WHERE oportunidade_id = $1',
        [id]
      );
      const queries = envolvidos.map((env: any) =>
        pool.query(
          `INSERT INTO public.oportunidade_envolvidos
           (oportunidade_id, nome, documento, telefone, endereco, relacao)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            id,
            env.nome || null,
            env.cpf_cnpj || null,
            env.telefone || null,
            env.endereco || null,
            env.relacao || null,
          ]
        )
      );
      await Promise.all(queries);
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateOportunidadeEtapa = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { etapa_id } = req.body;
  try {
    const result = await pool.query(
      `UPDATE public.oportunidades
       SET etapa_id = $1,
           ultima_atualizacao = NOW()
       WHERE id = $2
       RETURNING id, etapa_id, ultima_atualizacao`,
      [etapa_id, id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Oportunidade não encontrada' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteOportunidade = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'DELETE FROM public.oportunidades WHERE id = $1',
      [id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Oportunidade não encontrada' });
    }
    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

