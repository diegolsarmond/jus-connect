import { getApiUrl } from "@/lib/api";

export type PlanOption = {
  id: number;
  name: string;
  description: string | null;
  monthlyPrice: number | null;
  annualPrice: number | null;
};

type RawRecord = Record<string, unknown>;

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const toNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const sanitized = trimmed.replace(/[^\d,.-]/g, "").replace(/\.(?=.*\.)/g, "");
    const normalized = sanitized.replace(",", ".");
    const parsed = Number(normalized);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
};

const extractRows = (payload: unknown): RawRecord[] => {
  if (Array.isArray(payload)) {
    return payload.filter((item): item is RawRecord => item !== null && typeof item === "object");
  }

  if (payload && typeof payload === "object") {
    const data = (payload as { data?: unknown }).data;
    if (Array.isArray(data)) {
      return data.filter((item): item is RawRecord => item !== null && typeof item === "object");
    }

    const rows = (payload as { rows?: unknown }).rows;
    if (Array.isArray(rows)) {
      return rows.filter((item): item is RawRecord => item !== null && typeof item === "object");
    }
  }

  return [];
};

export const parsePlanOptions = (payload: unknown): PlanOption[] =>
  extractRows(payload)
    .map((record) => {
      const id = toNumber(record.id);
      if (id === null) {
        return null;
      }

      const nameCandidate = typeof record.nome === "string" ? record.nome.trim() : undefined;
      const descriptionCandidate = typeof record.descricao === "string" ? record.descricao.trim() : undefined;
      const monthly = toNumber(record.valor_mensal ?? record.valorMensal ?? record.preco_mensal);
      const annual = toNumber(record.valor_anual ?? record.valorAnual ?? record.preco_anual);

      return {
        id,
        name: nameCandidate && nameCandidate.length > 0 ? nameCandidate : `Plano ${id}`,
        description: descriptionCandidate && descriptionCandidate.length > 0 ? descriptionCandidate : null,
        monthlyPrice: monthly,
        annualPrice: annual,
      } satisfies PlanOption;
    })
    .filter((plan): plan is PlanOption => plan !== null);

export const formatPlanPriceLabel = (plan: PlanOption): string => {
  if (plan.monthlyPrice !== null) {
    return `${currencyFormatter.format(plan.monthlyPrice)} / mês`;
  }

  if (plan.annualPrice !== null) {
    return `${currencyFormatter.format(plan.annualPrice)} / ano`;
  }

  return "Consulte condições";
};

export async function fetchPlanOptions(signal?: AbortSignal): Promise<PlanOption[]> {
  const response = await fetch(getApiUrl("planos"), {
    headers: { Accept: "application/json" },
    signal,
  });

  if (!response.ok) {
    throw new Error(`Falha ao carregar planos (HTTP ${response.status})`);
  }

  const payload = await response.json();
  return parsePlanOptions(payload);
}

export const getComparableMonthlyPrice = (plan: PlanOption): number | null => {
  if (typeof plan.monthlyPrice === "number" && Number.isFinite(plan.monthlyPrice)) {
    return plan.monthlyPrice;
  }

  if (typeof plan.annualPrice === "number" && Number.isFinite(plan.annualPrice)) {
    return plan.annualPrice / 12;
  }

  return null;
};

export type PlanPaymentMethod = "pix" | "boleto" | "cartao" | "debito";

export type PlanPaymentPayload = {
  planId: number;
  pricingMode: "mensal" | "anual";
  paymentMethod: PlanPaymentMethod;
  billing: {
    companyName: string;
    document: string;
    email: string;
    notes?: string;
  };
  cardToken?: string;
  cardMetadata?: Record<string, unknown>;
};

export type PlanPaymentCharge = {
  id: number | null;
  financialFlowId: number | null;
  asaasChargeId: string | null;
  billingType: "PIX" | "BOLETO" | "CREDIT_CARD" | "DEBIT_CARD";
  status: string | null;
  dueDate: string | null;
  amount: number | null;
  invoiceUrl: string | null;
  boletoUrl: string | null;
  pixPayload: string | null;
  pixQrCode: string | null;
  cardLast4: string | null;
  cardBrand: string | null;
};

export type PlanPaymentFlow = {
  id: number | null;
  description: string | null;
  value: number | null;
  dueDate: string | null;
  status: string | null;
};

export type PlanPaymentResult = {
  plan: {
    id: number | null;
    nome: string | null;
    pricingMode: "mensal" | "anual";
    price: number | null;
  };
  paymentMethod: "PIX" | "BOLETO" | "CREDIT_CARD" | "DEBIT_CARD";
  charge: PlanPaymentCharge;
  flow: PlanPaymentFlow;
};

