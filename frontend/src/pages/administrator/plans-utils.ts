export interface ModuleInfo {
  id: string;
  nome: string;
  descricao?: string;
  categoria?: string;
}

const STATIC_MODULES: ModuleInfo[] = [
  {
    id: "arquivos",
    nome: "Meus Arquivos",
  },
];

export const ensureDefaultModules = (modules: ModuleInfo[]): ModuleInfo[] => {
  if (modules.length === 0) {
    return [...STATIC_MODULES];
  }

  const knownIds = new Set(modules.map((module) => module.id));
  const augmented = [...modules];

  STATIC_MODULES.forEach((module) => {
    if (!knownIds.has(module.id)) {
      augmented.push(module);
    }
  });

  return augmented;
};

export interface Plan {
  id: number;
  name: string;
  monthlyPrice: string;
  annualPrice: string;
  modules: string[];
  customAvailableFeatures: string[];
  customUnavailableFeatures: string[];
  clientLimit: number | null;
  userLimit: number | null;
  processLimit: number | null;
  proposalLimit: number | null;
  processSyncEnabled: boolean;
  processSyncQuota: number | null;
  publicConsultationModules: string[];
  intimationSyncEnabled: boolean;
  intimationSyncQuota: number | null;
  processMonitorLawyerLimit: number | null;
  intimationMonitorLawyerLimit: number | null;
}

export type PlanFormState = {
  name: string;
  monthlyPrice: string;
  annualPrice: string;
  modules: string[];
  customAvailableFeatures: string;
  customUnavailableFeatures: string;
  clientLimit: string;
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
  customAvailableFeatures: "",
  customUnavailableFeatures: "",
  clientLimit: "",
  userLimit: "",
  processLimit: "",
  proposalLimit: "",
  processSyncEnabled: false,
  processSyncQuota: "",
};

const FEATURE_SEPARATOR_REGEX = /[,;\n]+/;

const normalizeFeatureList = (entries: string[]): string[] => {
  const seen = new Set<string>();
  entries.forEach((entry) => {
    const trimmed = entry.trim();
    if (!trimmed) {
      return;
    }
    if (!seen.has(trimmed)) {
      seen.add(trimmed);
    }
  });
  return Array.from(seen);
};

const collectFeatureStrings = (value: unknown): string[] => {
  const seen = new Set<unknown>();

  const walk = (input: unknown): string[] => {
    if (input === null || input === undefined) {
      return [];
    }

    if (typeof input === "string") {
      return input
        .split(FEATURE_SEPARATOR_REGEX)
        .map((item) => item.trim())
        .filter(Boolean);
    }

    if (typeof input === "number" || typeof input === "boolean") {
      const normalized = String(input).trim();
      return normalized ? [normalized] : [];
    }

    if (Array.isArray(input)) {
      return input.flatMap((item) => walk(item));
    }

    if (typeof input === "object") {
      if (seen.has(input)) {
        return [];
      }
      seen.add(input);
      return Object.values(input as Record<string, unknown>).flatMap((item) => walk(item));
    }

    return [];
  };

  return walk(value);
};

const parseCustomResources = (
  value: unknown,
): { available: string[]; unavailable: string[] } => {
  if (!value) {
    return { available: [], unavailable: [] };
  }

  if (typeof value !== "object" || Array.isArray(value)) {
    return { available: normalizeFeatureList(collectFeatureStrings(value)), unavailable: [] };
  }

  const source = value as Record<string, unknown>;

  const availableCandidates: unknown[] = [
    source.disponiveis,
    source.disponiveisPersonalizados,
    source.available,
    source.availableFeatures,
    source.inclusos,
    source.incluidos,
    source.recursosDisponiveis,
    source.recursos_disponiveis,
  ];

  const unavailableCandidates: unknown[] = [
    source.indisponiveis,
    source.indisponiveisPersonalizados,
    source.naoDisponiveis,
    source.nao_disponiveis,
    source.notAvailable,
    source.excluidos,
    source.excludedFeatures,
    source.recursosIndisponiveis,
    source.recursos_indisponiveis,
  ];

  const available = normalizeFeatureList(
    availableCandidates.flatMap((entry) => collectFeatureStrings(entry)),
  );
  const unavailable = normalizeFeatureList(
    unavailableCandidates.flatMap((entry) => collectFeatureStrings(entry)),
  );

  if (available.length || unavailable.length) {
    return { available, unavailable };
  }

  return { available: normalizeFeatureList(collectFeatureStrings(value)), unavailable: [] };
};

