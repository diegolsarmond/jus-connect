import { Request, Response } from 'express';
import type { PoolClient } from 'pg';
import pool from '../services/db';
import { fetchAuthenticatedUserEmpresa } from '../utils/authUser';

const getAuthenticatedUser = (
  req: Request,
  res: Response
): NonNullable<Request['auth']> | null => {
  if (!req.auth) {
    res.status(401).json({ error: 'Token inválido.' });
    return null;
  }

  return req.auth;
};

const normalizeDecimal = (input: unknown): number | null => {
  if (typeof input === 'number' && Number.isFinite(input)) {
    return input;
  }
  if (typeof input === 'string' && input.trim().length > 0) {
    const sanitized = input.replace(/\./g, '').replace(',', '.');
    const parsed = Number(sanitized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (typeof input === 'bigint') {
    return Number(input);
  }
  return null;
};

const normalizeInteger = (input: unknown): number | null => {
  if (typeof input === 'number' && Number.isFinite(input)) {
    const normalized = Math.trunc(input);
    return normalized > 0 ? normalized : null;
  }
  if (typeof input === 'string' && input.trim().length > 0) {
    const parsed = Number(input);
    if (!Number.isFinite(parsed)) {
      return null;
    }
    const normalized = Math.trunc(parsed);
    return normalized > 0 ? normalized : null;
  }
  if (typeof input === 'bigint') {
    const normalized = Number(input);
    return Number.isFinite(normalized) && normalized > 0
      ? Math.trunc(normalized)
      : null;
  }
  return null;
};

const normalizeText = (input: unknown): string | null => {
  if (typeof input !== 'string') {
    return null;
  }
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return null;
  }
  return trimmed;
};

const parsePositiveIntegerParam = (input: unknown): number | null => {
  if (typeof input !== 'string' && typeof input !== 'number') {
    return null;
  }

  const parsed = Number(input);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  const normalized = Math.trunc(parsed);

  return normalized > 0 ? normalized : null;
};

type EmpresaResolution = { ok: true; empresaId: number } | { ok: false };

const resolveEmpresaIdFromRequest = async (
  req: Request,
  res: Response,
): Promise<EmpresaResolution> => {
  const auth = getAuthenticatedUser(req, res);
  if (!auth) {
    return { ok: false };
  }

  const empresaLookup = await fetchAuthenticatedUserEmpresa(auth.userId);

  if (!empresaLookup.success) {
    res.status(empresaLookup.status).json({ error: empresaLookup.message });
    return { ok: false };
  }

  const { empresaId } = empresaLookup;

  if (empresaId === null) {
    res.status(404).json({ error: 'Oportunidade não encontrada' });
    return { ok: false };
  }

  return { ok: true, empresaId };
};

const ensureOpportunityAccess = async (
  oportunidadeId: number,
  empresaId: number,
): Promise<boolean> => {
  const result = await pool.query(
    'SELECT 1 FROM public.oportunidades WHERE id = $1 AND idempresa = $2 LIMIT 1',
    [oportunidadeId, empresaId],
  );

  return (result.rowCount ?? 0) > 0;
};

const normalizePaymentLabel = (input: unknown): string | null => {
  const text = normalizeText(input);
  if (!text) {
    return null;
  }
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
};

const shouldCreateInstallments = (paymentLabel: string | null): boolean => {
  if (!paymentLabel) return false;
  if (paymentLabel.includes('parcel')) return true;
  if (paymentLabel.includes('vista')) return true;
  return false;
};

const buildInstallmentValues = (total: number, count: number): number[] => {
  if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(count) || count <= 0) {
    return [];
  }
  const centsTotal = Math.round(total * 100);
  const baseValue = Math.floor(centsTotal / count);
  let remainder = centsTotal - baseValue * count;
  const values: number[] = [];
  for (let index = 0; index < count; index += 1) {
    let cents = baseValue;
    if (remainder > 0) {
      cents += 1;
      remainder -= 1;
    }
    values.push(cents / 100);
  }
  return values;
};

