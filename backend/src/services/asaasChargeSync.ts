import { URLSearchParams } from 'url';
import type { QueryResultRow } from 'pg';
import pool from './db';
import { createNotification, type NotificationType } from './notificationService';
import { isUndefinedTableError } from '../utils/databaseErrors';
import {
  applySubscriptionOverdue,
  applySubscriptionPayment,
  findCompanyIdForFinancialFlow,
} from './subscriptionService';
import { normalizeFinancialFlowIdentifier } from '../utils/financialFlowIdentifier';

export const OPEN_PAYMENT_STATUSES = [
  'PENDING',
  'PENDING_RETRY',
  'AWAITING_RISK_ANALYSIS',
  'AUTHORIZED',
  'BANK_SLIP_VIEWED',
  'OVERDUE',
] as const;

export const PAID_PAYMENT_STATUSES = ['RECEIVED', 'RECEIVED_IN_CASH', 'CONFIRMED'] as const;
export const REFUND_PAYMENT_STATUSES = [
  'REFUNDED',
  'REFUND_REQUESTED',
  'REFUND_PENDING',
  'REFUND_IN_PROGRESS',
  'REFUND_COMPLETED',
  'CHARGEBACK',
  'CHARGEBACK_REQUESTED',
  'CHARGEBACK_DISPUTE',
] as const;

