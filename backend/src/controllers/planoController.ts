import { Request, Response } from 'express';
import { normalizeModuleId, sanitizeModuleIds, sortModules } from '../constants/modules';
import pool from '../services/db';

type PlanoRow = {
  id: number;
  nome: string;
  valor_mensal: number | string | null;
  valor_anual: number | string | null;
  ativo: boolean | number | string | null;
  datacadastro: Date | string | null;
  modulos: unknown;
  recursos: unknown;
  limite_processos: number | string | null;
  limite_usuarios: number | string | null;
  limite_propostas: number | string | null;
  limite_clientes: number | string | null;
  sincronizacao_processos_habilitada: boolean | number | string | null;
  sincronizacao_processos_cota: number | string | null;
};


type PlanoResponseRow = Omit<
  PlanoRow,
  |
    'recursos'
    | 'modulos'
    | 'limite_processos'
    | 'limite_usuarios'
    | 'limite_propostas'
    | 'limite_clientes'
    | 'sincronizacao_processos_habilitada'
    | 'sincronizacao_processos_cota'
    | 'ativo'

> & {
  recursos: string[];
  modulos: string[];
  limite_processos: number | null;
  limite_usuarios: number | null;
  limite_propostas: number | null;
  limite_clientes: number | null;
  sincronizacao_processos_habilitada: boolean;
  sincronizacao_processos_cota: number | null;
  ativo: boolean;
  recursos_personalizados: {
    disponiveis: string[];
    indisponiveis: string[];
  };
};

const parseBooleanFlag = (value: unknown): boolean | null => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return null;
    }

    return value !== 0;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      return null;
    }

    if (
      [
        '1',
        'true',
        't',
        'yes',
        'y',
        'sim',
        'on',
        'habilitado',
        'habilitada',
        'ativo',
        'ativa',
      ].includes(normalized)
    ) {
      return true;
    }

    if (
      [
        '0',
        'false',
        'f',
        'no',
        'n',
        'nao',
        'não',
        'off',
        'desabilitado',
        'desabilitada',
        'inativo',
        'inativa',
      ].includes(normalized)
    ) {
      return false;
    }
  }

  return null;
};

const parseNullableInteger = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const normalized = Math.trunc(value);
    return normalized >= 0 ? normalized : null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const parsed = Number.parseInt(trimmed, 10);
    if (Number.isFinite(parsed)) {
      const normalized = Math.trunc(parsed);
      return normalized >= 0 ? normalized : null;
    }
  }

  return null;

};

type RecursosDetails = {
  recursos: string[];
  modules: string[];
  customAvailable: string[];
  customUnavailable: string[];
  limiteProcessos: number | null;
  limiteUsuarios: number | null;
  limitePropostas: number | null;
  limiteClientes: number | null;
  sincronizacaoProcessosHabilitada: boolean | null;
  sincronizacaoProcessosCota: number | null;
};

const FEATURE_KEYS = [
  'features',
  'recursos',
  'items',
  'itens',
  'lista',
  'listaRecursos',
  'lista_recursos',
  'values',
  'value',
  'feature',
  'recurso',
] as const;

const CUSTOM_RESOURCE_KEYS = [
  'recursos_personalizados',
  'customResources',
  'personalizados',
] as const;

const CUSTOM_AVAILABLE_KEYS = [
  'disponiveis',
  'disponiveisPersonalizados',
  'available',
  'included',
  'inclusos',
  'incluidos',
  'availableFeatures',
] as const;

const CUSTOM_UNAVAILABLE_KEYS = [
  'indisponiveis',
  'indisponiveisPersonalizados',
  'naoDisponiveis',
  'nao_disponiveis',
  'notAvailable',
  'excluded',
  'excludedFeatures',
] as const;

const MODULE_KEYS = [
  'modules',
  'modulos',
  'moduleIds',
  'listaModulos',
  'lista_modulos',
] as const;

const LIMIT_PROCESS_KEYS = [
  'limite_processos',
  'limiteProcessos',
  'processLimit',
  'maxCases',
  'max_casos',
  'maxProcessos',
  'max_processos',
  'processos',
] as const;

const LIMIT_USER_KEYS = [
  'limite_usuarios',
  'limiteUsuarios',
  'userLimit',
  'usuarios',
  'qtde_usuarios',
  'maxUsers',
] as const;

const LIMIT_PROPOSAL_KEYS = [
  'limite_propostas',
  'limitePropostas',
  'proposalLimit',
  'max_propostas',
  'maxPropostas',
  'propostas',
] as const;
const LIMIT_CLIENT_KEYS = [
  'limite_clientes',
  'limiteClientes',
  'clientLimit',
  'clientes',
  'maxClientes',
] as const;

const SYNC_ENABLED_KEYS = [
  'sincronizacao_processos_habilitada',
  'sincronizacaoProcessosHabilitada',
  'processSyncEnabled',
  'syncProcessos',
] as const;

const SYNC_QUOTA_KEYS = [
  'sincronizacao_processos_cota',
  'sincronizacaoProcessosCota',
  'processSyncQuota',
  'sincronizacao_processos_limite',
  'processSyncLimit',
] as const;

