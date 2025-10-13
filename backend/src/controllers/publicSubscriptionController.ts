import { Request, Response } from 'express';
import AsaasSubscriptionService, {
  ManageSubscriptionInput,
} from '../services/asaas/subscriptionService';
import AsaasClient, {
  AsaasApiError,
  BillingType,
  CreditCardDetails,
  CreditCardHolderInfo,
  CustomerPayload,
  CustomerResponse,
  PaginatedResponse,
  SubscriptionResponse,
} from '../services/asaas/asaasClient';

type AsaasConfig = {
  baseUrl: string;
  accessToken: string;
};

type SitePlan = {
  id: string;
  name: string;
  monthlyPrice: number;
  yearlyPrice: number;
};

const SITE_PLANS: SitePlan[] = [
  {
    id: 'starter',
    name: 'Essencial',
    monthlyPrice: 149,
    yearlyPrice: 1490,
  },
  {
    id: 'professional',
    name: 'Profissional',
    monthlyPrice: 249,
    yearlyPrice: 2490,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    monthlyPrice: 449,
    yearlyPrice: 4490,
  },
];

const asaasSubscriptionService = new AsaasSubscriptionService();

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const sanitizeString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
};

const sanitizeDigits = (value: unknown): string | undefined => {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return undefined;
  }

  const digits = String(value).replace(/\D+/g, '');
  return digits ? digits : undefined;
};

const sanitizePhone = (value: unknown): string | undefined => {
  const digits = sanitizeDigits(value);
  if (!digits) {
    return undefined;
  }

  return digits.length >= 8 ? digits : undefined;
};

const resolveAsaasConfig = (): AsaasConfig | null => {
  const baseUrl = sanitizeString(process.env.ASAAS_API_URL)?.replace(/\/+$/, '') ?? null;
  const accessToken =
    sanitizeString(process.env.ASAAS_ACCESS_TOKEN) ?? sanitizeString(process.env.ASAAS_API_KEY) ?? null;

  if (!baseUrl || !accessToken) {
    return null;
  }

  return { baseUrl, accessToken };
};

const ensureAsaasClient = (res: Response): { client: AsaasClient; config: AsaasConfig } | null => {
  const config = resolveAsaasConfig();
  if (!config) {
    res
      .status(503)
      .json({ error: 'Integração com o Asaas não está configurada. Verifique as variáveis ASAAS_API_URL e ASAAS_ACCESS_TOKEN.' });
    return null;
  }

  return { client: new AsaasClient(config), config };
};

const extractErrorMessage = (error: AsaasApiError, fallback: string): string => {
  if (error.message && error.message.trim()) {
    return error.message.trim();
  }

  if (isRecord(error.responseBody)) {
    const message = sanitizeString(error.responseBody.message);
    if (message) {
      return message;
    }

    const errorDescription = Array.isArray(error.responseBody.errors)
      ? error.responseBody.errors
      : null;

    if (errorDescription?.length) {
      const first = errorDescription[0];
      if (isRecord(first)) {
        const description = sanitizeString(first.description);
        if (description) {
          return description;
        }

        const innerMessage = sanitizeString(first.message);
        if (innerMessage) {
          return innerMessage;
        }
      }
    }
  }

  return fallback;
};

const handleAsaasError = (res: Response, error: unknown, fallback: string): boolean => {
  if (error instanceof AsaasApiError) {
    const status = Number.isInteger(error.status) && error.status >= 400 ? error.status : 502;
    res.status(status).json({ error: extractErrorMessage(error, fallback) });
    return true;
  }

  return false;
};

