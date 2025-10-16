import pool from './db';

const clienteSelectFields = `id, nome, tipo, documento, email, telefone, cep, rua, numero, complemento, bairro, cidade, uf, ativo, idempresa, datacadastro`;

type ListClientesOptions = {
  limit?: number;
  offset?: number;
  orderBy?: 'nome' | 'datacadastro';
  orderDirection?: 'asc' | 'desc';
};

export const listClientesByEmpresaId = async (
  empresaId: number,
  options: ListClientesOptions = {}
) => {
  const orderColumn = options.orderBy === 'nome' ? 'nome' : 'datacadastro';
  const orderDirection = options.orderDirection === 'desc' ? 'DESC' : 'ASC';

  let query = `SELECT ${clienteSelectFields} FROM public.clientes WHERE idempresa = $1 ORDER BY ${orderColumn} ${orderDirection}, id ASC`;
  const params: Array<number> = [empresaId];

  if (typeof options.limit === 'number') {
    params.push(options.limit);
    query += ` LIMIT $${params.length}`;
  }

  if (typeof options.offset === 'number') {
    params.push(options.offset);
    query += ` OFFSET $${params.length}`;
  }

  const result = await pool.query(query, params);
  return result.rows;
};

export const findClienteById = async (id: string, empresaId: number | null) => {
  const result = await pool.query(
    `SELECT ${clienteSelectFields} FROM public.clientes WHERE id = $1 AND idempresa IS NOT DISTINCT FROM $2`,
    [id, empresaId]
  );
  return result.rows[0] ?? null;
};

export const countClientesAtivosByEmpresaId = async (empresaId: number) => {
  const result = await pool.query(
    'SELECT COUNT(*) AS total FROM public.clientes WHERE ativo = TRUE AND idempresa = $1',
    [empresaId]
  );
  const total = result.rows[0]?.total;
  return typeof total === 'string' ? Number.parseInt(total, 10) : Number(total ?? 0);
};

export const countClientesByEmpresaId = async (empresaId: number) => {
  const result = await pool.query(
    'SELECT COUNT(*) AS total FROM public.clientes WHERE idempresa = $1',
    [empresaId]
  );
  const total = result.rows[0]?.total;
  return typeof total === 'string' ? Number.parseInt(total, 10) : Number(total ?? 0);
};
