import { QueryResultRow } from 'pg';
import { normalizeFinancialFlowIdentifier, normalizeFinancialFlowIdentifierFromRow } from '../utils/financialFlowIdentifier';
import pool from './db';
import resolveAsaasIntegration, {
  AsaasIntegrationNotConfiguredError,
} from './asaas/integrationResolver';
import { normalizeAsaasEnvironment } from './asaas/urlNormalization';

export const ASAAS_BILLING_TYPES = ['PIX', 'BOLETO', 'CREDIT_CARD', 'DEBIT_CARD'] as const;
export type AsaasBillingType = (typeof ASAAS_BILLING_TYPES)[number];

export interface AsaasClientChargePayload {
  billingType: AsaasBillingType;
  customer: string;
  value: number;
  dueDate: string;
  description?: string;
  externalReference?: string;
  creditCardToken?: string;
  creditCard?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  [key: string]: unknown;
}

export interface AsaasClientChargeResponse {
  id: string;
  status: string;
  billingType?: string;
  dueDate?: string;
  value?: number;
  invoiceUrl?: string | null;
  bankSlipUrl?: string | null;
  boletoUrl?: string | null;
  pixQrCode?: string | null;
  pixQrCodeImage?: string | null;
  pixCopiaECola?: string | null;
  pixPayload?: string | null;
  creditCard?: {
    creditCardNumber?: string | null;
    creditCardNumberLast4?: string | null;
    creditCardBrand?: string | null;
    brand?: string | null;
  } | null;
  creditCardData?: {
    creditCardNumber?: string | null;
    creditCardBrand?: string | null;
  } | null;
  [key: string]: unknown;
}

type CreditCardResponse = NonNullable<
  AsaasClientChargeResponse['creditCard'] | AsaasClientChargeResponse['creditCardData']
>;

export interface AsaasChargeRecord {
  id: number;
  financialFlowId: number | string;
  clienteId: number | null;
  integrationApiKeyId: number | null;
  credentialId: number | null;
  asaasChargeId: string;
  billingType: AsaasBillingType;
  status: string;
  dueDate: string;
  value: string;
  invoiceUrl: string | null;
  lastEvent: string | null;
  payload: Record<string, unknown> | null;
  paidAt: string | null;
  pixPayload: string | null;
  pixQrCode: string | null;
  boletoUrl: string | null;
  cardLast4: string | null;
  cardBrand: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AsaasChargeResult {
  charge: AsaasChargeRecord;
  flow: QueryResultRow;
}

type Queryable = {
  query: (text: string, params?: unknown[]) => Promise<{ rows: QueryResultRow[]; rowCount: number }>;
};

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class ChargeConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ChargeConflictError';
  }
}

export interface CreateAsaasChargeInput {
  financialFlowId: number | string;
  billingType: string;
  clienteId?: number | null;
  integrationApiKeyId?: number | null;
  value: number | string;
  dueDate: string | Date;
  description?: string | null;
  cardToken?: string | null;
  asaasCustomerId?: string | null;
  customer?: string | null;
  externalReferenceId?: string | null;
  additionalFields?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  payerEmail?: string | null;
  payerName?: string | null;
  customerDocument?: string | null;
  remoteIp?: string | null;
}

export interface AsaasClientConfig {
  apiKey: string;
  baseUrl?: string | null;
}

export interface AsaasClient {
  createCharge(payload: AsaasClientChargePayload): Promise<AsaasClientChargeResponse>;
}

interface AsaasClientFactoryResult {
  client: AsaasClient;
  credentialId: number | null;
  integrationApiKeyId: number | null;
}

type AsaasClientFactory = (options: {
  integrationApiKeyId?: number | null;
  financialFlowId: number | string;
  db: Queryable;
}) => Promise<AsaasClientFactoryResult>;

const DEFAULT_BASE_URL = 'https://api.asaas.com/v3/';

class HttpAsaasClient implements AsaasClient {
  constructor(private readonly config: AsaasClientConfig) {}

