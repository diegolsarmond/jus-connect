import { getApiUrl, joinUrl } from './api';

export type AsaasPaymentMethod = 'PIX' | 'BOLETO' | 'CREDIT_CARD';

export interface CreateAsaasChargePayload {
  customerId: string;
  paymentMethod: AsaasPaymentMethod;
  installmentCount?: number;
  dueDate?: string;
  cardToken?: string;
  cardMetadata?: Record<string, unknown>;
  additionalData?: Record<string, unknown>;
}

export interface AsaasCharge {
  id?: string;
  flowId?: number;
  paymentMethod: AsaasPaymentMethod;
  value?: number;
  status?: string;
  dueDate?: string;
  pixPayload?: string;
  pixQrCode?: string;
  boletoUrl?: string;
  boletoBarcode?: string;
  cardAuthorizationCode?: string;
  raw?: unknown;
}

export interface AsaasChargeStatus {
  status: string;
  description?: string;
  updatedAt?: string;
  metadata?: Record<string, unknown>;
}

export interface CardTokenPayload {
  holderName: string;
  number: string;
  expiryMonth: string;
  expiryYear: string;
  cvv: string;
  document: string;
  email: string;
  phone: string;
  postalCode: string;
  addressNumber: string;
  addressComplement?: string;
}

export interface CardTokenResponse {
  token: string;
  brand?: string;
  last4Digits?: string;
  raw?: unknown;
}

export interface Flow {
  id: number;
  tipo: 'receita' | 'despesa';
  descricao: string;
  vencimento: string;
  pagamento?: string | null;
  valor: number;
  status: 'pendente' | 'pago';
}

const FLOWS_ENDPOINT = getApiUrl('financial/flows');

export async function fetchFlows(): Promise<Flow[]> {
  const res = await fetch(FLOWS_ENDPOINT);
  const data = await res.json();
  return data.items || data;
}

export async function createFlow(flow: Partial<Flow>): Promise<Flow> {
  const res = await fetch(FLOWS_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(flow),
  });
  const data = await res.json();
  return data.flow;
}

export async function settleFlow(id: number, pagamentoData: string): Promise<Flow> {
  const res = await fetch(joinUrl(FLOWS_ENDPOINT, `${id}/settle`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pagamentoData }),
  });
  const data = await res.json();
  return data.flow;
}

function ensureOkResponse(response: Response): Response {
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }
  return response;
}

function extractData<T>(payload: unknown, key: string): T | null {
  if (payload && typeof payload === 'object' && key in payload) {
    const value = (payload as Record<string, unknown>)[key];
    return (value as T) ?? null;
  }
  return null;
}

function normalizePaymentMethod(method: unknown): AsaasPaymentMethod {
  const normalized = String(method ?? '').toUpperCase();
  if (normalized === 'PIX' || normalized === 'BOLETO' || normalized === 'CREDIT_CARD') {
    return normalized;
  }
  if (normalized === 'CREDITCARD') {
    return 'CREDIT_CARD';
  }
  if (normalized === 'BOLETO_BANCARIO' || normalized === 'BANK_SLIP') {
    return 'BOLETO';
  }
  return 'PIX';
}

function normalizeCharge(raw: unknown): AsaasCharge | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const charge = (raw as { [key: string]: unknown }).charge ?? raw;
  if (!charge || typeof charge !== 'object') {
    return null;
  }

  const normalized: AsaasCharge = {
    id:
      (charge as { [key: string]: unknown }).id?.toString?.() ??
      (charge as { [key: string]: unknown }).chargeId?.toString?.() ??
      (charge as { [key: string]: unknown }).charge_id?.toString?.(),
    flowId:
      typeof (charge as { [key: string]: unknown }).flowId === 'number'
        ? ((charge as { [key: string]: unknown }).flowId as number)
        : undefined,
    paymentMethod: normalizePaymentMethod(
      (charge as { [key: string]: unknown }).paymentMethod ??
        (charge as { [key: string]: unknown }).payment_method ??
        (charge as { [key: string]: unknown }).billingType,
    ),
    value: Number((charge as { [key: string]: unknown }).value ?? (charge as { [key: string]: unknown }).amount),
    status: (charge as { [key: string]: unknown }).status as string | undefined,
    dueDate: (charge as { [key: string]: unknown }).dueDate as string | undefined,
    pixPayload:
      (charge as { [key: string]: unknown }).pixPayload as string | undefined ??
      (charge as { [key: string]: unknown }).payload as string | undefined ??
      (charge as { [key: string]: unknown }).copyPasteCode as string | undefined,
    pixQrCode:
      (charge as { [key: string]: unknown }).pixQrCode as string | undefined ??
      (charge as { [key: string]: unknown }).encodedImage as string | undefined ??
      (charge as { [key: string]: unknown }).qrCode as string | undefined,
    boletoUrl:
      (charge as { [key: string]: unknown }).bankSlipUrl as string | undefined ??
      (charge as { [key: string]: unknown }).boletoUrl as string | undefined ??
      (charge as { [key: string]: unknown }).invoiceUrl as string | undefined,
    boletoBarcode:
      (charge as { [key: string]: unknown }).identificationField as string | undefined ??
      (charge as { [key: string]: unknown }).digitableLine as string | undefined ??
      (charge as { [key: string]: unknown }).barCode as string | undefined,
    cardAuthorizationCode:
      (charge as { [key: string]: unknown }).authorizationCode as string | undefined ??
      (charge as { [key: string]: unknown }).nsu as string | undefined,
    raw: charge,
  };

  return normalized;
}

