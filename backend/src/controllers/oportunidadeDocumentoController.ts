import { Request, Response } from 'express';
import pool from '../services/db';
import { queryEmpresas } from '../services/empresaQueries';
import { replaceVariables } from '../services/templateService';
import { fetchAuthenticatedUserEmpresa } from '../utils/authUser';

type Primitive = string | number | boolean | null | undefined;

type EditorJsonNode = {
  type: string;
  text?: string;
  attrs?: Record<string, Primitive>;
  children?: EditorJsonNode[];
};

type OpportunityRow = {
  id: number;
  tipo_processo_id: number | null;
  area_atuacao_id: number | null;
  responsavel_id: number | null;
  idempresa: number | null;
  numero_processo_cnj: string | null;
  numero_protocolo: string | null;
  vara_ou_orgao: string | null;
  comarca: string | null;
  fase_id: number | null;
  etapa_id: number | null;
  prazo_proximo: string | null;
  status_id: number | null;
  solicitante_id: number | null;
  valor_causa: number | null;
  valor_honorarios: number | null;
  percentual_honorarios: number | null;
  forma_pagamento: string | null;
  qtde_parcelas: number | null;
  contingenciamento: string | null;
  detalhes: string | null;
  documentos_anexados: unknown;
  criado_por: number | string | null;
  sequencial_empresa: number;
  audiencia_data: string | null;
  audiencia_horario: string | null;
  audiencia_local: string | null;
  data_criacao: string | null;
  ultima_atualizacao: string | null;
};

type OpportunityDetails = OpportunityRow & {
  tipo_processo_nome: string | null;
  area_atuacao_nome: string | null;
  fase_nome: string | null;
  etapa_nome: string | null;
  status_nome: string | null;
};

type ClienteRow = {
  id: number;
  nome: string | null;
  tipo: number | null;
  documento: string | null;
  email: string | null;
  telefone: string | null;
  cep: string | null;
  rua: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
};

type ResponsavelRow = {
  id: number;
  nome_completo: string | null;
  email: string | null;
  telefone: string | null;
  oab: string | null;
  perfil: string | null;
};

const EMPRESA_ADDRESS_COLUMNS = [
  'cep',
  'rua',
  'logradouro',
  'numero',
  'complemento',
  'bairro',
  'cidade',
  'municipio',
  'estado',
  'uf',
  'endereco',
] as const;

type EmpresaAddressColumn = (typeof EMPRESA_ADDRESS_COLUMNS)[number];

type EmpresaAddress = Partial<Record<EmpresaAddressColumn, string | null>>;

type EmpresaRow = {
  id: number;
  nome_empresa: string | null;
  cnpj: string | null;
  telefone: string | null;
  email: string | null;
  plano?: string | null;
  responsavel?: string | null;
  ativo?: boolean | null;
  datacadastro?: string | null;
  atualizacao?: string | null;
} & EmpresaAddress;

type EnvolvidoRow = {
  nome: string | null;
  documento: string | null;
  telefone: string | null;
  endereco: string | null;
  relacao: string | null;
};

type OpportunityAudience = {
  data: string | null;
  hora: string | null;
  local: string | null;
};

type OpportunityData = {
  opportunity: OpportunityDetails;
  solicitante: ClienteRow | null;
  envolvidos: EnvolvidoRow[];
  responsavel: ResponsavelRow | null;
  empresa: EmpresaRow | null;
  audiencia: OpportunityAudience | null;
};

type TemplateRow = {
  id: number;
  title: string;
  content: string | null;
};

type VariableMap = Record<string, string | number>;

type OpportunityDocumentRow = {
  id: number;
  oportunidade_id: number;
  template_id: number | null;
  title: string;
  content: string | null;
  variables: unknown;
  created_at: string;
};

type AuthenticatedContext =
  | { ok: true; empresaId: number; userId: number }
  | { ok: false };

