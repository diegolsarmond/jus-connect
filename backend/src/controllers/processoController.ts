import { Request, Response } from 'express';
import pool from '../services/db';
import { Processo } from '../models/processo';
import { fetchDatajudMovimentacoes } from '../services/datajudService';

const normalizeString = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};

const normalizeUppercase = (value: unknown): string | null => {
  const normalized = normalizeString(value);
  return normalized ? normalized.toUpperCase() : null;
};

const normalizeLowercase = (value: unknown): string | null => {
  const normalized = normalizeString(value);
  return normalized ? normalized.toLowerCase() : null;
};

const normalizeDate = (value: unknown): string | null => {
  if (value === null || value === undefined) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? null
      : value.toISOString().slice(0, 10);
  }

  if (typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') {
      return null;
    }

    const isoCandidate = new Date(trimmed);
    if (!Number.isNaN(isoCandidate.getTime())) {
      return isoCandidate.toISOString().slice(0, 10);
    }

    const brFormatMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (brFormatMatch) {
      const [, day, month, year] = brFormatMatch;
      return `${year}-${month}-${day}`;
    }

    const isoFormatMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoFormatMatch) {
      return trimmed;
    }
  }

  return null;
};

const mapProcessoRow = (row: any): Processo => ({
  id: row.id,
  cliente_id: row.cliente_id,
  numero: row.numero,
  uf: row.uf,
  municipio: row.municipio,
  orgao_julgador: row.orgao_julgador,
  tipo: row.tipo,
  status: row.status,
  classe_judicial: row.classe_judicial,
  assunto: row.assunto,
  jurisdicao: row.jurisdicao,
  advogado_responsavel: row.advogado_responsavel,
  data_distribuicao: row.data_distribuicao,
  datajud_tipo_justica: row.datajud_tipo_justica,
  datajud_alias: row.datajud_alias,
  criado_em: row.criado_em,
  atualizado_em: row.atualizado_em,
  cliente: row.cliente_id
    ? {
        id: row.cliente_id,
        nome: row.cliente_nome ?? null,
        documento: row.cliente_documento ?? null,
        tipo:
          row.cliente_tipo === null || row.cliente_tipo === undefined
            ? null
            : String(row.cliente_tipo),
      }
    : null,
});