const BODY_MODULE_KEYS = ['modulos', 'modules'] as const;
const BODY_RECURSOS_KEYS = [
  'recursos',
  'features',
  'items',
  'lista',
  'listaRecursos',
  'lista_recursos',
] as const;
const BODY_VALOR_MENSAL_KEYS = ['valor_mensal', 'valorMensal', 'valor'] as const;
const BODY_VALOR_ANUAL_KEYS = ['valor_anual', 'valorAnual', 'valor_anualidade'] as const;
const BODY_LIMITE_PROCESSOS_KEYS = [
  'limite_processos',
  'limiteProcessos',
  'processLimit',
  'max_casos',
  'maxCases',
  'maxProcessos',
] as const;
const BODY_LIMITE_USUARIOS_KEYS = [
  'limite_usuarios',
  'limiteUsuarios',
  'userLimit',
  'qtde_usuarios',
  'maxUsers',
] as const;
const BODY_LIMITE_PROPOSTAS_KEYS = [
  'limite_propostas',
  'limitePropostas',
  'proposalLimit',
  'max_propostas',
  'maxPropostas',
] as const;
const BODY_LIMITE_CLIENTES_KEYS = [
  'limite_clientes',
  'limiteClientes',
  'clientLimit',
  'maxClientes',
] as const;
const BODY_SYNC_ENABLED_KEYS = [
  'sincronizacao_processos_habilitada',
  'sincronizacaoProcessosHabilitada',
  'processSyncEnabled',
  'syncProcessos',
] as const;
const BODY_SYNC_QUOTA_KEYS = [
  'sincronizacao_processos_cota',
  'sincronizacaoProcessosCota',
  'processSyncQuota',
  'sincronizacao_processos_limite',
  'processSyncLimit',
] as const;
const BODY_ATIVO_KEYS = ['ativo', 'isActive'] as const;

const toInteger = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const normalized = Number(trimmed.replace(/[^\d-]/g, ''));
    if (Number.isFinite(normalized)) {
      return Math.trunc(normalized);
    }
  }

  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }

  return null;
};

const toBoolean = (value: unknown): boolean | null => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    if (value === 1) {
      return true;
    }

    if (value === 0) {
      return false;
    }

    return null;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();

    if (!normalized) {
      return null;
    }

    if (['true', '1', 'sim', 'yes', 'on'].includes(normalized)) {
      return true;
    }

    if (['false', '0', 'nao', 'não', 'no', 'off'].includes(normalized)) {
      return false;
    }
  }

  return null;
};

const parseBooleanOrDefault = (
  value: unknown,
  fieldName: string,
  fallback: boolean
): boolean => {
  if (value === undefined) {
    return fallback;
  }

  if (value === null) {
    return false;
  }

  const parsed = toBoolean(value);
  if (parsed === null) {
    throw new Error(`${fieldName} deve ser um booleano válido`);
  }

  return parsed;
};

const pickFirstDefined = (
  source: Record<string, unknown>,
  keys: readonly string[]
): { value: unknown; provided: boolean } => {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      return { value: source[key], provided: true };
    }
  }

  return { value: undefined, provided: false };
};

const parseOptionalIntegerOrDefault = (
  value: unknown,
  fieldName: string,
  fallback: number | null
): number | null => {
  if (value === undefined) {
    return fallback;
  }

  if (value === null) {
    return null;
  }

  if (typeof value === 'string' && !value.trim()) {
    return null;
  }

  const parsed = toInteger(value);
  if (parsed === null) {
    throw new Error(`${fieldName} deve ser um número inteiro válido`);
  }

  return parsed;
};

const parseDecimalValue = (
  value: unknown,
  fieldName: string
): number | string | null => {
  if (value === undefined) {
    return null;
  }

  if (value === null) {
    return null;
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error(`${fieldName} deve ser um número válido`);
    }
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    if (!Number.isNaN(Number(trimmed))) {
      const parsed = Number(trimmed);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }

    const withoutSpaces = trimmed.replace(/\s+/g, '');
    if (withoutSpaces.includes(',')) {
      const normalized = withoutSpaces
        .split('.')
        .join('')
        .replace(/,/g, '.');
      const parsed = Number(normalized);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }

    const normalized = Number(withoutSpaces);
    if (Number.isFinite(normalized)) {
      return normalized;
    }

    throw new Error(`${fieldName} deve ser um número válido`);
  }

  throw new Error(`${fieldName} deve ser um número válido`);
};

const parseModulesOrDefault = (
  value: unknown,
  fallback: string[],
  fallbackWasNull: boolean
): string[] => {
  if (value === undefined) {
    return fallbackWasNull ? [] : fallback;
  }

  if (value === null) {
    return [];
  }

  try {
    return sanitizeModuleIds(value);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    }

    throw new Error('modulos inválidos');
  }
};

