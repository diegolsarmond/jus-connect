import { URL } from 'node:url';

export interface ProcessSyncSubtotal {
  service: string;
  quantity: number;
  totalCost: number;
}

export interface ProcessSyncReport {
  period: {
    from: string | null;
    to: string | null;
  };
  totalRequests: number;
  totalCost: number;
  subtotals: ProcessSyncSubtotal[];
}

type RemotePricingItem = {
  service?: unknown;
  code?: unknown;
  label?: unknown;
  name?: unknown;
  description?: unknown;
  type?: unknown;
  quantity?: unknown;
  count?: unknown;
  units?: unknown;
  total?: unknown;
  total_price?: unknown;
  totalPrice?: unknown;
  total_amount?: unknown;
  amount?: unknown;
  price?: unknown;
  unit_price?: unknown;
  unitPrice?: unknown;
};

type RemotePricing = {
  total?: unknown;
  total_price?: unknown;
  totalPrice?: unknown;
  total_amount?: unknown;
  amount?: unknown;
  items?: unknown;
  breakdown?: unknown;
};

type RemoteRequest = {
  pricing?: unknown;
  service?: unknown;
  service_name?: unknown;
  serviceName?: unknown;
  type?: unknown;
  name?: unknown;
  code?: unknown;
  description?: unknown;
};

const DEFAULT_BASE_URL = 'https://requests.prod.judit.io';

const toTrimmedString = (value: unknown): string | null => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return null;
};

const toPositiveInteger = (value: unknown, fallback: number): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const rounded = Math.floor(value);
    return rounded > 0 ? rounded : fallback;
  }
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return fallback;
};

const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const normalized = value.replace(/[^0-9,.-]+/g, '').replace(',', '.');
    if (!normalized) {
      return null;
    }
    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const resolveRequestsBaseUrl = (): string => {
  const candidates = [
    process.env.JUDIT_SYNC_REPORT_BASE_URL,
    process.env.JUDIT_BASE_URL,
    process.env.JUDIT_API_URL,
  ];
  for (const candidate of candidates) {
    const trimmed = toTrimmedString(candidate);
    if (trimmed) {
      return trimmed.replace(/\/+$/, '');
    }
  }
  return DEFAULT_BASE_URL;
};

const resolveApiKey = (): string => {
  const candidates = [process.env.JUDIT_SYNC_REPORT_API_KEY, process.env.JUDIT_API_KEY];
  for (const candidate of candidates) {
    const trimmed = toTrimmedString(candidate);
    if (trimmed) {
      return trimmed;
    }
  }
  throw new Error('JUDIT_API_KEY não configurado.');
};

const extractRequests = (payload: unknown): RemoteRequest[] => {
  if (Array.isArray(payload)) {
    return payload as RemoteRequest[];
  }
  if (payload && typeof payload === 'object') {
    const rows = (payload as { rows?: unknown }).rows;
    if (Array.isArray(rows)) {
      return rows as RemoteRequest[];
    }
    const data = (payload as { data?: unknown }).data;
    if (Array.isArray(data)) {
      return data as RemoteRequest[];
    }
    if (data && typeof data === 'object') {
      const nestedRows = (data as { rows?: unknown }).rows;
      if (Array.isArray(nestedRows)) {
        return nestedRows as RemoteRequest[];
      }
    }
  }
  return [];
};

const extractPricingItems = (pricing: RemotePricing | null): RemotePricingItem[] => {
  if (!pricing) {
    return [];
  }
  const collections = [];
  if (Array.isArray(pricing.breakdown)) {
    collections.push(pricing.breakdown);
  }
  if (Array.isArray(pricing.items)) {
    collections.push(pricing.items);
  }
  const items = collections.flat().filter((item): item is RemotePricingItem => item != null && typeof item === 'object');
  return items;
};

const resolvePricingTotal = (pricing: RemotePricing | null): number | null => {
  if (!pricing) {
    return null;
  }
  const candidates = [pricing.total, pricing.total_price, pricing.totalPrice, pricing.total_amount, pricing.amount];
  for (const candidate of candidates) {
    const value = toNumber(candidate);
    if (value !== null) {
      return value;
    }
  }
  return null;
};

const resolveItemLabel = (item: RemotePricingItem, fallback: string): string | null => {
  const candidates = [item.service, item.label, item.name, item.code, item.description, item.type];
  for (const candidate of candidates) {
    const label = toTrimmedString(candidate);
    if (label) {
      return label;
    }
  }
  return fallback || null;
};

const resolveItemQuantity = (item: RemotePricingItem): number => {
  const candidates = [item.quantity, item.count, item.units];
  for (const candidate of candidates) {
    const value = toNumber(candidate);
    if (value !== null) {
      return value;
    }
  }
  return 1;
};

