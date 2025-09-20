import { Request, Response } from 'express';
import pool from '../services/db';
import AsaasChargeService, {
  ChargeConflictError,
  ValidationError as AsaasValidationError,
} from '../services/asaasChargeService';

const asaasChargeService = new AsaasChargeService();

export const listFlows = async (req: Request, res: Response) => {
  const { page = '1', limit = '10' } = req.query;
  const pageNum = parseInt(page as string, 10);
  const limitNum = parseInt(limit as string, 10);
  const offset = (pageNum - 1) * limitNum;
  try {
    const items = await pool.query(
      'SELECT * FROM financial_flows ORDER BY vencimento DESC LIMIT $1 OFFSET $2',
      [limitNum, offset],
    );
    const totalResult = await pool.query('SELECT COUNT(*) FROM financial_flows');
    res.json({
      items: items.rows,
      total: parseInt(totalResult.rows[0].count, 10),
      page: pageNum,
      limit: limitNum,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getFlow = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const result = await pool.query('SELECT * FROM financial_flows WHERE id = $1', [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Flow not found' });
    res.json({ flow: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createFlow = async (req: Request, res: Response) => {
  const {
    tipo,
    descricao,
    valor,
    vencimento,
    paymentMethod,
    clienteId,
    integrationApiKeyId,
    cardToken,
    asaasCustomerId,
    asaasPayload,
    payerEmail,
    payerName,
    customerDocument,
    externalReferenceId,
    metadata,
    remoteIp,
  } = req.body;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const inserted = await client.query(
      'INSERT INTO financial_flows (tipo, descricao, valor, vencimento, status) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [tipo, descricao, valor, vencimento, 'pendente'],
    );

    let flow = inserted.rows[0];
    let charge = null;

    if (typeof paymentMethod === 'string' && paymentMethod.trim()) {
      if (flow.tipo !== 'receita') {
        throw new AsaasValidationError('Apenas receitas podem gerar cobrança no Asaas');
      }

      const chargeResult = await asaasChargeService.createCharge(
        {
          financialFlowId: flow.id,
          billingType: paymentMethod,
          clienteId: clienteId ?? null,
          integrationApiKeyId: integrationApiKeyId ?? null,
          value: valor,
          dueDate: vencimento,
          description: descricao,
          cardToken: cardToken ?? null,
          asaasCustomerId: asaasCustomerId ?? null,
          additionalFields: asaasPayload ?? null,
          payerEmail: payerEmail ?? null,
          payerName: payerName ?? null,
          customerDocument: customerDocument ?? null,
          externalReferenceId: externalReferenceId ?? null,
          metadata: metadata ?? null,
          remoteIp: remoteIp ?? null,
        },
        { dbClient: client },
      );

      flow = chargeResult.flow;
      charge = chargeResult.charge;
    }

    await client.query('COMMIT');
    res.status(201).json({ flow, charge });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err instanceof AsaasValidationError) {
      return res.status(400).json({ error: err.message });
    }
    if (err instanceof ChargeConflictError) {
      return res.status(409).json({ error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
};

export const updateFlow = async (req: Request, res: Response) => {
  const { id } = req.params;
  const {
    tipo,
    descricao,
    valor,
    vencimento,
    pagamento,
    status,
    paymentMethod,
    clienteId,
    integrationApiKeyId,
    cardToken,
    asaasCustomerId,
    asaasPayload,
    payerEmail,
    payerName,
    customerDocument,
    externalReferenceId,
    metadata,
    remoteIp,
  } = req.body;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await client.query(
      'UPDATE financial_flows SET tipo=$1, descricao=$2, valor=$3, vencimento=$4, pagamento=$5, status=$6 WHERE id=$7 RETURNING *',
      [tipo, descricao, valor, vencimento, pagamento, status, id],
    );
    if (result.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Flow not found' });
    }

    let flow = result.rows[0];
    let charge = null;

    if (typeof paymentMethod === 'string' && paymentMethod.trim()) {
      if (flow.tipo !== 'receita') {
        throw new AsaasValidationError('Apenas receitas podem gerar cobrança no Asaas');
      }

      const chargeResult = await asaasChargeService.createCharge(
        {
          financialFlowId: flow.id,
          billingType: paymentMethod,
          clienteId: clienteId ?? null,
          integrationApiKeyId: integrationApiKeyId ?? null,
          value: valor ?? flow.valor,
          dueDate: vencimento ?? flow.vencimento,
          description: descricao ?? flow.descricao,
          cardToken: cardToken ?? null,
          asaasCustomerId: asaasCustomerId ?? null,
          additionalFields: asaasPayload ?? null,
          payerEmail: payerEmail ?? null,
          payerName: payerName ?? null,
          customerDocument: customerDocument ?? null,
          externalReferenceId: externalReferenceId ?? flow.external_reference_id ?? null,
          metadata: metadata ?? null,
          remoteIp: remoteIp ?? null,
        },
        { dbClient: client },
      );

      flow = chargeResult.flow;
      charge = chargeResult.charge;
    }

    await client.query('COMMIT');
    res.json({ flow, charge });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err instanceof AsaasValidationError) {
      return res.status(400).json({ error: err.message });
    }
    if (err instanceof ChargeConflictError) {
      return res.status(409).json({ error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
};

export const deleteFlow = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM financial_flows WHERE id=$1', [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Flow not found' });
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const settleFlow = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { pagamentoData } = req.body;
  try {
    const current = await pool.query('SELECT external_provider FROM financial_flows WHERE id = $1', [id]);
    if (current.rowCount === 0) {
      return res.status(404).json({ error: 'Flow not found' });
    }

    const provider = current.rows[0].external_provider;
    if (typeof provider === 'string' && provider.trim().toLowerCase() === 'asaas') {
      return res.status(409).json({ error: 'Status controlado pelo Asaas para este fluxo financeiro' });
    }

    const result = await pool.query(
      "UPDATE financial_flows SET pagamento=$1, status='pago' WHERE id=$2 RETURNING *",
      [pagamentoData, id],
    );
    res.json({ flow: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createAsaasChargeForFlow = async (req: Request, res: Response) => {
  const { id } = req.params;
  const {
    paymentMethod,
    clienteId,
    integrationApiKeyId,
    cardToken,
    asaasCustomerId,
    asaasPayload,
    payerEmail,
    payerName,
    customerDocument,
    externalReferenceId,
    metadata,
    remoteIp,
  } = req.body;

  if (typeof paymentMethod !== 'string' || !paymentMethod.trim()) {
    return res.status(400).json({ error: 'paymentMethod é obrigatório' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const flowResult = await client.query('SELECT * FROM financial_flows WHERE id = $1', [id]);
    if (flowResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Flow not found' });
    }

    const flow = flowResult.rows[0];
    if (flow.tipo !== 'receita') {
      throw new AsaasValidationError('Apenas receitas podem gerar cobrança no Asaas');
    }

    const chargeResult = await asaasChargeService.createCharge(
      {
        financialFlowId: flow.id,
        billingType: paymentMethod,
        clienteId: clienteId ?? null,
        integrationApiKeyId: integrationApiKeyId ?? null,
        value: flow.valor,
        dueDate: flow.vencimento,
        description: flow.descricao,
        cardToken: cardToken ?? null,
        asaasCustomerId: asaasCustomerId ?? null,
        additionalFields: asaasPayload ?? null,
        payerEmail: payerEmail ?? null,
        payerName: payerName ?? null,
        customerDocument: customerDocument ?? null,
        externalReferenceId: externalReferenceId ?? flow.external_reference_id ?? null,
        metadata: metadata ?? null,
        remoteIp: remoteIp ?? null,
      },
      { dbClient: client },
    );

    await client.query('COMMIT');
    res.status(201).json({ flow: chargeResult.flow, charge: chargeResult.charge });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err instanceof AsaasValidationError) {
      return res.status(400).json({ error: err.message });
    }
    if (err instanceof ChargeConflictError) {
      return res.status(409).json({ error: err.message });
    }
    if ((err as Error & { code?: string }).code === '23505') {
      return res
        .status(409)
        .json({ error: 'O fluxo financeiro já possui uma cobrança vinculada ao Asaas' });
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
};
