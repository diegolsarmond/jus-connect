import { Request, Response } from 'express';
import AsaasCustomerService from '../services/asaasCustomerService';
import pool from '../services/db';
import { fetchAuthenticatedUserEmpresa } from '../utils/authUser';

const asaasCustomerService = new AsaasCustomerService();

function parseClienteId(value: string): number | null {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

export const getAsaasCustomerStatus = async (req: Request, res: Response) => {
  const { clienteId: clienteIdParam } = req.params;
  const clienteId = parseClienteId(clienteIdParam);

  if (!clienteId) {
    return res.status(400).json({ error: 'Identificador de cliente inválido.' });
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
      return res
        .status(400)
        .json({ error: 'Usuário autenticado não possui empresa vinculada.' });
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
