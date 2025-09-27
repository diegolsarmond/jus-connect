import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { AlertCircle, ArrowLeft, Clock, Newspaper } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getApiUrl } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  formatResponseKey,
  mapApiJuditRequest,
  parseOptionalString,
  parseResponseDataFromResult,
  parseTrackingSummaryFromResult,
  type ApiProcessoJuditRequest,
  type ProcessoJuditRequest,
  type ProcessoResponseData,
  type ProcessoTrackingSummary,
} from "./utils/judit";

interface ApiProcessoCliente {
  id?: number | null;
  nome?: string | null;
  documento?: string | null;
  tipo?: string | null;
}

interface ApiProcessoMovimentacao {
  id?: number | string | null;
  data?: string | null;
  tipo?: string | null;
  tipo_publicacao?: string | null;
  classificacao_predita?: Record<string, unknown> | null;
  conteudo?: string | null;
  texto_categoria?: string | null;
  fonte?: Record<string, unknown> | null;
  criado_em?: string | null;
  atualizado_em?: string | null;
}

interface ApiProcessoOportunidade {
  id?: number | string | null;
  sequencial_empresa?: number | string | null;
  data_criacao?: string | null;
  numero_processo_cnj?: string | null;
  numero_protocolo?: string | null;
  solicitante_id?: number | string | null;
  solicitante_nome?: string | null;
}

export interface ApiProcessoResponse {
  id?: number | null;
  cliente_id?: number | null;
  numero?: string | null;
  uf?: string | null;
  municipio?: string | null;
  orgao_julgador?: string | null;
  tipo?: string | null;
  status?: string | null;
  classe_judicial?: string | null;
  assunto?: string | null;
  jurisdicao?: string | null;
  advogado_responsavel?: string | null;
  data_distribuicao?: string | null;
  criado_em?: string | null;
  atualizado_em?: string | null;
  cliente?: ApiProcessoCliente | null;
  oportunidade_id?: number | string | null;
  oportunidade?: ApiProcessoOportunidade | null;
  movimentacoes?: ApiProcessoMovimentacao[] | null;
  movimentacoes_count?: number | string | null;
  consultas_api_count?: number | string | null;
  ultima_sincronizacao?: string | null;
  judit_tracking_id?: string | null;
  judit_tracking_hour_range?: string | null;
  judit_last_request?: ApiProcessoJuditRequest | null;
}

interface ProcessoPropostaDetalhe {
  id: number;
  label: string;
  solicitante?: string | null;
  dataCriacao?: string | null;
  sequencial?: number | null;
}

export interface ProcessoDetalhes {
  id: number;
  numero: string;
  status: string;
  tipo: string;
  classeJudicial: string;
  assunto: string;
  jurisdicao: string;
  orgaoJulgador: string;
  advogadoResponsavel: string;
  dataDistribuicao: string | null;
  dataDistribuicaoFormatada: string;
  criadoEm: string | null;
  atualizadoEm: string | null;
  uf: string | null;
  municipio: string | null;
  cliente: {
    id: number | null;
    nome: string;
    documento: string | null;
    papel: string;
  } | null;
  proposta: ProcessoPropostaDetalhe | null;
  consultasApiCount: number;
  ultimaSincronizacao: string | null;
  movimentacoesCount: number;
  movimentacoes: ProcessoMovimentacaoDetalhe[];
  juditTrackingId: string | null;
  juditTrackingHourRange: string | null;
  juditLastRequest: ProcessoJuditRequest | null;
  trackingSummary: ProcessoTrackingSummary | null;
  responseData: ProcessoResponseData | null;
}

interface ProcessoMovimentacaoDetalhe {
  id: string;
  data: string | null;
  dataFormatada: string | null;
  tipo: string;
  tipoPublicacao: string | null;
  conteudo: string | null;
  textoCategoria: string | null;
  classificacao: {
    nome: string;
    descricao: string | null;
    hierarquia: string | null;
  } | null;
  fonte: {
    nome: string | null;
    sigla: string | null;
    tipo: string | null;
    caderno: string | null;
    grau: string | null;
    grauFormatado: string | null;
  } | null;
  criadoEm: string | null;
  atualizadoEm: string | null;
}

const formatDateToPtBR = (value: string | null | undefined): string | null => {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleDateString("pt-BR");
};

const formatDateTimeToPtBR = (value: string | null | undefined): string => {
  if (!value) {
    return "Date not available";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Date not available";
  }

  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatDateTimeOrNull = (value: string | null | undefined): string | null => {
  if (!value) {
    return null;
  }

  const formatted = formatDateTimeToPtBR(value);
  return formatted === "Date not available" ? null : formatted;
};

const normalizeString = (value: unknown): string => {
  if (typeof value !== "string") {
    return "";
  }

  const trimmed = value.trim();
  return trimmed || "";
};

const normalizeClienteTipo = (value: string | null | undefined): string => {
  if (!value) {
    return "";
  }

  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
};

const resolveClientePapel = (tipo: string | null | undefined): string => {
  const normalized = normalizeClienteTipo(tipo);

  if (
    normalized.includes("JURIDICA") ||
    ["2", "J", "PJ"].includes(normalized)
  ) {
    return "Corporate entity";
  }

  if (
    normalized.includes("FISICA") ||
    ["1", "F", "PF"].includes(normalized)
  ) {
    return "Individual";
  }

  return "Party";
};

const parseOptionalInteger = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const parsed = Number.parseInt(trimmed, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
};

const formatPropostaLabel = (
  id: number,
  sequencial: number | null,
  dataCriacao: string | null,
  solicitante?: string | null,
): string => {
  const numero = sequencial && sequencial > 0 ? sequencial : id;
  let ano = new Date().getFullYear();

  if (dataCriacao) {
    const parsed = new Date(dataCriacao);
    if (!Number.isNaN(parsed.getTime())) {
      ano = parsed.getFullYear();
    }
  }

  const solicitanteNome =
    typeof solicitante === "string" && solicitante.trim().length > 0
      ? solicitante.trim()
      : "";

  return `Proposal #${numero}/${ano}${solicitanteNome ? ` - ${solicitanteNome}` : ""}`;
};

const parseInteger = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return 0;
    }

    const parsed = Number.parseInt(trimmed, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
};

const decodeHtmlEntities = (value: string): string =>
  value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/");

const normalizeMovimentacaoText = (
  value: string | null | undefined,
): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const decoded = decodeHtmlEntities(value)
    .replace(/\r\n/g, "\n")
    .replace(/\u00a0/g, " ");

  const trimmed = decoded.trim();
  return trimmed ? trimmed : null;
};