async function resolveAuthenticatedContext(
  req: Request,
  res: Response,
): Promise<AuthenticatedContext> {
  if (!req.auth) {
    res.status(401).json({ error: 'Token inválido.' });
    return { ok: false };
  }

  const empresaLookup = await fetchAuthenticatedUserEmpresa(req.auth.userId);

  if (!empresaLookup.success) {
    res.status(empresaLookup.status).json({ error: empresaLookup.message });
    return { ok: false };
  }

  const { empresaId } = empresaLookup;

  if (empresaId === null) {
    res.status(403).json({ error: 'Usuário autenticado não possui empresa vinculada.' });
    return { ok: false };
  }

  return { ok: true, empresaId, userId: req.auth.userId };
}

async function ensureOpportunityAccess(
  oportunidadeId: number,
  empresaId: number,
): Promise<boolean> {
  const result = await pool.query(
    'SELECT 1 FROM public.oportunidades WHERE id = $1 AND idempresa = $2 LIMIT 1',
    [oportunidadeId, empresaId],
  );

  return (result.rowCount ?? 0) > 0;
}

function ensureEditorJsonContent(value: unknown): EditorJsonNode[] | null {
  if (!value) return null;
  if (Array.isArray(value)) {
    return value.filter((node): node is EditorJsonNode =>
      !!node && typeof node === 'object' && typeof (node as { type?: unknown }).type === 'string',
    );
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return ensureEditorJsonContent(parsed);
    } catch {
      return null;
    }
  }
  if (typeof value === 'object') {
    const maybeNodes = (value as { nodes?: unknown }).nodes;
    if (Array.isArray(maybeNodes)) {
      return ensureEditorJsonContent(maybeNodes);
    }
  }
  return null;
}

function parseTemplateContent(raw: string | null): {
  contentHtml: string;
  contentEditorJson: EditorJsonNode[] | null;
  metadata: unknown;
} {
  if (!raw) {
    return { contentHtml: '<p></p>', contentEditorJson: null, metadata: null };
  }

  let contentHtml = raw;
  let contentEditorJson: EditorJsonNode[] | null = null;
  let metadata: unknown = null;

  try {
    const parsed = JSON.parse(raw) as {
      content_html?: unknown;
      content_editor_json?: unknown;
      metadata?: unknown;
    };
    if (typeof parsed?.content_html === 'string') {
      contentHtml = parsed.content_html;
    }
    contentEditorJson = ensureEditorJsonContent(parsed?.content_editor_json);
    metadata = parsed?.metadata ?? null;
  } catch {
    // Conteúdo armazenado como HTML simples.
  }

  if (!contentHtml || contentHtml.trim().length === 0) {
    contentHtml = '<p></p>';
  }

  return { contentHtml, contentEditorJson, metadata };
}

function parseStoredDocumentContent(raw: string | null): {
  contentHtml: string;
  contentEditorJson: EditorJsonNode[] | null;
  metadata: unknown;
} {
  if (!raw) {
    return { contentHtml: '<p></p>', contentEditorJson: null, metadata: null };
  }

  try {
    const parsed = JSON.parse(raw) as {
      content_html?: unknown;
      content_editor_json?: unknown;
      metadata?: unknown;
    };

    const contentHtml =
      typeof parsed?.content_html === 'string' && parsed.content_html.trim().length > 0
        ? parsed.content_html
        : '<p></p>';

    return {
      contentHtml,
      contentEditorJson: ensureEditorJsonContent(parsed?.content_editor_json),
      metadata: parsed?.metadata ?? null,
    };
  } catch {
    const trimmed = raw.trim();
    return { contentHtml: trimmed.length > 0 ? trimmed : '<p></p>', contentEditorJson: null, metadata: null };
  }
}

function normalizeVariables(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Ignored: fallback to empty object below
    }
  }

  return {};
}

function mapDocumentRow(row: OpportunityDocumentRow) {
  const { contentHtml, contentEditorJson, metadata } = parseStoredDocumentContent(row.content);

  return {
    id: row.id,
    oportunidade_id: row.oportunidade_id,
    template_id: row.template_id,
    title: row.title,
    created_at: row.created_at,
    variables: normalizeVariables(row.variables),
    content_html: contentHtml,
    content_editor_json: contentEditorJson,
    metadata,
  };
}

