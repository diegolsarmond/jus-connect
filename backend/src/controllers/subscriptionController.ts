import { Request, Response } from 'express';
import pool from '../services/db';
import {
  calculateBillingPeriod,
  calculateGraceDeadline,
  calculateTrialEnd,
  parseCadence,
  resolvePlanCadence,
  type SubscriptionCadence,
} from '../services/subscriptionService';

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
  const cadenceInput = parseCadence(req.body?.cadence);

  if (companyId == null || planId == null || !startDate) {
    res.status(400).json({ error: 'Dados inválidos para criar assinatura.' });
    return;
  }

  const isActive = status === 'active' || status === 'trialing';

  let cadence: SubscriptionCadence;

  try {
    cadence = await resolvePlanCadence(planId, cadenceInput);
  } catch (error) {
    console.error('Erro ao determinar recorrência do plano', error);
    res.status(400).json({ error: 'Plano informado é inválido para criar assinatura.' });
    return;
  }

  const isTrialing = status === 'trialing';
  const trialEndsAt = isTrialing ? calculateTrialEnd(startDate) : null;
  const period = isTrialing
    ? { start: startDate, end: trialEndsAt }
    : calculateBillingPeriod(startDate, cadence);
  const graceExpiresAt = isTrialing || !period.end ? trialEndsAt : calculateGraceDeadline(period.end, cadence);

  try {
    const result = await pool.query(
      `UPDATE public.empresas
         SET plano = $1,
             ativo = $2,
             datacadastro = $3,
             trial_started_at = $4,
             trial_ends_at = $5,
             current_period_start = $6,
             current_period_end = $7,
             grace_expires_at = $8,
             subscription_cadence = $9
       WHERE id = $10
       RETURNING id, nome_empresa, plano, ativo, datacadastro, trial_started_at, trial_ends_at, current_period_start, current_period_end, grace_expires_at, subscription_cadence`,
      [
        planId,
        isActive,
        startDate,
        isTrialing ? startDate : null,
        trialEndsAt,
        period.start ?? null,
        period.end ?? null,
        graceExpiresAt ?? null,
        cadence,
        companyId,
      ]
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
      cadence: updated.subscription_cadence,
      trialEndsAt: trialEndsAt ? trialEndsAt.toISOString() : null,
      currentPeriodStart: updated.current_period_start,
      currentPeriodEnd: updated.current_period_end,
      graceExpiresAt: updated.grace_expires_at,
    });
  } catch (error) {
    console.error('Erro ao criar assinatura', error);
    res.status(500).json({ error: 'Não foi possível criar a assinatura.' });
  }
};

export default { createSubscription };