const parseRecursosDetails = (value: unknown): RecursosDetails => {
  const featureSet = new Set<string>();
  const moduleSet = new Set<string>();
  const customAvailableSet = new Set<string>();
  const customUnavailableSet = new Set<string>();
  let limiteProcessos: number | null = null;
  let limiteUsuarios: number | null = null;
  let limitePropostas: number | null = null;
  let limiteClientes: number | null = null;
  let sincronizacaoProcessosHabilitada: boolean | null = null;
  let sincronizacaoProcessosCota: number | null = null;
  const visited = new Set<unknown>();

  const pushFeature = (entry: unknown) => {
    if (entry === null || entry === undefined) {
      return;
    }

    if (typeof entry === 'string') {
      const trimmed = entry.trim();
      if (!trimmed) {
        return;
      }
      featureSet.add(trimmed);
      const normalizedModule = normalizeModuleId(trimmed);
      if (normalizedModule) {
        moduleSet.add(normalizedModule);
      }
      return;
    }

    if (typeof entry === 'number' || typeof entry === 'boolean') {
      featureSet.add(String(entry));
    }
  };

  const collectCustomEntries = (
    input: unknown,
    target: Set<string>,
    { includeInFeatures }: { includeInFeatures: boolean },
  ) => {
    const localVisited = new Set<unknown>();

    const register = (entry: string) => {
      const trimmed = entry.trim();
      if (!trimmed) {
        return;
      }
      target.add(trimmed);
      if (includeInFeatures) {
        featureSet.add(trimmed);
        const normalizedModule = normalizeModuleId(trimmed);
        if (normalizedModule) {
          moduleSet.add(normalizedModule);
        }
      }
    };

    const walk = (current: unknown) => {
      if (current === null || current === undefined) {
        return;
      }

      if (typeof current === 'string') {
        current
          .split(/[\n;,]+/)
          .map((item) => item.trim())
          .filter(Boolean)
          .forEach((item) => register(item));
        return;
      }

      if (typeof current === 'number' || typeof current === 'boolean') {
        register(String(current));
        return;
      }

      if (Array.isArray(current)) {
        current.forEach((item) => walk(item));
        return;
      }

      if (typeof current === 'object') {
        if (localVisited.has(current)) {
          return;
        }
        localVisited.add(current);
        Object.values(current as Record<string, unknown>).forEach((item) => walk(item));
      }
    };

    walk(input);
  };

  const moduleKeySet = new Set<string>(MODULE_KEYS);
  const featureKeySet = new Set<string>(FEATURE_KEYS);
  const limitProcessKeySet = new Set<string>(LIMIT_PROCESS_KEYS);
  const limitUserKeySet = new Set<string>(LIMIT_USER_KEYS);
  const limitProposalKeySet = new Set<string>(LIMIT_PROPOSAL_KEYS);
  const limitClientKeySet = new Set<string>(LIMIT_CLIENT_KEYS);
  const syncEnabledKeySet = new Set<string>(SYNC_ENABLED_KEYS);
  const syncQuotaKeySet = new Set<string>(SYNC_QUOTA_KEYS);
  const customResourceKeySet = new Set<string>(CUSTOM_RESOURCE_KEYS);

  const visit = (input: unknown): void => {
    if (input === null || input === undefined) {
      return;
    }

    if (typeof input === 'string') {
      const trimmed = input.trim();
      if (!trimmed) {
        return;
      }

      try {
        const parsed = JSON.parse(trimmed);
        visit(parsed);
        return;
      } catch {
        // Ignored – fallback to splitting by common separators
      }

      trimmed
        .split(/[\n;,]+/)
        .map((item) => item.trim())
        .filter(Boolean)
        .forEach((item) => pushFeature(item));

      return;
    }

    if (typeof input === 'number' || typeof input === 'boolean') {
      pushFeature(input);
      return;
    }

    if (Array.isArray(input)) {
      input.forEach((item) => {
        if (typeof item === 'string') {
          pushFeature(item);
          return;
        }

        if (item && typeof item === 'object') {
          const candidateId = (item as { id?: unknown }).id;
          if (typeof candidateId === 'string') {
            pushFeature(candidateId);
          }
        }

        visit(item);
      });
      return;
    }

    if (typeof input === 'object') {
      if (visited.has(input)) {
        return;
      }
      visited.add(input);

      const obj = input as Record<string, unknown>;

      CUSTOM_RESOURCE_KEYS.forEach((key) => {
        if (!Object.prototype.hasOwnProperty.call(obj, key)) {
          return;
        }
        const entry = obj[key];
        if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
          const customObj = entry as Record<string, unknown>;
          CUSTOM_AVAILABLE_KEYS.forEach((availableKey) => {
            if (Object.prototype.hasOwnProperty.call(customObj, availableKey)) {
              collectCustomEntries(customObj[availableKey], customAvailableSet, {
                includeInFeatures: true,
              });
            }
          });
          CUSTOM_UNAVAILABLE_KEYS.forEach((unavailableKey) => {
            if (Object.prototype.hasOwnProperty.call(customObj, unavailableKey)) {
              collectCustomEntries(customObj[unavailableKey], customUnavailableSet, {
                includeInFeatures: false,
              });
            }
          });
        } else {
          collectCustomEntries(entry, customAvailableSet, { includeInFeatures: true });
        }
      });

      MODULE_KEYS.forEach((key) => {
        if (key in obj) {
          visit(obj[key]);
        }
      });

      FEATURE_KEYS.forEach((key) => {
        if (key in obj) {
          visit(obj[key]);
        }
      });

      for (const key of LIMIT_PROCESS_KEYS) {
        if (key in obj && limiteProcessos === null) {
          const parsed = toInteger(obj[key]);
          if (parsed !== null) {
            limiteProcessos = parsed;
            break;
          }
        }
      }

      for (const key of LIMIT_USER_KEYS) {
        if (key in obj && limiteUsuarios === null) {
          const parsed = toInteger(obj[key]);
          if (parsed !== null) {
            limiteUsuarios = parsed;
            break;
          }
        }
      }

      for (const key of LIMIT_PROPOSAL_KEYS) {
        if (key in obj && limitePropostas === null) {
          const parsed = toInteger(obj[key]);
          if (parsed !== null) {
            limitePropostas = parsed;
            break;
          }
        }
      }

      for (const key of LIMIT_CLIENT_KEYS) {
        if (key in obj && limiteClientes === null) {
          const parsed = toInteger(obj[key]);
          if (parsed !== null) {
            limiteClientes = parsed;
            break;
          }
        }
      }

      for (const key of SYNC_ENABLED_KEYS) {
        if (key in obj && sincronizacaoProcessosHabilitada === null) {
          const parsed = parseBooleanFlag(obj[key]);
          if (parsed !== null) {
            sincronizacaoProcessosHabilitada = parsed;
            break;
          }
        }
      }

      for (const key of SYNC_QUOTA_KEYS) {
        if (key in obj && sincronizacaoProcessosCota === null) {
          const parsed = parseNullableInteger(obj[key]);
          if (parsed !== null) {
            sincronizacaoProcessosCota = parsed;
            break;
          }
        }
      }

      Object.entries(obj).forEach(([key, item]) => {
        if (customResourceKeySet.has(key)) {
          return;
        }
        if (moduleKeySet.has(key) || featureKeySet.has(key)) {
          return;
        }
        if (
          limitProcessKeySet.has(key) ||
          limitUserKeySet.has(key) ||
          limitProposalKeySet.has(key) ||
          limitClientKeySet.has(key)
        ) {
          return;
        }
        if (syncEnabledKeySet.has(key) || syncQuotaKeySet.has(key)) {
          return;
        }
        visit(item);
      });
    }
  };

  visit(value);

  const modules = moduleSet.size ? sortModules(Array.from(moduleSet)) : [];
  const recursos = Array.from(featureSet);

  return {
    recursos,
    modules,
    customAvailable: Array.from(customAvailableSet),
    customUnavailable: Array.from(customUnavailableSet),
    limiteProcessos,
    limiteUsuarios,
    limitePropostas,
    limiteClientes,
    sincronizacaoProcessosHabilitada,
    sincronizacaoProcessosCota,
  };
};