function replaceInString(value: string, variables: VariableMap): string {
  return replaceVariables(value, variables);
}

function fillEditorNodes(nodes: EditorJsonNode[], variables: VariableMap): EditorJsonNode[] {
  return nodes.map((node) => {
    const next: EditorJsonNode = { type: node.type };
    if (typeof node.text === 'string') {
      next.text = replaceInString(node.text, variables);
    }
    if (node.attrs) {
      next.attrs = Object.fromEntries(
        Object.entries(node.attrs).map(([key, value]) => [
          key,
          typeof value === 'string' ? replaceInString(value, variables) : value,
        ]),
      );
    }
    if (Array.isArray(node.children) && node.children.length > 0) {
      next.children = fillEditorNodes(node.children, variables);
    }
    return next;
  });
}

function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
}

function coerceString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return null;
}

function normalizeDocument(doc: string | null): string | null {
  if (!doc) return null;
  const digits = doc.replace(/\D+/g, '');
  return digits.length > 0 ? digits : null;
}

function formatDatePtBr(input: string | null): string | null {
  if (!input) return null;
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return new Intl.DateTimeFormat('pt-BR').format(date);
}

function formatDateExtenso(input: Date): string {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full' }).format(input);
}

function formatTime(input: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(input);
}

function formatTimeString(input: string | null, fallbackDate?: string | null): string | null {
  const normalizeTime = (time: string) => {
    const match = time.match(/^(\d{1,2})(?::(\d{2}))?(?::(\d{2}))?$/);
    if (!match) {
      return null;
    }

    const hours = Number.parseInt(match[1] ?? '', 10);
    const minutes = Number.parseInt(match[2] ?? '0', 10);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
      return null;
    }

    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      return null;
    }

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };

  const trimmed = input?.trim();
  if (trimmed) {
    const normalized = normalizeTime(trimmed);
    if (normalized) {
      return normalized;
    }

    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return formatTime(parsed);
    }
  }

  if (fallbackDate) {
    const parsed = new Date(fallbackDate);
    if (!Number.isNaN(parsed.getTime())) {
      return formatTime(parsed);
    }
  }

  return null;

}

function formatAudienceTime(date: string | null, time: string | null): string | null {
  return formatTimeString(time, date);
}

async function fetchNomeById(query: string, id: number | null): Promise<string | null> {
  if (id === null || id === undefined) return null;
  const result = await pool.query<{ nome: string | null }>(query, [id]);
  if (!result.rowCount) {
    return null;
  }
  const value = result.rows[0]?.nome;
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }
  return null;
}

const EMPRESA_ADDRESS_SOURCES = [
  { schema: 'public', table: 'vw.empresas' },
  { schema: 'public', table: 'empresas' },
] as const;

type PgError = { code?: string };

const isPgMissingRelationError = (error: unknown): error is PgError => {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const { code } = error as PgError;
  return code === '42P01' || code === '42703';
};

async function fetchEmpresaEndereco(empresaId: number | null): Promise<EmpresaAddress | null> {
  if (!empresaId) {
    return null;
  }

  for (const source of EMPRESA_ADDRESS_SOURCES) {
    const columnsResult = await pool
      .query<{ column_name: string }>(
        `SELECT column_name
           FROM information_schema.columns
          WHERE table_schema = $1 AND table_name = $2`,
        [source.schema, source.table]
      )
      .catch((error) => {
        if (isPgMissingRelationError(error)) {
          return null;
        }
        throw error;
      });

    if (!columnsResult || columnsResult.rowCount === 0) {
      continue;
    }

    const availableColumns = new Set(columnsResult.rows.map((row) => row.column_name));
    const selectedColumns = EMPRESA_ADDRESS_COLUMNS.filter((column) => availableColumns.has(column));

    if (selectedColumns.length === 0) {
      continue;
    }

    const selectClause = selectedColumns.map((column) => `"${column}"`).join(', ');
    const relation = `${source.schema}."${source.table}"`;
    const query = `SELECT ${selectClause} FROM ${relation} WHERE id = $1 LIMIT 1`;

    const result = await pool
      .query<EmpresaAddress>(query, [empresaId])
      .catch((error) => {
        if (isPgMissingRelationError(error)) {
          return null;
        }
        throw error;
      });

    const rows = result?.rows ?? [];
    if (rows.length > 0) {
      return rows[0];
    }
  }

  return null;
}

