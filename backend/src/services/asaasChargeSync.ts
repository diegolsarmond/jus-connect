import { URLSearchParams } from 'url';
import type { QueryResultRow } from 'pg';
import pool from './db';

export const OPEN_PAYMENT_STATUSES = [
  'PENDING',
  'PENDING_RETRY',
  'AWAITING_RISK_ANALYSIS',
  'AUTHORIZED',
  'BANK_SLIP_VIEWED',
  'OVERDUE',
] as const;

export const PAID_PAYMENT_STATUSES = ['RECEIVED', 'RECEIVED_IN_CASH', 'CONFIRMED'] as const;

const OPEN_PAYMENT_STATUS_SET = new Set<string>(OPEN_PAYMENT_STATUSES);
const PAID_PAYMENT_STATUS_SET = new Set<string>(PAID_PAYMENT_STATUSES);

const DEFAULT_PAGE_SIZE = 100;

export class AsaasConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AsaasConfigurationError';
  }
}

type Queryable = {
  query: (text: string, params?: unknown[]) => Promise<{ rows: QueryResultRow[]; rowCount: number }>;
};

export interface AsaasPayment {
  id: string;
  status: string;
  value?: number;
  dueDate?: string | null;
  paymentDate?: string | null;
  externalReference?: string | null;
}

export interface ListPaymentsParams {
  status: string[];
  limit?: number;
  offset?: number;
  updatedSince?: string;
}

export interface AsaasPaymentsResponse {
  data: AsaasPayment[];
  hasMore?: boolean;
  totalCount?: number;
  limit?: number;
  offset?: number;
}

export interface AsaasClient {
  hasValidConfiguration(): boolean;
  listPayments(params: ListPaymentsParams): Promise<AsaasPaymentsResponse>;
}

interface AsaasChargeRow extends QueryResultRow {
  id: number;
  asaas_id: string;
  financial_flow_id: number | null;
  status: string;
}

export interface AsaasSyncResult {
  totalCharges: number;
  paymentsRetrieved: number;
  chargesUpdated: number;
  flowsUpdated: number;
  fetchedStatuses: string[];
}

function normalizeStatus(value: string | null | undefined): string {
  if (!value) {
    return '';
  }
  return value.trim().toUpperCase();
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

class HttpAsaasClient implements AsaasClient {
  private readonly apiKey: string | null;
  private readonly apiUrl: string;

  constructor(apiKey = process.env.ASAAS_API_KEY ?? null, apiUrl = process.env.ASAAS_API_URL ?? 'https://www.asaas.com/api/v3') {
    this.apiKey = apiKey && apiKey.trim() ? apiKey.trim() : null;
    this.apiUrl = apiUrl && apiUrl.trim() ? apiUrl.trim() : 'https://www.asaas.com/api/v3';
  }

  hasValidConfiguration(): boolean {
    return Boolean(this.apiKey);
  }

  async listPayments(params: ListPaymentsParams): Promise<AsaasPaymentsResponse> {
    if (!this.hasValidConfiguration()) {
      throw new AsaasConfigurationError(
        'Integração com o Asaas não está configurada. Defina ASAAS_API_KEY e ASAAS_API_URL conforme necessário.',
      );
    }

    const statuses = Array.from(new Set(params.status.map((status) => normalizeStatus(status)))).filter(Boolean);
    if (statuses.length === 0) {
      return { data: [], hasMore: false, totalCount: 0, limit: params.limit, offset: params.offset };
    }

    const searchParams = new URLSearchParams();
    for (const status of statuses) {
      searchParams.append('status', status);
    }
    if (typeof params.limit === 'number') {
      searchParams.set('limit', String(params.limit));
    }
    if (typeof params.offset === 'number') {
      searchParams.set('offset', String(params.offset));
    }
    if (params.updatedSince) {
      searchParams.set('updatedSince', params.updatedSince);
    }

    const url = `${this.apiUrl.replace(/\/$/, '')}/payments?${searchParams.toString()}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Falha ao consultar cobranças no Asaas: ${response.status} ${response.statusText}`);
    }

    const body = (await response.json()) as AsaasPaymentsResponse;
    if (!body || !Array.isArray(body.data)) {
      return { data: [], hasMore: false, totalCount: 0, limit: body?.limit, offset: body?.offset };
    }

    return {
      data: body.data.map((item) => ({
        ...item,
        status: normalizeStatus(item.status),
      })),
      hasMore: Boolean(body.hasMore),
      totalCount: typeof body.totalCount === 'number' ? body.totalCount : body.data.length,
      limit: typeof body.limit === 'number' ? body.limit : params.limit,
      offset: typeof body.offset === 'number' ? body.offset : params.offset,
    };
  }
}