const mapApiMovimentacoes = (
  value: unknown,
): ProcessoMovimentacaoDetalhe[] => {
  const movimentacoes: ProcessoMovimentacaoDetalhe[] = [];

  const processItem = (item: unknown) => {
    if (!item || typeof item !== "object") {
      return;
    }

    const raw = item as ApiProcessoMovimentacao;
    const idCandidate = raw.id ?? null;
    let id: string | null = null;

    if (typeof idCandidate === "number" && Number.isFinite(idCandidate)) {
      id = String(Math.trunc(idCandidate));
    } else if (typeof idCandidate === "string") {
      const trimmed = idCandidate.trim();
      if (trimmed) {
        id = trimmed;
      }
    }

    if (!id) {
      return;
    }

    const dataValue = normalizeString(raw.data) || null;
    const dataFormatada = dataValue ? formatDateToPtBR(dataValue) : null;
    const tipo = normalizeString(raw.tipo) || "Update";
    const tipoPublicacao = normalizeString(raw.tipo_publicacao) || null;
    const conteudo = normalizeMovimentacaoText(raw.conteudo);
    const textoCategoria = normalizeMovimentacaoText(raw.texto_categoria);

    let classificacao: ProcessoMovimentacaoDetalhe["classificacao"] = null;
    const rawClassificacao = raw.classificacao_predita;

    if (rawClassificacao && typeof rawClassificacao === "object") {
      const classificacaoObj = rawClassificacao as Record<string, unknown>;
      const nome = normalizeString(classificacaoObj.nome);
      const descricao = normalizeMovimentacaoText(
        typeof classificacaoObj.descricao === "string"
          ? classificacaoObj.descricao
          : null,
      );
      const hierarquia = normalizeString(classificacaoObj.hierarquia);

      if (nome || descricao || hierarquia) {
        classificacao = {
          nome: nome || "Predicted classification",
          descricao,
          hierarquia: hierarquia || null,
        };
      }
    }

    let fonte: ProcessoMovimentacaoDetalhe["fonte"] = null;
    const rawFonte = raw.fonte;

    if (rawFonte && typeof rawFonte === "object") {
      const fonteObj = rawFonte as Record<string, unknown>;
      const nome = normalizeString(fonteObj.nome) || null;
      const sigla = normalizeString(fonteObj.sigla) || null;
      const tipoFonte = normalizeString(fonteObj.tipo) || null;
      const caderno = normalizeString(fonteObj.caderno) || null;
      const grauFormatado = normalizeString(fonteObj.grau_formatado) || null;
      const grauValue =
        normalizeString(fonteObj.grau) ||
        (typeof fonteObj.grau === "number" ? String(fonteObj.grau) : null);

      if (nome || sigla || tipoFonte || caderno || grauFormatado || grauValue) {
        fonte = {
          nome,
          sigla,
          tipo: tipoFonte,
          caderno,
          grau: grauValue,
          grauFormatado,
        };
      }
    }

    movimentacoes.push({
      id,
      data: dataValue,
      dataFormatada: dataFormatada ?? dataValue,
      tipo,
      tipoPublicacao,
      conteudo,
      textoCategoria,
      classificacao,
      fonte,
      criadoEm: normalizeString(raw.criado_em) || null,
      atualizadoEm: normalizeString(raw.atualizado_em) || null,
    });
  };

  if (Array.isArray(value)) {
    value.forEach(processItem);
    return movimentacoes;
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        parsed.forEach(processItem);
      } else {
        processItem(parsed);
      }
    } catch {
      // ignore invalid JSON
    }

    return movimentacoes;
  }

  if (value && typeof value === "object") {
    const possibleRows = (value as { rows?: unknown[] }).rows;
    if (Array.isArray(possibleRows)) {
      possibleRows.forEach(processItem);
    }
  }

  return movimentacoes;
};

const buildDocumentoLinksMap = (
  primary: unknown,
  ...fallbacks: unknown[]
): Record<string, string> => {
  const links: Record<string, string> = {};

  const addLink = (keyHint: string, rawValue: unknown) => {
    if (typeof rawValue !== "string") {
      return;
    }

    const trimmedValue = rawValue.trim();
    if (!trimmedValue) {
      return;
    }

    const baseKey = keyHint ? keyHint.trim().toLowerCase() : "link";
    let candidateKey = baseKey || "link";
    let counter = 1;

    while (links[candidateKey] && links[candidateKey] !== trimmedValue) {
      candidateKey = `${baseKey || "link"}_${counter}`;
      counter += 1;
    }

    if (!links[candidateKey]) {
      links[candidateKey] = trimmedValue;
    }
  };

  const processValue = (value: unknown) => {
    if (Array.isArray(value)) {
      value.forEach((entry, index) => {
        if (typeof entry === "string") {
          addLink(`link_${index + 1}`, entry);
          return;
        }

        if (!entry || typeof entry !== "object") {
          return;
        }

        const entryObj = entry as Record<string, unknown>;
        const rel =
          typeof entryObj.rel === "string"
            ? entryObj.rel
            : typeof entryObj.tipo === "string"
              ? entryObj.tipo
              : "";
        const href =
          typeof entryObj.href === "string"
            ? entryObj.href
            : typeof entryObj.url === "string"
              ? entryObj.url
              : typeof entryObj.link === "string"
                ? entryObj.link
                : null;

        addLink(rel || `link_${index + 1}`, href);
      });
      return;
    }

    if (value && typeof value === "object") {
      Object.entries(value as Record<string, unknown>).forEach(([rawKey, rawValue]) => {
        const key = typeof rawKey === "string" ? rawKey : String(rawKey);
        addLink(key, rawValue);
      });
      return;
    }

    addLink("link", value);
  };

  processValue(primary);
  fallbacks.forEach((fallback, index) => addLink(`fallback_${index + 1}`, fallback));

  return links;
};

const ABSOLUTE_LINK_PATTERN = /^[a-z][a-z\d+\-.]*:/i;

const resolveDocumentoLinkHref = (href: unknown): string | null => {
  if (typeof href !== "string") {
    return null;
  }

  const trimmed = href.trim();
  if (!trimmed) {
    return null;
  }

  if (ABSOLUTE_LINK_PATTERN.test(trimmed)) {
    return trimmed;
  }

  if (trimmed.startsWith("//")) {
    const protocol =
      typeof window !== "undefined" && window.location?.protocol
        ? window.location.protocol
        : "https:";
    return `${protocol}${trimmed}`;
  }

  const normalizedPath = trimmed.replace(/^\/+/, "");
  const withoutApiPrefix = normalizedPath.replace(/^api\/+/, "");

  return getApiUrl(withoutApiPrefix);
};

const normalizeDocumentoLinks = (
  links: Record<string, string>,
): Record<string, string> => {
  const normalizedEntries = Object.entries(links).reduce<Record<string, string>>(
    (acc, [key, value]) => {
      const resolved = resolveDocumentoLinkHref(value);

      if (resolved) {
        acc[key] = resolved;
      }

      return acc;
    },
    {},
  );

  return normalizedEntries;
};