const buildCustomerPayload = (body: unknown): CustomerPayload => {
  if (!isRecord(body)) {
    throw new Error('Dados do cliente inválidos.');
  }

  const name = sanitizeString(body.name);
  if (!name) {
    throw new Error('Informe o nome do cliente.');
  }

  const cpfCnpj = sanitizeDigits(body.cpfCnpj);
  if (!cpfCnpj) {
    throw new Error('Informe o CPF ou CNPJ do cliente.');
  }

  const payload: CustomerPayload = {
    name,
    cpfCnpj,
  };

  const email = sanitizeString(body.email);
  if (email) {
    payload.email = email;
  }

  const phone = sanitizePhone(body.phone);
  if (phone) {
    payload.phone = phone;
  }

  const mobilePhone = sanitizePhone(body.mobilePhone) ?? phone;
  if (mobilePhone) {
    payload.mobilePhone = mobilePhone;
  }

  const postalCode = sanitizeDigits(body.postalCode);
  if (postalCode) {
    payload.postalCode = postalCode;
  }

  const addressNumber = sanitizeString(body.addressNumber);
  if (addressNumber) {
    payload.addressNumber = addressNumber;
  }

  return payload;
};

const normalizeSubscriptionCycle = (cycle: unknown): 'MONTHLY' | 'YEARLY' => {
  if (typeof cycle !== 'string') {
    return 'MONTHLY';
  }

  const normalized = cycle.trim().toUpperCase();
  if (normalized === 'ANNUAL' || normalized === 'ANNUALLY' || normalized === 'YEARLY') {
    return 'YEARLY';
  }

  return 'MONTHLY';
};

const resolveSitePlan = (planId: unknown): SitePlan | null => {
  if (typeof planId !== 'string') {
    return null;
  }

  const normalized = planId.trim();
  if (!normalized) {
    return null;
  }

  return SITE_PLANS.find((plan) => plan.id === normalized) ?? null;
};

const parseBillingType = (value: unknown): BillingType | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toUpperCase();
  if (normalized === 'PIX' || normalized === 'BOLETO' || normalized === 'CREDIT_CARD' || normalized === 'DEBIT_CARD') {
    return normalized as BillingType;
  }

  return null;
};

const parseCreditCard = (value: unknown): CreditCardDetails | null => {
  if (!isRecord(value)) {
    return null;
  }

  const holderName = sanitizeString(value.holderName);
  const number = sanitizeDigits(value.number);
  const expiryMonth = sanitizeDigits(value.expiryMonth);
  const expiryYear = sanitizeDigits(value.expiryYear);
  const ccv = sanitizeDigits(value.ccv);

  if (!holderName || !number || !expiryMonth || !expiryYear || !ccv) {
    return null;
  }

  return {
    holderName,
    number,
    expiryMonth,
    expiryYear,
    ccv,
  };
};

const parseCreditCardHolderInfo = (value: unknown): CreditCardHolderInfo | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  const name = sanitizeString(value.name);
  const email = sanitizeString(value.email);
  const cpfCnpj = sanitizeDigits(value.cpfCnpj);
  const postalCode = sanitizeDigits(value.postalCode);
  const addressNumber = sanitizeString(value.addressNumber);

  if (!name || !email || !cpfCnpj || !postalCode || !addressNumber) {
    return undefined;
  }

  const holder: CreditCardHolderInfo = {
    name,
    email,
    cpfCnpj,
    postalCode,
    addressNumber,
  };

  const addressComplement = sanitizeString(value.addressComplement);
  if (addressComplement) {
    holder.addressComplement = addressComplement;
  }

  const phone = sanitizePhone(value.phone);
  if (phone) {
    holder.phone = phone;
  }

  const mobilePhone = sanitizePhone(value.mobilePhone);
  if (mobilePhone) {
    holder.mobilePhone = mobilePhone;
  }

  return holder;
};

