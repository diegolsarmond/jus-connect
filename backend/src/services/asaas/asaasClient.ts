import { URL } from 'url';

export interface AsaasClientConfig {
  baseUrl: string;
  accessToken: string;
  fetchImpl?: typeof fetch;
}

export interface CustomerPayload {
  name: string;
  cpfCnpj?: string;
  email?: string;
  phone?: string;
  mobilePhone?: string;
  address?: string;
  addressNumber?: string;
  complement?: string;
  province?: string;
  postalCode?: string;
  externalReference?: string;
  notificationDisabled?: boolean;
  observations?: string;
}

export type UpdateCustomerPayload = Partial<CustomerPayload>;

export interface CustomerResponse extends CustomerPayload {
  id: string;
  object: 'customer';
  city?: string;
  state?: string;
  company?: string;
  deleted?: boolean;
  dateCreated?: string;
}

export type BillingType = 'BOLETO' | 'PIX' | 'CREDIT_CARD' | 'DEBIT_CARD';

export type SubscriptionCycle =
  | 'DAILY'
  | 'WEEKLY'
  | 'BIWEEKLY'
  | 'MONTHLY'
  | 'BIMONTHLY'
  | 'QUARTERLY'
  | 'SEMIANNUAL'
  | 'ANNUAL'
  | 'YEARLY';

export interface SubscriptionTrialPayload {
  startDate?: string;
  endDate?: string;
  value?: number;
  cycle?: SubscriptionCycle;
  nextDueDate?: string;
  [key: string]: unknown;
}

export interface CreateSubscriptionPayload {
  customer: string;
  billingType: BillingType;
  value: number;
  nextDueDate: string;
  cycle?: SubscriptionCycle;
  description?: string;
  externalReference?: string;
  creditCardToken?: string;
  creditCard?: CreditCardDetails;
  creditCardHolderInfo?: CreditCardHolderInfo;
  split?: SplitConfiguration[];
  discount?: unknown;
  fine?: unknown;
  interest?: unknown;
  maxPayments?: number;
  endDate?: string;
  updatePendingPayments?: boolean;
  metadata?: Record<string, unknown>;
  trial?: SubscriptionTrialPayload | null;
  [key: string]: unknown;
}

export type UpdateSubscriptionPayload = Partial<CreateSubscriptionPayload>;

export interface SubscriptionResponse {
  id: string;
  customer?: string;
  billingType?: BillingType;
  cycle?: SubscriptionCycle;
  value?: number;
  status?: string;
  nextDueDate?: string;
  dateCreated?: string;
  description?: string | null;
  externalReference?: string | null;
  deleted?: boolean;
  trial?:
    | ({
        startDate?: string | null;
        endDate?: string | null;
        value?: number | null;
        status?: string | null;
        cycle?: SubscriptionCycle | null;
        nextDueDate?: string | null;
      } & Record<string, unknown>)
    | null;
  currentCycle?: { start?: string | null; end?: string | null } | null;
  currentPeriod?: { start?: string | null; end?: string | null } | null;
  [key: string]: unknown;
}

export interface CreateChargePayload {
  customer: string;
  value: number;
  description?: string;
  dueDate?: string;
  billingType?: BillingType;
  externalReference?: string;
  installmentCount?: number;
  installmentValue?: number;
  totalValue?: number;
  interest?: number;
  fine?: number;
  postalService?: boolean;
  creditCard?: CreditCardDetails;
  creditCardHolderInfo?: CreditCardHolderInfo;
  split?: SplitConfiguration[];
}

export interface SplitConfiguration {
  walletId: string;
  fixedValue?: number;
  percentualValue?: number;
}

export interface CreditCardDetails {
  holderName: string;
  number: string;
  expiryMonth: string;
  expiryYear: string;
  ccv: string;
}

export interface CreditCardHolderInfo {
  name: string;
  email: string;
  cpfCnpj: string;
  postalCode: string;
  addressNumber: string;
  addressComplement?: string;
  phone?: string;
  mobilePhone?: string;
}

export interface ChargeResponse {
  id: string;
  object: 'payment';
  customer: string;
  value: number;
  netValue?: number;
  billingType: BillingType;
  status: string;
  description?: string;
  dueDate?: string;
  originalDueDate?: string;
  paymentDate?: string;
  clientPaymentDate?: string;
  confirmedDate?: string;
  creditCard?: CreditCardDetails & { id?: string };
  pixTransaction?: PixTransaction;
  externalReference?: string;
}

export interface PixTransaction {
  endToEndId?: string;
  payload?: string;
  encodedImage?: string;
  originalValue?: number;
  transactionDate?: string;
  status?: string;
}

export interface PixChargePayload {
  customer: string;
  value: number;
  description?: string;
  externalReference?: string;
  expirationSeconds?: number;
}

export interface PixChargeResponse {
  id: string;
  status: string;
  payload: string;
  encodedImage?: string;
  qrCodeBase64?: string;
  copyPasteCode?: string;
  expirationDate?: string;
}

export interface RefundChargePayload {
  value?: number;
  description?: string;
  externalReference?: string;
  keepCustomerFee?: boolean;
  [key: string]: unknown;
}

export interface RefundChargeResponse {
  id: string;
  status?: string;
  value?: number;
  dateCreated?: string;
  payment?: ChargeResponse | null;
  [key: string]: unknown;
}

export interface AccountInformation {
  object: 'account';
  id: string;
  name: string;
  email: string;
  cpfCnpj: string;
  companyType?: string;
  companyName?: string;
  accountNumber?: string;
  agency?: string;
}

export class AsaasApiError extends Error {
  public readonly status: number;
  public readonly responseBody: unknown;
  public readonly errorCode?: string;

