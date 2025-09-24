export interface ModuleInfo {
  id: string;
  nome: string;
  descricao?: string;
  categoria?: string;
}

export interface Plan {
  id: number;
  name: string;
  monthlyPrice: string;
  annualPrice: string;
  modules: string[];
  userLimit: number | null;
  processLimit: number | null;
  proposalLimit: number | null;
  processSyncEnabled: boolean;
  processSyncQuota: number | null;
}

export type PlanFormState = {
  name: string;
  monthlyPrice: string;
  annualPrice: string;
  modules: string[];
  userLimit: string;
  processLimit: string;
  proposalLimit: string;
  processSyncEnabled: boolean;
  processSyncQuota: string;
};

export const initialPlanFormState: PlanFormState = {
  name: "",
  monthlyPrice: "",
  annualPrice: "",
  modules: [],
  userLimit: "",
  processLimit: "",
  proposalLimit: "",
  processSyncEnabled: false,
  processSyncQuota: "",
};

export const extractCollection = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") {
    const data = value as Record<string, unknown>;
    if (Array.isArray(data.rows)) return data.rows;
    if (Array.isArray(data.data)) return data.data;
    if (data.data && typeof data.data === "object") {
      const nested = data.data as Record<string, unknown>;
      if (Array.isArray(nested.rows)) return nested.rows;
    }
  }
  return [];
};

export const parseInteger = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const normalized = Number(trimmed.replace(/\./g, "").replace(/,/g, "."));
    if (Number.isFinite(normalized)) {
      return Math.trunc(normalized);
    }
  }

  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }

  return null;
};

const parseBoolean = (value: unknown): boolean => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return ["true", "1", "yes", "sim", "habilitado", "ativo"].includes(normalized);
  }
  return false;
};

const parsePrice = (value: unknown): string => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value.toString();
  }
  if (typeof value === "string") {
    return value;
  }
  return "";
};

export const parseDecimal = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const normalized = Number(trimmed.replace(/\./g, "").replace(/,/g, "."));
    if (Number.isFinite(normalized) && normalized >= 0) {
      return normalized;
    }
  }

  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }

  return null;
};

const parseNumberId = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const normalized = Number(value);
    if (Number.isFinite(normalized)) {
      return normalized;
    }
  }
  return null;
};

const normalizeModuleIds = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  const unique: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string") continue;
    const trimmed = entry.trim();
    if (!trimmed || unique.includes(trimmed)) continue;
    unique.push(trimmed);
  }
  return unique;
};

export const parsePlan = (raw: unknown): Plan | null => {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;
  const id = parseNumberId(data.id);
  if (id == null) return null;
  const name =
    typeof data.nome === "string"
      ? data.nome
      : typeof data.name === "string"
        ? data.name
        : typeof data.descricao === "string"
          ? data.descricao
          : "";

  const modules = normalizeModuleIds(
    data.modulos ?? data.modules ?? data.recursos ?? data.features ?? []
  );

  const userLimit =
    parseInteger(
      data.limite_usuarios ??
        data.qtde_usuarios ??
        data.userLimit ??
        data.limiteUsuarios ??
        data.maxUsers
    ) ?? null;
  const processLimit =
    parseInteger(
      data.max_casos ??
        data.maxCases ??
        data.limite_processos ??
        data.processLimit ??
        data.maxProcessos
    ) ?? null;
  const proposalLimit =
    parseInteger(
      data.limite_propostas ??
        data.proposalLimit ??
        data.max_propostas ??
        data.maxPropostas ??
        data.propostasLimit
    ) ?? null;

  const processSyncEnabled = parseBoolean(
    data.sincronizacao_processos_habilitada ??
      data.processSyncEnabled ??
      data.syncProcessos ??
      data.processoSincronizacaoAtiva
  );
  const processSyncQuota =
    parseInteger(
      data.sincronizacao_processos_cota ??
        data.processSyncQuota ??
        data.quotaSincronizacaoProcessos ??
        data.processSyncLimit
    ) ?? null;

  return {
    id,
    name,
    monthlyPrice: parsePrice(
      data.valor_mensal ??
        data.valorMensal ??
        data.preco_mensal ??
        data.priceMonthly ??
        data.valor ??
        data.price ??
        data.preco
    ),
    annualPrice: parsePrice(
      data.valor_anual ??
        data.valorAnual ??
        data.preco_anual ??
        data.priceYearly ??
        data.priceAnnual ??
        data.valor_anualidade ??
        ""
    ),
    modules,
    userLimit,
    processLimit,
    proposalLimit,
    processSyncEnabled,
    processSyncQuota,
  } satisfies Plan;
};

export const formatLimit = (value: number | null): string => {
  if (value == null) return "—";
  return value.toString();
};

export const sanitizeLimitInput = (value: string): string => {
  if (!value) return "";
  return value.replace(/[^0-9]/g, "");
};

const DIGIT_ONLY_REGEX = /\D+/g;

const BRAZILIAN_CURRENCY_FORMATTER = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export const extractCurrencyDigits = (value: string): string => value.replace(DIGIT_ONLY_REGEX, "");

export const formatCurrencyInputValue = (digits: string): string => {
  if (!digits) {
    return "";
  }

  const parsed = Number.parseInt(digits, 10);
  if (Number.isNaN(parsed)) {
    return "";
  }

  return BRAZILIAN_CURRENCY_FORMATTER.format(parsed / 100);
};

export const parseCurrencyDigits = (digits: string): number | null => {
  if (!digits) {
    return null;
  }

  const parsed = Number.parseInt(digits, 10);
  if (Number.isNaN(parsed)) {
    return null;
  }

  return parsed / 100;
};

export const orderModules = (modules: string[], available: ModuleInfo[]): string[] => {
  if (modules.length <= 1 || available.length === 0) return [...modules];
  const index = new Map<string, number>();
  available.forEach((module, position) => {
    index.set(module.id, position);
  });
  return [...modules].sort((a, b) => {
    const indexA = index.get(a);
    const indexB = index.get(b);
    if (indexA == null && indexB == null) return a.localeCompare(b);
    if (indexA == null) return 1;
    if (indexB == null) return -1;
    if (indexA === indexB) return a.localeCompare(b);
    return indexA - indexB;
  });
};

export const parseModuleInfo = (entry: unknown): ModuleInfo | null => {
  if (!entry || typeof entry !== "object") return null;
  const data = entry as Record<string, unknown>;
  const id = typeof data.id === "string" ? data.id : null;
  const nome = typeof data.nome === "string" ? data.nome : null;
  if (!id || !nome) return null;
  return {
    id,
    nome,
    descricao: typeof data.descricao === "string" ? data.descricao : undefined,
    categoria: typeof data.categoria === "string" ? data.categoria : undefined,
  } satisfies ModuleInfo;
};