const parseManageSubscriptionInput = (body: unknown): ManageSubscriptionInput => {
  if (!isRecord(body)) {
    throw new Error('Dados da assinatura inválidos.');
  }

  const customer = sanitizeString(body.customer);
  const billingType = parseBillingType(body.billingType);
  const value = typeof body.value === 'number' ? body.value : Number(body.value);
  const nextDueDate = sanitizeString(body.nextDueDate);

  if (!customer || !billingType || !Number.isFinite(value) || !nextDueDate) {
    throw new Error('Preencha os dados obrigatórios da assinatura.');
  }

  const payload: ManageSubscriptionInput = {
    customer,
    billingType,
    value,
    nextDueDate,
  };

  const subscriptionId = sanitizeString(body.subscriptionId);
  if (subscriptionId) {
    payload.subscriptionId = subscriptionId;
  }

  const cycle = sanitizeString(body.cycle);
  if (cycle) {
    payload.cycle = cycle as ManageSubscriptionInput['cycle'];
  }

  const description = sanitizeString(body.description);
  if (description) {
    payload.description = description;
  }

  const externalReference = sanitizeString(body.externalReference);
  if (externalReference) {
    payload.externalReference = externalReference;
  }

  const creditCard = parseCreditCard(body.creditCard);
  if (creditCard) {
    payload.creditCard = creditCard;
  }

  const creditCardHolderInfo = parseCreditCardHolderInfo(body.creditCardHolderInfo);
  if (creditCardHolderInfo) {
    payload.creditCardHolderInfo = creditCardHolderInfo;
  }

  if (isRecord(body.metadata)) {
    payload.metadata = body.metadata as Record<string, unknown>;
  }

  if (Array.isArray(body.split)) {
    payload.split = body.split as ManageSubscriptionInput['split'];
  }

  if (isRecord(body.trial)) {
    payload.trial = body.trial as ManageSubscriptionInput['trial'];
  }

  if (typeof body.updatePendingPayments === 'boolean') {
    payload.updatePendingPayments = body.updatePendingPayments;
  }

  return payload;
};

const normalizeSubscriptionResponse = (subscription: SubscriptionResponse): SubscriptionResponse => {
  const cycle = normalizeSubscriptionCycle(subscription.cycle);
  if (cycle !== subscription.cycle) {
    return { ...subscription, cycle };
  }
  return subscription;
};

const mapPaginatedData = <T>(response: PaginatedResponse<T> | T[]): T[] => {
  if (Array.isArray(response)) {
    return response;
  }
  if (Array.isArray(response.data)) {
    return response.data;
  }
  return [];
};

export const createOrGetCustomer = async (req: Request, res: Response) => {
  const clientResolution = ensureAsaasClient(res);
  if (!clientResolution) {
    return;
  }

  try {
    const payload = buildCustomerPayload(req.body);

    const searchParams: Record<string, string> = {};
    if (payload.cpfCnpj) {
      searchParams.cpfCnpj = payload.cpfCnpj;
    } else if (payload.email) {
      searchParams.email = payload.email;
    } else if (payload.mobilePhone) {
      searchParams.mobilePhone = payload.mobilePhone;
    }

    let existingCustomer: CustomerResponse | null = null;

    if (Object.keys(searchParams).length > 0) {
      const list = await clientResolution.client.listCustomers(searchParams);
      const [first] = mapPaginatedData<CustomerResponse>(list);
      existingCustomer = first ?? null;
    }

    if (existingCustomer && typeof existingCustomer.id === 'string') {
      const updated = await clientResolution.client.updateCustomer(existingCustomer.id, payload);
      res.json(updated);
      return;
    }

    const created = await clientResolution.client.createCustomer(payload);
    res.json(created);
  } catch (error) {
    if (handleAsaasError(res, error, 'Não foi possível criar o cliente no Asaas.')) {
      return;
    }

    console.error('Falha ao criar cliente no Asaas', error);
    res.status(500).json({ error: 'Falha ao comunicar com o Asaas.' });
  }
};

export const createSubscription = async (req: Request, res: Response) => {
  const clientResolution = ensureAsaasClient(res);
  if (!clientResolution) {
    return;
  }

  try {
    const payload = parseManageSubscriptionInput(req.body);
    const result = await asaasSubscriptionService.createOrUpdateSubscription({
      integration: clientResolution.config,
      payload,
    });
    res.json(normalizeSubscriptionResponse(result.subscription));
  } catch (error) {
    if (handleAsaasError(res, error, 'Não foi possível criar a assinatura no Asaas.')) {
      return;
    }

    console.error('Falha ao criar assinatura no Asaas', error);
    res.status(500).json({ error: 'Falha ao comunicar com o Asaas.' });
  }
};