async function fetchOpportunityProcessId(opportunityId: number): Promise<number | null> {
  const queries = [
    `SELECT id FROM public.processos WHERE oportunidade_id = $1 ORDER BY atualizado_em DESC NULLS LAST, id DESC LIMIT 1`,
    `SELECT id FROM public.processos WHERE oportunidade_id = $1 ORDER BY id DESC LIMIT 1`,
  ];

  for (const query of queries) {
    const result = await pool
      .query<{ id: number | null }>(query, [opportunityId])
      .catch((error) => {
        if (isPgMissingRelationError(error)) {
          return null;
        }
        throw error;
      });

    if (!result || result.rowCount === 0) {
      continue;
    }

    const rawId = result.rows[0]?.id;
    if (rawId === null || rawId === undefined) {
      continue;
    }

    const parsed = Number(rawId);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

type AudienceRow = {
  data?: string | null;
  hora?: string | null;
  hora_inicio?: string | null;
  local?: string | null;
};

const AUDIENCIA_FILTER = `
  (
    (te.nome IS NOT NULL AND LOWER(te.nome) LIKE '%audi%') OR
    (a.titulo IS NOT NULL AND LOWER(a.titulo) LIKE '%audi%') OR
    (a.descricao IS NOT NULL AND LOWER(a.descricao) LIKE '%audi%')
  )
`;

const buildAgendaAudienceQuery = (column: string): string => `
  SELECT a.data, a.hora_inicio AS hora, a.local
    FROM public.agenda a
    LEFT JOIN public.tipo_evento te ON te.id = a.tipo
   WHERE a.${column} = $1
     AND ${AUDIENCIA_FILTER}
   ORDER BY a.data NULLS LAST, a.hora_inicio NULLS LAST, a.id DESC
   LIMIT 1
`;

async function fetchOpportunityAudience(opportunity: OpportunityDetails): Promise<OpportunityAudience | null> {
  const attempts: Array<{ query: string; params: unknown[] }> = [
    { query: buildAgendaAudienceQuery('id_oportunidades'), params: [opportunity.id] },
    { query: buildAgendaAudienceQuery('oportunidade_id'), params: [opportunity.id] },
  ];

  const processId = await fetchOpportunityProcessId(opportunity.id);
  if (processId !== null) {
    attempts.push({ query: buildAgendaAudienceQuery('processo_id'), params: [processId] });
  }

  attempts.push({
    query: `
      SELECT t.data, t.hora, NULL::text AS local
        FROM public.tarefas t
       WHERE t.id_oportunidades = $1
         AND (
           (t.titulo IS NOT NULL AND LOWER(t.titulo) LIKE '%audi%') OR
           (t.descricao IS NOT NULL AND LOWER(t.descricao) LIKE '%audi%')
         )
       ORDER BY t.data NULLS LAST, t.hora NULLS LAST, t.id DESC
       LIMIT 1
    `,
    params: [opportunity.id],
  });

  for (const attempt of attempts) {
    const result = await pool
      .query<AudienceRow>(attempt.query, attempt.params)
      .catch((error) => {
        if (isPgMissingRelationError(error)) {
          return null;
        }
        throw error;
      });

    if (!result || result.rowCount === 0) {
      continue;
    }

    const row = result.rows[0];
    const data = coerceString(row?.data ?? null);
    const hora = coerceString(row?.hora ?? row?.hora_inicio ?? null);
    const local = coerceString(row?.local ?? null);

    return {
      data,
      hora,
      local,
    };
  }

  return null;
}


function buildVariables({
  opportunity,
  solicitante,
  envolvidos,
  responsavel,
  empresa,
  audiencia,
}: OpportunityData): VariableMap {
  const variables: VariableMap = {};

  const assign = (key: string, value: unknown) => {
    if (value === null || value === undefined) return;
    const str = coerceString(value);
    if (str !== null) {
      variables[key] = str;
    }
  };

  assign('processo.numero', opportunity.numero_processo_cnj);
  assign('processo.numero_protocolo', opportunity.numero_protocolo);
  assign('processo.vara', opportunity.vara_ou_orgao);
  assign('processo.comarca', opportunity.comarca);
  assign('processo.tipo_acao', opportunity.tipo_processo_nome ?? opportunity.tipo_processo_id);
  assign('processo.tipo_acao_id', opportunity.tipo_processo_id);
  assign('processo.fase_atual', opportunity.fase_nome ?? opportunity.fase_id);
  assign('processo.fase_id', opportunity.fase_id);
  assign('processo.etapa', opportunity.etapa_nome ?? opportunity.etapa_id);
  assign('processo.etapa_id', opportunity.etapa_id);
  assign('processo.status', opportunity.status_nome ?? opportunity.status_id);
  assign('processo.status_id', opportunity.status_id);
  assign('processo.area_atuacao', opportunity.area_atuacao_nome ?? opportunity.area_atuacao_id);
  assign('processo.area_atuacao_id', opportunity.area_atuacao_id);
  assign('processo.valor_causa', opportunity.valor_causa);
  assign('processo.valor_honorarios', opportunity.valor_honorarios);
  assign('processo.percentual_honorarios', opportunity.percentual_honorarios);
  assign('processo.forma_pagamento', opportunity.forma_pagamento);
  assign('processo.qtde_parcelas', opportunity.qtde_parcelas);
  assign('processo.contingenciamento', opportunity.contingenciamento);
  assign('processo.detalhes', opportunity.detalhes);
  assign('processo.prazo_proximo', formatDatePtBr(opportunity.prazo_proximo));
  assign('processo.audiencia.data', formatDatePtBr(opportunity.audiencia_data));
  assign(
    'processo.audiencia.horario',
    formatTimeString(opportunity.audiencia_horario, opportunity.audiencia_data),
  );
  assign('processo.audiencia.local', opportunity.audiencia_local ?? opportunity.vara_ou_orgao);

  if (audiencia) {
    assign('processo.audiencia.data', formatDatePtBr(audiencia.data));
    assign('processo.audiencia.horario', formatAudienceTime(audiencia.data, audiencia.hora));
    assign('processo.audiencia.local', audiencia.local);
  }

  assign('oportunidade.id', opportunity.id);
  assign('oportunidade.data_criacao', formatDatePtBr(opportunity.data_criacao));
  assign('oportunidade.ultima_atualizacao', formatDatePtBr(opportunity.ultima_atualizacao));

  if (solicitante) {
    const nome = coerceString(solicitante.nome);
    if (nome) {
      assign('cliente.nome_completo', nome);
      const [first, ...rest] = nome.split(/\s+/);
      assign('cliente.primeiro_nome', first ?? '');
      assign('cliente.sobrenome', rest.join(' '));
    }

    if (solicitante.tipo === 1) {
      assign('cliente.tipo', 'Pessoa Física');
    } else if (solicitante.tipo === 2) {
      assign('cliente.tipo', 'Pessoa Jurídica');
    }

    const doc = normalizeDocument(solicitante.documento);
    if (doc) {
      assign('cliente.documento', doc);
      if (doc.length === 11) {
        assign('cliente.documento.cpf', doc);
      } else if (doc.length === 14) {
        assign('cliente.documento.cnpj', doc);
      } else {
        assign('cliente.documento.rg', doc);
      }
    }

    assign('cliente.contato.email', solicitante.email);
    assign('cliente.contato.telefone', solicitante.telefone);
    assign('cliente.endereco.cep', normalizeDocument(solicitante.cep));
    assign('cliente.endereco.rua', solicitante.rua);
    assign('cliente.endereco.numero', solicitante.numero);
    assign('cliente.endereco.complemento', solicitante.complemento);
    assign('cliente.endereco.bairro', solicitante.bairro);
    assign('cliente.endereco.cidade', solicitante.cidade);
    assign('cliente.endereco.estado', solicitante.uf);
  }

  envolvidos.forEach((envolvido, index) => {
    const relationSlug = envolvido.relacao ? slugify(envolvido.relacao) : null;
    const indexKey = `envolvidos.${index + 1}`;
    const baseKeys = [indexKey];
    if (relationSlug) {
      baseKeys.push(`envolvidos.${relationSlug}`);
    }
    baseKeys.forEach((base) => {
      assign(`${base}.nome`, envolvido.nome);
      const doc = normalizeDocument(envolvido.documento);
      assign(`${base}.documento`, doc);
      assign(`${base}.telefone`, envolvido.telefone);
      assign(`${base}.endereco`, envolvido.endereco);
      if (relationSlug) {
        assign(`${base}.relacao`, envolvido.relacao);
      }
    });
  });

  if (responsavel) {
    assign('usuario.nome', responsavel.nome_completo);
    assign('usuario.email', responsavel.email);
    assign('usuario.telefone', responsavel.telefone);
    assign('usuario.oab', responsavel.oab);
    assign('usuario.cargo', responsavel.perfil);
  }

  if (empresa) {
    assign('escritorio.nome', empresa.nome_empresa);
    assign('escritorio.razao_social', empresa.nome_empresa);
    assign('escritorio.cnpj', normalizeDocument(empresa.cnpj));
    assign('escritorio.telefone', empresa.telefone);
    assign('escritorio.email', empresa.email);
    assign('escritorio.responsavel', empresa.responsavel);
    assign('escritorio.plano', empresa.plano);
    assign('escritorio.endereco.cep', normalizeDocument(empresa.cep ?? null));
    assign('escritorio.endereco.rua', empresa.rua ?? empresa.logradouro ?? empresa.endereco);
    assign('escritorio.endereco.numero', empresa.numero);
    assign('escritorio.endereco.complemento', empresa.complemento);
    assign('escritorio.endereco.bairro', empresa.bairro);
    assign('escritorio.endereco.cidade', empresa.cidade ?? empresa.municipio);
    assign('escritorio.endereco.estado', empresa.estado ?? empresa.uf);
  }

  const now = new Date();
  assign('sistema.data_atual', formatDatePtBr(now.toISOString()));
  assign('sistema.hora_atual', formatTime(now));
  assign('sistema.data_extenso', formatDateExtenso(now));

  return variables;
}

async function fetchOpportunityData(
  id: number,
  empresaId: number,
): Promise<OpportunityData | null> {
  const opportunityResult = await pool.query<OpportunityRow>(
    `SELECT id, tipo_processo_id, area_atuacao_id, responsavel_id, idempresa, numero_processo_cnj, numero_protocolo,
            vara_ou_orgao, comarca, fase_id, etapa_id, prazo_proximo, status_id, solicitante_id,
            valor_causa, valor_honorarios, percentual_honorarios, forma_pagamento, qtde_parcelas,
            contingenciamento, detalhes, documentos_anexados, criado_por, sequencial_empresa,
            audiencia_data, audiencia_horario, audiencia_local, data_criacao, ultima_atualizacao

       FROM public.oportunidades WHERE id = $1 AND idempresa = $2`,
    [id, empresaId],
  );
  if (opportunityResult.rowCount === 0) {
    return null;
  }
  const opportunityBase = opportunityResult.rows[0];

  const [
    tipoProcessoNome,
    areaAtuacaoNome,
    faseNome,
    etapaNome,
    statusNome,
  ] = await Promise.all([
    fetchNomeById('SELECT nome FROM public.tipo_processo WHERE id = $1', opportunityBase.tipo_processo_id),
    fetchNomeById('SELECT nome FROM public.area_atuacao WHERE id = $1', opportunityBase.area_atuacao_id),
    fetchNomeById('SELECT nome FROM public.fluxo_trabalho WHERE id = $1', opportunityBase.fase_id),
    fetchNomeById('SELECT nome FROM public.etiquetas WHERE id = $1', opportunityBase.etapa_id),
    fetchNomeById('SELECT nome FROM public.situacao_proposta WHERE id = $1', opportunityBase.status_id),
  ]);

  const opportunity: OpportunityDetails = {
    ...opportunityBase,
    tipo_processo_nome: tipoProcessoNome,
    area_atuacao_nome: areaAtuacaoNome,
    fase_nome: faseNome,
    etapa_nome: etapaNome,
    status_nome: statusNome,
  };

  const envolvidosResult = await pool.query<EnvolvidoRow>(
    `SELECT nome, documento, telefone, endereco, relacao
       FROM public.oportunidade_envolvidos
      WHERE oportunidade_id = $1`,
    [id],
  );

  let solicitante: ClienteRow | null = null;
  if (opportunity.solicitante_id) {
    const solicitanteResult = await pool.query<ClienteRow>(
      `SELECT id, nome, tipo, documento, email, telefone, cep, rua, numero, complemento, bairro, cidade, uf
         FROM public.clientes
        WHERE id = $1`,
      [opportunity.solicitante_id],
    );
    solicitante = (solicitanteResult.rowCount ?? 0) > 0 ? solicitanteResult.rows[0] : null;
  }

  let responsavel: ResponsavelRow | null = null;
  if (opportunity.responsavel_id) {
    const responsavelResult = await pool.query<ResponsavelRow>(
      'SELECT id, nome_completo, email, telefone, oab, perfil FROM public.vw_usuarios WHERE id = $1',
      [opportunity.responsavel_id],
    );
    responsavel = (responsavelResult.rowCount ?? 0) > 0 ? responsavelResult.rows[0] : null;
  }

  let empresa: EmpresaRow | null = null;
  if (opportunity.idempresa !== null && opportunity.idempresa !== undefined) {
    const empresaResult = await queryEmpresas<EmpresaRow>('WHERE id = $1', [opportunity.idempresa]);
    empresa = (empresaResult.rowCount ?? 0) > 0 ? empresaResult.rows[0] : null;

  }

  if (empresa) {
    const endereco = await fetchEmpresaEndereco(empresa.id);
    if (endereco) {
      empresa = { ...empresa, ...endereco };
    }
  }

  const audiencia = await fetchOpportunityAudience(opportunity);


  return {
    opportunity,
    solicitante,
    envolvidos: envolvidosResult.rows,
    responsavel,
    empresa,
    audiencia,
  };
}

export const createOpportunityDocumentFromTemplate = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { templateId, title } = req.body as { templateId?: unknown; title?: unknown };

  const opportunityId = Number(id);
  if (!Number.isFinite(opportunityId)) {
    return res.status(400).json({ error: 'Oportunidade inválida' });
  }

  const numericTemplateId = typeof templateId === 'string' ? Number(templateId) : Number(templateId);
  if (!Number.isFinite(numericTemplateId)) {
    return res.status(400).json({ error: 'templateId inválido' });
  }

  try {
    const authContext = await resolveAuthenticatedContext(req, res);
    if (!authContext.ok) {
      return;
    }

    const { empresaId, userId } = authContext;

    const opportunityData = await fetchOpportunityData(opportunityId, empresaId);
    if (!opportunityData) {
      return res.status(404).json({ error: 'Oportunidade não encontrada' });
    }

    const templateResult = await pool.query<TemplateRow>(
      'SELECT id, title, content FROM templates WHERE id = $1 AND idempresa IS NOT DISTINCT FROM $2 AND idusuario = $3',
      [numericTemplateId, empresaId, userId],
    );
    if (templateResult.rowCount === 0) {
      return res.status(404).json({ error: 'Template não encontrado' });
    }
    const template = templateResult.rows[0];

    const { contentHtml, contentEditorJson, metadata } = parseTemplateContent(template.content);
    const variables = buildVariables(opportunityData);

    const filledHtml = replaceVariables(contentHtml, variables);
    const filledJson = contentEditorJson ? fillEditorNodes(contentEditorJson, variables) : null;

    const storedContent = JSON.stringify({
      content_html: filledHtml,
      content_editor_json: filledJson,
      metadata,
    });

    let requestedTitle: string | null = null;
    if (title !== undefined && title !== null) {
      if (typeof title !== 'string') {
        return res.status(400).json({ error: 'Título inválido' });
      }
      const trimmed = title.trim();
      if (!trimmed) {
        return res.status(400).json({ error: 'Título inválido' });
      }
      requestedTitle = trimmed;
    }

    const finalTitle = requestedTitle ?? template.title;

    const insertResult = await pool.query(
      `INSERT INTO public.oportunidade_documentos (oportunidade_id, template_id, title, content, variables)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, oportunidade_id, template_id, title, content, variables, created_at`,
      [
        opportunityId,
        numericTemplateId,
        finalTitle,
        storedContent,
        JSON.stringify(variables),
      ],
    );

    const document = insertResult.rows[0];
    const responseTitle =
      document && typeof document.title === 'string' && document.title.trim().length > 0
        ? document.title.trim()
        : finalTitle;

    return res.status(201).json({
      id: document.id,
      oportunidade_id: document.oportunidade_id,
      template_id: document.template_id,
      title: responseTitle,
      content: document.content,
      variables: document.variables,
      created_at: document.created_at,
      content_html: filledHtml,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const listOpportunityDocuments = async (req: Request, res: Response) => {
  const { id } = req.params;

  const opportunityId = Number(id);
  if (!Number.isFinite(opportunityId)) {
    return res.status(400).json({ error: 'Oportunidade inválida' });
  }

  try {
    const authContext = await resolveAuthenticatedContext(req, res);
    if (!authContext.ok) {
      return;
    }

    const { empresaId } = authContext;

    const hasAccess = await ensureOpportunityAccess(opportunityId, empresaId);
    if (!hasAccess) {
      return res.status(404).json({ error: 'Oportunidade não encontrada' });
    }

    const result = await pool.query<OpportunityDocumentRow>(
      `SELECT id, oportunidade_id, template_id, title, content, variables, created_at
       FROM public.oportunidade_documentos
       WHERE oportunidade_id = $1
       ORDER BY created_at DESC, id DESC`,
      [opportunityId],
    );

    const documents = result.rows.map(mapDocumentRow);

    return res.json({ documents });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const getOpportunityDocument = async (req: Request, res: Response) => {
  const { id, documentId } = req.params;

  const opportunityId = Number(id);
  const docId = Number(documentId);

  if (!Number.isFinite(opportunityId) || !Number.isFinite(docId)) {
    return res.status(400).json({ error: 'Parâmetros inválidos' });
  }

  try {
    const authContext = await resolveAuthenticatedContext(req, res);
    if (!authContext.ok) {
      return;
    }

    const { empresaId } = authContext;

    const hasAccess = await ensureOpportunityAccess(opportunityId, empresaId);
    if (!hasAccess) {
      return res.status(404).json({ error: 'Oportunidade não encontrada' });
    }

    const result = await pool.query<OpportunityDocumentRow>(
      `SELECT id, oportunidade_id, template_id, title, content, variables, created_at
       FROM public.oportunidade_documentos
       WHERE oportunidade_id = $1 AND id = $2`,
      [opportunityId, docId],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Documento não encontrado' });
    }

    return res.json(mapDocumentRow(result.rows[0]));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteOpportunityDocument = async (req: Request, res: Response) => {
  const { id, documentId } = req.params;

  const opportunityId = Number(id);
  const docId = Number(documentId);

  if (!Number.isFinite(opportunityId) || !Number.isFinite(docId)) {
    return res.status(400).json({ error: 'Parâmetros inválidos' });
  }

  try {
    const authContext = await resolveAuthenticatedContext(req, res);
    if (!authContext.ok) {
      return;
    }

    const { empresaId } = authContext;

    const hasAccess = await ensureOpportunityAccess(opportunityId, empresaId);
    if (!hasAccess) {
      return res.status(404).json({ error: 'Oportunidade não encontrada' });
    }

    const result = await pool.query(
      'DELETE FROM public.oportunidade_documentos WHERE oportunidade_id = $1 AND id = $2 RETURNING id',
      [opportunityId, docId],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Documento não encontrado' });
    }

    return res.status(204).send();
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const __test__ = {
  buildVariables,
  fetchOpportunityData,
};