const prepareRecursosForStorage = ({
  recursosInput,
  modules,
  limits,
  fallback = null,
}: {
  recursosInput: unknown;
  modules: string[];
  limits: {
    limiteProcessos: number | null;
    limiteUsuarios: number | null;
    limitePropostas: number | null;
    limiteClientes: number | null;
    sincronizacaoProcessosHabilitada: boolean;
    sincronizacaoProcessosCota: number | null;
  };
  fallback?: RecursosDetails | null;
}): string | null => {
  const fallbackDetails: RecursosDetails =
    fallback ?? {
      recursos: [],
      modules: [],
      customAvailable: [],
      customUnavailable: [],
      limiteProcessos: null,
      limiteUsuarios: null,
      limitePropostas: null,
      limiteClientes: null,
      sincronizacaoProcessosHabilitada: null,
      sincronizacaoProcessosCota: null,
    };

  let featureList: string[];
  let customAvailableList: string[];
  let customUnavailableList: string[];
  if (recursosInput === undefined) {
    featureList = fallbackDetails.recursos;
    customAvailableList = fallbackDetails.customAvailable;
    customUnavailableList = fallbackDetails.customUnavailable;
  } else if (recursosInput === null) {
    featureList = [];
    customAvailableList = [];
    customUnavailableList = [];
  } else {
    const parsed = parseRecursosDetails(recursosInput);
    featureList = parsed.recursos;
    customAvailableList = parsed.customAvailable;
    customUnavailableList = parsed.customUnavailable;
  }

  const featureSet = new Set(
    featureList
      .map((feature) => (typeof feature === 'string' ? feature.trim() : ''))
      .filter((feature): feature is string => Boolean(feature))
  );

  modules.forEach((moduleId) => {
    if (moduleId) {
      featureSet.add(moduleId);
    }
  });

  const customAvailableNormalized = Array.from(
    new Set(
      customAvailableList
        .map((feature) => (typeof feature === 'string' ? feature.trim() : ''))
        .filter((feature): feature is string => Boolean(feature))
    )
  );

  const customUnavailableNormalized = Array.from(
    new Set(
      customUnavailableList
        .map((feature) => (typeof feature === 'string' ? feature.trim() : ''))
        .filter((feature): feature is string => Boolean(feature))
    )
  );

  const normalizedFeatures = Array.from(featureSet);
  const uniqueModules = modules.length
    ? sortModules(Array.from(new Set(modules)))
    : [];

  const payload: Record<string, unknown> = {};

  if (uniqueModules.length) {
    payload.modules = uniqueModules;
    payload.modulos = uniqueModules;
  }

  if (normalizedFeatures.length) {
    payload.features = normalizedFeatures;
    payload.recursos = normalizedFeatures;
    payload.items = normalizedFeatures;
    payload.lista = normalizedFeatures;
  }

  if (customAvailableNormalized.length || customUnavailableNormalized.length) {
    payload.recursos_personalizados = {
      disponiveis: customAvailableNormalized,
      indisponiveis: customUnavailableNormalized,
    };
  }

  const limitsPayload: Record<string, unknown> = {};
  if (limits.limiteUsuarios != null) {
    limitsPayload.usuarios = limits.limiteUsuarios;
    limitsPayload.limiteUsuarios = limits.limiteUsuarios;
  }

  if (limits.limiteProcessos != null) {
    limitsPayload.processos = limits.limiteProcessos;
    limitsPayload.limiteProcessos = limits.limiteProcessos;
    payload.maxCases = limits.limiteProcessos;
    payload.max_casos = limits.limiteProcessos;
  }

  if (limits.limitePropostas != null) {
    limitsPayload.propostas = limits.limitePropostas;
    limitsPayload.limitePropostas = limits.limitePropostas;
  }

  if (limits.limiteClientes != null) {
    limitsPayload.clientes = limits.limiteClientes;
    limitsPayload.limiteClientes = limits.limiteClientes;
  }

  if (Object.keys(limitsPayload).length) {
    payload.limites = limitsPayload;
  }

  payload.sincronizacao_processos_habilitada = limits.sincronizacaoProcessosHabilitada;
  payload.sincronizacaoProcessosHabilitada = limits.sincronizacaoProcessosHabilitada;

  if (limits.sincronizacaoProcessosCota != null) {
    payload.sincronizacao_processos_cota = limits.sincronizacaoProcessosCota;
    payload.sincronizacaoProcessosCota = limits.sincronizacaoProcessosCota;
  }

  if (
    !uniqueModules.length &&
    !normalizedFeatures.length &&
    Object.keys(limitsPayload).length === 0 &&
    !limits.sincronizacaoProcessosHabilitada &&
    limits.sincronizacaoProcessosCota == null &&
    customAvailableNormalized.length === 0 &&
    customUnavailableNormalized.length === 0
  ) {
    return null;
  }

  return JSON.stringify(payload);
};