export const listProcessos = async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT 
         p.id,
         p.cliente_id,
         p.numero,
         p.uf,
         p.municipio,
         p.orgao_julgador,
         p.tipo,
         p.status,
       p.classe_judicial,
       p.assunto,
       p.jurisdicao,
       p.advogado_responsavel,
       p.data_distribuicao,
        p.datajud_tipo_justica,
        p.datajud_alias,
       p.criado_em,
       p.atualizado_em,
        c.nome AS cliente_nome,
        c.documento AS cliente_documento,
        c.tipo AS cliente_tipo
       FROM public.processos p
       LEFT JOIN public.clientes c ON c.id = p.cliente_id
       ORDER BY p.criado_em DESC`
    );

    res.json(result.rows.map(mapProcessoRow));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const listProcessosByCliente = async (req: Request, res: Response) => {
  const { clienteId } = req.params;
  const parsedClienteId = Number(clienteId);

  if (!Number.isInteger(parsedClienteId) || parsedClienteId <= 0) {
    return res.status(400).json({ error: 'clienteId inválido' });
  }

  try {
    const result = await pool.query(
      `SELECT 
         p.id,
         p.cliente_id,
         p.numero,
         p.uf,
         p.municipio,
         p.orgao_julgador,
         p.tipo,
         p.status,
        p.classe_judicial,
        p.assunto,
        p.jurisdicao,
        p.advogado_responsavel,
        p.data_distribuicao,
        p.datajud_tipo_justica,
        p.datajud_alias,
        p.criado_em,
        p.atualizado_em,
        c.nome AS cliente_nome,
        c.documento AS cliente_documento,
        c.tipo AS cliente_tipo
       FROM public.processos p
       LEFT JOIN public.clientes c ON c.id = p.cliente_id
       WHERE p.cliente_id = $1
       ORDER BY p.criado_em DESC`,
      [parsedClienteId]
    );

    res.json(result.rows.map(mapProcessoRow));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getProcessoById = async (req: Request, res: Response) => {
  const { id } = req.params;
  const parsedId = Number(id);

  if (!Number.isInteger(parsedId) || parsedId <= 0) {
    return res.status(400).json({ error: 'ID inválido' });
  }

  try {
    const result = await pool.query(
      `SELECT 
         p.id,
         p.cliente_id,
         p.numero,
         p.uf,
         p.municipio,
         p.orgao_julgador,
         p.tipo,
         p.status,
        p.classe_judicial,
        p.assunto,
        p.jurisdicao,
        p.advogado_responsavel,
        p.data_distribuicao,
        p.datajud_tipo_justica,
        p.datajud_alias,
        p.criado_em,
        p.atualizado_em,
        c.nome AS cliente_nome,
        c.documento AS cliente_documento,
        c.tipo AS cliente_tipo
       FROM public.processos p
       LEFT JOIN public.clientes c ON c.id = p.cliente_id
       WHERE p.id = $1`,
      [parsedId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Processo não encontrado' });
    }

    res.json(mapProcessoRow(result.rows[0]));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createProcesso = async (req: Request, res: Response) => {
  const {
    cliente_id,
    numero,
    uf,
    municipio,
    orgao_julgador,
    tipo,
    status,
    classe_judicial,
    assunto,
    jurisdicao,
    advogado_responsavel,
    data_distribuicao,
    datajud_tipo_justica,
    datajud_alias,
  } = req.body;

  const parsedClienteId = Number(cliente_id);

  if (!Number.isInteger(parsedClienteId) || parsedClienteId <= 0) {
    return res.status(400).json({ error: 'cliente_id inválido' });
  }

  const numeroValue = normalizeString(numero);
  const ufValue = normalizeUppercase(uf);
  const municipioValue = normalizeString(municipio);
  const orgaoValue = normalizeString(orgao_julgador);

  if (!numeroValue || !ufValue || !municipioValue || !orgaoValue) {
    return res.status(400).json({
      error:
        'Os campos cliente_id, numero, uf, municipio e orgao_julgador são obrigatórios',
    });
  }

  const tipoValue = normalizeString(tipo);
  const statusValue = normalizeString(status);
  const classeValue = normalizeString(classe_judicial);
  const assuntoValue = normalizeString(assunto);
  const jurisdicaoValue = normalizeString(jurisdicao);
  const advogadoValue = normalizeString(advogado_responsavel);
  const dataDistribuicaoValue = normalizeDate(data_distribuicao);
  const datajudTipoJusticaValue = normalizeLowercase(datajud_tipo_justica);
  const datajudAliasValue = normalizeLowercase(datajud_alias);

  if (!datajudTipoJusticaValue || !datajudAliasValue) {
    return res.status(400).json({
      error: 'Os campos datajud_tipo_justica e datajud_alias são obrigatórios',
    });
  }

  try {
    const clienteExists = await pool.query(
      'SELECT 1 FROM public.clientes WHERE id = $1',
      [parsedClienteId]
    );

    if (clienteExists.rowCount === 0) {
      return res.status(400).json({ error: 'Cliente não encontrado' });
    }

    const result = await pool.query(
      `WITH inserted AS (
         INSERT INTO public.processos (
           cliente_id,
           numero,
           uf,
           municipio,
           orgao_julgador,
           tipo,
           status,
           classe_judicial,
          assunto,
          jurisdicao,
          advogado_responsavel,
          data_distribuicao,
          datajud_tipo_justica,
          datajud_alias
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         RETURNING *
       )
       SELECT
         inserted.id,
         inserted.cliente_id,
         inserted.numero,
         inserted.uf,
         inserted.municipio,
         inserted.orgao_julgador,
         inserted.tipo,
         inserted.status,
         inserted.classe_judicial,
         inserted.assunto,
         inserted.jurisdicao,
         inserted.advogado_responsavel,
         inserted.data_distribuicao,
         inserted.datajud_tipo_justica,
         inserted.datajud_alias,
         inserted.criado_em,
         inserted.atualizado_em,
         c.nome AS cliente_nome,
         c.documento AS cliente_documento,
         c.tipo AS cliente_tipo
       FROM inserted
       LEFT JOIN public.clientes c ON c.id = inserted.cliente_id`,
      [
        parsedClienteId,
        numeroValue,
        ufValue,
        municipioValue,
        orgaoValue,
        tipoValue,
        statusValue,
        classeValue,
        assuntoValue,
        jurisdicaoValue,
        advogadoValue,
        dataDistribuicaoValue,
        datajudTipoJusticaValue,
        datajudAliasValue,
      ]
    );

    res.status(201).json(mapProcessoRow(result.rows[0]));
  } catch (error: any) {
    console.error(error);

    if (error?.code === '23505') {
      return res.status(409).json({ error: 'Número de processo já cadastrado' });
    }

    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateProcesso = async (req: Request, res: Response) => {
  const { id } = req.params;
  const parsedId = Number(id);

  if (!Number.isInteger(parsedId) || parsedId <= 0) {
    return res.status(400).json({ error: 'ID inválido' });
  }

  const {
    cliente_id,
    numero,
    uf,
    municipio,
    orgao_julgador,
    tipo,
    status,
    classe_judicial,
    assunto,
    jurisdicao,
    advogado_responsavel,
    data_distribuicao,
    datajud_tipo_justica,
    datajud_alias,
  } = req.body;

  const parsedClienteId = Number(cliente_id);

  if (!Number.isInteger(parsedClienteId) || parsedClienteId <= 0) {
    return res.status(400).json({ error: 'cliente_id inválido' });
  }

  const numeroValue = normalizeString(numero);
  const ufValue = normalizeUppercase(uf);
  const municipioValue = normalizeString(municipio);
  const orgaoValue = normalizeString(orgao_julgador);

  if (!numeroValue || !ufValue || !municipioValue || !orgaoValue) {
    return res.status(400).json({
      error:
        'Os campos cliente_id, numero, uf, municipio e orgao_julgador são obrigatórios',
    });
  }

  const tipoValue = normalizeString(tipo);
  const statusValue = normalizeString(status);
  const classeValue = normalizeString(classe_judicial);
  const assuntoValue = normalizeString(assunto);
  const jurisdicaoValue = normalizeString(jurisdicao);
  const advogadoValue = normalizeString(advogado_responsavel);
  const dataDistribuicaoValue = normalizeDate(data_distribuicao);
  const datajudTipoJusticaValue = normalizeLowercase(datajud_tipo_justica);
  const datajudAliasValue = normalizeLowercase(datajud_alias);

  if (!datajudTipoJusticaValue || !datajudAliasValue) {
    return res.status(400).json({
      error: 'Os campos datajud_tipo_justica e datajud_alias são obrigatórios',
    });
  }

  try {
    const existingProcess = await pool.query(
      'SELECT id FROM public.processos WHERE id = $1',
      [parsedId]
    );

    if (existingProcess.rowCount === 0) {
      return res.status(404).json({ error: 'Processo não encontrado' });
    }

    const clienteExists = await pool.query(
      'SELECT 1 FROM public.clientes WHERE id = $1',
      [parsedClienteId]
    );

    if (clienteExists.rowCount === 0) {
      return res.status(400).json({ error: 'Cliente não encontrado' });
    }

    const result = await pool.query(
      `WITH updated AS (
         UPDATE public.processos SET
           cliente_id = $1,
           numero = $2,
           uf = $3,
           municipio = $4,
           orgao_julgador = $5,
           tipo = $6,
           status = $7,
           classe_judicial = $8,
           assunto = $9,
           jurisdicao = $10,
           advogado_responsavel = $11,
           datajud_tipo_justica = $12,
           datajud_alias = $13,
           data_distribuicao = $14,
           atualizado_em = NOW()
        WHERE id = $15
        RETURNING *
      )
       SELECT 
         updated.id,
         updated.cliente_id,
         updated.numero,
         updated.uf,
         updated.municipio,
         updated.orgao_julgador,
         updated.tipo,
         updated.status,
         updated.classe_judicial,
        updated.assunto,
        updated.jurisdicao,
        updated.advogado_responsavel,
        updated.data_distribuicao,
        updated.datajud_tipo_justica,
        updated.datajud_alias,
        updated.criado_em,
        updated.atualizado_em,
        c.nome AS cliente_nome,
        c.documento AS cliente_documento,
        c.tipo AS cliente_tipo
       FROM updated
      LEFT JOIN public.clientes c ON c.id = updated.cliente_id`,
      [
        parsedClienteId,
        numeroValue,
        ufValue,
        municipioValue,
        orgaoValue,
        tipoValue,
        statusValue,
        classeValue,
        assuntoValue,
        jurisdicaoValue,
        advogadoValue,
        datajudTipoJusticaValue,
        datajudAliasValue,
        dataDistribuicaoValue,
        parsedId,
      ]
    );

    res.json(mapProcessoRow(result.rows[0]));
  } catch (error: any) {
    console.error(error);

    if (error?.code === '23505') {
      return res.status(409).json({ error: 'Número de processo já cadastrado' });
    }

    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getProcessoMovimentacoes = async (req: Request, res: Response) => {
  const { id } = req.params;
  const parsedId = Number(id);

  if (!Number.isInteger(parsedId) || parsedId <= 0) {
    return res.status(400).json({ error: 'ID inválido' });
  }

  try {
    const result = await pool.query(
      'SELECT numero, datajud_alias FROM public.processos WHERE id = $1',
      [parsedId],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Processo não encontrado' });
    }

    const row = result.rows[0] as { numero: string | null; datajud_alias: string | null };

    const numeroProcesso = normalizeString(row.numero);
    const datajudAlias = normalizeString(row.datajud_alias);

    if (!numeroProcesso || !datajudAlias) {
      return res.json([]);
    }

    try {
      const movimentacoes = await fetchDatajudMovimentacoes(
        datajudAlias,
        numeroProcesso,
      );
      return res.json(movimentacoes);
    } catch (error: any) {
      console.error(error);
      if (error instanceof Error) {
        if (error.message.includes('DATAJUD_API_KEY')) {
          return res.status(503).json({
            error: 'Integração com o Datajud não está configurada',
          });
        }

        if (error.message.toLowerCase().includes('tempo excedido')) {
          return res.status(504).json({ error: error.message });
        }

        return res
          .status(502)
          .json({ error: error.message || 'Erro ao consultar movimentações do Datajud' });
      }

      return res
        .status(502)
        .json({ error: 'Erro ao consultar movimentações do Datajud' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteProcesso = async (req: Request, res: Response) => {
  const { id } = req.params;
  const parsedId = Number(id);

  if (!Number.isInteger(parsedId) || parsedId <= 0) {
    return res.status(400).json({ error: 'ID inválido' });
  }

  try {
    const result = await pool.query(
      'DELETE FROM public.processos WHERE id = $1',
      [parsedId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Processo não encontrado' });
    }

    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