export const mapApiProcessoToDetalhes = (
  processo: ApiProcessoResponse,
  fallbackId?: string | number,
): ProcessoDetalhes => {
  const rawNumero = normalizeString(processo.numero);
  const rawStatus = normalizeString(processo.status) || NOT_INFORMED_LABEL;
  const rawTipo = normalizeString(processo.tipo) || NOT_INFORMED_LABEL;
  const rawClasse = normalizeString(processo.classe_judicial) || NOT_INFORMED_LABEL;
  const rawAssunto = normalizeString(processo.assunto) || NOT_INFORMED_LABEL;
  const rawOrgao = normalizeString(processo.orgao_julgador) || NOT_INFORMED_LABEL;
  const rawAdvogado =
    normalizeString(processo.advogado_responsavel) || NOT_INFORMED_LABEL;
  const rawMunicipio = normalizeString(processo.municipio);
  const rawUf = normalizeString(processo.uf);
  const jurisdicao =
    normalizeString(processo.jurisdicao) ||
    [rawMunicipio, rawUf].filter(Boolean).join(" - ") ||
    NOT_INFORMED_LABEL;
  const dataDistribuicao = normalizeString(processo.data_distribuicao) || null;
  const oportunidadeResumo = processo.oportunidade ?? null;
  const oportunidadeId = parseOptionalInteger(
    processo.oportunidade_id ?? oportunidadeResumo?.id ?? null,
  );
  const oportunidadeSequencial = parseOptionalInteger(
    oportunidadeResumo?.sequencial_empresa,
  );
  const oportunidadeDataCriacao =
    typeof oportunidadeResumo?.data_criacao === "string"
      ? oportunidadeResumo.data_criacao
      : null;
  const oportunidadeSolicitante =
    normalizeString(oportunidadeResumo?.solicitante_nome) || null;

  const clienteResumo = processo.cliente ?? null;
  const clienteId =
    typeof clienteResumo?.id === "number"
      ? clienteResumo.id
      : typeof processo.cliente_id === "number"
        ? processo.cliente_id
        : null;
  const clienteNome =
    normalizeString(clienteResumo?.nome) || "Client not provided";
  const clienteDocumento = normalizeString(clienteResumo?.documento) || null;
  const clientePapel = resolveClientePapel(clienteResumo?.tipo);
  const movimentacoes = mapApiMovimentacoes(processo.movimentacoes);
  const consultasApiCount = parseInteger(processo.consultas_api_count);
  const movimentacoesCount = Math.max(
    parseInteger(processo.movimentacoes_count),
    movimentacoes.length,
  );
  const juditTrackingId = normalizeString(processo.judit_tracking_id) || null;
  const juditTrackingHourRange =
    normalizeString(processo.judit_tracking_hour_range) || null;
  const juditLastRequest = mapApiJuditRequest(processo.judit_last_request);
  const trackingSummary = juditLastRequest
    ? parseTrackingSummaryFromResult(juditLastRequest.result)
    : null;
  const responseData = juditLastRequest
    ? parseResponseDataFromResult(juditLastRequest.result)
    : null;
  const proposta =
    oportunidadeId && oportunidadeId > 0
      ? {
          id: oportunidadeId,
          label: formatPropostaLabel(
            oportunidadeId,
            oportunidadeSequencial,
            oportunidadeDataCriacao,
            oportunidadeSolicitante,
          ),
          solicitante: oportunidadeSolicitante,
          dataCriacao: oportunidadeDataCriacao,
          sequencial: oportunidadeSequencial,
        }
      : null;

  return {
    id:
      typeof processo.id === "number"
        ? processo.id
        : Number.parseInt(String(processo.id ?? fallbackId ?? 0), 10) || 0,
    numero: rawNumero || NOT_INFORMED_LABEL,
    status: rawStatus,
    tipo: rawTipo,
    classeJudicial: rawClasse,
    assunto: rawAssunto,
    jurisdicao,
    orgaoJulgador: rawOrgao,
    advogadoResponsavel: rawAdvogado,
    dataDistribuicao,
    dataDistribuicaoFormatada: formatDateToPtBR(dataDistribuicao),
    criadoEm: processo.criado_em ?? null,
    atualizadoEm: processo.atualizado_em ?? null,
    uf: rawUf || null,
    municipio: rawMunicipio || null,
    cliente: clienteResumo
      ? {
          id: clienteId,
          nome: clienteNome,
          documento: clienteDocumento,
          papel: clientePapel,
        }
      : null,
    proposta,
    consultasApiCount,
    ultimaSincronizacao: processo.ultima_sincronizacao ?? null,
    movimentacoesCount,
    movimentacoes,
    juditTrackingId,
    juditTrackingHourRange,
    juditLastRequest,
    trackingSummary,
    responseData,
  };
};

const getStatusBadgeClassName = (status: string) => {
  const normalized = status.toLowerCase();

  if (
    normalized.includes("andamento") ||
    normalized.includes("ativo") ||
    normalized.includes("progress") ||
    normalized.includes("active")
  ) {
    return "border-emerald-200 bg-emerald-500/10 text-emerald-600";
  }

  if (normalized.includes("arquiv") || normalized.includes("archive")) {
    return "border-slate-200 bg-slate-500/10 text-slate-600";
  }

  if (normalized.includes("urg") || normalized.includes("urgent")) {
    return "border-amber-200 bg-amber-500/10 text-amber-600";
  }

  return "border-primary/20 bg-primary/5 text-primary";
};

const getTipoBadgeClassName = (tipo: string) => {
  if (!tipo) {
    return "border-muted-foreground/20 bg-muted text-muted-foreground";
  }

  const normalized = tipo.toLowerCase();

  if (normalized === "não informado" || normalized === "not informed") {
    return "border-muted-foreground/20 bg-muted text-muted-foreground";
  }

  return "border-blue-200 bg-blue-500/10 text-blue-600";
};

interface ProcessoAttachmentsSectionProps {
  attachments: Record<string, unknown>[];
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  processoId: number;
}

const ATTACHMENT_PAGE_SIZE_OPTIONS = [5, 10, 20, 50];
const HISTORY_PAGE_SIZE_OPTIONS = [5, 10, 20, 30];

type ProcessoTab = "overview" | "attachments" | "timeline";

const resolveTabValue = (value: string | null | undefined): ProcessoTab | null => {
  switch (value) {
    case "overview":
    case "attachments":
    case "timeline":
      return value;
    case "resumo":
      return "overview";
    case "anexos":
      return "attachments";
    case "historico":
      return "timeline";
    default:
      return null;
  }
};

const EN_US_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "2-digit",
  year: "numeric",
});

const EN_US_WEEKDAY_FORMATTER = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
});

const EN_US_TIME_FORMATTER = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  minute: "2-digit",
});

const EN_US_DATE_TIME_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const EXCERPT_CHARACTER_LIMIT = 320;
const NOT_INFORMED_LABEL = "Not informed";

const formatDateToEnUS = (value: string | null | undefined): string | null => {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return EN_US_DATE_FORMATTER.format(parsed);
};

const formatDateTimeToEnUS = (value: string | null | undefined): string => {
  if (!value) {
    return "Date not available";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "Date not available";
  }

  return EN_US_DATE_TIME_FORMATTER.format(parsed);
};

