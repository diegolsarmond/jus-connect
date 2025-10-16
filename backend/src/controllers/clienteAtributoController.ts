import { Request, Response } from 'express';
import pool from '../services/db';
import { fetchAuthenticatedUserEmpresa } from '../utils/authUser';

type AuthenticatedUser = NonNullable<Request['auth']>;

type ClienteAccessResult =
  | { success: true }
  | { success: false; status: number; message: string };

type ClienteAtributoAccessResult = ClienteAccessResult;

const getAuthenticatedUser = (
  req: Request,
  res: Response
): AuthenticatedUser | null => {
  if (!req.auth) {
    res.status(401).json({ error: 'Token inválido.' });
    return null;
  }

  return req.auth;
};

const resolveEmpresaId = async (
  auth: AuthenticatedUser,
  res: Response
): Promise<number | null | undefined> => {
  const empresaLookup = await fetchAuthenticatedUserEmpresa(auth.userId);

  if (!empresaLookup.success) {
    res.status(empresaLookup.status).json({ error: empresaLookup.message });
    return undefined;
  }

  return empresaLookup.empresaId;
};

const parseIntegerParam = (
  value: string | undefined,
  paramName: string,
  res: Response
): number | null => {
  if (!value) {
    res.status(400).json({ error: `Parâmetro "${paramName}" é obrigatório.` });
    return null;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    res.status(400).json({ error: `Parâmetro "${paramName}" inválido.` });
    return null;
  }

  return parsed;
};

const parseIntegerValue = (
  value: unknown,
  field: string,
  res: Response
): number | null => {
  if (value === undefined || value === null) {
    res.status(400).json({ error: `Campo "${field}" é obrigatório.` });
    return null;
  }

  if (typeof value === 'number' && Number.isInteger(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);

    if (Number.isInteger(parsed)) {
      return parsed;
    }
  }

  res.status(400).json({ error: `Campo "${field}" inválido.` });
  return null;
};

const ensureClienteAccess = async (
  clienteId: number,
  empresaId: number | null,
  res: Response
): Promise<ClienteAccessResult> => {
  const clienteResult = await pool.query(
    'SELECT 1 FROM public.clientes WHERE id = $1 AND idempresa IS NOT DISTINCT FROM $2',
    [clienteId, empresaId]
  );

  if (clienteResult.rowCount === 0) {
    res.status(404).json({ error: 'Cliente não encontrado.' });
    return { success: false, status: 404, message: 'Cliente não encontrado.' };
  }

  return { success: true };
};

const ensureClienteAtributoAccess = async (
  atributoId: number,
  clienteId: number,
  empresaId: number | null,
  res: Response
): Promise<ClienteAtributoAccessResult> => {
  const atributoResult = await pool.query(
    `SELECT 1
     FROM public.cliente_atributos ca
     JOIN public.clientes c ON ca.idclientes = c.id
     WHERE ca.id = $1
       AND ca.idclientes = $2
       AND c.idempresa IS NOT DISTINCT FROM $3`,
    [atributoId, clienteId, empresaId]
  );

  if (atributoResult.rowCount === 0) {
    res.status(404).json({ error: 'Atributo do cliente não encontrado.' });
    return {
      success: false,
      status: 404,
      message: 'Atributo do cliente não encontrado.',
    };
  }

  return { success: true };
};

const ensureTipoDocumentoAccess = async (
  tipoDocumentoId: number,
  empresaId: number | null,
  res: Response
): Promise<boolean> => {
  const tipoDocumentoResult = await pool.query(
    'SELECT 1 FROM public.tipo_documento WHERE id = $1 AND idempresa IS NOT DISTINCT FROM $2',
    [tipoDocumentoId, empresaId]
  );

  if (tipoDocumentoResult.rowCount === 0) {
    res.status(404).json({ error: 'Tipo de documento não encontrado.' });
    return false;
  }

  return true;
};

const fetchClienteAtributoById = async (
  atributoId: number
) => {
  const result = await pool.query(
    `SELECT
       ca.id,
       ca.idclientes AS cliente_id,
       ca.idtipodocumento AS tipo_documento_id,
       td.nome AS tipo_documento_nome,
       ca.valor,
       ca.datacadastro
     FROM public.cliente_atributos ca
     JOIN public.tipo_documento td ON td.id = ca.idtipodocumento
     WHERE ca.id = $1`,
    [atributoId]
  );

  return result.rows[0];
};

const parseValor = (valor: unknown, res: Response): string | null => {
  if (valor === undefined || valor === null) {
    res.status(400).json({ error: 'Campo "valor" é obrigatório.' });
    return null;
  }

  const valorString = typeof valor === 'string' ? valor : String(valor);

  if (valorString.trim() === '') {
    res.status(400).json({ error: 'Campo "valor" não pode ser vazio.' });
    return null;
  }

  return valorString;
};