  private resolveBaseUrl(): string {
    const configured =
      this.config.baseUrl ?? process.env.ASAAS_API_URL ?? process.env.ASAAS_BASE_URL;
    const base = configured && configured.trim() ? configured.trim() : DEFAULT_BASE_URL;
    return base.endsWith('/') ? base : `${base}/`;
  }

  async createCharge(payload: AsaasClientChargePayload): Promise<AsaasClientChargeResponse> {
    const url = new URL('payments', this.resolveBaseUrl());

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        access_token: this.config.apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      let errorBody: unknown;
      try {
        errorBody = await response.json();
      } catch (error) {
        errorBody = await response.text();
      }

      const error = new Error('Falha ao criar cobrança no Asaas');
      (error as Error & { status?: number; body?: unknown }).status = response.status;
      (error as Error & { status?: number; body?: unknown }).body = errorBody;
      throw error;
    }

    const data = (await response.json()) as AsaasClientChargeResponse;
    return data;
  }
}

function normalizeEmpresaId(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const parsed = Number.parseInt(trimmed, 10);
    if (Number.isInteger(parsed)) {
      return parsed;
    }
  }
  return null;
}

function extractEmpresaId(row: QueryResultRow): number | null {
  const candidates = ['idempresa', 'empresa_id', 'empresa'];
  for (const candidate of candidates) {
    if (Object.prototype.hasOwnProperty.call(row, candidate)) {
      const value = normalizeEmpresaId((row as Record<string, unknown>)[candidate]);
      if (value !== null) {
        return value;
      }
    }
  }
  return null;
}

function isTruthy(value: unknown): boolean {
  if (value === true) {
    return true;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return ['true', 't', '1', 'yes', 'y'].includes(normalized);
  }
  if (typeof value === 'number') {
    return value === 1;
  }
  return false;
}