const parseModulesCollection = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    try {
      return sortModules(sanitizeModuleIds(value));
    } catch {
      return [];
    }
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return [];
    }

    try {
      const parsed = JSON.parse(trimmed);
      return parseModulesCollection(parsed);
    } catch {
      return parseRecursosDetails(trimmed).modules;
    }
  }

  if (value && typeof value === 'object') {
    return parseRecursosDetails(value).modules;
  }

  return [];
};

const formatPlanoRow = (row: PlanoRow): PlanoResponseRow => {
  const recursosDetalhes = parseRecursosDetails(row.recursos);
  const modulesFromColumn = parseModulesCollection(row.modulos);
  const modules = modulesFromColumn.length
    ? modulesFromColumn
    : recursosDetalhes.modules;

  const recursos = recursosDetalhes.recursos.length
    ? recursosDetalhes.recursos
    : modules;

  const customResources = {
    disponiveis: recursosDetalhes.customAvailable,
    indisponiveis: recursosDetalhes.customUnavailable,
  };

  const limiteProcessos =
    parseNullableInteger(row.limite_processos) ??
    recursosDetalhes.limiteProcessos ??
    null;
  const limiteUsuarios =
    parseNullableInteger(row.limite_usuarios) ??
    recursosDetalhes.limiteUsuarios ??
    null;
  const limitePropostas =
    parseNullableInteger(row.limite_propostas) ??
    recursosDetalhes.limitePropostas ??
    null;
  const limiteClientes =
    parseNullableInteger(row.limite_clientes) ??
    recursosDetalhes.limiteClientes ??
    null;

  const sincronizacaoProcessosHabilitada =
    parseBooleanFlag(row.sincronizacao_processos_habilitada) ??
    recursosDetalhes.sincronizacaoProcessosHabilitada ??
    false;
  const sincronizacaoProcessosCota =
    parseNullableInteger(row.sincronizacao_processos_cota) ??
    recursosDetalhes.sincronizacaoProcessosCota ??
    null;

  const valorMensal =
    typeof row.valor_mensal === 'number' || typeof row.valor_mensal === 'string'
      ? row.valor_mensal
      : null;
  const valorAnual =
    typeof row.valor_anual === 'number' || typeof row.valor_anual === 'string'
      ? row.valor_anual
      : null;

  const ativo = parseBooleanFlag(row.ativo) ?? true;

  return {
    id: row.id,
    nome: row.nome,
    valor_mensal: valorMensal,
    valor_anual: valorAnual,
    ativo,
    datacadastro: row.datacadastro ?? null,
    recursos,
    modulos: modules,
    limite_processos: limiteProcessos,
    limite_usuarios: limiteUsuarios,
    limite_propostas: limitePropostas,
    limite_clientes: limiteClientes,
    sincronizacao_processos_habilitada: sincronizacaoProcessosHabilitada,
    sincronizacao_processos_cota: sincronizacaoProcessosCota,
    recursos_personalizados: customResources,
  };
};

