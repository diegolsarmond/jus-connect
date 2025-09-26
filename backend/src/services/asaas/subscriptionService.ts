import AsaasClient, {
  CreateSubscriptionPayload,
  SubscriptionResponse,
  SubscriptionCycle,
} from './asaasClient';
import { calculateGraceDeadline, type SubscriptionCadence } from '../subscriptionService';

const CADENCE_DURATIONS: Record<SubscriptionCadence, number> = {
  monthly: 30,
  annual: 365,
};

type ClientFactoryConfig = {
  baseUrl: string;
  accessToken: string;
};

type ClientFactory = (config: ClientFactoryConfig) => AsaasClient;

export interface SubscriptionTimeline {
  trialStart: Date | null;
  trialEnd: Date | null;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  gracePeriodEnd: Date | null;
  cadence: SubscriptionCadence;
}

export interface ManageSubscriptionInput extends CreateSubscriptionPayload {
  subscriptionId?: string | null;
}

export interface ManageSubscriptionResult {
  subscription: SubscriptionResponse;
  timeline: SubscriptionTimeline;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object';

const toDate = (value: unknown): Date | null => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(value.getTime());
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

const addDays = (date: Date, amount: number): Date => {
  const clone = new Date(date.getTime());
  clone.setUTCDate(clone.getUTCDate() + amount);
  return clone;
};

const subtractDays = (date: Date, amount: number): Date => addDays(date, -amount);

const resolveCadence = (cycle: SubscriptionCycle | string | null | undefined): SubscriptionCadence => {
  if (!cycle) {
    return 'monthly';
  }

  const normalized = cycle.toString().trim().toUpperCase();
  if (normalized === 'ANNUAL' || normalized === 'YEARLY') {
    return 'annual';
  }

  return 'monthly';
};

const findFirstRecord = (candidates: Array<unknown>): Record<string, unknown> | null => {
  for (const candidate of candidates) {
    if (isRecord(candidate)) {
      return candidate;
    }
  }
  return null;
};

const pickDate = (record: Record<string, unknown> | null, keys: string[]): Date | null => {
  if (!record) {
    return null;
  }

  for (const key of keys) {
    if (key in record) {
      const parsed = toDate(record[key]);
      if (parsed) {
        return parsed;
      }
    }
  }

  return null;
};

const extractTimeline = (
  response: SubscriptionResponse,
  payload: CreateSubscriptionPayload,
): SubscriptionTimeline => {
  const cadence = resolveCadence(response.cycle ?? payload.cycle ?? 'MONTHLY');

  const responseTrial = isRecord(response.trial) ? response.trial : null;
  const payloadTrial = isRecord(payload.trial) ? payload.trial : null;

  const trialStart =
    toDate(
      responseTrial?.startDate ??
        responseTrial?.start ??
        payloadTrial?.startDate ??
        payloadTrial?.start ??
        response.dateCreated ??
        null,
    ) ?? null;

  const trialEnd =
    toDate(
      responseTrial?.endDate ??
        responseTrial?.end ??
        responseTrial?.dueDate ??
        payloadTrial?.endDate ??
        payloadTrial?.end ??
        payloadTrial?.dueDate ??
        null,
    ) ?? null;

  const periodSource =
    findFirstRecord([
      response.currentCycle,
      response.currentPeriod,
      (response as Record<string, unknown>).currentPeriodInfo,
      (response as Record<string, unknown>).billingPeriod,
    ]) ?? null;

  let currentPeriodStart =
    pickDate(periodSource, ['start', 'startDate', 'begin', 'beginDate']) ??
    toDate((response as Record<string, unknown>).currentPeriodStart ?? null) ??
    (trialEnd ? new Date(trialEnd) : null);

  const requestedPeriodStart =
    pickDate(payloadTrial ?? null, ['start', 'startDate']) ??
    toDate((payload as Record<string, unknown>).currentPeriodStart ?? null);

  if (!currentPeriodStart && requestedPeriodStart) {
    currentPeriodStart = new Date(requestedPeriodStart);
  }

  let currentPeriodEnd =
    pickDate(periodSource, ['end', 'endDate', 'due', 'dueDate']) ??
    toDate((response as Record<string, unknown>).currentPeriodEnd ?? null) ??
    toDate(response.nextDueDate ?? null) ??
    toDate((payload as Record<string, unknown>).currentPeriodEnd ?? null) ??
    toDate(payload.nextDueDate ?? null);

  if (currentPeriodEnd && !currentPeriodStart) {
    currentPeriodStart = subtractDays(currentPeriodEnd, CADENCE_DURATIONS[cadence]);
  } else if (!currentPeriodEnd && currentPeriodStart) {
    currentPeriodEnd = addDays(currentPeriodStart, CADENCE_DURATIONS[cadence]);
  }

  const gracePeriodEnd =
    currentPeriodEnd != null ? calculateGraceDeadline(currentPeriodEnd, cadence) : null;

  return {
    trialStart,
    trialEnd,
    currentPeriodStart,
    currentPeriodEnd,
    gracePeriodEnd,
    cadence,
  } satisfies SubscriptionTimeline;
};

export default class AsaasSubscriptionService {
  constructor(private readonly clientFactory: ClientFactory = (config) => new AsaasClient(config)) {}

  async createOrUpdateSubscription({
    integration,
    payload,
  }: {
    integration: ClientFactoryConfig;
    payload: ManageSubscriptionInput;
  }): Promise<ManageSubscriptionResult> {
    const client = this.clientFactory(integration);
    const { subscriptionId, ...rest } = payload;
    const subscriptionPayload: CreateSubscriptionPayload = rest;

    const normalizedId =
      typeof subscriptionId === 'string' && subscriptionId.trim().length > 0
        ? subscriptionId.trim()
        : null;

    let response: SubscriptionResponse;
    if (normalizedId) {
      response = await client.updateSubscription(normalizedId, subscriptionPayload);
    } else {
      response = await client.createSubscription(subscriptionPayload);
    }

    const timeline = extractTimeline(response, subscriptionPayload);
    return { subscription: response, timeline } satisfies ManageSubscriptionResult;
  }
}
