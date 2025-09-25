export interface SystemModule {
  id: string;
  nome: string;
  descricao?: string;
  categoria?: string;
}

export const SYSTEM_MODULES: SystemModule[] = [
  { id: 'dashboard', nome: 'Dashboard', categoria: 'Aplicação' },
  { id: 'conversas', nome: 'Conversas', categoria: 'Aplicação' },
  { id: 'clientes', nome: 'Clientes', categoria: 'Aplicação' },
  { id: 'fornecedores', nome: 'Fornecedores', categoria: 'Aplicação' },
  { id: 'pipeline', nome: 'Pipeline', categoria: 'Aplicação' },
  { id: 'agenda', nome: 'Agenda', categoria: 'Aplicação' },
  { id: 'tarefas', nome: 'Tarefas', categoria: 'Aplicação' },
  { id: 'processos', nome: 'Processos', categoria: 'Aplicação' },
  { id: 'intimacoes', nome: 'Intimações', categoria: 'Aplicação' },
  { id: 'documentos', nome: 'Documentos', categoria: 'Aplicação' },
  { id: 'arquivos', nome: 'Arquivos', categoria: 'Aplicação' },
  { id: 'financeiro', nome: 'Financeiro', categoria: 'Aplicação' },
  { id: 'relatorios', nome: 'Relatórios', categoria: 'Aplicação' },
  { id: 'meu-plano', nome: 'Meu Plano', categoria: 'Aplicação' },
  { id: 'suporte', nome: 'Suporte', categoria: 'Aplicação' },
  { id: 'configuracoes', nome: 'Configurações', categoria: 'Configurações' },
  { id: 'configuracoes-usuarios', nome: 'Configurações - Usuários', categoria: 'Configurações' },
  { id: 'configuracoes-integracoes', nome: 'Configurações - Integrações', categoria: 'Configurações' },
  { id: 'configuracoes-parametros', nome: 'Configurações - Parâmetros', categoria: 'Configurações' },
  {
    id: 'configuracoes-conteudo-blog',
    nome: 'Configurações - Conteúdo - Blog',
    categoria: 'Configurações',
  },
  { id: 'configuracoes-parametros-perfis', nome: 'Configurações - Parâmetros - Perfis', categoria: 'Configurações' },
  { id: 'configuracoes-parametros-escritorios', nome: 'Configurações - Parâmetros - Escritórios', categoria: 'Configurações' },
  { id: 'configuracoes-parametros-area-atuacao', nome: 'Configurações - Parâmetros - Área de Atuação', categoria: 'Configurações' },
  { id: 'configuracoes-parametros-situacao-processo', nome: 'Configurações - Parâmetros - Situação do Processo', categoria: 'Configurações' },
  { id: 'configuracoes-parametros-tipo-processo', nome: 'Configurações - Parâmetros - Tipo de Processo', categoria: 'Configurações' },
  { id: 'configuracoes-parametros-tipo-evento', nome: 'Configurações - Parâmetros - Tipo de Evento', categoria: 'Configurações' },
  { id: 'configuracoes-parametros-situacao-cliente', nome: 'Configurações - Parâmetros - Situação do Cliente', categoria: 'Configurações' },
  {
    id: 'configuracoes-parametros-situacao-proposta',
    nome: 'Configurações - Parâmetros - Situação da Proposta',
    categoria: 'Configurações',
  },
  { id: 'configuracoes-parametros-etiquetas', nome: 'Configurações - Parâmetros - Etiquetas', categoria: 'Configurações' },
  { id: 'configuracoes-parametros-tipos-documento', nome: 'Configurações - Parâmetros - Tipos de Documento', categoria: 'Configurações' },
  { id: 'configuracoes-parametros-fluxo-trabalho', nome: 'Configurações - Parâmetros - Fluxo de Trabalho', categoria: 'Configurações' },
];

const SYSTEM_MODULE_INDEX = new Map<string, number>(
  SYSTEM_MODULES.map((module, index) => [module.id, index])
);

export const SYSTEM_MODULE_SET = new Set<string>(
  SYSTEM_MODULES.map((module) => module.id)
);

export function normalizeModuleId(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  if (SYSTEM_MODULE_SET.has(trimmed)) {
    return trimmed;
  }

  const lowerCased = trimmed.toLowerCase();

  if (SYSTEM_MODULE_SET.has(lowerCased)) {
    return lowerCased;
  }

  const sanitized = trimmed
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();

  if (sanitized && SYSTEM_MODULE_SET.has(sanitized)) {
    return sanitized;
  }

  return null;
}

export function sanitizeModuleIds(values: unknown): string[] {
  if (values == null) {
    return [];
  }

  if (!Array.isArray(values)) {
    throw new Error('modulos deve ser um array de strings');
  }

  const unique = new Set<string>();
  const sanitized: string[] = [];

  for (const value of values) {
    if (typeof value !== 'string') {
      throw new Error('modulos deve conter apenas strings válidas');
    }

    const normalized = normalizeModuleId(value);

    if (!normalized) {
      throw new Error(`Módulo desconhecido: ${value}`);
    }

    if (!unique.has(normalized)) {
      unique.add(normalized);
      sanitized.push(normalized);
    }
  }

  return sanitized;
}

export function sortModules(modules: string[]): string[] {
  return [...modules].sort((a, b) => {
    const indexA = SYSTEM_MODULE_INDEX.get(a);
    const indexB = SYSTEM_MODULE_INDEX.get(b);

    if (indexA == null && indexB == null) {
      return a.localeCompare(b);
    }

    if (indexA == null) return 1;
    if (indexB == null) return -1;

    if (indexA === indexB) {
      return a.localeCompare(b);
    }

    return indexA - indexB;
  });
}