export const listPlanos = async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT id, nome, valor_mensal, valor_anual, ativo, datacadastro, modulos, recursos, limite_processos, limite_usuarios, limite_propostas, limite_clientes, sincronizacao_processos_habilitada, sincronizacao_processos_cota FROM public.planos'

    );
    const formatted = result.rows.map((row) => formatPlanoRow(row as PlanoRow));
    res.json(formatted);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createPlano = async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as Record<string, unknown>;

  const nome = typeof body.nome === 'string' ? body.nome.trim() : '';
  if (!nome) {
    return res.status(400).json({ error: 'nome é obrigatório' });
  }


  const valorMensalEntry = pickFirstDefined(body, BODY_VALOR_MENSAL_KEYS);
  let valorMensal: number | string | null;
  try {
    valorMensal = parseDecimalValue(valorMensalEntry.value, 'valor_mensal');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'valor_mensal inválido';
    return res.status(400).json({ error: message });
  }

  if (!valorMensalEntry.provided || valorMensal === null) {
    return res.status(400).json({ error: 'valor_mensal é obrigatório' });
  }

  const valorAnualEntry = pickFirstDefined(body, BODY_VALOR_ANUAL_KEYS);
  let valorAnual: number | string | null;
  try {
    valorAnual = parseDecimalValue(valorAnualEntry.value, 'valor_anual');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'valor_anual inválido';
    return res.status(400).json({ error: message });
  }

  if (!valorAnualEntry.provided || valorAnual === null) {
    return res.status(400).json({ error: 'valor_anual é obrigatório' });
  }

  const ativoEntry = pickFirstDefined(body, BODY_ATIVO_KEYS);
  let ativoValue: boolean;
  try {
    ativoValue = parseBooleanOrDefault(ativoEntry.value, 'ativo', true);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'ativo inválido';
    return res.status(400).json({ error: message });
  }

  const recursosEntry = pickFirstDefined(body, BODY_RECURSOS_KEYS);
  const modulosEntry = pickFirstDefined(body, BODY_MODULE_KEYS);

  let modules: string[];
  try {
    modules = parseModulesOrDefault(modulosEntry.value, [], false);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'modulos inválidos';
    return res.status(400).json({ error: message });
  }

  if (!modules.length) {
    const recursosModules = recursosEntry.provided
      ? parseRecursosDetails(recursosEntry.value).modules
      : [];
    if (recursosModules.length) {
      modules = recursosModules;
    }
  }

  if (modules.length) {
    modules = sortModules(Array.from(new Set(modules)));
  }

  const limiteUsuariosEntry = pickFirstDefined(body, BODY_LIMITE_USUARIOS_KEYS);
  let limiteUsuarios: number | null;
  try {
    limiteUsuarios = parseOptionalIntegerOrDefault(
      limiteUsuariosEntry.provided ? limiteUsuariosEntry.value : undefined,
      'limite_usuarios',
      null
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'limite_usuarios inválido';
    return res.status(400).json({ error: message });
  }

  const limiteProcessosEntry = pickFirstDefined(body, BODY_LIMITE_PROCESSOS_KEYS);
  let limiteProcessos: number | null;
  try {
    limiteProcessos = parseOptionalIntegerOrDefault(
      limiteProcessosEntry.provided ? limiteProcessosEntry.value : undefined,
      'limite_processos',
      null
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'limite_processos inválido';
    return res.status(400).json({ error: message });
  }

  const limitePropostasEntry = pickFirstDefined(body, BODY_LIMITE_PROPOSTAS_KEYS);
  let limitePropostas: number | null;
  try {
    limitePropostas = parseOptionalIntegerOrDefault(
      limitePropostasEntry.provided ? limitePropostasEntry.value : undefined,
      'limite_propostas',
      null
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'limite_propostas inválido';
    return res.status(400).json({ error: message });
  }

  const limiteClientesEntry = pickFirstDefined(body, BODY_LIMITE_CLIENTES_KEYS);
  let limiteClientes: number | null;
  try {
    limiteClientes = parseOptionalIntegerOrDefault(
      limiteClientesEntry.provided ? limiteClientesEntry.value : undefined,
      'limite_clientes',
      null
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'limite_clientes inválido';
    return res.status(400).json({ error: message });
  }

  const syncEnabledEntry = pickFirstDefined(body, BODY_SYNC_ENABLED_KEYS);
  let syncEnabled: boolean;
  try {
    syncEnabled = parseBooleanOrDefault(
      syncEnabledEntry.value,
      'sincronizacao_processos_habilitada',
      false
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'sincronizacao_processos_habilitada inválido';
    return res.status(400).json({ error: message });
  }

  const syncQuotaEntry = pickFirstDefined(body, BODY_SYNC_QUOTA_KEYS);
  let syncQuota: number | null;
  try {
    syncQuota = parseOptionalIntegerOrDefault(
      syncQuotaEntry.provided ? syncQuotaEntry.value : undefined,
      'sincronizacao_processos_cota',
      null
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'sincronizacao_processos_cota inválido';
    return res.status(400).json({ error: message });
  }

  const recursosPayload = prepareRecursosForStorage({
    recursosInput: recursosEntry.provided ? recursosEntry.value : undefined,
    modules,
    limits: {
      limiteProcessos,
      limiteUsuarios,
      limitePropostas,
      limiteClientes,
      sincronizacaoProcessosHabilitada: syncEnabled,
      sincronizacaoProcessosCota: syncQuota,
    },
  });

  try {
    const result = await pool.query(
      'INSERT INTO public.planos (nome, valor_mensal, valor_anual, ativo, datacadastro, modulos, recursos, limite_processos, limite_usuarios, limite_propostas, limite_clientes, sincronizacao_processos_habilitada, sincronizacao_processos_cota) VALUES ($1, $2, $3, $4, NOW(), $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id, nome, valor_mensal, valor_anual, ativo, datacadastro, modulos, recursos, limite_processos, limite_usuarios, limite_propostas, limite_clientes, sincronizacao_processos_habilitada, sincronizacao_processos_cota',
      [
        nome,
        valorMensal,
        valorAnual,
        ativoValue,
        modules,
        recursosPayload,
        limiteProcessos,
        limiteUsuarios,
        limitePropostas,
        limiteClientes,
        syncEnabled,
        syncQuota,
      ]
    );

    const payload = formatPlanoRow(result.rows[0] as PlanoRow);
    res.status(201).json(payload);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updatePlano = async (req: Request, res: Response) => {
  const { id } = req.params;
  const body = (req.body ?? {}) as Record<string, unknown>;

  try {
    const existingResult = await pool.query(
      'SELECT id, nome, valor_mensal, valor_anual, ativo, datacadastro, modulos, recursos, limite_processos, limite_usuarios, limite_propostas, limite_clientes, sincronizacao_processos_habilitada, sincronizacao_processos_cota FROM public.planos WHERE id = $1',
      [id]
    );

    if (existingResult.rowCount === 0) {
      return res.status(404).json({ error: 'Plano não encontrado' });
    }

    const currentRow = existingResult.rows[0] as PlanoRow;
    const currentPlano = formatPlanoRow(currentRow);
    const currentRecursos = parseRecursosDetails(currentRow.recursos);

    let nomeValue = currentPlano.nome;
    if (Object.prototype.hasOwnProperty.call(body, 'nome')) {
      if (typeof body.nome !== 'string' || !body.nome.trim()) {
        return res.status(400).json({ error: 'nome deve ser um texto não vazio' });
      }
      nomeValue = body.nome.trim();
    }

    const valorMensalEntry = pickFirstDefined(body, BODY_VALOR_MENSAL_KEYS);
    let valorMensalValue: number | string | null =
      typeof currentRow.valor_mensal === 'number' || typeof currentRow.valor_mensal === 'string'
        ? currentRow.valor_mensal
        : null;
    if (valorMensalEntry.provided) {
      try {
        valorMensalValue = parseDecimalValue(valorMensalEntry.value, 'valor_mensal');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'valor_mensal inválido';
        return res.status(400).json({ error: message });
      }
    }

    const valorAnualEntry = pickFirstDefined(body, BODY_VALOR_ANUAL_KEYS);
    let valorAnualValue: number | string | null =
      typeof currentRow.valor_anual === 'number' || typeof currentRow.valor_anual === 'string'
        ? currentRow.valor_anual
        : null;
    if (valorAnualEntry.provided) {
      try {
        valorAnualValue = parseDecimalValue(valorAnualEntry.value, 'valor_anual');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'valor_anual inválido';
        return res.status(400).json({ error: message });
      }
    }

    const ativoEntry = pickFirstDefined(body, BODY_ATIVO_KEYS);
    let ativoValue = currentPlano.ativo;
    if (ativoEntry.provided) {
      try {
        ativoValue = parseBooleanOrDefault(ativoEntry.value, 'ativo', currentPlano.ativo);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'ativo inválido';
        return res.status(400).json({ error: message });
      }
    }

    const recursosEntry = pickFirstDefined(body, BODY_RECURSOS_KEYS);
    const modulosEntry = pickFirstDefined(body, BODY_MODULE_KEYS);

    let modules = currentPlano.modulos;
    if (modulosEntry.provided) {
      try {
        modules = parseModulesOrDefault(
          modulosEntry.value,
          currentPlano.modulos,
          currentRow.modulos == null
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'modulos inválidos';
        return res.status(400).json({ error: message });
      }
    }

    if (!modules.length) {
      const fallbackModules = recursosEntry.provided
        ? parseRecursosDetails(recursosEntry.value).modules
        : currentRecursos.modules;
      if (fallbackModules.length) {
        modules = fallbackModules;
      }
    }

    if (modules.length) {
      modules = sortModules(Array.from(new Set(modules)));
    }

    const limiteUsuariosEntry = pickFirstDefined(body, BODY_LIMITE_USUARIOS_KEYS);
    let limiteUsuariosValue: number | null;
    try {
      limiteUsuariosValue = parseOptionalIntegerOrDefault(
        limiteUsuariosEntry.provided ? limiteUsuariosEntry.value : undefined,
        'limite_usuarios',
        currentPlano.limite_usuarios
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'limite_usuarios inválido';
      return res.status(400).json({ error: message });
    }

    const limiteProcessosEntry = pickFirstDefined(body, BODY_LIMITE_PROCESSOS_KEYS);
    let limiteProcessosValue: number | null;
    try {
      limiteProcessosValue = parseOptionalIntegerOrDefault(
        limiteProcessosEntry.provided ? limiteProcessosEntry.value : undefined,
        'limite_processos',
        currentPlano.limite_processos
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'limite_processos inválido';
      return res.status(400).json({ error: message });
    }

    const limitePropostasEntry = pickFirstDefined(body, BODY_LIMITE_PROPOSTAS_KEYS);
    let limitePropostasValue: number | null;
    try {
      limitePropostasValue = parseOptionalIntegerOrDefault(
        limitePropostasEntry.provided ? limitePropostasEntry.value : undefined,
        'limite_propostas',
        currentPlano.limite_propostas
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'limite_propostas inválido';
      return res.status(400).json({ error: message });
    }

    const limiteClientesEntry = pickFirstDefined(body, BODY_LIMITE_CLIENTES_KEYS);
    let limiteClientesValue: number | null;
    try {
      limiteClientesValue = parseOptionalIntegerOrDefault(
        limiteClientesEntry.provided ? limiteClientesEntry.value : undefined,
        'limite_clientes',
        currentPlano.limite_clientes
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'limite_clientes inválido';
      return res.status(400).json({ error: message });
    }

    const syncEnabledEntry = pickFirstDefined(body, BODY_SYNC_ENABLED_KEYS);
    let syncEnabledValue = currentPlano.sincronizacao_processos_habilitada;
    if (syncEnabledEntry.provided) {
      try {
        syncEnabledValue = parseBooleanOrDefault(
          syncEnabledEntry.value,
          'sincronizacao_processos_habilitada',
          currentPlano.sincronizacao_processos_habilitada
        );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'sincronizacao_processos_habilitada inválido';
        return res.status(400).json({ error: message });
      }
    }

    const syncQuotaEntry = pickFirstDefined(body, BODY_SYNC_QUOTA_KEYS);
    let syncQuotaValue: number | null;
    try {
      syncQuotaValue = parseOptionalIntegerOrDefault(
        syncQuotaEntry.provided ? syncQuotaEntry.value : undefined,
        'sincronizacao_processos_cota',
        currentPlano.sincronizacao_processos_cota
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'sincronizacao_processos_cota inválido';
      return res.status(400).json({ error: message });
    }

    const recursosPayload = prepareRecursosForStorage({
      recursosInput: recursosEntry.provided ? recursosEntry.value : undefined,
      modules,
      limits: {
        limiteProcessos: limiteProcessosValue,
        limiteUsuarios: limiteUsuariosValue,
        limitePropostas: limitePropostasValue,
        limiteClientes: limiteClientesValue,
        sincronizacaoProcessosHabilitada: syncEnabledValue,
        sincronizacaoProcessosCota: syncQuotaValue,
      },
      fallback: currentRecursos,
    });

    const result = await pool.query(
      'UPDATE public.planos SET nome = $1, valor_mensal = $2, valor_anual = $3, ativo = $4, modulos = $5, recursos = $6, limite_processos = $7, limite_usuarios = $8, limite_propostas = $9, limite_clientes = $10, sincronizacao_processos_habilitada = $11, sincronizacao_processos_cota = $12 WHERE id = $13 RETURNING id, nome, valor_mensal, valor_anual, ativo, datacadastro, modulos, recursos, limite_processos, limite_usuarios, limite_propostas, limite_clientes, sincronizacao_processos_habilitada, sincronizacao_processos_cota',
      [
        nomeValue,
        valorMensalValue,
        valorAnualValue,
        ativoValue,
        modules,
        recursosPayload,
        limiteProcessosValue,
        limiteUsuariosValue,
        limitePropostasValue,
        limiteClientesValue,
        syncEnabledValue,
        syncQuotaValue,
        id,
      ]
    );

    const payload = formatPlanoRow(result.rows[0] as PlanoRow);
    res.json(payload);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deletePlano = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'DELETE FROM public.planos WHERE id = $1',
      [id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Plano não encontrado' });
    }
    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