const OPEN_PAYMENT_STATUS_SET = new Set<string>(OPEN_PAYMENT_STATUSES);
const PAID_PAYMENT_STATUS_SET = new Set<string>(PAID_PAYMENT_STATUSES);
const REFUND_PAYMENT_STATUS_SET = new Set<string>(REFUND_PAYMENT_STATUSES);
const TRACKED_PAYMENT_STATUSES = Array.from(
  new Set<string>([...OPEN_PAYMENT_STATUSES, ...PAID_PAYMENT_STATUSES, ...REFUND_PAYMENT_STATUSES]),
);

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
  financial_flow_id: number | string | null;
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

  constructor(
    apiKey = process.env.ASAAS_ACCESS_TOKEN ?? process.env.ASAAS_API_KEY ?? null,
    apiUrl = process.env.ASAAS_API_URL ?? 'https://www.asaas.com/api/v3',
  ) {
    this.apiKey = apiKey && apiKey.trim() ? apiKey.trim() : null;
    this.apiUrl = apiUrl && apiUrl.trim() ? apiUrl.trim() : 'https://www.asaas.com/api/v3';
  }

  hasValidConfiguration(): boolean {
    return Boolean(this.apiKey);
  }

  async listPayments(params: ListPaymentsParams): Promise<AsaasPaymentsResponse> {
    if (!this.hasValidConfiguration()) {
      throw new AsaasConfigurationError(
        'Integração com o Asaas não está configurada. Defina ASAAS_ACCESS_TOKEN (ou ASAAS_API_KEY) e ASAAS_API_URL conforme necessário.',
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
      if (response.status === 401 || response.status === 403) {
        throw new AsaasConfigurationError('Falha ao consultar cobranças no Asaas: credenciais inválidas ou expiradas.');
      }
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
        'Integração com o Asaas não está configurada. Defina ASAAS_ACCESS_TOKEN (ou ASAAS_API_KEY) e ASAAS_API_URL conforme necessário.',
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
      let statusChanged = false;

      if (paymentStatus && paymentStatus !== normalizeStatus(charge.status)) {
        await this.db.query('UPDATE asaas_charges SET status = $1 WHERE id = $2', [paymentStatus, charge.id]);
        chargesUpdated += 1;
        statusChanged = true;
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

          await this.updateSubscriptionForCharge(charge.financial_flow_id, paymentStatus, paymentDate, payment.dueDate);
        }
      }

      if (statusChanged) {
        await this.notifyChargeUpdate(charge, payment, paymentStatus || charge.status);
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
    return TRACKED_PAYMENT_STATUSES;
  }

  private async loadPendingCharges(): Promise<AsaasChargeRow[]> {
    try {
      const { rows } = await this.db.query(
        'SELECT id, asaas_charge_id AS asaas_id, financial_flow_id, status FROM asaas_charges WHERE status = ANY($1)',
        [TRACKED_PAYMENT_STATUSES],
      );

      return rows.map((row) => {
        const normalizedFinancialFlowId = normalizeFinancialFlowIdentifier(
          (row as Record<string, unknown>).financial_flow_id,
        );

        return {
          id: Number(row.id),
          asaas_id: String(row.asaas_id),
          financial_flow_id: normalizedFinancialFlowId,
          status: String(row.status),
        } as AsaasChargeRow;
      });
    } catch (error) {
      if (isUndefinedTableError(error)) {
        console.warn('Tabela asaas_charges ausente. Sincronização será ignorada.');
        return [];
      }

      throw error;
    }
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

  private async notifyChargeUpdate(
    charge: AsaasChargeRow,
    payment: AsaasPayment,
    status: string,
  ): Promise<void> {
    const normalizedStatus = normalizeStatus(status);
    const type: NotificationType = PAID_PAYMENT_STATUS_SET.has(normalizedStatus)
      ? 'success'
      : REFUND_PAYMENT_STATUS_SET.has(normalizedStatus)
        ? 'warning'
        : normalizedStatus === 'OVERDUE'
          ? 'warning'
          : 'info';

    const dueDate = payment.dueDate ?? null;
    const paymentDate = payment.paymentDate ?? null;
    const value = payment.value ?? null;
    const statusLabel = normalizedStatus.replace(/_/g, ' ').toLowerCase();

    const messageParts = [`Cobrança ${payment.id} agora está ${statusLabel}.`];
    if (paymentDate) {
      messageParts.push(`Pagamento registrado em ${paymentDate}.`);
    } else if (dueDate) {
      messageParts.push(`Vencimento em ${dueDate}.`);
    }

    try {
      await createNotification({
        userId: 'finance',
        title: `Cobrança atualizada (${normalizedStatus})`,
        message: messageParts.join(' '),
        category: 'payments',
        type,
        metadata: {
          chargeId: charge.id,
          asaasId: charge.asaas_id,
          financialFlowId: charge.financial_flow_id,
          status: normalizedStatus,
          dueDate,
          paymentDate,
          value,
        },
      });
    } catch (error) {
      console.error('Falha ao enviar notificação de cobrança do Asaas', error);
    }
  }

  private buildFinancialFlowUpdate(status: string, paymentDate: string | null | undefined): [string, Date | null] | null {
    const normalizedStatus = normalizeStatus(status);

    if (PAID_PAYMENT_STATUS_SET.has(normalizedStatus)) {
      return ['pago', parseDate(paymentDate)];
    }

    if (REFUND_PAYMENT_STATUS_SET.has(normalizedStatus)) {
      return ['estornado', null];
    }

    if (OPEN_PAYMENT_STATUS_SET.has(normalizedStatus)) {
      return ['pendente', null];
    }

    return null;
  }

  private async updateSubscriptionForCharge(
    financialFlowId: number | string,
    paymentStatus: string,
    paymentDate: Date | null,
    dueDate: string | null | undefined,
  ): Promise<void> {
    const normalizedStatus = normalizeStatus(paymentStatus);

    let chargeOrigin: string | null = null;
    let hasClienteId = false;

    try {
      const { rows } = await this.db.query(
        `SELECT
            ac.raw_response #>> '{metadata,origin}' AS origin,
            ff.cliente_id AS cliente_id
          FROM asaas_charges ac
          LEFT JOIN financial_flows ff ON ff.id::text = ac.financial_flow_id::text
         WHERE ac.financial_flow_id::text = $1
         LIMIT 1`,
        [String(financialFlowId)],
      );

      if (rows.length > 0) {
        const row = rows[0] as { origin?: unknown; cliente_id?: unknown };
        chargeOrigin = typeof row.origin === 'string' ? row.origin : null;
        const clienteId = row.cliente_id;
        if (typeof clienteId === 'number') {
          hasClienteId = Number.isInteger(clienteId) && clienteId > 0;
        } else if (typeof clienteId === 'string' && clienteId.trim()) {
          const parsedClienteId = Number(clienteId);
          hasClienteId = Number.isInteger(parsedClienteId) && parsedClienteId > 0;
        }
      }
    } catch (error) {
      console.error(
        '[AsaasChargeSync] Failed to load charge metadata for subscription update',
        financialFlowId,
        error,
      );
      return;
    }

    if (chargeOrigin !== 'plan-payment' && !hasClienteId) {
      return;
    }

    let companyId: number | null = null;

    try {
      companyId = await findCompanyIdForFinancialFlow(financialFlowId);
    } catch (error) {
      console.error('[AsaasChargeSync] Failed to resolve company for financial flow', financialFlowId, error);
      return;
    }

    if (!companyId) {
      return;
    }

    try {
      if (PAID_PAYMENT_STATUS_SET.has(normalizedStatus)) {
        const effectivePaymentDate = paymentDate ?? new Date();
        await applySubscriptionPayment(companyId, effectivePaymentDate);
      } else if (normalizedStatus === 'OVERDUE') {
        const parsedDueDate = parseDate(dueDate);
        await applySubscriptionOverdue(companyId, parsedDueDate);
      }
    } catch (error) {
      console.error('[AsaasChargeSync] Failed to update subscription timeline', { companyId, financialFlowId }, error);
    }
  }
}

export const asaasChargeSyncService = new AsaasChargeSyncService();

export default asaasChargeSyncService;
