import { Request, Response } from 'express';
import {
  countCompanyResource,
  fetchPlanLimitsForCompany,
} from '../services/planLimitsService';
import {
  countClientesAtivosByEmpresaId,
  countClientesByEmpresaId,
  findClienteById,
  listClientesByEmpresaId,
} from '../services/clienteRepository';
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
      return res
        .status(403)
        .json({ error: 'Usuário autenticado não possui empresa vinculada.' });
    }

    const queryValue = (value: unknown): string | undefined => {
      if (Array.isArray(value)) {
        return value[0];
      }
      return typeof value === 'string' ? value : undefined;
    };

    const pageParam = queryValue(req.query.page);
    const pageSizeParam = queryValue(req.query.pageSize ?? req.query.limit);

    const parsedPage = pageParam ? Number.parseInt(pageParam, 10) : Number.NaN;
    const parsedPageSize = pageSizeParam
      ? Number.parseInt(pageSizeParam, 10)
      : Number.NaN;

    const page = Number.isNaN(parsedPage) || parsedPage < 1 ? 1 : parsedPage;
    const pageSize =
      Number.isNaN(parsedPageSize) || parsedPageSize < 1 ? 20 : parsedPageSize;

    const offset = (page - 1) * pageSize;

    const clientes = await listClientesByEmpresaId(empresaId, {
      limit: pageSize,
      offset,
      orderBy: 'nome',
      orderDirection: 'asc',
    });

    const total = await countClientesByEmpresaId(empresaId);

    return res.json({ data: clientes, total, page, pageSize });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
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

    const cliente = await findClienteById(id, empresaLookup.empresaId);
    if (!cliente) {
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }
    res.json(cliente);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
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
      return res
        .status(403)
        .json({ error: 'Usuário autenticado não possui empresa vinculada.' });
    }

    const totalClientesAtivos = await countClientesAtivosByEmpresaId(empresaId);
    res.json({
      total_clientes_ativos: totalClientesAtivos,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
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
  const tipoNormalizado = (() => {
    if (typeof tipo === 'number') {
      return tipo;
    }

    if (typeof tipo === 'string') {
      if (tipo === 'F') {
        return 1;
      }

      if (tipo === 'J') {
        return 2;
      }

      const parsed = Number.parseInt(tipo, 10);
      return Number.isNaN(parsed) ? null : parsed;
    }

    return null;
  })();

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
        .status(403)
        .json({ error: 'Usuário autenticado não possui empresa vinculada.' });
    }

    if (tipoNormalizado === null) {
      return res.status(400).json({ error: 'Tipo de cliente inválido.' });
    }

    const planLimits = await fetchPlanLimitsForCompany(empresaId);
    if (planLimits?.limiteClientes != null) {
      const clientesCount = await countCompanyResource(empresaId, 'clientes');
      if (clientesCount >= planLimits.limiteClientes) {
        return res
          .status(403)
          .json({ error: 'Limite de clientes do plano atingido.' });
      }
    }

    const result = await pool.query(
      'INSERT INTO public.clientes (nome, tipo, documento, email, telefone, cep, rua, numero, complemento, bairro, cidade, uf, ativo, idempresa, datacadastro) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW()) RETURNING id, nome, tipo, documento, email, telefone, cep, rua, numero, complemento, bairro, cidade, uf, ativo, idempresa, datacadastro',
      [
        nome,
        tipoNormalizado,
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
      tipo: tipoNormalizado,
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
    res.status(500).json({ error: 'Erro interno do servidor.' });
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
  const tipoNormalizado = (() => {
    if (typeof tipo === 'number') {
      return tipo;
    }

    if (typeof tipo === 'string') {
      if (tipo === 'F') {
        return 1;
      }

      if (tipo === 'J') {
        return 2;
      }

      const parsed = Number.parseInt(tipo, 10);
      return Number.isNaN(parsed) ? null : parsed;
    }

    return null;
  })();

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
        .status(403)
        .json({ error: 'Usuário autenticado não possui empresa vinculada.' });
    }

    if (tipoNormalizado === null) {
      return res.status(400).json({ error: 'Tipo de cliente inválido.' });
    }

    const result = await pool.query(
      'UPDATE public.clientes SET nome = $1, tipo = $2, documento = $3, email = $4, telefone = $5, cep = $6, rua = $7, numero = $8, complemento = $9, bairro = $10, cidade = $11, uf = $12, ativo = $13, idempresa = $14 WHERE id = $15 AND idempresa IS NOT DISTINCT FROM $16 RETURNING id, nome, tipo, documento, email, telefone, cep, rua, numero, complemento, bairro, cidade, uf, ativo, idempresa, datacadastro',
      [
        nome,
        tipoNormalizado,
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
      tipo: tipoNormalizado,
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
    res.status(500).json({ error: 'Erro interno do servidor.' });
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
        .status(403)
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
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};



