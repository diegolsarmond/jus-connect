const TRUE_FLAGS = new Set([
  "true",
  "1",
  "yes",
  "y",
  "sim",
  "s",
  "ativo",
  "ativa",
  "active",
]);

const FALSE_FLAGS = new Set([
  "false",
  "0",
  "no",
  "n",
  "nao",
  "não",
  "inactive",
  "inativo",
  "inativa",
]);

export type CompanySubscriptionStatus = "active" | "inactive" | "trial";

export type SubscriptionCadence = "mensal" | "anual" | "nenhuma" | null;

export interface CompanySubscriptionSource {
  plano?: unknown;
  ativo?: unknown;
  datacadastro?: unknown;
  trial_started_at?: unknown;
  trial_ends_at?: unknown;
  subscription_trial_ends_at?: unknown;
  current_period_start?: unknown;
  current_period_end?: unknown;
  subscription_current_period_ends_at?: unknown;
  grace_expires_at?: unknown;
  subscription_grace_period_ends_at?: unknown;
  subscription_cadence?: unknown;
  plano_recorrencia?: unknown;
  recorrencia?: unknown;
  plano_periodicidade?: unknown;
}

export interface CompanySubscriptionEvaluation {
  planId: string | null;
  isActive: boolean | null;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  gracePeriodEndsAt: string | null;
  status: CompanySubscriptionStatus;
}

const parsePlanId = (value: unknown): string | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  return null;
};

const parseBooleanFlag = (value: unknown): boolean | null => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return null;
    }
    return value !== 0;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      return null;
    }

    if (TRUE_FLAGS.has(normalized)) {
      return true;
    }

    if (FALSE_FLAGS.has(normalized)) {
      return false;
    }
  }

  return null;
};

const coalesceTimestamp = (...values: unknown[]): string | null => {
  for (const value of values) {
    if (value == null) {
      continue;
    }

    if (value instanceof Date) {
      if (!Number.isNaN(value.getTime())) {
        return value.toISOString();
      }
      continue;
    }

    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) {
        continue;
      }

      const parsed = new Date(trimmed);
      if (!Number.isNaN(parsed.getTime())) {
        return trimmed;
      }
    }
  }

  return null;
};

const toTimestamp = (value: string | null): number | null => {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  const time = date.getTime();
  return Number.isNaN(time) ? null : time;
};

export const evaluateCompanySubscription = (
  company: CompanySubscriptionSource,
  now: Date = new Date(),
): CompanySubscriptionEvaluation => {
  const planId = parsePlanId(company.plano);
  const isActive = parseBooleanFlag(company.ativo);

  const trialStartedAt = coalesceTimestamp(company.trial_started_at, company.datacadastro);
  const trialEndsAt = coalesceTimestamp(company.trial_ends_at, company.subscription_trial_ends_at);
  const currentPeriodStart = coalesceTimestamp(company.current_period_start, company.datacadastro);
  const currentPeriodEnd = coalesceTimestamp(
    company.current_period_end,
    company.subscription_current_period_ends_at,
  );
  const gracePeriodEndsAt = coalesceTimestamp(
    company.grace_expires_at,
    company.subscription_grace_period_ends_at,
  );

  const nowTs = now.getTime();
  const trialEndsTs = toTimestamp(trialEndsAt);
  const currentPeriodEndTs = toTimestamp(currentPeriodEnd);
  const gracePeriodEndsTs = toTimestamp(gracePeriodEndsAt);

  let status: CompanySubscriptionStatus = "inactive";

  const isTrialing = trialEndsTs !== null && nowTs < trialEndsTs;
  const hasPlan = planId !== null;
  const isExplicitlyInactive = isActive === false;

  if (isTrialing && !isExplicitlyInactive) {
    status = "trial";
  } else if (hasPlan && !isExplicitlyInactive) {
    if (currentPeriodEndTs !== null && nowTs <= currentPeriodEndTs) {
      status = "active";
    } else if (gracePeriodEndsTs !== null && nowTs <= gracePeriodEndsTs) {
      status = "active";
    } else if (isActive === true) {
      status = "active";
    }
  }

  return {
    planId,
    isActive,
    trialStartedAt,
    trialEndsAt,
    currentPeriodStart,
    currentPeriodEnd,
    gracePeriodEndsAt,
    status,
  };
};

const parseCadence = (value: unknown): SubscriptionCadence => {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();

  if (!normalized) {
    return null;
  }

  if (["mensal", "mensalmente", "monthly", "mês", "mes", "month"].includes(normalized)) {
    return "mensal";
  }

  if (["anual", "anualmente", "annual", "ano", "year", "yearly"].includes(normalized)) {
    return "anual";
  }

  if (["nenhuma", "sem", "none", "no", "n/a"].includes(normalized)) {
    return "nenhuma";
  }

  return null;
};

export const resolveCompanySubscriptionCadence = (
  company: CompanySubscriptionSource,
): SubscriptionCadence => {
  const candidates: unknown[] = [
    company.subscription_cadence,
    company.plano_recorrencia,
    company.recorrencia,
    company.plano_periodicidade,
  ];

  for (const candidate of candidates) {
    const parsed = parseCadence(candidate);
    if (parsed) {
      return parsed;
    }
  }

  return null;
};

export const isCompanyTrialing = (company: CompanySubscriptionSource, now: Date = new Date()): boolean => {
  const { status } = evaluateCompanySubscription(company, now);
  return status === "trial";
};