export const getSubscription = async (req: Request, res: Response) => {
  const clientResolution = ensureAsaasClient(res);
  if (!clientResolution) {
    return;
  }

  const subscriptionId = sanitizeString(req.params?.subscriptionId ?? req.params?.id);
  if (!subscriptionId) {
    res.status(400).json({ error: 'Identificador de assinatura inválido.' });
    return;
  }

  try {
    const subscription = await clientResolution.client.getSubscription(subscriptionId);
    res.json(normalizeSubscriptionResponse(subscription));
  } catch (error) {
    if (handleAsaasError(res, error, 'Não foi possível recuperar a assinatura.')) {
      return;
    }

    console.error('Falha ao recuperar assinatura no Asaas', error);
    res.status(500).json({ error: 'Falha ao comunicar com o Asaas.' });
  }
};

export const getSubscriptionPayments = async (req: Request, res: Response) => {
  const clientResolution = ensureAsaasClient(res);
  if (!clientResolution) {
    return;
  }

  const subscriptionId = sanitizeString(req.params?.subscriptionId ?? req.params?.id);
  if (!subscriptionId) {
    res.status(400).json({ error: 'Identificador de assinatura inválido.' });
    return;
  }

  try {
    const paymentsResponse = await clientResolution.client.listSubscriptionPayments(subscriptionId, {
      limit: 50,
      offset: 0,
    });

    const payments = mapPaginatedData(paymentsResponse).map((payment) => {
      const record = payment as unknown as Record<string, unknown>;
      const invoiceUrl = sanitizeString(record.invoiceUrl) ?? sanitizeString(record.invoice_url);
      const boletoUrl = sanitizeString(record.bankSlipUrl) ?? sanitizeString(record.bank_slip_url);
      const rawValue =
        typeof record.value === 'number' ? record.value : Number(record.value ?? Number.NaN);
      const value = Number.isFinite(rawValue) ? rawValue : 0;

      return {
        id: (record.id as string) ?? '',
        description: sanitizeString(record.description) ?? '',
        dueDate: sanitizeString(record.dueDate) ?? sanitizeString(record.originalDueDate) ?? '',
        value,
        status: sanitizeString(record.status) ?? '',
        billingType: sanitizeString(record.billingType) ?? '',
        invoiceUrl: invoiceUrl ?? boletoUrl ?? null,
      };
    });

    res.json({ data: payments });
  } catch (error) {
    if (handleAsaasError(res, error, 'Não foi possível recuperar os pagamentos da assinatura.')) {
      return;
    }

    console.error('Falha ao recuperar pagamentos da assinatura no Asaas', error);
    res.status(500).json({ error: 'Falha ao comunicar com o Asaas.' });
  }
};

export const getPaymentPixQrCode = async (req: Request, res: Response) => {
  const clientResolution = ensureAsaasClient(res);
  if (!clientResolution) {
    return;
  }

  const paymentId = sanitizeString(req.params?.paymentId ?? req.params?.id);
  if (!paymentId) {
    res.status(400).json({ error: 'Identificador de pagamento inválido.' });
    return;
  }

  try {
    const [pixQrCode, charge] = await Promise.all([
      clientResolution.client.getPaymentPixQrCode(paymentId),
      clientResolution.client.getCharge(paymentId),
    ]);

    const chargeRecord = charge as unknown as Record<string, unknown>;
    const pixTransaction = isRecord(chargeRecord.pixTransaction) ? chargeRecord.pixTransaction : null;

    const payload =
      sanitizeString(pixQrCode.payload) ?? sanitizeString(pixTransaction?.payload) ?? undefined;
    const encodedImage =
      sanitizeString(pixQrCode.encodedImage) ?? sanitizeString(pixTransaction?.encodedImage) ?? undefined;
    const expirationSource =
      sanitizeString((pixTransaction as Record<string, unknown> | null)?.expirationDate) ??
      sanitizeString(chargeRecord.dueDate) ??
      sanitizeString(chargeRecord.originalDueDate) ??
      sanitizeString(pixTransaction?.transactionDate) ??
      undefined;

    if (!payload) {
      res.status(404).json({ error: 'Código PIX ainda não está disponível.' });
      return;
    }

    res.json({
      payload,
      encodedImage: encodedImage ?? '',
      expirationDate: expirationSource ?? '',
    });
  } catch (error) {
    if (handleAsaasError(res, error, 'Não foi possível gerar o QR Code PIX.')) {
      return;
    }

    console.error('Falha ao recuperar QR Code PIX no Asaas', error);
    res.status(500).json({ error: 'Falha ao comunicar com o Asaas.' });
  }
};

