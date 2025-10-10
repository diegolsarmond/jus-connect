import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { getApiUrl } from "@/lib/api";

interface ApiNotification {
  id: string;
  category: string;
  type: string;
  read: boolean;
  createdAt: string;
  readAt?: string | null;
  metadata?: Record<string, unknown> | null;
}

interface NotificationsUnreadResponse {
  unread?: number;
}

export interface ProjudiSyncItem {
  id: number;
  origem: string;
  externalId: string;
  numeroProcesso: string | null;
  orgao: string | null;
  assunto: string | null;
  status: string | null;
  prazo: string | null;
  recebidaEm: string | null;
  fonteCriadaEm: string | null;
  fonteAtualizadaEm: string | null;
  payload: unknown;
  createdAt: string;
  updatedAt: string;
  operation: "inserted" | "updated";
}

export interface ProjudiSyncResult {
  source: string;
  startedAt: string;
  finishedAt: string;
  requestedFrom: string;
  totalFetched: number;
  totalProcessed: number;
  inserted: number;
  updated: number;
  latestSourceTimestamp: string | null;
  items: ProjudiSyncItem[];
}

export interface ProjudiSyncStatus {
  enabled: boolean;
  running: boolean;
  intervalMs: number;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastErrorMessage?: string;
  lastResult?: ProjudiSyncResult;
  lastReferenceUsed: string | null;
  nextReference: string | null;
  nextRunAt: string | null;
  lastManualTriggerAt: string | null;
}

export interface ProjudiSyncPreviewResponse {
  triggered: boolean;
  status?: ProjudiSyncStatus | null;
}

export interface ProjudiSyncTriggerResponse {
  triggered: boolean;
  status: ProjudiSyncStatus;
}

export type ModeloIntimacaoStatus = "Ativo" | "Em revisão" | "Arquivado";

export interface ModeloIntimacao {
  id: string;
  titulo: string;
  descricao: string;
  numeroProcesso: string;
  comarca: string;
  vara: string;
  cliente: string;
  dataDistribuicao: string;
  advogadoResponsavel: string;
  juizResponsavel: string;
  ultimaAtualizacao: string;
  status: ModeloIntimacaoStatus;
  area: string;
  prazoResposta: string;
  tags: string[];
}

export interface IntimacaoMensal {
  mes: string;
  enviadas: number;
  cumpridas: number;
  emAndamento: number;
  pendentes: number;
  prazoMedio: number;
}

export interface IntimacaoStatusDistribuicao {
  status: string;
  value: number;
}

export interface IntimacaoTipoDistribuicao {
  tipo: string;
  value: number;
}

export interface IntimacoesOverviewSummary {
  totalEnviadas: number;
  totalCumpridas: number;
  totalPendentes: number;
  taxaCumprimento: number;
  prazoMedioResposta: number;
}

export interface IntimacoesOverview {
  summary: IntimacoesOverviewSummary;
  intimacoesMensais: IntimacaoMensal[];
  intimacoesPorStatus: IntimacaoStatusDistribuicao[];
  intimacoesPorTipo: IntimacaoTipoDistribuicao[];
  modelos: ModeloIntimacao[];
  unreadCount: number;
  syncStatus: ProjudiSyncStatus | null;
}

interface FetchOptions {
  signal?: AbortSignal;
}

const JSON_HEADERS = { Accept: "application/json" } as const;

const TYPE_LABELS: Record<string, string> = {
  deadline: "Prazos",
  document: "Documentos",
  task: "Tarefas",
  hearing: "Audiências",
};

const MODEL_STATUS_FALLBACK: ModeloIntimacaoStatus = "Ativo";

const COMPLETED_KEYWORDS = ["cumprid", "conclu", "finaliz", "resolvid"];
const IN_PROGRESS_KEYWORDS = ["andament", "analise", "aguard", "process"]; // aguarda, aguardando, etc.
const ARCHIVED_KEYWORDS = ["arquiv", "inativ", "encerr"];
const REVIEW_KEYWORDS = ["revis", "pend", "ajust", "valid"];

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const MONTHS_WINDOW = 6;

type AnyRecord = Record<string, unknown>;

type NotificationStatus = "completed" | "in_progress" | "pending";