async function defaultClientFactory({
  integrationApiKeyId,
  financialFlowId,
  db,
}: {
  integrationApiKeyId?: number | null;
  financialFlowId: number | string;
  db: Queryable;
}): Promise<AsaasClientFactoryResult> {
  const normalizedFinancialFlowId = normalizeFinancialFlowIdentifier(financialFlowId);

  if (normalizedFinancialFlowId === null) {
    throw new ValidationError('Identificador do fluxo financeiro inválido');
  }

  const flowResult = await db.query(
    'SELECT id, idempresa, empresa_id, empresa FROM financial_flows WHERE id = $1',
    [normalizedFinancialFlowId],
  );

  if (flowResult.rowCount === 0) {
    throw new ValidationError('Fluxo financeiro não encontrado');
  }

  const flowRow = flowResult.rows[0] as QueryResultRow;
  const flowEmpresaId = extractEmpresaId(flowRow);

  if (integrationApiKeyId) {
    const result = await db.query(
      'SELECT id, provider, key_value, url_api, idempresa, global FROM integration_api_keys WHERE id = $1',
      [integrationApiKeyId],
    );

    if (result.rowCount === 0) {
      throw new ValidationError('Chave de integração do Asaas não encontrada');
    }

    const row = result.rows[0] as QueryResultRow & {
      provider?: string;
      key_value?: string;
      url_api?: string | null;
      idempresa?: unknown;
      global?: unknown;
    };

    const keyValue = typeof row.key_value === 'string' ? row.key_value : null;
    if (!keyValue) {
      throw new ValidationError('Chave de API do Asaas inválida');
    }

    const provider = typeof row.provider === 'string' ? row.provider.trim().toLowerCase() : '';
    if (provider && provider !== 'asaas') {
      console.warn(
        'integration_api_keys apontada para o Asaas contém provider diferente de "asaas":',
        row.provider,
      );
    }

    const integrationEmpresaId = extractEmpresaId(row);
    const isGlobalKey = isTruthy(row.global);

    if (!isGlobalKey) {
      if (integrationEmpresaId === null || flowEmpresaId === null || integrationEmpresaId !== flowEmpresaId) {
        throw new ValidationError(
          'Chave de integração do Asaas não pertence à empresa do fluxo financeiro',
        );
      }
    }

    const baseUrl = typeof row.url_api === 'string' && row.url_api.trim() ? row.url_api : null;

    const credentialLookup = await db.query(
      'SELECT id FROM asaas_credentials WHERE integration_api_key_id = $1',
      [integrationApiKeyId],
    );

    let credentialId: number | null = null;
    if (credentialLookup.rowCount > 0) {
      const rawId = (credentialLookup.rows[0] as { id?: unknown })?.id;
      if (typeof rawId === 'number' && Number.isFinite(rawId)) {
        credentialId = Math.trunc(rawId);
      } else if (typeof rawId === 'string' && rawId.trim()) {
        const parsed = Number.parseInt(rawId.trim(), 10);
        if (Number.isFinite(parsed)) {
          credentialId = parsed;
        }
      }
    }

    return {
      client: new HttpAsaasClient({ apiKey: keyValue, baseUrl }),
      credentialId,
      integrationApiKeyId,
    };
  }

  if (flowEmpresaId !== null) {
    const rawEnvironment = process.env.ASAAS_ENVIRONMENT;
    const configuredEnvironment =
      typeof rawEnvironment === 'string' && rawEnvironment.trim()
        ? normalizeAsaasEnvironment(rawEnvironment)
        : undefined;
    try {
      const integration = await resolveAsaasIntegration(
        flowEmpresaId,
        db,
        configuredEnvironment,
      );
      return {
        client: new HttpAsaasClient({ apiKey: integration.accessToken, baseUrl: integration.baseUrl }),
        credentialId: integration.credentialId ?? null,
        integrationApiKeyId: integration.integrationId ?? null,
      };
    } catch (error) {
      if (!(error instanceof AsaasIntegrationNotConfiguredError)) {
        console.error('Falha ao resolver integração do Asaas para empresa', flowEmpresaId, error);
      }
    }
  }

  const apiKey = process.env.ASAAS_ACCESS_TOKEN ?? process.env.ASAAS_API_KEY;
  if (!apiKey) {
    throw new ValidationError('Nenhuma credencial do Asaas configurada');
  }

  return {
    client: new HttpAsaasClient({
      apiKey,
      baseUrl: process.env.ASAAS_API_URL ?? process.env.ASAAS_BASE_URL,
    }),
    credentialId: null,
    integrationApiKeyId: null,
  };
}

function normalizeBillingType(value: string): AsaasBillingType {
  if (typeof value !== 'string') {
    throw new ValidationError('paymentMethod é obrigatório');
  }

  const normalized = value.trim().toUpperCase();
  if (!ASAAS_BILLING_TYPES.includes(normalized as AsaasBillingType)) {
    throw new ValidationError('paymentMethod deve ser PIX, BOLETO, CREDIT_CARD ou DEBIT_CARD');
  }

  return normalized as AsaasBillingType;
}

function ensureCustomerIdentifier(
  clienteId: number | null | undefined,
  asaasCustomerId: string | null | undefined,
  customer: string | null | undefined,
): string {
  if (typeof asaasCustomerId === 'string' && asaasCustomerId.trim()) {
    return asaasCustomerId.trim();
  }

  if (typeof customer === 'string' && customer.trim()) {
    return customer.trim();
  }

  if (typeof clienteId === 'number' && Number.isFinite(clienteId)) {
    return String(clienteId);
  }

  throw new ValidationError('Identificador do cliente no Asaas é obrigatório');
}

function formatDueDate(value: string | Date): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw new ValidationError('Data de vencimento inválida');
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    throw new ValidationError('Data de vencimento inválida');
  }

  return parsed.toISOString().slice(0, 10);
}

function normalizeValue(value: number | string): number {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new ValidationError('Valor da cobrança inválido');
    }
    return value;
  }

  if (typeof value === 'string') {
    const normalized = Number(value);
    if (!Number.isFinite(normalized)) {
      throw new ValidationError('Valor da cobrança inválido');
    }
    return normalized;
  }

  throw new ValidationError('Valor da cobrança inválido');
}