export const listClienteAtributoTipos = async (req: Request, res: Response) => {
  const auth = getAuthenticatedUser(req, res);
  if (!auth) {
    return;
  }

  const empresaId = await resolveEmpresaId(auth, res);
  if (empresaId === undefined) {
    return;
  }

  const empresaIdValue = empresaId ?? null;

  try {
    const result = await pool.query(
      `SELECT td.id, td.nome
       FROM public.tipo_documento td
       WHERE EXISTS (
         SELECT 1
         FROM public.cliente_atributos ca
         WHERE ca.idtipodocumento = td.id
       )
       AND td.idempresa IS NOT DISTINCT FROM $1
       ORDER BY td.nome ASC`,
      [empresaIdValue]
    );

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

export const listClienteAtributos = async (req: Request, res: Response) => {
  const auth = getAuthenticatedUser(req, res);
  if (!auth) {
    return;
  }

  const empresaId = await resolveEmpresaId(auth, res);
  if (empresaId === undefined) {
    return;
  }

  const empresaIdValue = empresaId ?? null;

  const clienteId = parseIntegerParam(req.params.clienteId, 'clienteId', res);
  if (clienteId === null) {
    return;
  }

  const clienteAccess = await ensureClienteAccess(clienteId, empresaIdValue, res);
  if (!clienteAccess.success) {
    return;
  }

  try {
    const result = await pool.query(
      `SELECT
         ca.id,
         ca.idclientes AS cliente_id,
         ca.idtipodocumento AS tipo_documento_id,
         td.nome AS tipo_documento_nome,
         ca.valor,
         ca.datacadastro
       FROM public.cliente_atributos ca
       JOIN public.tipo_documento td ON td.id = ca.idtipodocumento
       WHERE ca.idclientes = $1
       ORDER BY ca.id ASC`,
      [clienteId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

export const createClienteAtributo = async (req: Request, res: Response) => {
  const auth = getAuthenticatedUser(req, res);
  if (!auth) {
    return;
  }

  const empresaId = await resolveEmpresaId(auth, res);
  if (empresaId === undefined) {
    return;
  }

  const empresaIdValue = empresaId ?? null;

  const clienteId = parseIntegerParam(req.params.clienteId, 'clienteId', res);
  if (clienteId === null) {
    return;
  }

  const clienteAccess = await ensureClienteAccess(clienteId, empresaIdValue, res);
  if (!clienteAccess.success) {
    return;
  }

  const tipoDocumentoId = parseIntegerValue(req.body.idtipodocumento, 'idtipodocumento', res);
  if (tipoDocumentoId === null) {
    return;
  }

  const valor = parseValor(req.body.valor, res);
  if (valor === null) {
    return;
  }

  const tipoDocumentoAccess = await ensureTipoDocumentoAccess(
    tipoDocumentoId,
    empresaIdValue,
    res
  );

  if (!tipoDocumentoAccess) {
    return;
  }

  try {
    const insertResult = await pool.query(
      `INSERT INTO public.cliente_atributos (idclientes, idtipodocumento, valor)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [clienteId, tipoDocumentoId, valor]
    );

    const created = await fetchClienteAtributoById(insertResult.rows[0].id);

    res.status(201).json(created);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

export const updateClienteAtributo = async (req: Request, res: Response) => {
  const auth = getAuthenticatedUser(req, res);
  if (!auth) {
    return;
  }

  const empresaId = await resolveEmpresaId(auth, res);
  if (empresaId === undefined) {
    return;
  }

  const empresaIdValue = empresaId ?? null;

  const clienteId = parseIntegerParam(req.params.clienteId, 'clienteId', res);
  if (clienteId === null) {
    return;
  }

  const atributoId = parseIntegerParam(req.params.id, 'id', res);
  if (atributoId === null) {
    return;
  }

  const atributoAccess = await ensureClienteAtributoAccess(
    atributoId,
    clienteId,
    empresaIdValue,
    res
  );
  if (!atributoAccess.success) {
    return;
  }

  const tipoDocumentoId = parseIntegerValue(req.body.idtipodocumento, 'idtipodocumento', res);
  if (tipoDocumentoId === null) {
    return;
  }

  const valor = parseValor(req.body.valor, res);
  if (valor === null) {
    return;
  }

  const tipoDocumentoAccess = await ensureTipoDocumentoAccess(
    tipoDocumentoId,
    empresaIdValue,
    res
  );

  if (!tipoDocumentoAccess) {
    return;
  }

  try {
    const updateResult = await pool.query(
      `UPDATE public.cliente_atributos
       SET idtipodocumento = $1, valor = $2
       WHERE id = $3 AND idclientes = $4`,
      [tipoDocumentoId, valor, atributoId, clienteId]
    );

    if (updateResult.rowCount === 0) {
      res.status(404).json({ error: 'Atributo do cliente não encontrado.' });
      return;
    }

    const updated = await fetchClienteAtributoById(atributoId);

    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

export const deleteClienteAtributo = async (req: Request, res: Response) => {
  const auth = getAuthenticatedUser(req, res);
  if (!auth) {
    return;
  }

  const empresaId = await resolveEmpresaId(auth, res);
  if (empresaId === undefined) {
    return;
  }

  const empresaIdValue = empresaId ?? null;

  const clienteId = parseIntegerParam(req.params.clienteId, 'clienteId', res);
  if (clienteId === null) {
    return;
  }

  const atributoId = parseIntegerParam(req.params.id, 'id', res);
  if (atributoId === null) {
    return;
  }

  const atributoAccess = await ensureClienteAtributoAccess(
    atributoId,
    clienteId,
    empresaIdValue,
    res
  );
  if (!atributoAccess.success) {
    return;
  }

  try {
    const deleteResult = await pool.query(
      'DELETE FROM public.cliente_atributos WHERE id = $1 AND idclientes = $2',
      [atributoId, clienteId]
    );

    if (deleteResult.rowCount === 0) {
      res.status(404).json({ error: 'Atributo do cliente não encontrado.' });
      return;
    }

    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};