  constructor(message: string, status: number, responseBody: unknown, errorCode?: string) {
    super(message);
    this.name = 'AsaasApiError';
    this.status = status;
    this.responseBody = responseBody;
    this.errorCode = errorCode;
  }
}

function isJsonContentType(headers: Headers): boolean {
  const contentType = headers.get('content-type');
  return Boolean(contentType && contentType.toLowerCase().includes('application/json'));
}

async function parseResponseBody(response: Response): Promise<unknown> {
  if (response.status === 204) {
    return null;
  }

  const cloned = response.clone();
  try {
    if (isJsonContentType(response.headers)) {
      return await cloned.json();
    }
    const text = await cloned.text();
    return text ? text : null;
  } catch (error) {
    return null;
  }
}

function buildUrl(baseUrl: string, path: string): string {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const trimmedPath = path.startsWith('/') ? path.slice(1) : path;
  return new URL(trimmedPath, base).toString();
}

function extractErrorDetails(body: unknown, status: number): { message: string; code?: string } {
  if (!body || typeof body !== 'object') {
    return { message: `Asaas API request failed with status ${status}` };
  }

  const payload = body as Record<string, unknown>;

  if (Array.isArray(payload.errors) && payload.errors.length > 0) {
    const first = payload.errors[0] as Record<string, unknown>;
    const description = typeof first.description === 'string' ? first.description : undefined;
    const message = description || (typeof first.message === 'string' ? first.message : undefined);
    const code = typeof first.code === 'string' ? first.code : undefined;
    if (message) {
      return { message, code };
    }
  }

  if (typeof payload.message === 'string' && payload.message.trim()) {
    return { message: payload.message.trim(), code: typeof payload.code === 'string' ? payload.code : undefined };
  }

  if (typeof payload.error === 'string' && payload.error.trim()) {
    return { message: payload.error.trim() };
  }

  return { message: `Asaas API request failed with status ${status}` };
}

export class AsaasClient {
  private readonly baseUrl: string;
  private readonly accessToken: string;
  private readonly fetch: typeof fetch;

  constructor(config: AsaasClientConfig) {
    if (!config.baseUrl) {
      throw new Error('AsaasClient requires a baseUrl');
    }
    if (!config.accessToken) {
      throw new Error('AsaasClient requires an accessToken');
    }
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.accessToken = config.accessToken;
    this.fetch = config.fetchImpl ?? fetch;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const url = buildUrl(this.baseUrl, path);
    const headers = new Headers(init.headers);

    headers.set('Authorization', `Bearer ${this.accessToken}`);
    headers.set('access_token', this.accessToken);
    headers.set('Accept', 'application/json');

    const hasBody = typeof init.body !== 'undefined' && init.body !== null;
    if (hasBody && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const response = await this.fetch(url, {
      ...init,
      headers,
    });

    const responseBody = await parseResponseBody(response);

    if (!response.ok) {
      const { message, code } = extractErrorDetails(responseBody, response.status);
      throw new AsaasApiError(message, response.status, responseBody, code);
    }

    return responseBody as T;
  }

  async createCustomer(payload: CustomerPayload): Promise<CustomerResponse> {
    return this.request<CustomerResponse>('/customers', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateCustomer(customerId: string, payload: UpdateCustomerPayload): Promise<CustomerResponse> {
    return this.request<CustomerResponse>(`/customers/${customerId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  async createCharge(payload: CreateChargePayload): Promise<ChargeResponse> {
    return this.request<ChargeResponse>('/payments', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getCharge(chargeId: string): Promise<ChargeResponse> {
    return this.request<ChargeResponse>(`/payments/${chargeId}`);
  }

  async createPix(payload: PixChargePayload): Promise<PixChargeResponse> {
    return this.request<PixChargeResponse>('/pix/payments', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async refundCharge(
    chargeId: string,
    payload?: RefundChargePayload | null,
  ): Promise<RefundChargeResponse> {
    if (!chargeId || typeof chargeId !== 'string' || !chargeId.trim()) {
      throw new Error('chargeId is required to refund an Asaas charge');
    }

    const path = `/payments/${chargeId}/refund`;
    const body = payload && Object.keys(payload).length > 0 ? JSON.stringify(payload) : undefined;

    try {
      return await this.request<RefundChargeResponse>(path, {
        method: 'POST',
        body,
      });
    } catch (error) {
      if (error instanceof AsaasApiError) {
        throw error;
      }

      const err = error as Error;
      throw new AsaasApiError(
        err.message || 'Falha ao solicitar estorno no Asaas',
        err instanceof AsaasApiError ? err.status : 500,
        err instanceof AsaasApiError ? err.responseBody : null,
        err instanceof AsaasApiError ? err.errorCode : undefined,
      );
    }
  }

  async createSubscription(payload: CreateSubscriptionPayload): Promise<SubscriptionResponse> {
    return this.request<SubscriptionResponse>('/subscriptions', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateSubscription(
    subscriptionId: string,
    payload: UpdateSubscriptionPayload,
  ): Promise<SubscriptionResponse> {
    if (!subscriptionId) {
      throw new Error('subscriptionId is required to update an Asaas subscription');
    }

    return this.request<SubscriptionResponse>(`/subscriptions/${subscriptionId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  async createCreditCardCharge(payload: Omit<CreateChargePayload, 'billingType'>): Promise<ChargeResponse> {
    const normalizedPayload: CreateChargePayload = {
      ...payload,
      billingType: 'CREDIT_CARD',
    };
    return this.createCharge(normalizedPayload);
  }

  async validateCredentials(): Promise<AccountInformation> {
    return this.request<AccountInformation>('/accounts');
  }
}

export default AsaasClient;