export const getPaymentBoletoCode = async (req: Request, res: Response) => {
  const clientResolution = ensureAsaasClient(res);
  if (!clientResolution) {
    return;
  }

  const paymentId = sanitizeString(req.params?.paymentId ?? req.params?.id);
  if (!paymentId) {
    res.status(400).json({ error: 'Identificador de pagamento inválido.' });
    return;
  }

  try {
    const charge = await clientResolution.client.getCharge(paymentId);
    const record = charge as unknown as Record<string, unknown>;

    const identificationField =
      sanitizeString(record.identificationField) ?? sanitizeString(record.identification_field) ?? '';

    res.json({ identificationField });
  } catch (error) {
    if (handleAsaasError(res, error, 'Não foi possível recuperar o código do boleto.')) {
      return;
    }

    console.error('Falha ao recuperar boleto no Asaas', error);
    res.status(500).json({ error: 'Falha ao comunicar com o Asaas.' });
  }
};

export const updateSubscriptionPlan = async (req: Request, res: Response) => {
  const clientResolution = ensureAsaasClient(res);
  if (!clientResolution) {
    return;
  }

  const subscriptionId = sanitizeString(req.params?.subscriptionId ?? req.params?.id);
  if (!subscriptionId) {
    res.status(400).json({ error: 'Identificador de assinatura inválido.' });
    return;
  }

  const requestedPlan = resolveSitePlan(req.body?.planId ?? req.body?.plan_id ?? req.body?.plan);
  if (!requestedPlan) {
    res.status(400).json({ error: 'Plano selecionado inválido.' });
    return;
  }

  try {
    const subscription = await clientResolution.client.getSubscription(subscriptionId);
    const normalizedSubscription = normalizeSubscriptionResponse(subscription);
    const cycle = normalizeSubscriptionCycle(normalizedSubscription.cycle);

    const value = cycle === 'YEARLY' ? requestedPlan.yearlyPrice : requestedPlan.monthlyPrice;
    const description = `Assinatura ${requestedPlan.name} (${cycle === 'YEARLY' ? 'anual' : 'mensal'})`;

    const updated = await clientResolution.client.updateSubscription(subscriptionId, {
      value,
      description,
    });

    res.json(normalizeSubscriptionResponse(updated));
  } catch (error) {
    if (handleAsaasError(res, error, 'Não foi possível atualizar o plano da assinatura.')) {
      return;
    }

    console.error('Falha ao atualizar plano da assinatura no Asaas', error);
    res.status(500).json({ error: 'Falha ao comunicar com o Asaas.' });
  }
};

export const updateSubscriptionCard = async (req: Request, res: Response) => {
  const clientResolution = ensureAsaasClient(res);
  if (!clientResolution) {
    return;
  }

  const subscriptionId = sanitizeString(req.params?.subscriptionId ?? req.params?.id);
  if (!subscriptionId) {
    res.status(400).json({ error: 'Identificador de assinatura inválido.' });
    return;
  }

  const creditCard = parseCreditCard(req.body?.creditCard ?? req.body?.card);
  if (!creditCard) {
    res.status(400).json({ error: 'Informe os dados do cartão de crédito.' });
    return;
  }

  const creditCardHolderInfo = parseCreditCardHolderInfo(req.body?.creditCardHolderInfo ?? req.body?.holder);

  try {
    const payload = creditCardHolderInfo
      ? { creditCard, creditCardHolderInfo, billingType: 'CREDIT_CARD' as BillingType }
      : { creditCard, billingType: 'CREDIT_CARD' as BillingType };

    const updated = await clientResolution.client.updateSubscription(subscriptionId, payload);
    res.json(normalizeSubscriptionResponse(updated));
  } catch (error) {
    if (handleAsaasError(res, error, 'Não foi possível atualizar o cartão da assinatura.')) {
      return;
    }

    console.error('Falha ao atualizar cartão da assinatura no Asaas', error);
    res.status(500).json({ error: 'Falha ao comunicar com o Asaas.' });
  }
};

