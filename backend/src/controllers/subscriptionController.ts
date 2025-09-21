import { Request, Response } from 'express';
import pool from '../services/db';

const parseNumericId = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const parsed = Number(trimmed);
    if (Number.isInteger(parsed)) {
      return parsed;
    }
  }

  return null;
};

const parseStatus = (value: unknown): 'active' | 'trialing' | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === 'active' || normalized === 'trialing') {
    return normalized;
  }

  return null;
};

const parseStartDate = (value: unknown): Date | null => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return null;
};

export const createSubscription = async (req: Request, res: Response) => {
  const companyId = parseNumericId(req.body?.companyId);
  const planId = parseNumericId(req.body?.planId);
  const status = parseStatus(req.body?.status) ?? 'active';
  const startDate = parseStartDate(req.body?.startDate);

  if (companyId == null || planId == null || !startDate) {
    res.status(400).json({ error: 'Dados inválidos para criar assinatura.' });
    return;
  }

  const isActive = status === 'active' || status === 'trialing';

  try {
    const result = await pool.query(
      `UPDATE public.empresas
         SET plano = $1,
             ativo = $2,
             datacadastro = $3
       WHERE id = $4
       RETURNING id, nome_empresa, plano, ativo, datacadastro`,
      [planId, isActive, startDate, companyId]
    );

    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Empresa não encontrada.' });
      return;
    }

    const updated = result.rows[0];

    res.status(201).json({
      id: `subscription-${updated.id}`,
      companyId: updated.id,
      planId: updated.plano,
      status,
      isActive: updated.ativo,
      startDate: updated.datacadastro,
    });
  } catch (error) {
    console.error('Erro ao criar assinatura', error);
    res.status(500).json({ error: 'Não foi possível criar a assinatura.' });
  }
};

export default { createSubscription };