const MOVEMENT_TRANSLATION_RULES: {
  pattern: RegExp;
  translation: string;
  keepRest?: boolean;
}[] = [
  { pattern: /^Pet[ií]ção Inicial\b/i, translation: "Initial petition" },
  { pattern: /^Pet[ií]ção\b/i, translation: "Petition", keepRest: true },
  { pattern: /^Juntada\b/i, translation: "Document filing", keepRest: true },
  { pattern: /^Decis[aã]o\b/i, translation: "Decision", keepRest: true },
  { pattern: /^Despacho\b/i, translation: "Order", keepRest: true },
  { pattern: /^Intima[cç][aã]o\b/i, translation: "Notice", keepRest: true },
  { pattern: /^Cita[cç][aã]o\b/i, translation: "Service of process", keepRest: true },
  { pattern: /^Certid[aã]o\b/i, translation: "Certificate", keepRest: true },
  { pattern: /^Contest[aã]?[cç][aã]o\b/i, translation: "Defense brief", keepRest: true },
  { pattern: /^Impugna[cç][aã]o\b/i, translation: "Objection", keepRest: true },
  {
    pattern: /^Manifest[aã]?[cç][aã]o da Advocacia P[uú]blica\b/i,
    translation: "Public attorney statement",
    keepRest: true,
  },
  { pattern: /^Manifest[aã]?[cç][aã]o\b/i, translation: "Statement", keepRest: true },
  {
    pattern: /^Arquivado Definitivamente\b/i,
    translation: "Case archived permanently",
  },
  { pattern: /^Recebidos os autos\b/i, translation: "Case files received" },
  { pattern: /^Conclusos para despacho\b/i, translation: "Submitted for order" },
  {
    pattern: /^Classe Processual alterada\b/i,
    translation: "Case class updated",
    keepRest: true,
  },
  {
    pattern: /^Expedi[cç][aã]o de comunica[cç][aã]o via sistema\b/i,
    translation: "Communication issued via system",
  },
  {
    pattern: /^Decorrido prazo de\s*/i,
    translation: "Deadline expired for ",
    keepRest: true,
  },
  {
    pattern: /^Remetidos os Autos\b/i,
    translation: "Case files forwarded",
    keepRest: true,
  },
  {
    pattern: /^Proferido despacho de mero expediente\b/i,
    translation: "Routine order issued",
  },
];

const SECONDARY_TRANSLATIONS: { pattern: RegExp; replacement: string }[] = [
  {
    pattern: /Aviso de Recebimento/gi,
    replacement: "Return receipt",
  },
  {
    pattern: /Turma Recursal/gi,
    replacement: "Appellate panel",
  },
  {
    pattern: /Juizado Especial/gi,
    replacement: "Small claims court",
  },
  {
    pattern: /Perdas e Danos/gi,
    replacement: "Losses and damages",
  },
  {
    pattern: /Indeniza[cç][aã]o por Dano Moral/gi,
    replacement: "Moral damages claim",
  },
];

const JUDGE_KEYWORDS = [
  "despacho",
  "decisao",
  "decisão",
  "sentenca",
  "sentença",
  "acordao",
  "acórdão",
  "relator",
  "relatório",
  "relatorio",
  "juiz",
  "magistrado",
  "poder judiciario",
];

interface TimelineEntry {
  id: string;
  dateKey: string;
  dateLabel: string;
  weekdayLabel: string | null;
  timeLabel: string | null;
  type: string;
  publicationType: string | null;
  classification: string | null;
  source: string | null;
  recordedAt: string | null;
  updatedAt: string | null;
  content: string | null;
  excerpt: string | null;
  hasMoreContent: boolean;
  isJudgeDocument: boolean;
}

interface TimelineGroup {
  dateKey: string;
  dateLabel: string;
  weekdayLabel: string | null;
  items: TimelineEntry[];
}

const translateLabelToEnglish = (value: string | null | undefined): string => {
  if (!value) {
    return "Not informed";
  }

  let result = value.trim();

  if (!result) {
    return "Not informed";
  }

  for (const rule of MOVEMENT_TRANSLATION_RULES) {
    if (rule.pattern.test(result)) {
      if (rule.keepRest) {
        const matched = result.match(rule.pattern)?.[0] ?? "";
        const rest = result.slice(matched.length).trim();
        result = rest ? `${rule.translation} — ${rest}` : rule.translation;
      } else {
        result = rule.translation;
      }
      break;
    }
  }

  for (const replacement of SECONDARY_TRANSLATIONS) {
    if (replacement.pattern.test(result)) {
      result = result.replace(replacement.pattern, replacement.replacement);
    }
  }

  const normalized = result.charAt(0).toUpperCase() + result.slice(1);
  return normalized;
};

const parseDateFromKnownFormats = (
  ...values: (string | null | undefined)[]
): Date | null => {
  for (const value of values) {
    if (!value) {
      continue;
    }

    const trimmed = value.trim();
    if (!trimmed) {
      continue;
    }

    const parsedTimestamp = Date.parse(trimmed);
    if (!Number.isNaN(parsedTimestamp)) {
      return new Date(parsedTimestamp);
    }

    const match = trimmed.match(
      /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/,
    );

    if (match) {
      const [, day, month, year, hour = "0", minute = "0", second = "0"] = match;
      return new Date(
        Number(year),
        Number(month) - 1,
        Number(day),
        Number(hour),
        Number(minute),
        Number(second),
      );
    }
  }

  return null;
};

const formatDateLabel = (date: Date | null): string => {
  if (!date) {
    return "Date not available";
  }

  return EN_US_DATE_FORMATTER.format(date);
};

const formatWeekdayLabel = (date: Date | null): string | null => {
  if (!date) {
    return null;
  }

  return EN_US_WEEKDAY_FORMATTER.format(date);
};

const formatTimeLabel = (date: Date | null): string | null => {
  if (!date) {
    return null;
  }

  return EN_US_TIME_FORMATTER.format(date);
};

const dedupeMovements = (
  movements: ProcessoMovimentacaoDetalhe[],
): ProcessoMovimentacaoDetalhe[] => {
  const seenIds = new Set<string>();
  const seenContent = new Set<string>();
  const result: ProcessoMovimentacaoDetalhe[] = [];

  movements.forEach((movement) => {
    if (!movement.id) {
      return;
    }

    const normalizedId = movement.id.trim();
    const normalizedContentKey = [
      (movement.data ?? "").slice(0, 10),
      movement.tipo.trim().toLowerCase(),
      (movement.conteudo ?? "").replace(/\s+/g, " ").toLowerCase(),
      (movement.textoCategoria ?? "").replace(/\s+/g, " ").toLowerCase(),
    ].join("|");

    if (seenIds.has(normalizedId) || seenContent.has(normalizedContentKey)) {
      return;
    }

    seenIds.add(normalizedId);
    seenContent.add(normalizedContentKey);
    result.push(movement);
  });

  return result;
};

const buildSourceDescription = (
  fonte: ProcessoMovimentacaoDetalhe["fonte"],
): string | null => {
  if (!fonte) {
    return null;
  }

  const parts = [
    fonte.nome ? translateLabelToEnglish(fonte.nome) : fonte.sigla ?? null,
    fonte.tipo ? translateLabelToEnglish(fonte.tipo) : null,
    fonte.caderno ? translateLabelToEnglish(fonte.caderno) : null,
    fonte.grauFormatado
      ? translateLabelToEnglish(fonte.grauFormatado)
      : fonte.grau
        ? translateLabelToEnglish(fonte.grau)
        : null,
  ].filter(Boolean) as string[];

  if (parts.length === 0) {
    return null;
  }

  return parts.join(" · ");
};