const normalizeString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeCharge = (payload: unknown): PlanPaymentCharge => {
  if (!payload || typeof payload !== "object") {
    return {
      id: null,
      financialFlowId: null,
      asaasChargeId: null,
      billingType: "PIX",
      status: null,
      dueDate: null,
      amount: null,
      invoiceUrl: null,
      boletoUrl: null,
      pixPayload: null,
      pixQrCode: null,
      cardLast4: null,
      cardBrand: null,
    } satisfies PlanPaymentCharge;
  }

  const record = payload as Record<string, unknown>;
  const amount = toNumber(record.value ?? record.amount ?? record.valor);

  const billingTypeRaw = normalizeString(record.billingType);
  const billingType: "PIX" | "BOLETO" | "CREDIT_CARD" | "DEBIT_CARD" =
    billingTypeRaw === "BOLETO"
      ? "BOLETO"
      : billingTypeRaw === "CREDIT_CARD"
        ? "CREDIT_CARD"
        : billingTypeRaw === "DEBIT_CARD"
          ? "DEBIT_CARD"
          : "PIX";

  return {
    id: toNumber(record.id),
    financialFlowId: toNumber(record.financialFlowId ?? record.financial_flow_id),
    asaasChargeId: normalizeString(record.asaasChargeId ?? record.asaas_charge_id),
    billingType,
    status: normalizeString(record.status),
    dueDate: normalizeString(record.dueDate ?? record.due_date),
    amount,
    invoiceUrl: normalizeString(record.invoiceUrl ?? record.invoice_url),
    boletoUrl: normalizeString(record.boletoUrl ?? record.bankSlipUrl ?? record.boleto_url),
    pixPayload: normalizeString(record.pixPayload ?? record.pix_payload ?? record.pixCopiaECola),
    pixQrCode: normalizeString(record.pixQrCode ?? record.pix_qr_code ?? record.pixQrCodeImage),
    cardLast4: normalizeString(record.cardLast4 ?? record.card_last4 ?? record.cardLastDigits),
    cardBrand: normalizeString(record.cardBrand ?? record.card_brand ?? record.brand),
  } satisfies PlanPaymentCharge;
};

const normalizeFlow = (payload: unknown): PlanPaymentFlow => {
  if (!payload || typeof payload !== "object") {
    return {
      id: null,
      description: null,
      value: null,
      dueDate: null,
      status: null,
    } satisfies PlanPaymentFlow;
  }

  const record = payload as Record<string, unknown>;
  return {
    id: toNumber(record.id),
    description: normalizeString(record.descricao ?? record.description),
    value: toNumber(record.valor ?? record.value),
    dueDate: normalizeString(record.vencimento ?? record.dueDate ?? record.due_date),
    status: normalizeString(record.status),
  } satisfies PlanPaymentFlow;
};

const normalizePlanInfo = (
  payload: unknown,
  fallbackId: number | null,
): PlanPaymentResult["plan"] => {
  const fallback = typeof fallbackId === "number" && Number.isFinite(fallbackId) ? fallbackId : null;

  if (!payload || typeof payload !== "object") {
    return {
      id: fallback,
      nome: null,
      pricingMode: "mensal",
      price: null,
    } satisfies PlanPaymentResult["plan"];
  }

  const record = payload as Record<string, unknown>;
  const pricingModeRaw = normalizeString(record.pricingMode ?? record.cadence);
  const pricingMode: "mensal" | "anual" = pricingModeRaw === "anual" ? "anual" : "mensal";

  return {
    id: toNumber(record.id) ?? fallback,
    nome: normalizeString(record.nome ?? record.name),
    pricingMode,
    price: toNumber(record.price ?? record.valor),
  } satisfies PlanPaymentResult["plan"];
};

export const normalizePlanPaymentResult = (
  payload: unknown,
  fallbackPlanId: number | null,
): PlanPaymentResult => {
  const payloadRecord =
    payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};

  const paymentMethodRaw = normalizeString(payloadRecord.paymentMethod);
  const paymentMethod: "PIX" | "BOLETO" | "CREDIT_CARD" | "DEBIT_CARD" =
    paymentMethodRaw === "BOLETO"
      ? "BOLETO"
      : paymentMethodRaw === "CREDIT_CARD"
        ? "CREDIT_CARD"
        : paymentMethodRaw === "DEBIT_CARD"
          ? "DEBIT_CARD"
          : "PIX";

  return {
    plan: normalizePlanInfo(payloadRecord.plan, fallbackPlanId),
    paymentMethod,
    charge: normalizeCharge(payloadRecord.charge),
    flow: normalizeFlow(payloadRecord.flow),
  } satisfies PlanPaymentResult;
};

export async function createPlanPayment(payload: PlanPaymentPayload): Promise<PlanPaymentResult> {
  const response = await fetch(getApiUrl("plan-payments"), {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload),
  });

  let data: unknown = null;
  try {
    data = await response.json();
  } catch (error) {
    data = null;
  }

  if (!response.ok) {
    const errorMessage =
      (data && typeof data === "object" && typeof (data as { error?: unknown }).error === "string"
        ? ((data as { error?: unknown }).error as string)
        : null) ?? `Falha ao gerar cobrança (HTTP ${response.status}).`;
    throw new Error(errorMessage);
  }

  return normalizePlanPaymentResult(data, payload.planId);
}