function extractPixPayload(response: AsaasClientChargeResponse): {
  payload: string | null;
  qrCode: string | null;
} {
  const payload =
    typeof response.pixCopiaECola === 'string'
      ? response.pixCopiaECola
      : typeof response.pixPayload === 'string'
        ? response.pixPayload
        : null;
  const qrCode =
    typeof response.pixQrCode === 'string'
      ? response.pixQrCode
      : typeof response.pixQrCodeImage === 'string'
        ? response.pixQrCodeImage
        : null;
  return { payload, qrCode };
}

function extractBoletoUrl(response: AsaasClientChargeResponse): string | null {
  if (typeof response.boletoUrl === 'string' && response.boletoUrl.trim()) {
    return response.boletoUrl;
  }
  if (typeof response.bankSlipUrl === 'string' && response.bankSlipUrl.trim()) {
    return response.bankSlipUrl;
  }
  return null;
}

function hasCreditCardNumberLast4(
  card: CreditCardResponse,
): card is CreditCardResponse & { creditCardNumberLast4?: string | null } {
  return 'creditCardNumberLast4' in card;
}

function hasBrandProperty(card: CreditCardResponse): card is CreditCardResponse & { brand?: string | null } {
  return 'brand' in card;
}

function resolveCardNumber(card: CreditCardResponse): string | null {
  if (typeof card.creditCardNumber === 'string' && card.creditCardNumber.trim()) {
    return card.creditCardNumber;
  }

  if (hasCreditCardNumberLast4(card)) {
    const { creditCardNumberLast4 } = card;
    if (typeof creditCardNumberLast4 === 'string' && creditCardNumberLast4.trim()) {
      return creditCardNumberLast4;
    }
  }

  return null;
}

function resolveCardBrand(card: CreditCardResponse): string | null {
  if (typeof card.creditCardBrand === 'string' && card.creditCardBrand.trim()) {
    return card.creditCardBrand;
  }

  if (hasBrandProperty(card)) {
    const { brand } = card;
    if (typeof brand === 'string' && brand.trim()) {
      return brand;
    }
  }

  return null;
}

function extractCardInfo(response: AsaasClientChargeResponse): {
  last4: string | null;
  brand: string | null;
} {
  const creditCard = response.creditCard ?? response.creditCardData ?? null;
  let last4: string | null = null;
  let brand: string | null = null;

  if (creditCard) {
    const rawNumber = resolveCardNumber(creditCard);
    if (rawNumber && rawNumber.length >= 4) {
      last4 = rawNumber.slice(-4);
    }

    const rawBrand = resolveCardBrand(creditCard);
    if (rawBrand) {
      brand = rawBrand;
    }
  }

  return { last4, brand };
}

const REFUNDED_PAYMENT_STATUS_SET = new Set([
  'REFUNDED',
  'REFUND_REQUESTED',
  'REFUND_PENDING',
  'REFUND_IN_PROGRESS',
  'REFUND_COMPLETED',
  'CHARGEBACK',
  'CHARGEBACK_REQUESTED',
  'CHARGEBACK_DISPUTE',
]);

function mapFlowStatus(chargeStatus: string | undefined): 'pendente' | 'pago' | 'estornado' {
  if (!chargeStatus) {
    return 'pendente';
  }

  const normalized = chargeStatus.trim().toUpperCase();
  const paidStatuses = new Set([
    'RECEIVED',
    'RECEIVED_IN_CASH',
    'RECEIVED_PARTIALLY',
    'CONFIRMED',
  ]);

  if (paidStatuses.has(normalized)) {
    return 'pago';
  }

  if (REFUNDED_PAYMENT_STATUS_SET.has(normalized)) {
    return 'estornado';
  }

  return 'pendente';
}