function normalizeChargeStatuses(payload: unknown): AsaasChargeStatus[] {
  if (!payload) return [];
  const collection = extractData<unknown[]>(payload, 'statuses') ?? extractData<unknown[]>(payload, 'items');
  const entries = Array.isArray(collection) ? collection : Array.isArray(payload) ? payload : [];
  return entries
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const statusValue =
        (entry as { [key: string]: unknown }).status ??
        (entry as { [key: string]: unknown }).currentStatus ??
        (entry as { [key: string]: unknown }).code;
      if (typeof statusValue !== 'string') return null;
      return {
        status: statusValue,
        description: (entry as { [key: string]: unknown }).description as string | undefined,
        updatedAt: (entry as { [key: string]: unknown }).updatedAt as string | undefined,
        metadata: entry as Record<string, unknown>,
      } satisfies AsaasChargeStatus;
    })
    .filter((status): status is AsaasChargeStatus => Boolean(status));
}

function getChargeEndpoint(flowId: number | string): string {
  return joinUrl(FLOWS_ENDPOINT, `${flowId}/asaas/charges`);
}

export async function createAsaasCharge(
  flowId: number,
  payload: CreateAsaasChargePayload,
): Promise<AsaasCharge> {
  const endpoint = getChargeEndpoint(flowId);
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await ensureOkResponse(response).json();
  const charge = normalizeCharge(data);
  if (!charge) {
    throw new Error('Resposta inesperada ao criar cobrança');
  }
  return charge;
}

export async function fetchChargeDetails(flowId: number): Promise<AsaasCharge | null> {
  const endpoint = getChargeEndpoint(flowId);
  const response = await fetch(endpoint, { method: 'GET' });

  if (response.status === 404) {
    return null;
  }

  const data = await ensureOkResponse(response).json();
  return normalizeCharge(data);
}

export async function listChargeStatus(flowId: number): Promise<AsaasChargeStatus[]> {
  const endpoint = joinUrl(getChargeEndpoint(flowId), 'status');
  const response = await fetch(endpoint, { method: 'GET' });
  if (response.status === 404) {
    return [];
  }
  const payload = await ensureOkResponse(response).json();
  return normalizeChargeStatuses(payload);
}

export async function tokenizeCard(payload: CardTokenPayload): Promise<CardTokenResponse> {
  const endpoint = getApiUrl('asaas/tokenize-card');
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await ensureOkResponse(response).json();
  const token =
    (data as { [key: string]: unknown }).token ??
    (data as { [key: string]: unknown }).cardToken ??
    (data as { [key: string]: unknown }).id;
  if (!token || typeof token !== 'string') {
    throw new Error('Token do cartão não encontrado na resposta');
  }

  return {
    token,
    brand: (data as { [key: string]: unknown }).brand as string | undefined,
    last4Digits: (data as { [key: string]: unknown }).last4Digits as string | undefined,
    raw: data,
  } satisfies CardTokenResponse;
}

export interface CustomerSyncStatus {
  status: string;
  lastSyncedAt?: string;
  needsSync?: boolean;
  message?: string;
  raw?: unknown;
}

function normalizeCustomerStatus(payload: unknown): CustomerSyncStatus | null {
  if (!payload || typeof payload !== 'object') return null;
  const statusValue =
    (payload as { [key: string]: unknown }).status ??
    (payload as { [key: string]: unknown }).syncStatus ??
    (payload as { [key: string]: unknown }).code;

  if (typeof statusValue !== 'string') {
    return null;
  }

  return {
    status: statusValue,
    lastSyncedAt: (payload as { [key: string]: unknown }).lastSyncedAt as string | undefined,
    needsSync: Boolean((payload as { [key: string]: unknown }).needsSync ?? false),
    message: (payload as { [key: string]: unknown }).message as string | undefined,
    raw: payload,
  } satisfies CustomerSyncStatus;
}

export async function fetchCustomerSyncStatus(customerId: string): Promise<CustomerSyncStatus | null> {
  const endpoint = getApiUrl(`asaas/customers/status?customerId=${encodeURIComponent(customerId)}`);
  const response = await fetch(endpoint, { method: 'GET' });

  if (response.status === 404) {
    return null;
  }

  const data = await ensureOkResponse(response).json();
  const directStatus = normalizeCustomerStatus(data);
  if (directStatus) {
    return directStatus;
  }

  const statusFromData = extractData<unknown>(data, 'status');
  return normalizeCustomerStatus(statusFromData);
}

export async function syncCustomerNow(customerId: string): Promise<CustomerSyncStatus | null> {
  const endpoint = getApiUrl('asaas/customers/sync');
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ customerId }),
  });
  const data = await ensureOkResponse(response).json();
  const status = normalizeCustomerStatus(data);
  if (status) {
    return status;
  }
  const nested = extractData<unknown>(data, 'status');
  return normalizeCustomerStatus(nested);
}
