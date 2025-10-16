import pool from './db';

const clienteSelectFields = `id, nome, tipo, documento, email, telefone, cep, rua, numero, complemento, bairro, cidade, uf, ativo, idempresa, datacadastro`;

export const listClientesByEmpresaId = async (empresaId: number) => {
  const result = await pool.query(
    `SELECT ${clienteSelectFields} FROM public.clientes WHERE idempresa = $1`,
    [empresaId]
  );
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
