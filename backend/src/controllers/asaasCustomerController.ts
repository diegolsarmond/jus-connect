import { Request, Response } from 'express';
import AsaasCustomerService, { ClienteLocalData } from '../services/asaasCustomerService';
import pool from '../services/db';
import { ensureAuthenticatedEmpresaId } from '../middlewares/ensureAuthenticatedEmpresa';

const asaasCustomerService = new AsaasCustomerService();

function parseClienteId(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const parsed = Number.parseInt(trimmed, 10);
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return null;
}

export const getAsaasCustomerStatus = async (req: Request, res: Response) => {
  const clienteId = parseClienteId(
    req.params?.clienteId ?? req.query?.customerId ?? req.query?.clienteId ?? req.query?.id
  );

  if (!clienteId) {
    return res.status(400).json({ error: 'Identificador de cliente inválido.' });
  }

  try {
    const empresaId = await ensureAuthenticatedEmpresaId(req, res, {
      empresaNaoVinculadaStatus: 400,
    });
    if (empresaId === undefined) {
      return;
    }

    const clienteResult = await pool.query(
      'SELECT id FROM public.clientes WHERE id = $1 AND idempresa IS NOT DISTINCT FROM $2',
      [clienteId, empresaId]
    );

    if (clienteResult.rowCount === 0) {
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }

    const status = await asaasCustomerService.ensureCustomer(clienteId, empresaId);
    return res.json(status);
  } catch (error) {
    console.error('Falha ao recuperar status do cliente Asaas:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const syncAsaasCustomerNow = async (req: Request, res: Response) => {
  const clienteId = parseClienteId(
    req.body?.customerId ?? req.body?.clienteId ?? req.params?.clienteId ?? req.query?.customerId
  );

  if (!clienteId) {
    return res.status(400).json({ error: 'Identificador de cliente inválido.' });
  }

  try {
    const empresaId = await ensureAuthenticatedEmpresaId(req, res, {
      empresaNaoVinculadaStatus: 400,
    });
    if (empresaId === undefined) {
      return;
    }

    const clienteResult = await pool.query(
      `SELECT id, nome, tipo, documento, email, telefone, cep, rua, numero, complemento, bairro, cidade, uf
         FROM public.clientes
        WHERE id = $1 AND idempresa IS NOT DISTINCT FROM $2`,
      [clienteId, empresaId]
    );

    if (clienteResult.rowCount === 0) {
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }

    const row = clienteResult.rows[0] as {
      nome: string;
      tipo: string | number | null;
      documento: string | null;
      email: string | null;
      telefone: string | null;
      cep: string | null;
      rua: string | null;
      numero: string | null;
      complemento: string | null;
      bairro: string | null;
      cidade: string | null;
      uf: string | null;
    };

    const payload: ClienteLocalData = {
      nome: row.nome,
      tipo: row.tipo,
      documento: row.documento,
      email: row.email,
      telefone: row.telefone,
      cep: row.cep,
      rua: row.rua,
      numero: row.numero,
      complemento: row.complemento,
      bairro: row.bairro,
      cidade: row.cidade,
      uf: row.uf,
    };

    const status = await asaasCustomerService.updateFromLocal(clienteId, empresaId, payload);
    return res.json(status);
  } catch (error) {
    console.error('Falha ao sincronizar cliente com o Asaas imediatamente:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