const resolveItemTotal = (item: RemotePricingItem, quantity: number): number | null => {
  const candidates = [item.total, item.total_price, item.totalPrice, item.total_amount, item.amount, item.price];
  for (const candidate of candidates) {
    const value = toNumber(candidate);
    if (value !== null) {
      return value;
    }
  }
  const unit = toNumber(item.unit_price ?? item.unitPrice);
  if (unit !== null) {
    return unit * quantity;
  }
  return null;
};

const resolveRequestServiceName = (request: RemoteRequest): string => {
  const candidates = [
    request.service,
    request.serviceName,
    request.service_name,
    request.name,
    request.code,
    request.type,
    request.description,
  ];
  for (const candidate of candidates) {
    const label = toTrimmedString(candidate);
    if (label) {
      return label;
    }
  }
  return 'Serviço';
};

const accumulate = (
  subtotals: Map<string, ProcessSyncSubtotal>,
  service: string,
  quantity: number,
  total: number,
) => {
  const existing = subtotals.get(service);
  if (existing) {
    existing.quantity += quantity;
    existing.totalCost += total;
    return;
  }
  subtotals.set(service, {
    service,
    quantity,
    totalCost: total,
  });
};

const collectRequestTotals = (
  request: RemoteRequest,
  subtotals: Map<string, ProcessSyncSubtotal>,
): number => {
  const pricing = request.pricing && typeof request.pricing === 'object' ? (request.pricing as RemotePricing) : null;
  const serviceName = resolveRequestServiceName(request);
  const items = extractPricingItems(pricing);
  let total = 0;
  if (items.length > 0) {
    for (const item of items) {
      const quantity = resolveItemQuantity(item);
      const itemTotal = resolveItemTotal(item, quantity);
      if (itemTotal === null) {
        continue;
      }
      const label = resolveItemLabel(item, serviceName);
      if (!label) {
        continue;
      }
      accumulate(subtotals, label, quantity, itemTotal);
      total += itemTotal;
    }
  }
  if (total === 0) {
    const fallbackTotal = resolvePricingTotal(pricing);
    if (fallbackTotal !== null) {
      accumulate(subtotals, serviceName, 1, fallbackTotal);
      total = fallbackTotal;
    }
  }
  return total;
};

export const fetchProcessSyncReport = async (): Promise<ProcessSyncReport> => {
  const baseUrl = resolveRequestsBaseUrl();
  const apiKey = resolveApiKey();
  const pageSize = toPositiveInteger(process.env.JUDIT_SYNC_REPORT_PAGE_SIZE, 100);
  const createdAtGte = toTrimmedString(process.env.JUDIT_SYNC_REPORT_CREATED_AT_GTE);
  const createdAtLte = toTrimmedString(process.env.JUDIT_SYNC_REPORT_CREATED_AT_LTE);
  const userId = toTrimmedString(process.env.JUDIT_SYNC_REPORT_USER_ID);
  const endpoint = new URL('/requests', baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`);
  endpoint.searchParams.set('page_size', String(pageSize));
  if (createdAtGte) {
    endpoint.searchParams.set('created_at_gte', createdAtGte);
  }
  if (createdAtLte) {
    endpoint.searchParams.set('created_at_lte', createdAtLte);
  }
  if (userId) {
    endpoint.searchParams.set('user_id', userId);
  }
  const response = await fetch(endpoint, {
    headers: {
      Accept: 'application/json',
      'api-key': apiKey,
    },
  });
  if (!response.ok) {
    throw new Error(`Falha ao consultar requisições da Judit (HTTP ${response.status}).`);
  }
  let payload: unknown;
  try {
    payload = await response.json();
  } catch (error) {
    throw new Error('Resposta inválida da API da Judit.');
  }
  const requests = extractRequests(payload);
  const subtotals = new Map<string, ProcessSyncSubtotal>();
  let totalCost = 0;
  for (const request of requests) {
    const requestTotal = collectRequestTotals(request, subtotals);
    totalCost += requestTotal;
  }
  const period = {
    from: createdAtGte ?? null,
    to: createdAtLte ?? null,
  };
  const subtotalsList = Array.from(subtotals.values()).map((item) => ({
    service: item.service,
    quantity: Number.isFinite(item.quantity) ? item.quantity : 0,
    totalCost: Number.isFinite(item.totalCost) ? Number(item.totalCost.toFixed(2)) : 0,
  }));
  subtotalsList.sort((a, b) => b.totalCost - a.totalCost);
  return {
    period,
    totalRequests: requests.length,
    totalCost: Number(totalCost.toFixed(2)),
    subtotals: subtotalsList,
  };
};

export default fetchProcessSyncReport;