function normalizeInsertRow(row: QueryResultRow): AsaasChargeRecord {
  const financialFlowId = normalizeFinancialFlowIdentifierFromRow(
    (row as Record<string, unknown>).financial_flow_id,
  );

  const credentialValue = (row as Record<string, unknown>).credential_id;
  let credentialId: number | null = null;
  if (typeof credentialValue === 'number' && Number.isFinite(credentialValue)) {
    credentialId = Math.trunc(credentialValue);
  } else if (typeof credentialValue === 'string' && credentialValue.trim()) {
    const parsed = Number.parseInt(credentialValue.trim(), 10);
    if (Number.isFinite(parsed)) {
      credentialId = parsed;
    }
  }

  const payloadValue = (row as Record<string, unknown>).payload;
  const parsedPayload =
    payloadValue && typeof payloadValue === 'object' ? (payloadValue as Record<string, unknown>) : null;

  const paidAtValue = (row as Record<string, unknown>).paid_at;
  const paidAt =
    paidAtValue === null || paidAtValue === undefined
      ? null
      : new Date(paidAtValue as string | number | Date).toISOString();

  return {
    id: Number(row.id),
    financialFlowId,
    clienteId: row.cliente_id === null || row.cliente_id === undefined ? null : Number(row.cliente_id),
    integrationApiKeyId:
      row.integration_api_key_id === null || row.integration_api_key_id === undefined
        ? null
        : Number(row.integration_api_key_id),
    credentialId,
    asaasChargeId: String(row.asaas_charge_id),
    billingType: String(row.billing_type) as AsaasBillingType,
    status: String(row.status),
    dueDate: new Date(row.due_date).toISOString().slice(0, 10),
    value: String(row.value),
    invoiceUrl: row.invoice_url ? String(row.invoice_url) : null,
    lastEvent:
      row.last_event === null || row.last_event === undefined ? null : String(row.last_event),
    payload: parsedPayload,
    paidAt,
    pixPayload: row.pix_payload ? String(row.pix_payload) : null,
    pixQrCode: row.pix_qr_code ? String(row.pix_qr_code) : null,
    boletoUrl: row.boleto_url ? String(row.boleto_url) : null,
    cardLast4: row.card_last4 ? String(row.card_last4) : null,
    cardBrand: row.card_brand ? String(row.card_brand) : null,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export default class AsaasChargeService {
  constructor(
    private readonly db: Queryable = pool,
    private readonly clientFactory: AsaasClientFactory = defaultClientFactory,
  ) {}

  async createCharge(
    input: CreateAsaasChargeInput,
    options?: {
      dbClient?: Queryable;
      asaasClient?: AsaasClient;
      credentialId?: number | null;
      integrationApiKeyId?: number | null;
    },
  ): Promise<AsaasChargeResult> {
    const dbClient = options?.dbClient ?? this.db;

    const billingType = normalizeBillingType(input.billingType);
    const value = normalizeValue(input.value);
    const dueDate = formatDueDate(input.dueDate);
    const customer = ensureCustomerIdentifier(input.clienteId, input.asaasCustomerId, input.customer);

    const normalizedFinancialFlowId = normalizeFinancialFlowIdentifier(input.financialFlowId);

    if (normalizedFinancialFlowId === null) {
      throw new ValidationError('Identificador do fluxo financeiro inválido');
    }

    const existingCharge = await dbClient.query(
      'SELECT id FROM asaas_charges WHERE financial_flow_id = $1',
      [normalizedFinancialFlowId],
    );

    if (existingCharge.rowCount > 0) {
      throw new ChargeConflictError('O fluxo financeiro já possui uma cobrança vinculada ao Asaas');
    }

    const payload: AsaasClientChargePayload = {
      billingType,
      customer,
      value,
      dueDate,
      description: input.description ?? undefined,
      externalReference: input.externalReferenceId ?? String(normalizedFinancialFlowId),
    };

    if (input.additionalFields) {
      for (const [key, val] of Object.entries(input.additionalFields)) {
        if (val !== undefined) {
          (payload as Record<string, unknown>)[key] = val;
        }
      }
    }

    if (input.metadata) {
      payload.metadata = input.metadata;
    }

    if (input.payerEmail) {
      (payload as Record<string, unknown>).customerEmail = input.payerEmail;
    }

    if (input.payerName) {
      (payload as Record<string, unknown>).customerName = input.payerName;
    }

    if (input.customerDocument) {
      (payload as Record<string, unknown>).customerCpfCnpj = input.customerDocument;
    }

    if (input.remoteIp) {
      (payload as Record<string, unknown>).remoteIp = input.remoteIp;
    }

    if (billingType === 'CREDIT_CARD' || billingType === 'DEBIT_CARD') {
      if (!input.cardToken || !input.cardToken.trim()) {
        throw new ValidationError('cardToken é obrigatório para cobranças via cartão');
      }
      payload.creditCardToken = input.cardToken.trim();
    }

    let resolvedCredentialId = options?.credentialId ?? null;
    let resolvedIntegrationApiKeyId = options?.integrationApiKeyId ?? input.integrationApiKeyId ?? null;
    let asaasClient: AsaasClient;

    if (options?.asaasClient) {
      asaasClient = options.asaasClient;
    } else {
      const clientResolution = await this.clientFactory({
        integrationApiKeyId: input.integrationApiKeyId,
        financialFlowId: normalizedFinancialFlowId,
        db: dbClient,
      });
      asaasClient = clientResolution.client;
      if (clientResolution.credentialId !== null && clientResolution.credentialId !== undefined) {
        resolvedCredentialId = clientResolution.credentialId;
      }
      if (
        clientResolution.integrationApiKeyId !== null &&
        clientResolution.integrationApiKeyId !== undefined
      ) {
        resolvedIntegrationApiKeyId = clientResolution.integrationApiKeyId;
      }
    }
    const chargeResponse = await asaasClient.createCharge(payload);

    const { payload: pixPayload, qrCode: pixQrCode } = extractPixPayload(chargeResponse);
    const boletoUrl = extractBoletoUrl(chargeResponse);
    const { last4: cardLast4, brand: cardBrand } = extractCardInfo(chargeResponse);
    const flowStatus = mapFlowStatus(chargeResponse.status);

    const insertResult = await dbClient.query(
      `INSERT INTO asaas_charges (
        financial_flow_id,
        cliente_id,
        integration_api_key_id,
        credential_id,
        asaas_charge_id,
        billing_type,
        status,
        due_date,
        value,
        invoice_url,
        last_event,
        payload,
        paid_at,
        pix_payload,
        pix_qr_code,
        boleto_url,
        card_last4,
        card_brand,
        raw_response
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19
      )
      RETURNING
        id,
        financial_flow_id,
        cliente_id,
        integration_api_key_id,
        credential_id,
        asaas_charge_id,
        billing_type,
        status,
        due_date,
        value,
        invoice_url,
        last_event,
        payload,
        paid_at,
        pix_payload,
        pix_qr_code,
        boleto_url,
        card_last4,
        card_brand,
        raw_response,
        created_at,
        updated_at
      `,
      [
        normalizedFinancialFlowId,
        input.clienteId ?? null,
        resolvedIntegrationApiKeyId,
        resolvedCredentialId,
        chargeResponse.id,
        billingType,
        chargeResponse.status,
        dueDate,
        value,
        chargeResponse.invoiceUrl ?? null,
        null,
        null,
        null,
        pixPayload,
        pixQrCode,
        boletoUrl,
        cardLast4,
        cardBrand,
        JSON.stringify(chargeResponse),
      ],
    );

    if (insertResult.rowCount === 0) {
      throw new Error('Falha ao persistir cobrança do Asaas');
    }

    const charge = normalizeInsertRow(insertResult.rows[0]);

    const updateResult = await dbClient.query(
      `UPDATE financial_flows
         SET external_provider = $1,
             external_reference_id = $2,
             status = $3
       WHERE id = $4
       RETURNING *`,
      ['asaas', chargeResponse.id, flowStatus, normalizedFinancialFlowId],
    );

    if (updateResult.rowCount === 0) {
      throw new Error('Fluxo financeiro não encontrado para atualização');
    }

    return { charge, flow: updateResult.rows[0] };
  }
}
