export type PricingMode = "mensal" | "anual";

export type ManagePlanSelectionPlan = {
  id: number;
  nome: string;
  descricao: string | null;
  recursos: string[];
  valorMensal: number | null;
  valorAnual: number | null;
  precoMensal: string | null;
  precoAnual: string | null;
  descontoAnualPercentual: number | null;
  economiaAnual: number | null;
  economiaAnualFormatada: string | null;
};

export type ManagePlanSelection = {
  plan?: ManagePlanSelectionPlan;
  pricingMode?: PricingMode;
};

const STORAGE_KEY = "jus-connect:manage-plan-payment-selection";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const toNullableNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const parsed = Number(trimmed.replace(/,/, "."));
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const toNullableString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const toStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
};

const sanitizePlan = (input: unknown): ManagePlanSelectionPlan | undefined => {
  if (!isRecord(input)) {
    return undefined;
  }

  const idValue = input.id;
  const id = typeof idValue === "number" && Number.isFinite(idValue)
    ? idValue
    : typeof idValue === "string"
      ? Number.parseInt(idValue, 10)
      : null;

  if (id === null || Number.isNaN(id)) {
    return undefined;
  }

  return {
    id,
    nome: toNullableString(input.nome) ?? "",
    descricao: toNullableString(input.descricao),
    recursos: toStringArray(input.recursos),
    valorMensal: toNullableNumber(input.valorMensal),
    valorAnual: toNullableNumber(input.valorAnual),
    precoMensal: toNullableString(input.precoMensal),
    precoAnual: toNullableString(input.precoAnual),
    descontoAnualPercentual: toNullableNumber(input.descontoAnualPercentual),
    economiaAnual: toNullableNumber(input.economiaAnual),
    economiaAnualFormatada: toNullableString(input.economiaAnualFormatada),
  };
};

const sanitizePricingMode = (value: unknown): PricingMode | undefined => {
  return value === "anual" || value === "mensal" ? value : undefined;
};

const sanitizeSelection = (value: unknown): ManagePlanSelection => {
  if (!isRecord(value)) {
    return {};
  }

  const plan = sanitizePlan(value.plan);
  const pricingMode = sanitizePricingMode(value.pricingMode);

  return {
    ...(plan ? { plan } : {}),
    ...(pricingMode ? { pricingMode } : {}),
  };
};

const getSessionStorage = (): Storage | null => {
  if (typeof window === "undefined" || !window.sessionStorage) {
    return null;
  }

  return window.sessionStorage;
};

export const persistManagePlanSelection = (selection: ManagePlanSelection) => {
  const storage = getSessionStorage();
  if (!storage) {
    return;
  }

  try {
    const normalized = sanitizeSelection(selection);
    storage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  } catch (error) {
    console.error("Falha ao salvar a seleção do plano no armazenamento de sessão", error);
  }
};

export const getPersistedManagePlanSelection = (): ManagePlanSelection => {
  const storage = getSessionStorage();
  if (!storage) {
    return {};
  }

  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);
    return sanitizeSelection(parsed);
  } catch (error) {
    console.error("Falha ao carregar a seleção do plano do armazenamento de sessão", error);
    return {};
  }
};

export const clearPersistedManagePlanSelection = () => {
  const storage = getSessionStorage();
  if (!storage) {
    return;
  }

  storage.removeItem(STORAGE_KEY);
};
