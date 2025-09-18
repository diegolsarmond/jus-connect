import { Request, Response } from 'express';
import pool from '../services/db';

export const listOportunidades = async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT id, tipo_processo_id, area_atuacao_id, responsavel_id, numero_processo_cnj, numero_protocolo,
              vara_ou_orgao, comarca, fase_id, etapa_id, prazo_proximo, status_id, solicitante_id,
              valor_causa, valor_honorarios, percentual_honorarios, forma_pagamento, qtde_parcelas, contingenciamento,
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
              valor_causa, valor_honorarios, percentual_honorarios, forma_pagamento, qtde_parcelas, contingenciamento,
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
              valor_causa, valor_honorarios, percentual_honorarios, forma_pagamento, qtde_parcelas, contingenciamento,
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
    qtde_parcelas,
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
        valor_causa, valor_honorarios, percentual_honorarios, forma_pagamento, qtde_parcelas, contingenciamento,
        detalhes, documentos_anexados, criado_por, data_criacao, ultima_atualizacao)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,NOW(),NOW())
       RETURNING id, tipo_processo_id, area_atuacao_id, responsavel_id, numero_processo_cnj, numero_protocolo,
                 vara_ou_orgao, comarca, fase_id, etapa_id, prazo_proximo, status_id, solicitante_id,
                 valor_causa, valor_honorarios, percentual_honorarios, forma_pagamento, qtde_parcelas, contingenciamento,
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
          qtde_parcelas,
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
    qtde_parcelas,
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
         qtde_parcelas = $17,
         contingenciamento = $18,
         detalhes = $19,
         documentos_anexados = $20,
         criado_por = $21,
         ultima_atualizacao = NOW()
       WHERE id = $22
       RETURNING id, tipo_processo_id, area_atuacao_id, responsavel_id, numero_processo_cnj, numero_protocolo,
                 vara_ou_orgao, comarca, fase_id, etapa_id, prazo_proximo, status_id, solicitante_id,
                 valor_causa, valor_honorarios, percentual_honorarios, forma_pagamento, qtde_parcelas, contingenciamento,
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
        qtde_parcelas,
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

export const updateOportunidadeStatus = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status_id } = req.body as { status_id?: unknown };

  const parsedStatus =
    status_id === null || status_id === undefined || status_id === ''
      ? null
      : Number(status_id);

  if (parsedStatus !== null && Number.isNaN(parsedStatus)) {
    return res.status(400).json({ error: 'status_id inválido' });
  }

  try {
    const result = await pool.query(
      `UPDATE public.oportunidades
       SET status_id = $1,
           ultima_atualizacao = NOW()
       WHERE id = $2
       RETURNING id, status_id, ultima_atualizacao`,
      [parsedStatus, id]
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

export const listOportunidadeFaturamentos = async (
  req: Request,
  res: Response,
) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT id, oportunidade_id, forma_pagamento, condicao_pagamento, valor, parcelas,
              observacoes, data_faturamento, criado_em
         FROM public.oportunidade_faturamentos
        WHERE oportunidade_id = $1
        ORDER BY data_faturamento DESC NULLS LAST, id DESC`,
      [id],
    );
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createOportunidadeFaturamento = async (
  req: Request,
  res: Response,
) => {
  const { id } = req.params;
  const {
    forma_pagamento,
    condicao_pagamento,
    valor,
    parcelas,
    observacoes,
    data_faturamento,
  } = req.body as {
    forma_pagamento?: unknown;
    condicao_pagamento?: unknown;
    valor?: unknown;
    parcelas?: unknown;
    observacoes?: unknown;
    data_faturamento?: unknown;
  };

  if (typeof forma_pagamento !== 'string' || forma_pagamento.trim().length === 0) {
    return res
      .status(400)
      .json({ error: 'forma_pagamento é obrigatório e deve ser uma string.' });
  }

  const normalizedForma = forma_pagamento.trim();

  const normalizeNumber = (input: unknown): number | null => {
    if (input === null || input === undefined || input === '') {
      return null;
    }
    if (typeof input === 'number') {
      return Number.isNaN(input) ? null : input;
    }
    if (typeof input === 'string') {
      const sanitized = input.replace(/\./g, '').replace(',', '.');
      const parsed = Number(sanitized);
      return Number.isNaN(parsed) ? null : parsed;
    }
    return null;
  };

  const parsedValor = normalizeNumber(valor);
  if (valor !== undefined && parsedValor === null) {
    return res.status(400).json({ error: 'valor inválido.' });
  }

  const condicaoValue =
    typeof condicao_pagamento === 'string' && condicao_pagamento.trim().length > 0
      ? condicao_pagamento.trim()
      : null;

  let parsedParcelas: number | null = null;
  if (
    condicaoValue &&
    condicaoValue.toLowerCase() === 'parcelado'
  ) {
    if (parcelas === undefined || parcelas === null || parcelas === '') {
      return res
        .status(400)
        .json({ error: 'parcelas é obrigatório para pagamentos parcelados.' });
    }
    const parcelasNumber = normalizeNumber(parcelas);
    if (parcelasNumber === null || !Number.isFinite(parcelasNumber) || parcelasNumber < 1) {
      return res.status(400).json({ error: 'parcelas inválido.' });
    }
    parsedParcelas = Math.trunc(parcelasNumber);
  }

  let faturamentoDate: Date | null = null;
  if (data_faturamento !== undefined && data_faturamento !== null && data_faturamento !== '') {
    const parsedDate = new Date(data_faturamento as string);
    if (Number.isNaN(parsedDate.getTime())) {
      return res.status(400).json({ error: 'data_faturamento inválida.' });
    }
    faturamentoDate = parsedDate;
  }

  const observations =
    typeof observacoes === 'string' && observacoes.trim().length > 0
      ? observacoes.trim()
      : null;

  try {
    const opportunityExists = await pool.query(
      'SELECT 1 FROM public.oportunidades WHERE id = $1',
      [id],
    );
    if (opportunityExists.rowCount === 0) {
      return res.status(404).json({ error: 'Oportunidade não encontrada' });
    }

    const result = await pool.query(
      `INSERT INTO public.oportunidade_faturamentos
         (oportunidade_id, forma_pagamento, condicao_pagamento, valor, parcelas, observacoes, data_faturamento)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, oportunidade_id, forma_pagamento, condicao_pagamento, valor, parcelas,
                 observacoes, data_faturamento, criado_em`,
      [
        id,
        normalizedForma,
        condicaoValue,
        parsedValor,
        parsedParcelas,
        observations,
        faturamentoDate ?? new Date(),
      ],
    );

    res.status(201).json(result.rows[0]);
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
      [id],
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

