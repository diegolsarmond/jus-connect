import { NextFunction, Request, Response } from 'express';
import pool from '../services/db';
import { fetchAuthenticatedUserEmpresa } from '../utils/authUser';

const sanitizeString = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

export const ensureSubscriptionOwner = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  if (!req.auth) {
    res.status(401).json({ error: 'Token de autenticação ausente.' });
    return;
  }

  const subscriptionId =
    sanitizeString(req.params?.subscriptionId ?? req.params?.id) ??
    sanitizeString((req.body as { subscriptionId?: unknown })?.subscriptionId);

  if (!subscriptionId) {
    res.status(400).json({ error: 'Identificador de assinatura inválido.' });
    return;
  }

  let lookup;
  try {
    lookup = await fetchAuthenticatedUserEmpresa(req.auth.userId);
  } catch (error) {
    console.error('Falha ao verificar empresa do usuário autenticado', error);
    res.status(500).json({ error: 'Não foi possível verificar o vínculo do usuário autenticado.' });
    return;
  }

  if (!lookup.success) {
    res.status(lookup.status).json({ error: lookup.message });
    return;
  }

  if (!lookup.empresaId) {
    res.status(403).json({ error: 'Usuário autenticado não está vinculado a uma empresa.' });
    return;
  }

  let empresa;
  try {
    const result = await pool.query<{ asaas_subscription_id: unknown }>(
      'SELECT asaas_subscription_id FROM public.empresas WHERE id = $1 LIMIT 1',
      [lookup.empresaId],
    );

    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Empresa não encontrada.' });
      return;
    }

    empresa = result.rows[0];
  } catch (error) {
    console.error('Falha ao consultar vínculo de assinatura da empresa', error);
    res
      .status(500)
      .json({ error: 'Não foi possível verificar o vínculo da empresa com a assinatura informada.' });
    return;
  }

  const storedSubscriptionId = sanitizeString(empresa?.asaas_subscription_id);

  if (!storedSubscriptionId) {
    res.status(404).json({ error: 'Nenhuma assinatura ativa foi encontrada para a empresa.' });
    return;
  }

  if (storedSubscriptionId !== subscriptionId) {
    res.status(403).json({ error: 'A assinatura informada não pertence ao usuário autenticado.' });
    return;
  }

  next();
};