const normalizeDateOnly = (input: unknown): Date | null => {
  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) {
      return null;
    }
    const year = input.getUTCFullYear();
    const monthIndex = input.getUTCMonth();
    const day = input.getUTCDate();
    return new Date(Date.UTC(year, monthIndex, day));
  }

  const text = normalizeText(input);
  if (!text) {
    return null;
  }

  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);

  if (!Number.isFinite(year) || !Number.isFinite(monthIndex) || !Number.isFinite(day)) {
    return null;
  }

  const candidate = new Date(Date.UTC(year, monthIndex, day));
  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== monthIndex ||
    candidate.getUTCDate() !== day
  ) {
    return null;
  }

  return candidate;
};

const formatDateOnly = (value: Date): string => {
  const year = value.getUTCFullYear().toString().padStart(4, '0');
  const month = (value.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = value.getUTCDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const addMonthsPreservingDay = (base: Date, monthsToAdd: number): Date => {
  const desiredDay = base.getUTCDate();
  const baseMonthIndex = base.getUTCMonth();
  const baseYear = base.getUTCFullYear();
  const totalMonths = baseMonthIndex + monthsToAdd;
  const targetYear = baseYear + Math.floor(totalMonths / 12);
  const normalizedMonthIndex = ((totalMonths % 12) + 12) % 12;
  const lastDayOfTargetMonth = new Date(
    Date.UTC(targetYear, normalizedMonthIndex + 1, 0),
  ).getUTCDate();
  const day = Math.min(desiredDay, lastDayOfTargetMonth);
  return new Date(Date.UTC(targetYear, normalizedMonthIndex, day));
};

const buildInstallmentDueDates = (
  count: number,
  firstDueDate: Date | null,
): (Date | null)[] => {
  if (!Number.isFinite(count) || count <= 0) {
    return [];
  }

  if (!firstDueDate) {
    return Array.from({ length: count }, () => null);
  }

  const schedule: (Date | null)[] = [];
  for (let index = 0; index < count; index += 1) {
    schedule.push(addMonthsPreservingDay(firstDueDate, index));
  }

  return schedule;
};

type InstallmentEntry = {
  valor: number;
  dataPrevista: Date | null;
};

const resetOpportunityInstallments = async (
  client: PoolClient,
  oportunidadeId: number,
  installments: InstallmentEntry[],
  empresaId: number | null,
) => {
  await client.query('DELETE FROM public.oportunidade_parcelas WHERE oportunidade_id = $1', [
    oportunidadeId,
  ]);

  if (installments.length === 0) {
    return;
  }

  const empresaValue = empresaId ?? null;

  for (let index = 0; index < installments.length; index += 1) {
    const installment = installments[index];
    const dueDateParam =
      installment.dataPrevista !== null ? formatDateOnly(installment.dataPrevista) : null;
    await client.query(
      `INSERT INTO public.oportunidade_parcelas (oportunidade_id, numero_parcela, valor, data_prevista, idempresa)
       VALUES ($1, $2, $3, $4, $5)`,
      [oportunidadeId, index + 1, installment.valor, dueDateParam, empresaValue],
    );
  }
};

const createOrReplaceOpportunityInstallments = async (
  client: PoolClient,
  oportunidadeId: number,
  valorHonorarios: unknown,
  formaPagamento: unknown,
  qtdeParcelas: unknown,
  prazoProximo: unknown,
  empresaId: number | null,
) => {
  const normalizedPayment = normalizePaymentLabel(formaPagamento);
  const honorarios = normalizeDecimal(valorHonorarios);
  if (!honorarios || honorarios <= 0 || !shouldCreateInstallments(normalizedPayment)) {
    await resetOpportunityInstallments(client, oportunidadeId, [], empresaId);
    return;
  }

  const parcelasCount = normalizeInteger(qtdeParcelas);
  const totalParcelas = normalizedPayment?.includes('parcel')
    ? parcelasCount ?? 1
    : 1;

  if (!totalParcelas || totalParcelas <= 0) {
    await resetOpportunityInstallments(client, oportunidadeId, []);
    return;
  }

  const values = buildInstallmentValues(honorarios, totalParcelas);
  const firstDueDate = normalizeDateOnly(prazoProximo);
  const dueDates = buildInstallmentDueDates(values.length, firstDueDate);
  const installments = values.map((valor, index) => ({
    valor,
    dataPrevista: dueDates[index] ?? null,
  }));
  await resetOpportunityInstallments(client, oportunidadeId, installments, empresaId);
};

const ensureOpportunityInstallments = async (
  client: PoolClient,
  oportunidadeId: number,
  valorHonorarios: unknown,
  formaPagamento: unknown,
  qtdeParcelas: unknown,
  prazoProximo: unknown,
  empresaId: number | null,
) => {
  const existing = await client.query(
    'SELECT id FROM public.oportunidade_parcelas WHERE oportunidade_id = $1 LIMIT 1',
    [oportunidadeId],
  );
  if ((existing.rowCount ?? 0) > 0) {
    return;
  }
  await createOrReplaceOpportunityInstallments(
    client,
    oportunidadeId,
    valorHonorarios,
    formaPagamento,
    qtdeParcelas,
    prazoProximo,
    empresaId,
  );
};

export const listOportunidades = async (req: Request, res: Response) => {
  try {
    const auth = getAuthenticatedUser(req, res);
    if (!auth) {
      return;
    }

    const empresaLookup = await fetchAuthenticatedUserEmpresa(auth.userId);

    if (!empresaLookup.success) {
      res.status(empresaLookup.status).json({ error: empresaLookup.message });
      return;
    }

    const { empresaId } = empresaLookup;

    if (empresaId === null) {
      res.json([]);
      return;
    }

    const result = await pool.query(
      `SELECT id, tipo_processo_id, area_atuacao_id, responsavel_id, numero_processo_cnj, numero_protocolo,
              vara_ou_orgao, comarca, fase_id, etapa_id, prazo_proximo, status_id, solicitante_id,
              valor_causa, valor_honorarios, percentual_honorarios, forma_pagamento, qtde_parcelas, contingenciamento,
              detalhes, documentos_anexados, criado_por, sequencial_empresa, data_criacao, ultima_atualizacao, idempresa
       FROM public.oportunidades WHERE idempresa = $1`,
      [empresaId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const listOportunidadesByFase = async (req: Request, res: Response) => {
  const { faseId } = req.params;
  const parsedFaseId = parsePositiveIntegerParam(faseId);

  if (parsedFaseId === null) {
    res.status(400).json({ error: 'Fluxo de trabalho inválido' });
    return;
  }

  try {
    const empresaResolution = await resolveEmpresaIdFromRequest(req, res);
    if (!empresaResolution.ok) {
      return;
    }

    const { empresaId } = empresaResolution;

    const result = await pool.query(
      `SELECT id, tipo_processo_id, area_atuacao_id, responsavel_id, numero_processo_cnj, numero_protocolo,
              vara_ou_orgao, comarca, fase_id, etapa_id, prazo_proximo, status_id, solicitante_id,
              valor_causa, valor_honorarios, percentual_honorarios, forma_pagamento, qtde_parcelas, contingenciamento,
              detalhes, documentos_anexados, criado_por, sequencial_empresa, data_criacao, ultima_atualizacao
       FROM public.oportunidades WHERE fase_id = $1 AND idempresa = $2`,
      [parsedFaseId, empresaId]
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
    const empresaResolution = await resolveEmpresaIdFromRequest(req, res);
    if (!empresaResolution.ok) {
      return;
    }

    const parsedId = parsePositiveIntegerParam(id);
    if (parsedId === null) {
      res.status(400).json({ error: 'Oportunidade inválida' });
      return;
    }

    const oportunidadeResult = await pool.query(
      `SELECT id, tipo_processo_id, area_atuacao_id, responsavel_id, numero_processo_cnj, numero_protocolo,
              vara_ou_orgao, comarca, fase_id, etapa_id, prazo_proximo, status_id, solicitante_id,
              valor_causa, valor_honorarios, percentual_honorarios, forma_pagamento, qtde_parcelas, contingenciamento,
              detalhes, documentos_anexados, criado_por, sequencial_empresa, data_criacao, ultima_atualizacao
       FROM public.oportunidades WHERE id = $1 AND idempresa = $2`,
      [parsedId, empresaResolution.empresaId]
    );
    if (oportunidadeResult.rowCount === 0) {
      return res.status(404).json({ error: 'Oportunidade não encontrada' });
    }
    const envolvidosResult = await pool.query(
      `SELECT nome, documento, telefone, endereco, relacao
       FROM public.oportunidade_envolvidos
       WHERE oportunidade_id = $1`,
      [parsedId]
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
  const parsedId = parsePositiveIntegerParam(id);

  if (parsedId === null) {
    res.status(400).json({ error: 'Oportunidade inválida' });
    return;
  }

  try {
    const empresaResolution = await resolveEmpresaIdFromRequest(req, res);
    if (!empresaResolution.ok) {
      return;
    }

    const hasAccess = await ensureOpportunityAccess(
      parsedId,
      empresaResolution.empresaId,
    );

    if (!hasAccess) {
      res.status(404).json({ error: 'Oportunidade não encontrada' });
      return;
    }

    const result = await pool.query(
      `SELECT id, oportunidade_id, nome, documento, telefone, endereco, relacao
       FROM public.oportunidade_envolvidos
       WHERE oportunidade_id = $1`,
      [parsedId],
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

  const auth = getAuthenticatedUser(req, res);
  if (!auth) {
    return;
  }

  const empresaLookup = await fetchAuthenticatedUserEmpresa(auth.userId);

  if (!empresaLookup.success) {
    res.status(empresaLookup.status).json({ error: empresaLookup.message });
    return;
  }

  const { empresaId } = empresaLookup;

  if (empresaId === null) {
    res
      .status(400)
      .json({ error: 'Usuário autenticado não possui empresa vinculada.' });
    return;
  }

  let client: PoolClient | null = null;

  try {
    client = await pool.connect();

    if (!client) {
      throw new Error('Não foi possível obter conexão com o banco de dados.');
    }

    const dbClient = client;

    await dbClient.query('BEGIN');
    const sequenceResult = await dbClient.query(
      `INSERT INTO public.oportunidade_sequence (empresa_id, atual)
       VALUES ($1, 1)
       ON CONFLICT (empresa_id)
       DO UPDATE SET atual = public.oportunidade_sequence.atual + 1
       RETURNING atual`,
      [empresaId],
    );

    if (sequenceResult.rowCount === 0) {
      throw new Error('Não foi possível gerar o sequencial da oportunidade.');
    }

    const sequencialEmpresa: number = sequenceResult.rows[0].atual;

    const result = await dbClient.query(
      `INSERT INTO public.oportunidades
       (tipo_processo_id, area_atuacao_id, responsavel_id, numero_processo_cnj, numero_protocolo,
        vara_ou_orgao, comarca, fase_id, etapa_id, prazo_proximo, status_id, solicitante_id,
        valor_causa, valor_honorarios, percentual_honorarios, forma_pagamento, qtde_parcelas, contingenciamento,
        detalhes, documentos_anexados, criado_por, sequencial_empresa, data_criacao, ultima_atualizacao, idempresa)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,NOW(),NOW(),$23)
       RETURNING id, tipo_processo_id, area_atuacao_id, responsavel_id, numero_processo_cnj, numero_protocolo,
                 vara_ou_orgao, comarca, fase_id, etapa_id, prazo_proximo, status_id, solicitante_id,
                 valor_causa, valor_honorarios, percentual_honorarios, forma_pagamento, qtde_parcelas, contingenciamento,
                 detalhes, documentos_anexados, criado_por, sequencial_empresa, data_criacao, ultima_atualizacao, idempresa`,
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
        sequencialEmpresa,
        empresaId,
      ]
    );
    const oportunidade = result.rows[0];
    if (Array.isArray(envolvidos) && envolvidos.length > 0) {
      const queries = envolvidos.map((env: any) =>
        dbClient.query(
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
    await createOrReplaceOpportunityInstallments(
      dbClient,
      oportunidade.id,
      valor_honorarios,
      forma_pagamento,
      qtde_parcelas,
      prazo_proximo,
      empresaId,
    );
    await client.query('COMMIT');
    res.status(201).json(oportunidade);
  } catch (error) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('Erro ao reverter transação de oportunidade:', rollbackError);
      }
    }
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client?.release();
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

  let client: PoolClient | null = null;

  try {
    client = await pool.connect();
    await client.query('BEGIN');

    const result = await client.query(
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
                 detalhes, documentos_anexados, criado_por, sequencial_empresa, data_criacao, ultima_atualizacao, idempresa`,
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
      ],
    );

    if (result.rowCount === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: 'Oportunidade não encontrada' });
      return;
    }

    if (Array.isArray(envolvidos)) {
      await client.query(
        'DELETE FROM public.oportunidade_envolvidos WHERE oportunidade_id = $1',
        [id],
      );

      const queries = envolvidos.map((env: any) =>
        client!.query(
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
          ],
        ),
      );
      await Promise.all(queries);
    }

    const oportunidade = result.rows[0];

    await createOrReplaceOpportunityInstallments(
      client,
      oportunidade.id,
      valor_honorarios,
      forma_pagamento,
      qtde_parcelas,
      prazo_proximo,
      typeof oportunidade.idempresa === 'number' ? oportunidade.idempresa : null,
    );

    await client.query('COMMIT');
    res.json(oportunidade);
  } catch (error) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('Erro ao reverter transação de oportunidade:', rollbackError);
      }
    }
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client?.release();
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
  const parsedId = parsePositiveIntegerParam(id);

  if (parsedId === null) {
    res.status(400).json({ error: 'Oportunidade inválida' });
    return;
  }

  try {
    const empresaResolution = await resolveEmpresaIdFromRequest(req, res);
    if (!empresaResolution.ok) {
      return;
    }

    const hasAccess = await ensureOpportunityAccess(
      parsedId,
      empresaResolution.empresaId,
    );

    if (!hasAccess) {
      res.status(404).json({ error: 'Oportunidade não encontrada' });
      return;
    }

    const result = await pool.query(
      `SELECT id, oportunidade_id, forma_pagamento, condicao_pagamento, valor, parcelas,
              observacoes, data_faturamento, criado_em
         FROM public.oportunidade_faturamentos
        WHERE oportunidade_id = $1
        ORDER BY data_faturamento DESC NULLS LAST, id DESC`,
      [parsedId],
    );
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const listOportunidadeParcelas = async (req: Request, res: Response) => {
  const { id } = req.params;
  const parsedId = parsePositiveIntegerParam(id);

  if (parsedId === null) {
    res.status(400).json({ error: 'Oportunidade inválida' });
    return;
  }

  try {
    const empresaResolution = await resolveEmpresaIdFromRequest(req, res);
    if (!empresaResolution.ok) {
      return;
    }

    const hasAccess = await ensureOpportunityAccess(
      parsedId,
      empresaResolution.empresaId,
    );

    if (!hasAccess) {
      res.status(404).json({ error: 'Oportunidade não encontrada' });
      return;
    }

    const result = await pool.query(
      `SELECT id, oportunidade_id, numero_parcela, valor, valor_pago, status, data_prevista,
              quitado_em, faturamento_id, criado_em, atualizado_em
         FROM public.oportunidade_parcelas
        WHERE oportunidade_id = $1
        ORDER BY numero_parcela ASC`,
      [parsedId],
    );
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const __test__ = {
  createOrReplaceOpportunityInstallments,
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
    parcelas_ids,
    juros,
    multa,
  } = req.body as {
    forma_pagamento?: unknown;
    condicao_pagamento?: unknown;
    valor?: unknown;
    parcelas?: unknown;
    observacoes?: unknown;
    data_faturamento?: unknown;
    parcelas_ids?: unknown;
    juros?: unknown;
    multa?: unknown;
  };

  const formaValue = normalizeText(forma_pagamento);
  if (!formaValue) {
    return res
      .status(400)
      .json({ error: 'forma_pagamento é obrigatório e deve ser uma string.' });
  }

  const parsedValor = valor === undefined ? null : normalizeDecimal(valor);
  if (valor !== undefined && parsedValor === null) {
    return res.status(400).json({ error: 'valor inválido.' });
  }

  const condicaoValue = normalizeText(condicao_pagamento);
  const condicaoNormalized = normalizePaymentLabel(condicaoValue);
  const isParcelado = condicaoNormalized ? condicaoNormalized.includes('parcel') : false;

  let parsedParcelas: number | null = null;
  if (isParcelado) {
    parsedParcelas = normalizeInteger(parcelas);
    if (parsedParcelas === null) {
      return res
        .status(400)
        .json({ error: 'parcelas é obrigatório para pagamentos parcelados.' });
    }
  }

  let faturamentoDate: Date | null = null;
  if (data_faturamento !== undefined && data_faturamento !== null && data_faturamento !== '') {
    const parsedDate = new Date(data_faturamento as string);
    if (Number.isNaN(parsedDate.getTime())) {
      return res.status(400).json({ error: 'data_faturamento inválida.' });
    }
    faturamentoDate = parsedDate;
  }

  const observations = normalizeText(observacoes);

  const jurosValor = (() => {
    if (juros === undefined || juros === null) {
      return 0;
    }
    if (typeof juros === 'string' && juros.trim().length === 0) {
      return 0;
    }
    const parsed = normalizeDecimal(juros);
    if (parsed === null) {
      return null;
    }
    return parsed;
  })();

  if (jurosValor === null) {
    return res.status(400).json({ error: 'juros inválido.' });
  }
  if (jurosValor < 0) {
    return res.status(400).json({ error: 'juros não pode ser negativo.' });
  }

  const multaValor = (() => {
    if (multa === undefined || multa === null) {
      return 0;
    }
    if (typeof multa === 'string' && multa.trim().length === 0) {
      return 0;
    }
    const parsed = normalizeDecimal(multa);
    if (parsed === null) {
      return null;
    }
    return parsed;
  })();

  if (multaValor === null) {
    return res.status(400).json({ error: 'multa inválida.' });
  }
  if (multaValor < 0) {
    return res.status(400).json({ error: 'multa não pode ser negativa.' });
  }

  const encargosValor = jurosValor + multaValor;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const opportunityResult = await client.query(
      `SELECT id, forma_pagamento, qtde_parcelas, valor_honorarios, prazo_proximo, idempresa
         FROM public.oportunidades
        WHERE id = $1`,
      [id],
    );

    if (opportunityResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Oportunidade não encontrada' });
    }

    const opportunity = opportunityResult.rows[0];

    await ensureOpportunityInstallments(
      client,
      Number(id),
      opportunity.valor_honorarios,
      opportunity.forma_pagamento,
      opportunity.qtde_parcelas,
      opportunity.prazo_proximo,
      typeof opportunity.idempresa === 'number' ? opportunity.idempresa : null,
    );

    const installmentsResult = await client.query(
      `SELECT id, valor, numero_parcela
         FROM public.oportunidade_parcelas
        WHERE oportunidade_id = $1
          AND status = 'pendente'
        ORDER BY numero_parcela ASC`,
      [id],
    );

    type InstallmentRow = { id: number; valor: number };
    const pendingInstallments: InstallmentRow[] = installmentsResult.rows.map((row) => ({
      id: Number(row.id),
      valor: Number(row.valor),
    }));

    const requestedInstallmentIds = (() => {
      if (parcelas_ids === undefined || parcelas_ids === null) {
        return [] as number[];
      }
      const base = Array.isArray(parcelas_ids) ? parcelas_ids : [parcelas_ids];
      const normalized: number[] = [];
      base.forEach((value) => {
        const normalizedId = normalizeInteger(value);
        if (normalizedId !== null && !normalized.includes(normalizedId)) {
          normalized.push(normalizedId);
        }
      });
      return normalized;
    })();

    let installmentsToClose: InstallmentRow[] = [];
    if (pendingInstallments.length > 0) {
      if (requestedInstallmentIds.length > 0) {
        const pendingById = new Map(pendingInstallments.map((item) => [item.id, item]));
        const matched: InstallmentRow[] = [];
        for (const requestedId of requestedInstallmentIds) {
          const match = pendingById.get(requestedId);
          if (!match) {
            await client.query('ROLLBACK');
            return res
              .status(400)
              .json({ error: 'Parcela selecionada indisponível para faturamento.' });
          }
          matched.push(match);
        }
        installmentsToClose = matched;
      } else if (isParcelado) {
        const desiredCount = parsedParcelas ?? 1;
        if (desiredCount > pendingInstallments.length) {
          await client.query('ROLLBACK');
          return res
            .status(400)
            .json({ error: 'Quantidade de parcelas indisponível para faturamento.' });
        }
        installmentsToClose = pendingInstallments.slice(0, desiredCount);
      } else {
        installmentsToClose = pendingInstallments;
      }
    }

    let valorToPersist = parsedValor;
    if (installmentsToClose.length > 0) {
      const sum = installmentsToClose.reduce((acc, installment) => acc + installment.valor, 0);
      if (valorToPersist === null) {
        valorToPersist = sum;
      } else if (Math.abs(valorToPersist - sum) > 0.009) {
        valorToPersist = sum;
      }
      if (valorToPersist !== null) {
        valorToPersist += encargosValor;
      }
    } else if (valorToPersist === null && encargosValor > 0) {
      valorToPersist = encargosValor;
    }

    const parcelasToPersist = isParcelado
      ? parsedParcelas ?? (installmentsToClose.length > 0 ? installmentsToClose.length : null)
      : installmentsToClose.length > 0
        ? installmentsToClose.length
        : null;

    const faturamentoDateValue = faturamentoDate ?? new Date();

    const insertResult = await client.query(
      `INSERT INTO public.oportunidade_faturamentos
         (oportunidade_id, forma_pagamento, condicao_pagamento, valor, parcelas, observacoes, data_faturamento)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, oportunidade_id, forma_pagamento, condicao_pagamento, valor, parcelas,
                 observacoes, data_faturamento, criado_em`,
      [
        id,
        formaValue,
        condicaoValue,
        valorToPersist,
        parcelasToPersist,
        observations,
        faturamentoDateValue,
      ],
    );

    const faturamento = insertResult.rows[0];

    if (installmentsToClose.length > 0) {
      for (const installment of installmentsToClose) {
        await client.query(
          `UPDATE public.oportunidade_parcelas
             SET status = 'quitado',
                 valor_pago = $2,
                 quitado_em = $3,
                 faturamento_id = $4,
                 atualizado_em = NOW()
           WHERE id = $1`,
          [installment.id, installment.valor, faturamentoDateValue, faturamento.id],
        );
      }
    }

    await client.query('COMMIT');
    res.status(201).json(faturamento);
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('Rollback failed after faturamento creation error.', rollbackError);
    }
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
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

