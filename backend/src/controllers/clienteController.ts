import { Request, Response } from 'express';
import pool from '../services/db';
import { fetchAuthenticatedUserEmpresa } from '../utils/authUser';
import AsaasCustomerService, {
  AsaasCustomerState,
  ClienteLocalData,
} from '../services/asaasCustomerService';

const asaasCustomerService = new AsaasCustomerService();

const DEFAULT_ASAAS_STATE: AsaasCustomerState = {
  integrationActive: false,
  integrationApiKeyId: null,
  status: 'inactive',
  customerId: null,
  syncedAt: null,
  lastPayload: null,
  errorMessage: null,
};

const triggerAsaasSync = (
  clienteId: number,
  empresaId: number,
  payload: ClienteLocalData
) => {
  const runSync = async () => {
    try {
      await asaasCustomerService.updateFromLocal(clienteId, empresaId, payload);
    } catch (error) {
      console.error('Falha ao sincronizar cliente no Asaas:', error);
    }
  };

  if (typeof setImmediate === 'function') {
    setImmediate(runSync);
  } else {
    void Promise.resolve().then(runSync);
  }
};

export const listClientes = async (req: Request, res: Response) => {
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
      'SELECT id, nome, tipo, documento, email, telefone, cep, rua, numero, complemento, bairro, cidade, uf, ativo, idempresa, datacadastro FROM public.clientes WHERE idempresa = $1',
      [empresaId]
    );
    return res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getClienteById = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    if (!req.auth) {
      return res.status(401).json({ error: 'Token inválido.' });
    }

    const empresaLookup = await fetchAuthenticatedUserEmpresa(req.auth.userId);

    if (!empresaLookup.success) {
      return res.status(empresaLookup.status).json({ error: empresaLookup.message });
    }

    const result = await pool.query(
      'SELECT id, nome, tipo, documento, email, telefone, cep, rua, numero, complemento, bairro, cidade, uf, ativo, idempresa, datacadastro FROM public.clientes WHERE id = $1 AND idempresa IS NOT DISTINCT FROM $2',
      [id, empresaLookup.empresaId]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const countClientesAtivos = async (req: Request, res: Response) => {
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
      return res.json({ total_clientes_ativos: 0 });
    }

    const result = await pool.query(
      'SELECT COUNT(*) AS total_clientes_ativos FROM public.clientes WHERE ativo = TRUE AND idempresa = $1',
      [empresaId]
    );
    res.json({
      total_clientes_ativos: parseInt(result.rows[0].total_clientes_ativos, 10),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createCliente = async (req: Request, res: Response) => {
  const {
    nome,
    tipo,
    documento,
    email,
    telefone,
    cep,
    rua,
    numero,
    complemento,
    bairro,
    cidade,
    uf,
    ativo,
  } = req.body;

  const documentoLimpo = documento ? documento.replace(/\D/g, '') : null;
  const telefoneLimpo = telefone ? telefone.replace(/\D/g, '') : null;

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

    const result = await pool.query(
      'INSERT INTO public.clientes (nome, tipo, documento, email, telefone, cep, rua, numero, complemento, bairro, cidade, uf, ativo, idempresa, datacadastro) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW()) RETURNING id, nome, tipo, documento, email, telefone, cep, rua, numero, complemento, bairro, cidade, uf, ativo, idempresa, datacadastro',
      [
        nome,
        tipo,
        documentoLimpo,
        email,
        telefoneLimpo,
        cep,
        rua,
        numero,
        complemento,
        bairro,
        cidade,
        uf,
        ativo,
        empresaId,
      ]
    );

    const createdCliente = result.rows[0];

    const syncPayload: ClienteLocalData = {
      nome,
      tipo,
      documento: documentoLimpo,
      email,
      telefone: telefoneLimpo,
      cep,
      rua,
      numero,
      complemento,
      bairro,
      cidade,
      uf,
    };

    let asaasIntegration: AsaasCustomerState = { ...DEFAULT_ASAAS_STATE };

    try {
      asaasIntegration = await asaasCustomerService.ensureCustomer(
        createdCliente.id,
        empresaId,
      );

      if (asaasIntegration.integrationActive) {
        triggerAsaasSync(createdCliente.id, empresaId, syncPayload);
      }
    } catch (syncError) {
      console.error('Falha ao preparar sincronização com Asaas:', syncError);
    }

    res.status(201).json({ ...createdCliente, asaasIntegration });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateCliente = async (req: Request, res: Response) => {
  const { id } = req.params;
  const {
    nome,
    tipo,
    documento,
    email,
    telefone,
    cep,
    rua,
    numero,
    complemento,
    bairro,
    cidade,
    uf,
    ativo,
  } = req.body;

  const documentoLimpo = documento ? documento.replace(/\D/g, '') : null;
  const telefoneLimpo = telefone ? telefone.replace(/\D/g, '') : null;

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

    const result = await pool.query(
      'UPDATE public.clientes SET nome = $1, tipo = $2, documento = $3, email = $4, telefone = $5, cep = $6, rua = $7, numero = $8, complemento = $9, bairro = $10, cidade = $11, uf = $12, ativo = $13, idempresa = $14 WHERE id = $15 AND idempresa IS NOT DISTINCT FROM $16 RETURNING id, nome, tipo, documento, email, telefone, cep, rua, numero, complemento, bairro, cidade, uf, ativo, idempresa, datacadastro',
      [
        nome,
        tipo,
        documentoLimpo,
        email,
        telefoneLimpo,
        cep,
        rua,
        numero,
        complemento,
        bairro,
        cidade,
        uf,
        ativo,
        empresaId,
        id,
        empresaId,
      ]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }

    const updatedCliente = result.rows[0];

    const syncPayload: ClienteLocalData = {
      nome,
      tipo,
      documento: documentoLimpo,
      email,
      telefone: telefoneLimpo,
      cep,
      rua,
      numero,
      complemento,
      bairro,
      cidade,
      uf,
    };

    let asaasIntegration: AsaasCustomerState = { ...DEFAULT_ASAAS_STATE };

    try {
      asaasIntegration = await asaasCustomerService.ensureCustomer(updatedCliente.id, empresaId);

      if (asaasIntegration.integrationActive) {
        triggerAsaasSync(updatedCliente.id, empresaId, syncPayload);
      }
    } catch (syncError) {
      console.error('Falha ao preparar sincronização com Asaas:', syncError);
    }

    res.json({ ...updatedCliente, asaasIntegration });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteCliente = async (req: Request, res: Response) => {
  const { id } = req.params;
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

    const result = await pool.query(
      'UPDATE public.clientes SET ativo = NOT ativo WHERE id = $1 AND idempresa IS NOT DISTINCT FROM $2 RETURNING ativo',
      [id, empresaId]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }
    res.json({ ativo: result.rows[0].ativo });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};



