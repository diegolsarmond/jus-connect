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

type ProcessosColumnInfo = {
  hasDatajudTipoJustica: boolean;
  hasDatajudAlias: boolean;
};

const getProcessosColumnInfo = async (): Promise<ProcessosColumnInfo> => {
  try {
    const result = await pool.query(
      `SELECT column_name
         FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'processos'
          AND column_name IN ('datajud_tipo_justica', 'datajud_alias')`
    );

    const columnNames = new Set<string>();

    for (const row of result.rows as Array<{ column_name?: unknown }>) {
      if (typeof row.column_name === 'string') {
        columnNames.add(row.column_name);
      }
    }

    return {
      hasDatajudTipoJustica: columnNames.has('datajud_tipo_justica'),
      hasDatajudAlias: columnNames.has('datajud_alias'),
    };
  } catch (error) {
    console.error('Erro ao verificar colunas da tabela processos', error);
    return {
      hasDatajudTipoJustica: false,
      hasDatajudAlias: false,
    };
  }
};

const buildDatajudSelectExpressions = (
  alias: string,
  info: ProcessosColumnInfo
): string[] => [
  info.hasDatajudTipoJustica
    ? `${alias}.datajud_tipo_justica AS datajud_tipo_justica`
    : 'NULL AS datajud_tipo_justica',
  info.hasDatajudAlias
    ? `${alias}.datajud_alias AS datajud_alias`
    : 'NULL AS datajud_alias',
];

const formatRequiredFieldsMessage = (fields: string[]): string => {
  if (fields.length === 0) {
    return 'Os campos obrigatórios não foram informados';
  }

  if (fields.length === 1) {
    return `O campo ${fields[0]} é obrigatório`;
  }

  const fieldsCopy = [...fields];
  const lastField = fieldsCopy.pop();

  if (!lastField) {
    return 'Os campos obrigatórios não foram informados';
  }

  return `Os campos ${fieldsCopy.join(', ')} e ${lastField} são obrigatórios`;
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
  datajud_tipo_justica: row.datajud_tipo_justica ?? null,
  datajud_alias: row.datajud_alias ?? null,
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
    const columnInfo = await getProcessosColumnInfo();
    const datajudSelect = buildDatajudSelectExpressions('p', columnInfo).join(',\n        ');

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
        ${datajudSelect},
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
    const columnInfo = await getProcessosColumnInfo();
    const datajudSelect = buildDatajudSelectExpressions('p', columnInfo).join(',\n        ');

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
        ${datajudSelect},
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
    const columnInfo = await getProcessosColumnInfo();
    const datajudSelect = buildDatajudSelectExpressions('p', columnInfo).join(',\n        ');

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
        ${datajudSelect},
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
  const columnInfo = await getProcessosColumnInfo();
  const datajudTipoJusticaValue = columnInfo.hasDatajudTipoJustica
    ? normalizeLowercase(datajud_tipo_justica)
    : null;
  const datajudAliasValue = columnInfo.hasDatajudAlias
    ? normalizeLowercase(datajud_alias)
    : null;

  const missingDatajudFields: string[] = [];
  if (columnInfo.hasDatajudTipoJustica && !datajudTipoJusticaValue) {
    missingDatajudFields.push('datajud_tipo_justica');
  }

  if (columnInfo.hasDatajudAlias && !datajudAliasValue) {
    missingDatajudFields.push('datajud_alias');
  }

  if (missingDatajudFields.length > 0) {
    return res.status(400).json({ error: formatRequiredFieldsMessage(missingDatajudFields) });
  }

  try {
    const clienteExists = await pool.query(
      'SELECT 1 FROM public.clientes WHERE id = $1',
      [parsedClienteId]
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
    ];

    if (columnInfo.hasDatajudTipoJustica) {
      columnsAndValues.push({ name: 'datajud_tipo_justica', value: datajudTipoJusticaValue });
    }

    if (columnInfo.hasDatajudAlias) {
      columnsAndValues.push({ name: 'datajud_alias', value: datajudAliasValue });
    }

    const columnNames = columnsAndValues.map((item) => item.name).join(',\n           ');
    const placeholders = columnsAndValues.map((_, index) => `$${index + 1}`).join(', ');
    const values = columnsAndValues.map((item) => item.value);
    const insertedDatajudSelect = buildDatajudSelectExpressions('inserted', columnInfo).join(',\n         ');

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
         ${insertedDatajudSelect},
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
  const columnInfo = await getProcessosColumnInfo();
  const datajudTipoJusticaValue = columnInfo.hasDatajudTipoJustica
    ? normalizeLowercase(datajud_tipo_justica)
    : null;
  const datajudAliasValue = columnInfo.hasDatajudAlias
    ? normalizeLowercase(datajud_alias)
    : null;

  const missingDatajudFields: string[] = [];
  if (columnInfo.hasDatajudTipoJustica && !datajudTipoJusticaValue) {
    missingDatajudFields.push('datajud_tipo_justica');
  }

  if (columnInfo.hasDatajudAlias && !datajudAliasValue) {
    missingDatajudFields.push('datajud_alias');
  }

  if (missingDatajudFields.length > 0) {
    return res.status(400).json({ error: formatRequiredFieldsMessage(missingDatajudFields) });
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

    if (columnInfo.hasDatajudTipoJustica) {
      pushAssignment('datajud_tipo_justica', datajudTipoJusticaValue);
    }

    if (columnInfo.hasDatajudAlias) {
      pushAssignment('datajud_alias', datajudAliasValue);
    }

    assignments.push('atualizado_em = NOW()');

    values.push(parsedId);
    const whereParam = `$${values.length}`;
    const assignmentClause = assignments.join(',\n           ');
    const updatedDatajudSelect = buildDatajudSelectExpressions('updated', columnInfo).join(',\n         ');

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
        ${updatedDatajudSelect},
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

export const getProcessoMovimentacoes = async (req: Request, res: Response) => {
  const { id } = req.params;
  const parsedId = Number(id);

  if (!Number.isInteger(parsedId) || parsedId <= 0) {
    return res.status(400).json({ error: 'ID inválido' });
  }

  try {
    const columnInfo = await getProcessosColumnInfo();
    const datajudAliasSelect = columnInfo.hasDatajudAlias
      ? 'datajud_alias AS datajud_alias'
      : 'NULL AS datajud_alias';

    const result = await pool.query(
      `SELECT numero, ${datajudAliasSelect} FROM public.processos WHERE id = $1`,
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
