import { Request, Response } from 'express';
import pool from '../services/db';
import { Processo } from '../models/processo';
import { fetchAuthenticatedUserEmpresa } from '../utils/authUser';

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

const normalizeDate = (value: unknown): string | null => {
  if (value === null || value === undefined) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
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
  idempresa: row.idempresa ?? null,
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

export const listProcessos = async (req: Request, res: Response) => {
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
      `SELECT
        p.id,
        p.cliente_id,
        p.idempresa,
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
         p.criado_em,
         p.atualizado_em,
         c.nome AS cliente_nome,
         c.documento AS cliente_documento,
         c.tipo AS cliente_tipo
       FROM public.processos p
       LEFT JOIN public.clientes c ON c.id = p.cliente_id
      WHERE p.idempresa IS NOT DISTINCT FROM $1
       ORDER BY p.criado_em DESC`,
      [empresaId]
    );

    return res.json(result.rows.map(mapProcessoRow));
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
      `SELECT
         p.id,
         p.cliente_id,
         p.idempresa,
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
         p.criado_em,
         p.atualizado_em,
         c.nome AS cliente_nome,
         c.documento AS cliente_documento,
         c.tipo AS cliente_tipo
       FROM public.processos p
       LEFT JOIN public.clientes c ON c.id = p.cliente_id
       WHERE p.cliente_id = $1
         AND p.idempresa IS NOT DISTINCT FROM $2
       ORDER BY p.criado_em DESC`,
      [parsedClienteId, empresaId]
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
    if (!req.auth) {
      return res.status(401).json({ error: 'Token inválido.' });
    }

    const empresaLookup = await fetchAuthenticatedUserEmpresa(req.auth.userId);

    if (!empresaLookup.success) {
      return res.status(empresaLookup.status).json({ error: empresaLookup.message });
    }

    const { empresaId } = empresaLookup;

    if (empresaId === null) {
      return res.status(404).json({ error: 'Processo não encontrado' });
    }

    const result = await pool.query(
      `SELECT
         p.id,
         p.cliente_id,
         p.idempresa,
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
         p.criado_em,
         p.atualizado_em,
         c.nome AS cliente_nome,
         c.documento AS cliente_documento,
         c.tipo AS cliente_tipo
       FROM public.processos p
       LEFT JOIN public.clientes c ON c.id = p.cliente_id
       WHERE p.id = $1
         AND p.idempresa IS NOT DISTINCT FROM $2`,
      [parsedId, empresaId]
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

    const clienteExists = await pool.query(
      'SELECT 1 FROM public.clientes WHERE id = $1 AND idempresa IS NOT DISTINCT FROM $2',
      [parsedClienteId, empresaId]
    );

    if (clienteExists.rowCount === 0) {
      return res.status(400).json({ error: 'Cliente não encontrado' });
    }

    const columnsAndValues: Array<{ name: string; value: unknown }> = [
      { name: 'cliente_id', value: parsedClienteId },
      { name: 'numero', value: numeroValue },
      { name: 'uf', value: ufValue },
      { name: 'municipio', value: municipioValue },
      { name: 'orgao_julgador', value: orgaoValue },
      { name: 'tipo', value: tipoValue },
      { name: 'status', value: statusValue },
      { name: 'classe_judicial', value: classeValue },
      { name: 'assunto', value: assuntoValue },
      { name: 'jurisdicao', value: jurisdicaoValue },
      { name: 'advogado_responsavel', value: advogadoValue },
      { name: 'data_distribuicao', value: dataDistribuicaoValue },
      { name: 'idempresa', value: empresaId },
    ];

    const columnNames = columnsAndValues.map((item) => item.name).join(',\n           ');
    const placeholders = columnsAndValues.map((_, index) => `$${index + 1}`).join(', ');
    const values = columnsAndValues.map((item) => item.value);

    const result = await pool.query(
      `WITH inserted AS (
       INSERT INTO public.processos (
          ${columnNames}
        ) VALUES (${placeholders})
        RETURNING *
      )
      SELECT
         inserted.id,
         inserted.cliente_id,
         inserted.idempresa,
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
         inserted.criado_em,
         inserted.atualizado_em,
         c.nome AS cliente_nome,
         c.documento AS cliente_documento,
         c.tipo AS cliente_tipo
       FROM inserted
       LEFT JOIN public.clientes c ON c.id = inserted.cliente_id`,
      values
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

    const assignments: string[] = [];
    const values: unknown[] = [];
    const pushAssignment = (column: string, value: unknown) => {
      values.push(value);
      assignments.push(`${column} = $${values.length}`);
    };

    pushAssignment('cliente_id', parsedClienteId);
    pushAssignment('numero', numeroValue);
    pushAssignment('uf', ufValue);
    pushAssignment('municipio', municipioValue);
    pushAssignment('orgao_julgador', orgaoValue);
    pushAssignment('tipo', tipoValue);
    pushAssignment('status', statusValue);
    pushAssignment('classe_judicial', classeValue);
    pushAssignment('assunto', assuntoValue);
    pushAssignment('jurisdicao', jurisdicaoValue);
    pushAssignment('advogado_responsavel', advogadoValue);
    pushAssignment('data_distribuicao', dataDistribuicaoValue);
    assignments.push('atualizado_em = NOW()');

    values.push(parsedId);
    const whereParam = `$${values.length}`;
    const assignmentClause = assignments.join(',\n           ');

    const result = await pool.query(
      `WITH updated AS (
         UPDATE public.processos SET
           ${assignmentClause}
        WHERE id = ${whereParam}
        RETURNING *
      )
       SELECT
         updated.id,
         updated.cliente_id,
         updated.idempresa,
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
         updated.criado_em,
         updated.atualizado_em,
         c.nome AS cliente_nome,
         c.documento AS cliente_documento,
         c.tipo AS cliente_tipo
       FROM updated
       LEFT JOIN public.clientes c ON c.id = updated.cliente_id`,
      values
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