const isJudgeMovement = (movement: ProcessoMovimentacaoDetalhe): boolean => {
  const content = [
    movement.tipo,
    movement.tipoPublicacao,
    movement.classificacao?.nome ?? null,
    movement.conteudo ?? null,
    movement.textoCategoria ?? null,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return JUDGE_KEYWORDS.some((keyword) => content.includes(keyword));
};

const createTimelineEntries = (
  movements: ProcessoMovimentacaoDetalhe[],
): TimelineEntry[] => {
  if (movements.length === 0) {
    return [];
  }

  const uniqueMovements = dedupeMovements(movements);

  const sortedMovements = [...uniqueMovements].sort((a, b) => {
    const dateA =
      parseDateFromKnownFormats(a.data, a.criadoEm, a.atualizadoEm)?.getTime() ?? Number.NEGATIVE_INFINITY;
    const dateB =
      parseDateFromKnownFormats(b.data, b.criadoEm, b.atualizadoEm)?.getTime() ?? Number.NEGATIVE_INFINITY;

    return dateB - dateA;
  });

  return sortedMovements.map((movement) => {
    const movementDate = parseDateFromKnownFormats(
      movement.data,
      movement.dataFormatada,
      movement.criadoEm,
    );

    const excerpt = movement.conteudo
      ? movement.conteudo.length > EXCERPT_CHARACTER_LIMIT
        ? `${movement.conteudo.slice(0, EXCERPT_CHARACTER_LIMIT - 1).trimEnd()}…`
        : movement.conteudo
      : null;

    return {
      id: movement.id,
      dateKey: movementDate ? movementDate.toISOString().slice(0, 10) : "unknown",
      dateLabel: formatDateLabel(movementDate),
      weekdayLabel: formatWeekdayLabel(movementDate),
      timeLabel: formatTimeLabel(movementDate),
      type: translateLabelToEnglish(movement.tipo),
      publicationType: movement.tipoPublicacao
        ? translateLabelToEnglish(movement.tipoPublicacao)
        : null,
      classification: movement.classificacao?.nome
        ? translateLabelToEnglish(movement.classificacao.nome)
        : null,
      source: buildSourceDescription(movement.fonte),
      recordedAt: formatDateTimeOrNull(movement.criadoEm),
      updatedAt: formatDateTimeOrNull(movement.atualizadoEm),
      content: movement.conteudo,
      excerpt,
      hasMoreContent:
        typeof movement.conteudo === "string" && movement.conteudo.length > EXCERPT_CHARACTER_LIMIT,
      isJudgeDocument: isJudgeMovement(movement),
    } satisfies TimelineEntry;
  });
};

const groupTimelineEntries = (entries: TimelineEntry[]): TimelineGroup[] => {
  const groups: TimelineGroup[] = [];
  const groupMap = new Map<string, TimelineGroup>();

  entries.forEach((entry) => {
    const key = entry.dateKey;
    const existing = groupMap.get(key);

    if (existing) {
      existing.items.push(entry);
      return;
    }

    const newGroup: TimelineGroup = {
      dateKey: key,
      dateLabel: entry.dateLabel,
      weekdayLabel: entry.weekdayLabel,
      items: [entry],
    };

    groupMap.set(key, newGroup);
    groups.push(newGroup);
  });

  return groups;
};

const buildPaginationRange = (
  currentPage: number,
  totalPages: number,
): (number | "ellipsis")[] => {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const range: (number | "ellipsis")[] = [1];
  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);

  if (start > 2) {
    range.push("ellipsis");
  }

  for (let page = start; page <= end; page += 1) {
    range.push(page);
  }

  if (end < totalPages - 1) {
    range.push("ellipsis");
  }

  range.push(totalPages);

  return range;
};

