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