type MonthlyAccumulator = {
  label: string;
  year: number;
  month: number;
  enviadas: number;
  completed: number;
  inProgress: number;
  responseTotalDays: number;
  responseCount: number;
};

export interface Intimacao {
  id: number | string;
  siglaTribunal: string | null;
  external_id: string | null;
  numero_processo: string | null;
  nomeOrgao: string | null;
  tipoComunicacao: string | null;
  texto: string | null;
  prazo: string | null;
  data_disponibilizacao: string | null;
  created_at: string | null;
  updated_at: string | null;
  meio: string | null;
  link: string | null;
  tipodocumento: string | null;
  nomeclasse: string | null;
  codigoclasse: string | null;
  numerocomunicacao: string | null;
  ativo: boolean | null;
  hash: string | null;
  status: string | null;
  motivo_cancelamento: string | null;
  data_cancelamento: string | null;
  destinatarios: unknown;
  destinatarios_advogados: unknown;
  idusuario: number | null;
  idempresa: number | null;
  nao_lida: boolean | null;
  arquivada: boolean | null;
}

function isRecord(value: unknown): value is AnyRecord {
  return typeof value === "object" && value !== null;
}

function readString(record: AnyRecord | null | undefined, key: string): string | undefined {
  if (!record) {
    return undefined;
  }

  const value = record[key];
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function readStringFromKeys(record: AnyRecord | null | undefined, keys: string[]): string | undefined {
  if (!record) {
    return undefined;
  }

  for (const key of keys) {
    const value = readString(record, key);
    if (value) {
      return value;
    }
  }

  return undefined;
}

function readStringArray(record: AnyRecord | null | undefined, key: string): string[] | undefined {
  if (!record) {
    return undefined;
  }

  const value = record[key];
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function parseDate(value: unknown): Date | null {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
}

function removeDiacritics(value: string): string {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

function capitalize(value: string): string {
  if (!value) {
    return value;
  }
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function titleize(value: string): string {
  return value
    .split(/[\s_/\-]+/)
    .map((segment) => capitalize(segment.toLowerCase()))
    .join(" ");
}

function formatMonthLabel(date: Date): string {
  const formatted = format(date, "MMM", { locale: ptBR });
  return capitalize(formatted);
}

function formatDisplayDate(value: string | null | undefined): string | undefined {
  const parsed = parseDate(value);
  if (!parsed) {
    return undefined;
  }
  const formatted = format(parsed, "dd MMM yyyy", { locale: ptBR });
  const [day, month, year] = formatted.split(" ");
  if (!day || !month || !year) {
    return capitalize(formatted);
  }
  return `${day} ${capitalize(month)} ${year}`;
}

function formatPrazoResposta(item: ProjudiSyncItem, payload: AnyRecord): string {
  const rawPrazo = readStringFromKeys(payload, ["prazoResposta", "prazo_resposta", "prazo", "deadline"]);
  if (rawPrazo) {
    return rawPrazo;
  }

  const formatted = formatDisplayDate(item.prazo);
  if (formatted) {
    return `Prazo em ${formatted}`;
  }

  const recebida = formatDisplayDate(item.recebidaEm);
  if (recebida) {
    return `Recebida em ${recebida}`;
  }

  return "Prazo não informado";
}

function normalizeNotification(entry: unknown): ApiNotification | null {
  if (!isRecord(entry)) {
    return null;
  }

  const idCandidate = entry.id;
  const createdAtCandidate = entry.createdAt ?? entry.created_at;

  if (typeof idCandidate !== "string" || typeof createdAtCandidate !== "string") {
    return null;
  }

  const category = typeof entry.category === "string" ? entry.category : "";
  const type = typeof entry.type === "string" ? entry.type : "";
  const read = typeof entry.read === "boolean" ? entry.read : Boolean(entry.read_at);
  const readAt = typeof entry.readAt === "string" ? entry.readAt : typeof entry.read_at === "string" ? entry.read_at : null;
  const metadata = isRecord(entry.metadata) ? (entry.metadata as Record<string, unknown>) : null;

  return {
    id: idCandidate,
    category,
    type,
    read,
    createdAt: createdAtCandidate,
    readAt,
    metadata,
  };
}

function inferNotificationStatus(notification: ApiNotification): NotificationStatus {
  if (notification.read) {
    return "completed";
  }

  const meta = notification.metadata ?? {};
  const statusCandidate = readStringFromKeys(meta, ["status", "situacao", "situacaoAtual", "state"]);
  if (statusCandidate) {
    const normalized = removeDiacritics(statusCandidate).toLowerCase();

    if (COMPLETED_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
      return "completed";
    }

    if (IN_PROGRESS_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
      return "in_progress";
    }

    if (normalized.includes("pend")) {
      return "pending";
    }
  }

  return "pending";
}

function createMonthlyBuckets(): Map<string, MonthlyAccumulator> {
  const now = new Date();
  const buckets = new Map<string, MonthlyAccumulator>();

  for (let offset = MONTHS_WINDOW - 1; offset >= 0; offset -= 1) {
    const reference = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const key = `${reference.getFullYear()}-${reference.getMonth()}`;
    buckets.set(key, {
      label: formatMonthLabel(reference),
      year: reference.getFullYear(),
      month: reference.getMonth(),
      enviadas: 0,
      completed: 0,
      inProgress: 0,
      responseTotalDays: 0,
      responseCount: 0,
    });
  }

  return buckets;
}

function computeMonthlyMetrics(notifications: ApiNotification[]): IntimacaoMensal[] {
  const buckets = createMonthlyBuckets();

  for (const notification of notifications) {
    const created = parseDate(notification.createdAt);
    if (!created) {
      continue;
    }

    const bucketKey = `${created.getFullYear()}-${created.getMonth()}`;
    const bucket = buckets.get(bucketKey);
    if (!bucket) {
      continue;
    }

    bucket.enviadas += 1;

    const status = inferNotificationStatus(notification);
    if (status === "completed") {
      bucket.completed += 1;
    } else if (status === "in_progress") {
      bucket.inProgress += 1;
    }

    if (notification.read && notification.readAt) {
      const readAt = parseDate(notification.readAt);
      if (readAt) {
        const diff = (readAt.getTime() - created.getTime()) / MS_PER_DAY;
        if (Number.isFinite(diff) && diff >= 0) {
          bucket.responseTotalDays += diff;
          bucket.responseCount += 1;
        }
      }
    }
  }

  return Array.from(buckets.values()).map((bucket) => {
    const pendentes = Math.max(bucket.enviadas - bucket.completed, 0);
    const prazoMedio = bucket.responseCount > 0 ? bucket.responseTotalDays / bucket.responseCount : 0;

    return {
      mes: bucket.label,
      enviadas: bucket.enviadas,
      cumpridas: bucket.completed,
      emAndamento: bucket.inProgress,
      pendentes,
      prazoMedio,
    };
  });
}

function computeStatusDistribution(notifications: ApiNotification[]): IntimacaoStatusDistribuicao[] {
  let completed = 0;
  let inProgress = 0;

  for (const notification of notifications) {
    const status = inferNotificationStatus(notification);
    if (status === "completed") {
      completed += 1;
    } else if (status === "in_progress") {
      inProgress += 1;
    }
  }

  const totalPendentes = Math.max(notifications.length - completed, 0);
  const pendentes = Math.max(totalPendentes - inProgress, 0);

  return [
    { status: "Cumpridas", value: completed },
    { status: "Em andamento", value: inProgress },
    { status: "Pendentes", value: pendentes },
  ];
}

function resolveTypeLabel(notification: ApiNotification): string {
  const metadata = notification.metadata ?? {};
  const alertTypeCandidate = readStringFromKeys(metadata, ["alertType", "tipo", "type"]);
  if (alertTypeCandidate) {
    const normalized = alertTypeCandidate.trim().toLowerCase();
    return TYPE_LABELS[normalized] ?? titleize(alertTypeCandidate);
  }

  if (notification.type) {
    const normalized = notification.type.trim().toLowerCase();
    if (normalized in TYPE_LABELS) {
      return TYPE_LABELS[normalized];
    }
    return titleize(notification.type);
  }

  if (notification.category) {
    return titleize(notification.category);
  }

  return "Outros";
}

function computeTypeDistribution(notifications: ApiNotification[]): IntimacaoTipoDistribuicao[] {
  const counters = new Map<string, number>();

  for (const notification of notifications) {
    const label = resolveTypeLabel(notification);
    const current = counters.get(label) ?? 0;
    counters.set(label, current + 1);
  }

  return Array.from(counters.entries())
    .sort((a, b) => {
      if (b[1] === a[1]) {
        return a[0].localeCompare(b[0]);
      }
      return b[1] - a[1];
    })
    .map(([tipo, value]) => ({ tipo, value }));
}

function computeAverageResponseDays(notifications: ApiNotification[]): number {
  let total = 0;
  let count = 0;

  for (const notification of notifications) {
    if (!notification.read || !notification.readAt) {
      continue;
    }

    const created = parseDate(notification.createdAt);
    const readAt = parseDate(notification.readAt);
    if (!created || !readAt) {
      continue;
    }

    const diff = (readAt.getTime() - created.getTime()) / MS_PER_DAY;
    if (Number.isFinite(diff) && diff >= 0) {
      total += diff;
      count += 1;
    }
  }

  return count > 0 ? total / count : 0;
}

function mapModeloStatus(rawStatus: string | null | undefined, operation: "inserted" | "updated"): ModeloIntimacaoStatus {
  if (rawStatus) {
    const normalized = removeDiacritics(rawStatus).toLowerCase();

    if (ARCHIVED_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
      return "Arquivado";
    }

    if (REVIEW_KEYWORDS.some((keyword) => normalized.includes(keyword)) || normalized.includes("andament")) {
      return "Em revisão";
    }

    if (normalized.includes("ativo")) {
      return "Ativo";
    }
  }

  if (operation === "updated") {
    return "Em revisão";
  }

  return MODEL_STATUS_FALLBACK;
}

function mapProjudiItemToModelo(item: ProjudiSyncItem): ModeloIntimacao {
  const payload = isRecord(item.payload) ? (item.payload as AnyRecord) : {};

  const id = item.externalId || String(item.id);
  const titulo = readStringFromKeys(payload, ["titulo", "title", "assunto", "descricaoResumo"]) || item.assunto || "Atualização do Projudi";
  const descricao =
    readStringFromKeys(payload, ["descricao", "description", "detalhes", "mensagem"]) ||
    item.orgao ||
    "Detalhes não fornecidos pelo Projudi.";

  const numeroProcesso =
    readStringFromKeys(payload, ["numeroProcesso", "processo", "processNumber"]) || item.numeroProcesso || "Não informado";

  const comarca =
    readStringFromKeys(payload, ["comarca", "comarcaNome", "comarcaDescricao"]) || item.orgao || "Não informado";

  const vara = readStringFromKeys(payload, ["vara", "varaNome", "varaDescricao"]) || "Não informado";
  const cliente = readStringFromKeys(payload, ["cliente", "clienteNome", "parte", "parteNome", "pessoa"]) || "Não informado";
  const advogado =
    readStringFromKeys(payload, ["advogado", "advogadoResponsavel", "responsavel", "representante"]) || "Não informado";
  const juiz = readStringFromKeys(payload, ["juiz", "juizResponsavel", "magistrado"]) || "Não informado";

  const dataDistribuicao =
    formatDisplayDate(item.recebidaEm) ||
    formatDisplayDate(readStringFromKeys(payload, ["dataDistribuicao", "dataRecebimento"])) ||
    "Não informado";

  const ultimaAtualizacao =
    formatDisplayDate(item.updatedAt) ||
    formatDisplayDate(readStringFromKeys(payload, ["ultimaAtualizacao", "atualizadoEm"])) ||
    "Não informado";

  const area = readStringFromKeys(payload, ["area", "assunto", "classeProcessual", "categoria"]) || "Geral";
  const prazoResposta = formatPrazoResposta(item, payload);
  const status = mapModeloStatus(item.status, item.operation);

  const tags = new Set<string>();
  const payloadTags =
    readStringArray(payload, "tags") ||
    readStringArray(payload, "etiquetas") ||
    readStringArray(payload, "labels");

  if (payloadTags) {
    for (const tag of payloadTags) {
      tags.add(titleize(tag));
    }
  }

  if (item.origem) {
    tags.add(titleize(item.origem));
  }

  if (item.operation === "updated") {
    tags.add("Atualizada");
  } else {
    tags.add("Nova");
  }

  return {
    id,
    titulo,
    descricao,
    numeroProcesso,
    comarca,
    vara,
    cliente,
    dataDistribuicao,
    advogadoResponsavel: advogado,
    juizResponsavel: juiz,
    ultimaAtualizacao,
    status,
    area: titleize(area),
    prazoResposta,
    tags: Array.from(tags).filter((tag) => tag.trim().length > 0),
  };
}

async function fetchJson<T>(url: string, { signal }: FetchOptions = {}): Promise<T> {
  const response = await fetch(url, {
    method: "GET",
    headers: JSON_HEADERS,
    signal,
  });

  if (!response.ok) {
    throw new Error(`Falha ao carregar dados (${response.status})`);
  }

  return (await response.json()) as T;
}

export async function fetchIntimacoes(signal?: AbortSignal): Promise<Intimacao[]> {
  const payload = await fetchJson<unknown>(getApiUrl("intimacoes"), { signal });

  if (!Array.isArray(payload)) {
    throw new Error("Resposta inválida ao carregar intimações.");
  }

  return payload as Intimacao[];
}

export async function archiveIntimacao(
  id: number | string,
): Promise<{ id: number; arquivada: boolean; updated_at: string }>
{
  const response = await fetch(getApiUrl(`intimacoes/${id}/archive`), {
    method: "PATCH",
    headers: JSON_HEADERS,
  });

  if (!response.ok) {
    throw new Error(`Falha ao arquivar intimação (${response.status}).`);
  }

  return (await response.json()) as { id: number; arquivada: boolean; updated_at: string };
}

export async function fetchIntimacoesOverview(signal?: AbortSignal): Promise<IntimacoesOverview> {
  const notificationsUrl = new URL(getApiUrl("notifications"));
  notificationsUrl.searchParams.set("category", "projudi");

  const previewUrl = new URL(getApiUrl("notificacoes/projudi/sync"));
  previewUrl.searchParams.set("preview", "true");

  const [notificationsPayload, unreadPayload, previewPayload] = await Promise.all([
    fetchJson<unknown>(notificationsUrl.toString(), { signal }),
    fetchJson<NotificationsUnreadResponse>(getApiUrl("notifications/unread-count"), { signal }),
    fetchJson<ProjudiSyncPreviewResponse>(previewUrl.toString(), { signal }),
  ]);

  const notificationEntries = Array.isArray(notificationsPayload) ? notificationsPayload : [];

  const notifications = notificationEntries
    .map((entry) => normalizeNotification(entry))
    .filter((notification): notification is ApiNotification => Boolean(notification));

  const totalEnviadas = notifications.length;
  const totalCumpridas = notifications.filter((notification) => inferNotificationStatus(notification) === "completed").length;
  const totalPendentes = Math.max(totalEnviadas - totalCumpridas, 0);
  const taxaCumprimento = totalEnviadas > 0 ? (totalCumpridas / totalEnviadas) * 100 : 0;
  const prazoMedioResposta = computeAverageResponseDays(notifications);

  const syncStatus = previewPayload.status ?? null;
  const modelos = syncStatus?.lastResult?.items?.map((item) => mapProjudiItemToModelo(item)) ?? [];

  return {
    summary: {
      totalEnviadas,
      totalCumpridas,
      totalPendentes,
      taxaCumprimento,
      prazoMedioResposta,
    },
    intimacoesMensais: computeMonthlyMetrics(notifications),
    intimacoesPorStatus: computeStatusDistribution(notifications),
    intimacoesPorTipo: computeTypeDistribution(notifications),
    modelos,
    unreadCount: typeof unreadPayload.unread === "number" ? unreadPayload.unread : 0,
    syncStatus,
  };
}

export async function triggerProjudiSync(signal?: AbortSignal): Promise<ProjudiSyncTriggerResponse> {
  return fetchJson<ProjudiSyncTriggerResponse>(getApiUrl("notificacoes/projudi/sync"), { signal });
}