export const createDefaultAsaasClient = () => new HttpAsaasClient();

export class AsaasChargeSyncService {
  private readonly db: Queryable;
  private readonly client: AsaasClient;
  private readonly pageSize: number;

  constructor(db: Queryable = pool, client: AsaasClient = createDefaultAsaasClient(), pageSize = DEFAULT_PAGE_SIZE) {
    this.db = db;
    this.client = client;
    this.pageSize = pageSize;
  }

  hasValidConfiguration(): boolean {
    return this.client.hasValidConfiguration();
  }

  async syncPendingCharges(): Promise<AsaasSyncResult> {
    if (!this.hasValidConfiguration()) {
      throw new AsaasConfigurationError(
        'Integração com o Asaas não está configurada. Defina ASAAS_API_KEY e ASAAS_API_URL conforme necessário.',
      );
    }

    const charges = await this.loadPendingCharges();
    if (charges.length === 0) {
      return {
        totalCharges: 0,
        paymentsRetrieved: 0,
        chargesUpdated: 0,
        flowsUpdated: 0,
        fetchedStatuses: this.statusesToFetch,
      };
    }

    const payments = await this.fetchPayments();
    const paymentsById = new Map(payments.map((payment) => [payment.id, payment]));

    let chargesUpdated = 0;
    let flowsUpdated = 0;

    for (const charge of charges) {
      const payment = paymentsById.get(charge.asaas_id);
      if (!payment) {
        continue;
      }

      const paymentStatus = normalizeStatus(payment.status);
      if (paymentStatus && paymentStatus !== normalizeStatus(charge.status)) {
        await this.db.query('UPDATE asaas_charges SET status = $1 WHERE id = $2', [paymentStatus, charge.id]);
        chargesUpdated += 1;
      }

      if (charge.financial_flow_id) {
        const flowUpdate = this.buildFinancialFlowUpdate(paymentStatus, payment.paymentDate);
        if (flowUpdate) {
          const [flowStatus, paymentDate] = flowUpdate;
          await this.db.query(
            'UPDATE financial_flows SET status = $1, pagamento = $2 WHERE id = $3',
            [flowStatus, paymentDate, charge.financial_flow_id],
          );
          flowsUpdated += 1;
        }
      }
    }

    return {
      totalCharges: charges.length,
      paymentsRetrieved: payments.length,
      chargesUpdated,
      flowsUpdated,
      fetchedStatuses: this.statusesToFetch,
    };
  }

  private get statusesToFetch(): string[] {
    return [...OPEN_PAYMENT_STATUSES, ...PAID_PAYMENT_STATUSES];
  }

  private async loadPendingCharges(): Promise<AsaasChargeRow[]> {
    const { rows } = await this.db.query(
      'SELECT id, asaas_id, financial_flow_id, status FROM asaas_charges WHERE status = ANY($1)',
      [OPEN_PAYMENT_STATUSES],
    );

    return rows as AsaasChargeRow[];
  }

  private async fetchPayments(): Promise<AsaasPayment[]> {
    const statuses = this.statusesToFetch;
    const payments: AsaasPayment[] = [];
    let offset = 0;

    while (true) {
      const response = await this.client.listPayments({ status: statuses, limit: this.pageSize, offset });
      if (Array.isArray(response.data)) {
        for (const payment of response.data) {
          payments.push({
            ...payment,
            status: normalizeStatus(payment.status),
          });
        }
      }

      const hasMore = Boolean(response.hasMore);
      const limit = typeof response.limit === 'number' && response.limit > 0 ? response.limit : this.pageSize;

      if (!hasMore) {
        break;
      }

      offset += limit;

      if (limit <= 0) {
        break;
      }
    }

    return payments;
  }

  private buildFinancialFlowUpdate(status: string, paymentDate: string | null | undefined): [string, Date | null] | null {
    const normalizedStatus = normalizeStatus(status);

    if (PAID_PAYMENT_STATUS_SET.has(normalizedStatus)) {
      return ['pago', parseDate(paymentDate)];
    }

    if (OPEN_PAYMENT_STATUS_SET.has(normalizedStatus)) {
      return ['pendente', null];
    }

    return null;
  }
}

export const asaasChargeSyncService = new AsaasChargeSyncService();

export default asaasChargeSyncService;