export const splitFeatureInput = (value: string): string[] => {
  if (!value) {
    return [];
  }
  return value
    .split(FEATURE_SEPARATOR_REGEX)
    .map((item) => item.trim())
    .filter(Boolean);
};

export const buildRecursosPayload = ({
  modules,
  customAvailable,
  customUnavailable,
}: {
  modules: string[];
  customAvailable: string[];
  customUnavailable: string[];
}): unknown => {
  const normalizedModules = normalizeFeatureList(modules);
  const normalizedAvailable = normalizeFeatureList(customAvailable);
  const normalizedUnavailable = normalizeFeatureList(customUnavailable);
  const combinedFeatures = normalizeFeatureList([
    ...normalizedModules,
    ...normalizedAvailable,
  ]);

  const shouldReturnArray =
    normalizedUnavailable.length === 0 &&
    normalizedAvailable.length === 0 &&
    combinedFeatures.length === normalizedModules.length &&
    combinedFeatures.every((item, index) => item === normalizedModules[index]);

  if (shouldReturnArray) {
    return normalizedModules;
  }

  const payload: Record<string, unknown> = {};

  if (normalizedModules.length) {
    payload.modules = normalizedModules;
    payload.modulos = normalizedModules;
  }

  if (combinedFeatures.length) {
    payload.features = combinedFeatures;
    payload.recursos = combinedFeatures;
    payload.items = combinedFeatures;
    payload.lista = combinedFeatures;
  }

  if (normalizedAvailable.length || normalizedUnavailable.length) {
    payload.recursos_personalizados = {
      disponiveis: normalizedAvailable,
      indisponiveis: normalizedUnavailable,
    };
  }

  return payload;
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

  const customResources = parseCustomResources(
    data.recursos_personalizados ??
      data.recursosPersonalizados ??
      data.customResources ??
      data.personalizados ??
      null,
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
  const clientLimit =
    parseInteger(
      data.limite_clientes ??
        data.clientLimit ??
        data.clienteLimit ??
        data.client_limit ??
        data.clientes_limit ??
        data.limiteClientes ??
        data.max_clientes ??
        data.maxClientes ??
        data.clientesMax ??
        data.clientsLimit
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
        data.sincronizacao_processos_limite ??
        data.processSyncQuota ??
        data.quotaSincronizacaoProcessos ??
        data.sincronizacaoProcessosLimite ??
        data.processSyncLimit ??
        data.processSyncLimit
    ) ?? null;

  const publicConsultationModules = normalizeModuleIds(
    data.consulta_publica_modulos ??
      data.consultaPublicaModulos ??
      data.publicConsultationModules ??
      data.recursos_consulta_publica ??
      []
  );

  const intimationSyncEnabled = parseBoolean(
    data.sincronizacao_intimacoes_habilitada ??
      data.sincronizacaoIntimacoesHabilitada ??
      data.intimationSyncEnabled ??
      data.syncIntimacoes ??
      data.intimacaoSincronizacaoAtiva
  );

  const intimationSyncQuota =
    parseInteger(
      data.sincronizacao_intimacoes_limite ??
        data.sincronizacao_intimacoes_cota ??
        data.sincronizacaoIntimacoesLimite ??
        data.sincronizacaoIntimacoesCota ??
        data.intimationSyncLimit ??
        data.intimationSyncQuota ??
        data.quotaSincronizacaoIntimacoes
    ) ?? null;

  const processMonitorLawyerLimit =
    parseInteger(
      data.limite_advogados_processos ??
        data.limiteAdvogadosProcessos ??
        data.limite_advogados_processos_monitorados ??
        data.processMonitorLawyerLimit ??
        data.processosAdvogadosLimite
    ) ?? null;

  const intimationMonitorLawyerLimit =
    parseInteger(
      data.limite_advogados_intimacoes ??
        data.limiteAdvogadosIntimacoes ??
        data.limite_advogados_intimacoes_monitoradas ??
        data.intimationMonitorLawyerLimit ??
        data.intimacoesAdvogadosLimite
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
    customAvailableFeatures: customResources.available,
    customUnavailableFeatures: customResources.unavailable,
    clientLimit,
    userLimit,
    processLimit,
    proposalLimit,
    processSyncEnabled,
    processSyncQuota,
    publicConsultationModules,
    intimationSyncEnabled,
    intimationSyncQuota,
    processMonitorLawyerLimit,
    intimationMonitorLawyerLimit,
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