export function ProcessoAttachmentsSection({
  attachments,
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  processoId,
}: ProcessoAttachmentsSectionProps) {
  const hasAttachments = totalItems > 0;
  const paginationRange = buildPaginationRange(currentPage, totalPages);
  const displayStart = !hasAttachments ? 0 : (currentPage - 1) * pageSize + 1;
  const displayEnd = !hasAttachments
    ? 0
    : Math.min(displayStart + attachments.length - 1, totalItems);

  const handlePageSizeChange = (value: string) => {
    const parsed = Number(value);

    if (!Number.isFinite(parsed) || parsed <= 0) {
      return;
    }

    onPageSizeChange(parsed);
  };

  const handlePageChange = (page: number) => {
    if (page === currentPage) {
      return;
    }

    onPageChange(page);
  };

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <CardTitle className="text-xl font-semibold">Attachments</CardTitle>
          <CardDescription>
            {hasAttachments
              ? "Review the documents provided by the tracking service."
              : "No attachments have been received yet."}
          </CardDescription>
        </div>
        {hasAttachments ? (
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="font-medium uppercase tracking-wide">Items per page</span>
            <Select value={String(pageSize)} onValueChange={handlePageSizeChange}>
              <SelectTrigger className="h-8 w-[90px] text-xs" aria-label="Items per page">
                <SelectValue placeholder={`${pageSize}`} />
              </SelectTrigger>
              <SelectContent>
                {ATTACHMENT_PAGE_SIZE_OPTIONS.map((option) => (
                  <SelectItem key={option} value={String(option)}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-6">
        {!hasAttachments ? (
          <div className="rounded-lg border border-dashed border-border/60 bg-muted/30 p-4 text-sm text-muted-foreground">
            No attachments have been received yet.
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {attachments.map((anexo, index) => {
                const titulo =
                  parseOptionalString(anexo.titulo) ??
                  parseOptionalString(anexo.title) ??
                  parseOptionalString(anexo.nome) ??
                  parseOptionalString(anexo.attachment_name ?? anexo.attachmentName) ??
                  `Attachment ${index + 1 + (currentPage - 1) * pageSize}`;
                const dataBruta =
                  parseOptionalString(anexo.attachment_date) ??
                  parseOptionalString(anexo.data) ??
                  parseOptionalString(anexo.created_at) ??
                  parseOptionalString(anexo.updated_at) ??
                  parseOptionalString(anexo.criado_em) ??
                  parseOptionalString(anexo.atualizado_em) ??
                  parseOptionalString(anexo.timestamp) ??
                  parseOptionalString(anexo.date) ??
                  null;
                const dataFormatada = formatDateTimeToEnUS(dataBruta);
                const links = normalizeDocumentoLinks(
                  buildDocumentoLinksMap(
                    anexo.links,
                    anexo.href,
                    anexo.url,
                    anexo.link,
                  ),
                );
                const linkEntries = Object.entries(links);

                return (
                  <div
                    key={`${processoId}-anexo-${index}-${titulo}`}
                    className="rounded-md border border-border/40 bg-background/60 p-3"
                  >
                    <p className="text-sm font-medium text-foreground">{titulo}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{dataFormatada}</p>
                    {linkEntries.length > 0 ? (
                      <ul className="mt-2 space-y-1 text-xs text-primary underline">
                        {linkEntries.map(([key, value]) => (
                          <li key={`${processoId}-anexo-${index}-${key}`}>
                            <a
                              href={value}
                              target="_blank"
                              rel="noreferrer"
                              className="hover:text-primary/80"
                            >
                              {formatResponseKey(key)}
                            </a>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                );
              })}
            </div>
            <div className="flex flex-col gap-4 border-t border-border/60 pt-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <span>
                Showing {displayStart}-{displayEnd} of {totalItems} attachments
              </span>
              <Pagination className="sm:justify-end">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      onClick={(event) => {
                        event.preventDefault();
                        if (currentPage > 1) {
                          onPageChange(currentPage - 1);
                        }
                      }}
                      className={currentPage === 1 ? "pointer-events-none opacity-50" : undefined}
                    />
                  </PaginationItem>
                  {paginationRange.map((item, itemIndex) => (
                    <PaginationItem key={`${item}-${itemIndex}`}>
                      {item === "ellipsis" ? (
                        <PaginationEllipsis />
                      ) : (
                        <PaginationLink
                          href="#"
                          size="default"
                          isActive={item === currentPage}
                          onClick={(event) => {
                            event.preventDefault();
                            handlePageChange(item);
                          }}
                        >
                          {item}
                        </PaginationLink>
                      )}
                    </PaginationItem>
                  ))}
                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      onClick={(event) => {
                        event.preventDefault();
                        if (currentPage < totalPages) {
                          onPageChange(currentPage + 1);
                        }
                      }}
                      className={
                        currentPage === totalPages || totalPages === 0
                          ? "pointer-events-none opacity-50"
                          : undefined
                      }
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function VisualizarProcesso() {
  const { processoId } = useParams();
  const navigate = useNavigate();
  const location = useLocation<{ initialTab?: string }>();
  const [loading, setLoading] = useState(true);
  const [processo, setProcesso] = useState<ProcessoDetalhes | null>(null);
  const [error, setError] = useState<string | null>(null);
  const initialTabFromLocation = resolveTabValue(location.state?.initialTab);
  const [activeTab, setActiveTab] = useState<ProcessoTab>(
    initialTabFromLocation ?? "overview",
  );

  useEffect(() => {
    if (!initialTabFromLocation || initialTabFromLocation === activeTab) {
      return;
    }

    setActiveTab(initialTabFromLocation);
  }, [activeTab, initialTabFromLocation]);

  useEffect(() => {
    let cancelled = false;

    const fetchProcesso = async () => {
      if (!processoId) {
        setProcesso(null);
        setError("Invalid case identifier");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const res = await fetch(getApiUrl(`processos/${processoId}`), {
          headers: { Accept: "application/json" },
        });

        const text = await res.text();
        let json: unknown = null;

        if (text) {
          try {
            json = JSON.parse(text);
          } catch (parseError) {
            console.error("Failed to parse case payload", parseError);
          }
        }

        if (!res.ok) {
          const message =
            json && typeof json === "object" &&
            "error" in json &&
            typeof (json as { error: unknown }).error === "string"
              ? (json as { error: string }).error
              : `Failed to load the case (HTTP ${res.status})`;
          throw new Error(message);
        }

        if (!json || typeof json !== "object") {
          throw new Error("Invalid response received while loading the case");
        }

        const processoResponse = json as ApiProcessoResponse;
        const detalhes = mapApiProcessoToDetalhes(processoResponse, processoId);

        if (!cancelled) {
          setProcesso(detalhes);
        }
      } catch (fetchError) {
        const message =
          fetchError instanceof Error
            ? fetchError.message
            : "Failed to load the case details";
        if (!cancelled) {
          setProcesso(null);
          setError(message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchProcesso();

    return () => {
      cancelled = true;
    };
  }, [processoId]);


  const overviewFields = useMemo(() => {
    if (!processo) {
      return [] as { label: string; value: string }[];
    }

    const distributionDate =
      formatDateToEnUS(processo.dataDistribuicao) ??
      processo.dataDistribuicaoFormatada ??
      NOT_INFORMED_LABEL;

    return [
      { label: "Case number", value: processo.numero || NOT_INFORMED_LABEL },
      {
        label: "Status",
        value: translateLabelToEnglish(processo.status) || NOT_INFORMED_LABEL,
      },
      {
        label: "Type",
        value: translateLabelToEnglish(processo.tipo) || NOT_INFORMED_LABEL,
      },
      {
        label: "Judicial class",
        value:
          translateLabelToEnglish(processo.classeJudicial) || NOT_INFORMED_LABEL,
      },
      {
        label: "Subject",
        value: translateLabelToEnglish(processo.assunto) || NOT_INFORMED_LABEL,
      },
      {
        label: "Jurisdiction",
        value:
          translateLabelToEnglish(processo.jurisdicao) || NOT_INFORMED_LABEL,
      },
      {
        label: "Judging body",
        value:
          translateLabelToEnglish(processo.orgaoJulgador) || NOT_INFORMED_LABEL,
      },
      {
        label: "Responsible attorney",
        value:
          translateLabelToEnglish(processo.advogadoResponsavel) ||
          NOT_INFORMED_LABEL,
      },
      {
        label: "Distribution date",
        value: distributionDate,
      },
      {
        label: "Created at",
        value: processo.criadoEm
          ? formatDateTimeToEnUS(processo.criadoEm)
          : "Date not available",
      },
      {
        label: "Updated at",
        value: processo.atualizadoEm
          ? formatDateTimeToEnUS(processo.atualizadoEm)
          : "Date not available",
      },
      {
        label: "Last synchronization",
        value: processo.ultimaSincronizacao
          ? formatDateTimeToEnUS(processo.ultimaSincronizacao)
          : "Date not available",
      },
      {
        label: "Unique timeline updates",
        value: String(totalTimelineEntries),
      },
    ];
  }, [processo, totalTimelineEntries]);

  const statusBadgeLabel = useMemo(() => {
    if (!processo) {
      return null;
    }

    return translateLabelToEnglish(processo.status);
  }, [processo]);

  const typeBadgeLabel = useMemo(() => {
    if (!processo) {
      return null;
    }

    return translateLabelToEnglish(processo.tipo);
  }, [processo]);

  const anexos = processo?.responseData?.anexos ?? [];
  const totalAttachments = anexos.length;
  const [attachmentsPage, setAttachmentsPage] = useState(1);
  const [attachmentsPageSize, setAttachmentsPageSize] = useState(10);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPageSize, setHistoryPageSize] = useState(10);
  const [selectedMovement, setSelectedMovement] = useState<TimelineEntry | null>(null);

  useEffect(() => {
    setAttachmentsPage(1);
  }, [processo?.id]);

  useEffect(() => {
    setHistoryPage(1);
  }, [processo?.id]);

  useEffect(() => {
    setAttachmentsPage(1);
  }, [attachmentsPageSize]);

  useEffect(() => {
    setHistoryPage(1);
  }, [historyPageSize]);

  const attachmentsTotalPages = useMemo(() => {
    if (totalAttachments === 0) {
      return 1;
    }

    return Math.max(1, Math.ceil(totalAttachments / attachmentsPageSize));
  }, [attachmentsPageSize, totalAttachments]);

  const timelineEntries = useMemo(() => {
    if (!processo) {
      return [];
    }

    return createTimelineEntries(processo.movimentacoes);
  }, [processo]);

  const totalTimelineEntries = timelineEntries.length;

  const historyTotalPages = useMemo(() => {
    if (totalTimelineEntries === 0) {
      return 1;
    }

    return Math.max(1, Math.ceil(totalTimelineEntries / historyPageSize));
  }, [historyPageSize, totalTimelineEntries]);

  useEffect(() => {
    setAttachmentsPage((previous) => {
      if (previous > attachmentsTotalPages) {
        return attachmentsTotalPages;
      }

      if (previous < 1) {
        return 1;
      }

      return previous;
    });
  }, [attachmentsTotalPages]);

  useEffect(() => {
    setHistoryPage((previous) => {
      if (previous > historyTotalPages) {
        return historyTotalPages;
      }

      if (previous < 1) {
        return 1;
      }

      return previous;
    });
  }, [historyTotalPages]);

  const paginatedAttachments = useMemo(() => {
    if (totalAttachments === 0) {
      return [];
    }

    const start = (attachmentsPage - 1) * attachmentsPageSize;
    const end = start + attachmentsPageSize;

    return anexos.slice(start, end);
  }, [anexos, attachmentsPage, attachmentsPageSize, totalAttachments]);

  const paginatedTimelineEntries = useMemo(() => {
    if (totalTimelineEntries === 0) {
      return [];
    }

    const start = (historyPage - 1) * historyPageSize;
    const end = start + historyPageSize;

    return timelineEntries.slice(start, end);
  }, [historyPage, historyPageSize, timelineEntries, totalTimelineEntries]);

  const timelineGroups = useMemo(
    () => groupTimelineEntries(paginatedTimelineEntries),
    [paginatedTimelineEntries],
  );

  const hasTimelineEntries = totalTimelineEntries > 0;
  const historyPaginationRange = useMemo(
    () => buildPaginationRange(historyPage, historyTotalPages),
    [historyPage, historyTotalPages],
  );

  const historyDisplayStart = !hasTimelineEntries
    ? 0
    : (historyPage - 1) * historyPageSize + 1;
  const historyDisplayEnd = !hasTimelineEntries
    ? 0
    : Math.min(historyDisplayStart + paginatedTimelineEntries.length - 1, totalTimelineEntries);
  const lastPaginatedEntryId =
    paginatedTimelineEntries.length > 0
      ? paginatedTimelineEntries[paginatedTimelineEntries.length - 1].id
      : null;

  const handleAttachmentsPageChange = useCallback(
    (page: number) => {
      setAttachmentsPage((current) => {
        const nextPage = Math.min(
          Math.max(Number.isFinite(page) ? page : current, 1),
          attachmentsTotalPages,
        );

        return nextPage;
      });
    },
    [attachmentsTotalPages],
  );

  const handleAttachmentsPageSizeChange = useCallback((size: number) => {
    const nextSize = Number.isFinite(size) && size > 0 ? Math.floor(size) : 10;

    setAttachmentsPageSize((currentSize) => {
      if (currentSize === nextSize) {
        return currentSize;
      }

      return nextSize;
    });
  }, []);

  const handleHistoryPageChange = useCallback(
    (page: number) => {
      setHistoryPage((current) => {
        const nextPage = Math.min(
          Math.max(Number.isFinite(page) ? page : current, 1),
          historyTotalPages,
        );

        return nextPage;
      });
    },
    [historyTotalPages],
  );

  const handleHistoryPageSizeChange = useCallback((size: number) => {
    const nextSize = Number.isFinite(size) && size > 0 ? Math.floor(size) : 10;

    setHistoryPageSize((currentSize) => {
      if (currentSize === nextSize) {
        return currentSize;
      }

      return nextSize;
    });
  }, []);

  if (loading && !processo) {
    return (
      <div className="space-y-6 p-4 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <Skeleton className="h-10 w-32" />
          <div className="space-y-2 lg:w-1/2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>

      </div>
    );
  }

  if (!processo) {
    return (
      <div className="space-y-6 p-4 sm:p-6">
        <Button variant="outline" onClick={() => navigate(-1)} className="w-fit">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Unable to load case</AlertTitle>
          <AlertDescription>
            {error ?? "The requested case information could not be found."}

          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <Button variant="outline" onClick={() => navigate(-1)} className="w-fit">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">
            Case {processo.numero}
          </h1>
          <p className="text-sm text-muted-foreground">
            Review the registered case data and keep every update organized in a single workspace.
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="w-full justify-start bg-muted/50">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="attachments">Attachments</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <Card>
            <CardHeader className="space-y-3">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-2xl font-semibold text-foreground">
                    Case overview
                  </CardTitle>
                  <CardDescription>
                    Review the essential data captured for this case.
                  </CardDescription>
                </div>
                {processo ? (
                  <div className="flex flex-wrap items-center gap-2">
                    {statusBadgeLabel ? (
                      <Badge className={`text-xs ${getStatusBadgeClassName(processo.status)}`}>
                        {statusBadgeLabel}
                      </Badge>
                    ) : null}
                    {typeBadgeLabel ? (
                      <Badge
                        variant="outline"
                        className={`text-xs ${getTipoBadgeClassName(processo.tipo)}`}
                      >
                        {typeBadgeLabel}
                      </Badge>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </CardHeader>
            <CardContent>
              {overviewFields.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border/60 bg-muted/30 p-4 text-sm text-muted-foreground">
                  No case information is available.
                </div>
              ) : (
                <dl className="grid gap-4 sm:grid-cols-2">
                  {overviewFields.map((field) => (
                    <div key={field.label} className="space-y-1">
                      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {field.label}
                      </dt>
                      <dd className="text-sm text-foreground">{field.value}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attachments" className="space-y-6">
          <ProcessoAttachmentsSection
            attachments={paginatedAttachments}
            currentPage={attachmentsPage}
            totalPages={attachmentsTotalPages}
            pageSize={attachmentsPageSize}
            totalItems={totalAttachments}
            onPageChange={handleAttachmentsPageChange}
            onPageSizeChange={handleAttachmentsPageSizeChange}
            processoId={processo.id}
          />
        </TabsContent>

        <TabsContent value="timeline" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="space-y-1">
                <CardTitle className="text-xl font-semibold">Case timeline</CardTitle>
                <CardDescription>
                  Explore a chronological view of the official updates recorded for this lawsuit.
                </CardDescription>
              </div>
              {hasTimelineEntries ? (
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-medium uppercase tracking-wide">Items per page</span>
                  <Select
                    value={String(historyPageSize)}
                    onValueChange={(value) => {
                      const parsed = Number(value);
                      if (!Number.isFinite(parsed) || parsed <= 0) {
                        return;
                      }
                      handleHistoryPageSizeChange(parsed);
                    }}
                  >
                    <SelectTrigger className="h-8 w-[90px] text-xs" aria-label="Items per page">
                      <SelectValue placeholder={`${historyPageSize}`} />
                    </SelectTrigger>
                    <SelectContent>
                      {HISTORY_PAGE_SIZE_OPTIONS.map((option) => (
                        <SelectItem key={option} value={String(option)}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
            </CardHeader>
            <CardContent className="space-y-6">
              {!hasTimelineEntries ? (
                <div className="rounded-lg border border-dashed border-border/60 bg-muted/30 p-4 sm:p-6 text-sm text-muted-foreground">
                  No updates have been recorded yet.
                </div>
              ) : (
                <>
                  <div className="space-y-8">
                    {timelineGroups.map((group) => {
                      return (
                        <div key={`${group.dateKey}-${group.dateLabel}`} className="space-y-4">
                          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                            <span className="inline-flex w-fit items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
                              {group.dateLabel}
                            </span>
                            {group.weekdayLabel ? (
                              <span className="text-xs text-muted-foreground capitalize">
                                {group.weekdayLabel}
                              </span>
                            ) : null}
                          </div>
                          <div className="relative pl-6 sm:pl-10">
                            <div
                              className="pointer-events-none absolute left-[11px] top-2 bottom-4 w-px bg-border/60 sm:left-[17px]"
                              aria-hidden
                            />
                            <div className="space-y-6">
                              {group.items.map((entry) => {
                                const isLastInPage = lastPaginatedEntryId === entry.id;
                                const indicatorDotClasses = isLastInPage
                                  ? "bg-muted-foreground"
                                  : "bg-primary";

                                return (
                                  <div key={entry.id} className="relative pl-6 sm:pl-10">
                                    <span
                                      className="absolute left-[-3px] top-2 flex h-4 w-4 items-center justify-center rounded-full border border-border/60 bg-background sm:left-0"
                                      aria-hidden
                                    >
                                      <span className={`h-2 w-2 rounded-full ${indicatorDotClasses}`} />
                                    </span>
                                    <div
                                      className={cn(
                                        "rounded-xl border border-border/60 bg-background/80 p-5 shadow-sm transition hover:border-primary/40 hover:shadow-md",
                                        entry.isJudgeDocument &&
                                          "border-amber-400/70 bg-amber-50/40 dark:bg-amber-500/10",
                                      )}
                                    >
                                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                        <div className="space-y-2">
                                          <div className="flex flex-wrap items-center gap-2">
                                            <p className="text-sm font-semibold text-foreground">{entry.type}</p>
                                            {entry.publicationType ? (
                                              <Badge
                                                variant="outline"
                                                className="rounded-full px-2.5 text-[10px] uppercase tracking-wide"
                                              >
                                                {entry.publicationType}
                                              </Badge>
                                            ) : null}
                                            {entry.classification ? (
                                              <Badge
                                                variant="secondary"
                                                className="rounded-full px-2.5 text-[10px] uppercase tracking-wide"
                                              >
                                                {entry.classification}
                                              </Badge>
                                            ) : null}
                                            {entry.isJudgeDocument ? (
                                              <Badge
                                                variant="destructive"
                                                className="rounded-full px-2.5 text-[10px] uppercase tracking-wide"
                                              >
                                                Judge decision
                                              </Badge>
                                            ) : null}
                                          </div>
                                          {entry.source ? (
                                            <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                                              <Newspaper className="h-3.5 w-3.5" />
                                              <span>{entry.source}</span>
                                            </div>
                                          ) : null}
                                        </div>
                                        <div className="flex flex-col items-start gap-1 text-xs text-muted-foreground sm:items-end">
                                          {entry.timeLabel ? (
                                            <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                                              <Clock className="h-4 w-4 text-primary" />
                                              {entry.timeLabel}
                                            </span>
                                          ) : (
                                            <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                                              <Clock className="h-4 w-4 text-primary" />
                                              Time not available
                                            </span>
                                          )}
                                          {entry.recordedAt ? (
                                            <span>Recorded: {entry.recordedAt}</span>
                                          ) : null}
                                          {entry.updatedAt && entry.updatedAt !== entry.recordedAt ? (
                                            <span>Updated: {entry.updatedAt}</span>
                                          ) : null}
                                        </div>
                                      </div>
                                      {entry.excerpt ? (
                                        <p className="mt-3 whitespace-pre-line text-sm text-muted-foreground">
                                          {entry.excerpt}
                                        </p>
                                      ) : null}
                                      {(entry.hasMoreContent || entry.isJudgeDocument) && entry.content ? (
                                        <Button
                                          variant="outline"
                                          size="xs"
                                          className="mt-3"
                                          onClick={() => setSelectedMovement(entry)}
                                        >
                                          {entry.isJudgeDocument
                                            ? "View judge decision"
                                            : "View full content"}
                                        </Button>
                                      ) : null}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex flex-col gap-4 border-t border-border/60 pt-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                    <span>
                      Showing {historyDisplayStart}-{historyDisplayEnd} of {totalTimelineEntries} updates
                    </span>
                    <Pagination className="sm:justify-end">
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious
                            href="#"
                            onClick={(event) => {
                              event.preventDefault();
                              if (historyPage > 1) {
                                handleHistoryPageChange(historyPage - 1);
                              }
                            }}
                            className={historyPage === 1 ? "pointer-events-none opacity-50" : undefined}
                          />
                        </PaginationItem>
                        {historyPaginationRange.map((item, itemIndex) => (
                          <PaginationItem key={`${item}-${itemIndex}`}>
                            {item === "ellipsis" ? (
                              <PaginationEllipsis />
                            ) : (
                              <PaginationLink
                                href="#"
                                size="default"
                                isActive={item === historyPage}
                                onClick={(event) => {
                                  event.preventDefault();
                                  handleHistoryPageChange(item);
                                }}
                              >
                                {item}
                              </PaginationLink>
                            )}
                          </PaginationItem>
                        ))}
                        <PaginationItem>
                          <PaginationNext
                            href="#"
                            onClick={(event) => {
                              event.preventDefault();
                              if (historyPage < historyTotalPages) {
                                handleHistoryPageChange(historyPage + 1);
                              }
                            }}
                            className={
                              historyPage === historyTotalPages || historyTotalPages === 0
                                ? "pointer-events-none opacity-50"
                                : undefined
                            }
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      <Dialog
        open={selectedMovement !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedMovement(null);
          }
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{selectedMovement?.type ?? "Timeline entry"}</DialogTitle>
            <DialogDescription>
              {selectedMovement
                ? `${selectedMovement.dateLabel}${selectedMovement.timeLabel ? ` • ${selectedMovement.timeLabel}` : ""}`
                : "Detailed information about the selected update."}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh] pr-2">
            <div className="space-y-4 pt-1">
              {selectedMovement?.content ? (
                <p className="whitespace-pre-line text-sm text-foreground">
                  {selectedMovement.content}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No additional text is available for this timeline entry.
                </p>
              )}
              {selectedMovement?.source ? (
                <p className="text-xs text-muted-foreground">Source: {selectedMovement.source}</p>
              ) : null}
              {selectedMovement?.recordedAt ? (
                <p className="text-xs text-muted-foreground">
                  Recorded: {selectedMovement.recordedAt}
                </p>
              ) : null}
              {selectedMovement?.updatedAt &&
              selectedMovement.updatedAt !== selectedMovement.recordedAt ? (
                <p className="text-xs text-muted-foreground">
                  Updated: {selectedMovement.updatedAt}
                </p>
              ) : null}
            </div>
          </ScrollArea>
          <DialogFooter className="sm:justify-end">
            <Button variant="outline" onClick={() => setSelectedMovement(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


