import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
} from "@/components/ui/pagination";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { SafeMarkdown } from "@/components/ui/safe-markdown";
import {
  archiveIntimacao,
  fetchIntimacoes,
  markIntimacaoAsRead,
  type Intimacao,
  type MarkIntimacaoAsReadResponse,
} from "@/services/intimacoes";
import { fetchIntegrationApiKeys, generateAiText } from "@/lib/integrationApiKeys";
import { getApiUrl } from "@/lib/api";
import { normalizarTexto } from "./utils/processo-ui";
import {
  Archive,
  CalendarPlus,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  ListChecks,
  Loader2,
  RotateCcw,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type NormalizedDestinatario = {
  nome: string;
  polo?: string;
};

type NormalizedAdvogado = {
  nome: string;
  numeroOab?: string;
  ufOab?: string;
};

type PeriodFilter = "all" | "7d" | "30d" | "90d" | "month";
type SituationFilter = "ativas" | "todas" | "arquivadas" | "nao-lidas";

type FiltersState = {
  search: string;
  advogado: string;
  periodo: PeriodFilter;
  situacao: SituationFilter;
  tribunal: string;
  tipo: string;
};

const ITEMS_PER_PAGE = 15;
const numberFormatter = new Intl.NumberFormat("pt-BR");

type MonitoredOab = {
  id: string;
  uf: string;
  number: string;
  usuarioId: string | null;
  usuarioNome: string | null;
  usuarioOabNumero: string | null;
  usuarioOabUf: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

type CompanyUserOption = {
  id: string;
  name: string;
  oabNumber: string | null;
  oabUf: string | null;
};

type ApiCompanyUser = {
  id?: number | string | null;
  id_usuario?: number | string | null;
  idUsuario?: number | string | null;
  idusuario?: number | string | null;
  usuario_id?: number | string | null;
  usuarioId?: number | string | null;
  user_id?: number | string | null;
  userId?: number | string | null;
  codigo?: number | string | null;
  nome_completo?: string | null;
  nome?: string | null;
  nome_usuario?: string | null;
  nomeusuario?: string | null;
  nomeUsuario?: string | null;
  nome_usuario_completo?: string | null;
  email?: string | null;
  oab?: string | null;
  oab_number?: string | null;
  oabNumber?: string | null;
  oab_numero?: string | null;
  oabNumero?: string | null;
  oab_uf?: string | null;
  oabUf?: string | null;
};

type ApiMonitoredOab = {
  id?: number | string | null;
  uf?: string | null;
  numero?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  usuario_id?: number | string | null;
  usuarioId?: number | string | null;
  usuario_nome?: string | null;
  usuarioNome?: string | null;
  usuario_oab_numero?: string | null;
  usuarioOabNumero?: string | null;
  usuario_oab_uf?: string | null;
  usuarioOabUf?: string | null;
};

const pickFirstNonEmptyString = (
  ...values: Array<string | null | undefined>
): string | null => {
  for (const value of values) {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) {
        return trimmed;
      }
    }
  }
  return null;
};

const getNameFromEmail = (value?: string | null): string | null => {
  if (!value) {
    return null;
  }

  const [localPart] = value.split("@");
  if (!localPart) {
    return null;
  }

  const cleaned = localPart.replace(/[._-]+/g, " ").trim();
  if (!cleaned) {
    return null;
  }

  return cleaned.replace(/\b\w/g, (char) => char.toUpperCase());
};

const extractCompanyUserArray = (payload: unknown): ApiCompanyUser[] => {
  if (Array.isArray(payload)) {
    return payload.filter((item): item is ApiCompanyUser => Boolean(item && typeof item === "object"));
  }

  if (!payload || typeof payload !== "object") {
    return [];
  }

  const visited = new Set<object>();
  const queue: unknown[] = [payload];
  const candidateKeys = [
    "usuarios",
    "usuarios_empresa",
    "usuariosEmpresa",
    "usuariosEmpresaRows",
    "lista",
    "items",
    "result",
    "results",
    "records",
    "rows",
    "data",
    "values",
    "payload",
    "content",
    "body",
  ];

  while (queue.length > 0) {
    const current = queue.shift();

    if (!current || typeof current !== "object") {
      continue;
    }

    if (visited.has(current as object)) {
      continue;
    }

    visited.add(current as object);

    for (const key of candidateKeys) {
      const value = (current as Record<string, unknown>)[key];

      if (Array.isArray(value)) {
        const objects = value.filter((item): item is ApiCompanyUser => Boolean(item && typeof item === "object"));
        if (objects.length > 0) {
          return objects;
        }
      }
    }

    for (const value of Object.values(current as Record<string, unknown>)) {
      if (Array.isArray(value)) {
        for (const item of value) {
          if (item && typeof item === "object") {
            queue.push(item);
          }
        }
      } else if (value && typeof value === "object") {
        queue.push(value);
      }
    }
  }

  return [];
};

const extractCompanyUserId = (user: ApiCompanyUser): string | null => {
  const candidates: Array<number | string | null | undefined> = [
    user.id,
    user.id_usuario,
    user.idUsuario,
    user.idusuario,
    user.usuario_id,
    user.usuarioId,
    user.user_id,
    user.userId,
    user.codigo,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      return String(Math.trunc(candidate));
    }

    if (typeof candidate === "string") {
      const trimmed = candidate.trim();
      if (trimmed) {
        return trimmed;
      }
    }
  }

  return null;
};

const sanitizeUfValue = (value: string | null | undefined): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.replace(/[^a-zA-Z]/g, "").slice(0, 2).toUpperCase();
  return normalized.length === 2 ? normalized : null;
};

const sanitizeOabNumberValue = (value: string | null | undefined): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const digits = value.replace(/\D/g, "").slice(0, 12);
  return digits ? digits : null;
};

const extractCombinedOabData = (
  value: string | null | undefined,
): { number: string | null; uf: string | null } => {
  if (typeof value !== "string") {
    return { number: null, uf: null };
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return { number: null, uf: null };
  }

  const normalized = trimmed.replace(/^OAB\s*/i, "");

  if (normalized.includes("/")) {
    const [left, right] = normalized.split("/");
    const number = sanitizeOabNumberValue(left);
    const uf = sanitizeUfValue(right);
    return { number, uf };
  }

  const match = normalized.match(/([A-Za-z]{2})[^A-Za-z0-9]*([0-9]+)/);

  if (match) {
    const [, ufRaw, numberRaw] = match;
    return {
      number: sanitizeOabNumberValue(numberRaw),
      uf: sanitizeUfValue(ufRaw),
    };
  }

  return { number: sanitizeOabNumberValue(normalized), uf: null };
};

const extractCompanyUserOab = (
  user: ApiCompanyUser,
): { number: string | null; uf: string | null } => {
  const explicitNumber = sanitizeOabNumberValue(
    pickFirstNonEmptyString(user.oab_number, user.oabNumber, user.oab_numero, user.oabNumero),
  );
  const explicitUf = sanitizeUfValue(pickFirstNonEmptyString(user.oab_uf, user.oabUf));

  let number = explicitNumber;
  let uf = explicitUf;

  if (!number || !uf) {
    const combined = extractCombinedOabData(user.oab);
    if (!number && combined.number) {
      number = combined.number;
    }
    if (!uf && combined.uf) {
      uf = combined.uf;
    }
  }

  return { number, uf };
};

const parseCompanyUsers = (payload: unknown): CompanyUserOption[] => {
  const data = extractCompanyUserArray(payload);
  const options: CompanyUserOption[] = [];
  const seen = new Set<string>();

  for (const user of data) {
    const id = extractCompanyUserId(user);
    if (!id || seen.has(id)) {
      continue;
    }

    const name =
      pickFirstNonEmptyString(
        user.nome_completo,
        user.nome,
        user.nome_usuario,
        user.nomeusuario,
        user.nomeUsuario,
        user.nome_usuario_completo,
      ) ?? getNameFromEmail(user.email) ?? `Usuário ${id}`;

    const { number, uf } = extractCompanyUserOab(user);

    options.push({
      id,
      name,
      oabNumber: number,
      oabUf: uf,
    });
    seen.add(id);
  }

  return options;
};

const mapApiMonitoredOab = (payload: unknown): MonitoredOab | null => {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const data = payload as ApiMonitoredOab;

  const rawId = data.id;
  let id: string | null = null;

  if (typeof rawId === "number" && Number.isFinite(rawId)) {
    id = String(Math.trunc(rawId));
  } else if (typeof rawId === "string") {
    const trimmed = rawId.trim();
    if (trimmed) {
      id = trimmed;
    }
  }

  if (!id) {
    return null;
  }

  const uf = typeof data.uf === "string" ? data.uf.trim().toUpperCase() : null;
  const numero = typeof data.numero === "string" ? data.numero.trim() : null;

  if (!uf || !numero) {
    return null;
  }

  const usuarioIdCandidate = data.usuarioId ?? data.usuario_id ?? null;
  let usuarioId: string | null = null;

  if (typeof usuarioIdCandidate === "number" && Number.isFinite(usuarioIdCandidate)) {
    usuarioId = String(Math.trunc(usuarioIdCandidate));
  } else if (typeof usuarioIdCandidate === "string") {
    const trimmed = usuarioIdCandidate.trim();
    if (trimmed) {
      usuarioId = trimmed;
    }
  }

  const usuarioNome = pickFirstNonEmptyString(data.usuarioNome as string, data.usuario_nome as string);
  const usuarioOabNumero = pickFirstNonEmptyString(
    data.usuarioOabNumero as string,
    data.usuario_oab_numero as string,
  );
  const usuarioOabUf = sanitizeUfValue(
    pickFirstNonEmptyString(data.usuarioOabUf as string, data.usuario_oab_uf as string),
  );

  const createdAt = pickFirstNonEmptyString(data.createdAt as string, data.created_at as string);
  const updatedAt = pickFirstNonEmptyString(data.updatedAt as string, data.updated_at as string);

  return {
    id,
    uf,
    number: numero,
    usuarioId,
    usuarioNome: usuarioNome ?? null,
    usuarioOabNumero: usuarioOabNumero ?? null,
    usuarioOabUf: usuarioOabUf ?? null,
    createdAt: createdAt ?? null,
    updatedAt: updatedAt ?? null,
  };
};

const parseMonitoredOabArray = (payload: unknown): MonitoredOab[] => {
  if (!Array.isArray(payload)) {
    return [];
  }

  return payload
    .map((item) => mapApiMonitoredOab(item))
    .filter((item): item is MonitoredOab => Boolean(item));
};

const sortMonitoredOabs = (items: MonitoredOab[]): MonitoredOab[] => {
  return [...items].sort((a, b) => {
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;

    if (timeA !== timeB) {
      return timeB - timeA;
    }

    const idA = Number.parseInt(a.id, 10);
    const idB = Number.parseInt(b.id, 10);

    if (Number.isFinite(idA) && Number.isFinite(idB)) {
      return idB - idA;
    }

    return b.id.localeCompare(a.id);
  });
};

const BRAZILIAN_STATES = [
  { value: "AC", label: "Acre" },
  { value: "AL", label: "Alagoas" },
  { value: "AP", label: "Amapá" },
  { value: "AM", label: "Amazonas" },
  { value: "BA", label: "Bahia" },
  { value: "CE", label: "Ceará" },
  { value: "DF", label: "Distrito Federal" },
  { value: "ES", label: "Espírito Santo" },
  { value: "GO", label: "Goiás" },
  { value: "MA", label: "Maranhão" },
  { value: "MT", label: "Mato Grosso" },
  { value: "MS", label: "Mato Grosso do Sul" },
  { value: "MG", label: "Minas Gerais" },
  { value: "PA", label: "Pará" },
  { value: "PB", label: "Paraíba" },
  { value: "PR", label: "Paraná" },
  { value: "PE", label: "Pernambuco" },
  { value: "PI", label: "Piauí" },
  { value: "RJ", label: "Rio de Janeiro" },
  { value: "RN", label: "Rio Grande do Norte" },
  { value: "RS", label: "Rio Grande do Sul" },
  { value: "RO", label: "Rondônia" },
  { value: "RR", label: "Roraima" },
  { value: "SC", label: "Santa Catarina" },
  { value: "SP", label: "São Paulo" },
  { value: "SE", label: "Sergipe" },
  { value: "TO", label: "Tocantins" },
] as const;

const allowedRichTextTags = new Set([
  "p",
  "br",
  "strong",
  "em",
  "b",
  "i",
  "u",
  "span",
  "div",
  "ul",
  "ol",
  "li",
  "table",
  "thead",
  "tbody",
  "tr",
  "td",
  "th",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "blockquote",
  "pre",
  "code",
  "a",
  "hr",
]);

const allowedRichTextAttributes = new Map<string, Set<string>>([
  [
    "a",
    new Set(["href", "title", "target", "rel"]),
  ],
  [
    "span",
    new Set(["style"]),
  ],
  [
    "div",
    new Set(["style"]),
  ],
  [
    "p",
    new Set(["style"]),
  ],
  [
    "table",
    new Set(["style"]),
  ],
  [
    "thead",
    new Set(["style"]),
  ],
  [
    "tbody",
    new Set(["style"]),
  ],
  [
    "tr",
    new Set(["style"]),
  ],
  [
    "td",
    new Set(["style", "colspan", "rowspan", "align"]),
  ],
  [
    "th",
    new Set(["style", "colspan", "rowspan", "align"]),
  ],
  [
    "ul",
    new Set(["style"]),
  ],
  [
    "ol",
    new Set(["style"]),
  ],
  [
    "li",
    new Set(["style"]),
  ],
]);

const htmlEntityMap: Record<string, string> = {
  "&lt;": "<",
  "&gt;": ">",
  "&amp;": "&",
  "&quot;": '"',
  "&#39;": "'",
};

function decodeHtmlEntities(value: string): string {
  if (!value) {
    return value;
  }

  if (typeof DOMParser !== "undefined") {
    try {
      const parser = new DOMParser();
      const documentFragment = parser.parseFromString(`<!doctype html><body>${value}`, "text/html");
      return documentFragment.body.innerHTML || value;
    } catch {
      // ignore parser errors and fallback to other strategies
    }
  }

  if (typeof document !== "undefined") {
    const textarea = document.createElement("textarea");
    textarea.innerHTML = value;
    return textarea.value;
  }

  return value.replace(/&(lt|gt|amp|quot|#39);/g, (match) => htmlEntityMap[match] ?? match);
}

function sanitizeStyleAttribute(value: string): string | null {
  const normalized = value.trim();

  if (!normalized) {
    return null;
  }

  if (/(expression|javascript:|vbscript:|data:|url\s*\()/i.test(normalized)) {
    return null;
  }

  return normalized.replace(/\s{2,}/g, " ");
}

function sanitizeIntimacaoHtml(html: string): string {
  if (typeof window === "undefined" || typeof DOMParser === "undefined") {
    return html;
  }

  const parser = new DOMParser();
  const parsedDocument = parser.parseFromString(html, "text/html");

  if (parsedDocument.querySelector("parsererror")) {
    return html;
  }

  const unwrapElement = (element: Element) => {
    const parent = element.parentNode;

    if (!parent) {
      element.remove();
      return;
    }

    while (element.firstChild) {
      parent.insertBefore(element.firstChild, element);
    }

    parent.removeChild(element);
  };

  const elements = Array.from(parsedDocument.body.querySelectorAll("*"));

  elements.forEach((element) => {
    const tagName = element.tagName.toLowerCase();

    if (!allowedRichTextTags.has(tagName)) {
      unwrapElement(element);
      return;
    }

    const allowedAttributes = allowedRichTextAttributes.get(tagName);

    Array.from(element.attributes).forEach((attribute) => {
      const attributeName = attribute.name.toLowerCase();

      if (!allowedAttributes || !allowedAttributes.has(attributeName)) {
        element.removeAttribute(attribute.name);
        return;
      }

      if (attributeName === "href") {
        const value = attribute.value.trim();

        if (!value || /^(javascript:|data:)/i.test(value)) {
          element.removeAttribute(attribute.name);
          return;
        }

        if (/^https?:/i.test(value)) {
          element.setAttribute("target", "_blank");
          element.setAttribute("rel", "noopener noreferrer");
        }
      }

      if (attributeName === "target") {
        const value = attribute.value.trim();
        if (value !== "_blank" && value !== "_self") {
          element.setAttribute("target", "_blank");
        }
      }

      if (attributeName === "rel") {
        const tokens = attribute.value
          .split(/\s+/)
          .map((token) => token.trim())
          .filter(Boolean);
        const normalized = new Set(tokens);
        normalized.add("noopener");
        normalized.add("noreferrer");
        element.setAttribute("rel", Array.from(normalized).join(" "));
      }

      if (attributeName === "style") {
        const sanitized = sanitizeStyleAttribute(attribute.value);

        if (!sanitized) {
          element.removeAttribute(attribute.name);
        } else {
          element.setAttribute(attribute.name, sanitized);
        }
      }
    });
  });

  return parsedDocument.body.innerHTML;
}

type NormalizedRichText =
  | { type: "html"; value: string }
  | { type: "text"; value: string };

function normalizeRichText(value: string | null | undefined): NormalizedRichText | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const decoded = decodeHtmlEntities(trimmed);

  if (/[<>]/.test(decoded)) {
    const sanitized = sanitizeIntimacaoHtml(decoded);

    if (sanitized && sanitized.trim()) {
      return { type: "html", value: sanitized };
    }

    const stripped = decoded.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    return stripped ? { type: "text", value: stripped } : null;
  }

  return { type: "text", value: decoded };
}

function prepararResumoIa(conteudo?: string | null): string | null {
  if (!conteudo) {
    return null;
  }

  const textoNormalizado = normalizarTexto(conteudo);

  if (!textoNormalizado) {
    return null;
  }

  const paragrafoUnico = textoNormalizado
    .split("\n")
    .map((linha) => linha.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (!paragrafoUnico) {
    return null;
  }

  const frases = paragrafoUnico
    .split(/(?<=[.!?])\s+/)
    .filter((frase) => frase.trim().length > 0);
  let frasesParaResumo = frases;

  if (frases.length > 0) {
    const primeiraFraseNormalizada = frases[0].trim().toLowerCase();
    const prefixosRemoviveis = ["resumo", "síntese", "este documento"];

    if (prefixosRemoviveis.some((prefixo) => primeiraFraseNormalizada.startsWith(prefixo))) {
      const restantes = frases.slice(1);
      frasesParaResumo = restantes.length > 0 ? restantes : frases;
    }
  }

  const resumoConciso = frasesParaResumo.slice(0, 2).join(" ") || paragrafoUnico;

  const resumoLimpo = resumoConciso.replace(/\*\*/g, "");

  return resumoLimpo || resumoConciso;
}

function montarPromptResumoIntimacao(intimacao: Intimacao): string {
  const partes: string[] = [
    "Responda de forma direta qual é a solicitação da autoridade judicial e qual foi o prazo determinado.",
  ];

  const numeroProcesso =
    typeof intimacao.numero_processo === "string" ? intimacao.numero_processo.trim() : "";
  const tipoComunicacao =
    typeof intimacao.tipoComunicacao === "string" ? intimacao.tipoComunicacao.trim() : "";
  const tribunal = typeof intimacao.siglaTribunal === "string" ? intimacao.siglaTribunal.trim() : "";
  const orgao = typeof intimacao.nomeOrgao === "string" ? intimacao.nomeOrgao.trim() : "";
  const prazo = typeof intimacao.prazo === "string" ? intimacao.prazo.trim() : "";

  if (numeroProcesso) {
    partes.push(`Processo: ${numeroProcesso}`);
  }

  if (tipoComunicacao) {
    partes.push(`Tipo de comunicação: ${tipoComunicacao}`);
  }

  if (tribunal) {
    partes.push(`Tribunal: ${tribunal}`);
  }

  if (orgao) {
    partes.push(`Órgão: ${orgao}`);
  }

  if (prazo) {
    partes.push(`Prazo informado: ${prazo}`);
  }

  const conteudoNormalizado = normalizarTexto(intimacao.texto);
  partes.push(`Conteúdo:\n${conteudoNormalizado || "Sem texto disponível."}`);

  return partes.filter(Boolean).join("\n\n");
}

function parseMaybeJson(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return value;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function normalizeDestinatarios(raw: unknown): NormalizedDestinatario[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((item) => parseMaybeJson(item))
    .map((item) => {
      if (typeof item === "string") {
        const nome = item.trim();
        return nome ? { nome } : null;
      }

      if (item && typeof item === "object") {
        const record = item as Record<string, unknown>;
        const nome = typeof record.nome === "string" ? record.nome.trim() : undefined;
        const polo = typeof record.polo === "string" ? record.polo.trim() : undefined;

        if (nome) {
          return {
            nome,
            polo: polo && polo.length > 0 ? polo : undefined,
          };
        }
      }

      return null;
    })
    .filter((value): value is NormalizedDestinatario => value !== null);
}

function normalizeDestinatariosAdvogados(raw: unknown): NormalizedAdvogado[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((item) => parseMaybeJson(item))
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const record = item as Record<string, unknown>;
      const advogadoValue = "advogado" in record ? parseMaybeJson(record.advogado) : record;

      if (!advogadoValue || typeof advogadoValue !== "object") {
        return null;
      }

      const advogado = advogadoValue as Record<string, unknown>;
      const nome = typeof advogado.nome === "string" ? advogado.nome.trim() : undefined;

      const numero =
        typeof advogado.numero_oab === "string" || typeof advogado.numero_oab === "number"
          ? String(advogado.numero_oab).trim()
          : typeof advogado.numeroOab === "string"
          ? advogado.numeroOab.trim()
          : undefined;

      const uf =
        typeof advogado.uf_oab === "string"
          ? advogado.uf_oab.trim()
          : typeof advogado.ufOab === "string"
          ? advogado.ufOab.trim()
          : undefined;

      if (!nome) {
        return null;
      }

      return {
        nome,
        numeroOab: numero && numero.length > 0 ? numero : undefined,
        ufOab: uf && uf.length > 0 ? uf : undefined,
      };
    })
    .filter((value): value is NormalizedAdvogado => value !== null);
}

function formatAdvogadoLabel(advogado: NormalizedAdvogado): string {
  const parts = [advogado.nome];
  const oab = [advogado.ufOab ?? "", advogado.numeroOab ?? ""].filter((value) => value).join("-");

  if (oab) {
    parts.push(`OAB ${oab}`);
  }

  return parts.join(" • ");
}

function createAdvogadoKey(advogado: NormalizedAdvogado): string {
  return [advogado.nome, advogado.ufOab ?? "", advogado.numeroOab ?? ""].join("|");
}

function formatDateTime(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return format(date, "dd/MM/yyyy", { locale: ptBR });
}

function formatDateOrText(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (!Number.isNaN(date.getTime())) {
    return format(date, "dd/MM/yyyy", { locale: ptBR });
  }

  return value;
}

function parseDateValue(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function hasContent(value: ReactNode): boolean {
  if (value === null || value === undefined || value === false) {
    return false;
  }

  if (Array.isArray(value)) {
    return value.some((item) => hasContent(item));
  }

  if (typeof value === "string") {
    return value.trim().length > 0;
  }

  if (typeof value === "number") {
    return true;
  }

  if (typeof value === "boolean") {
    return true;
  }

  return true;
}

function InfoItem({ label, children }: { label: string; children?: ReactNode }) {
  if (!hasContent(children ?? null)) {
    return null;
  }

  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p>
      <div className="text-sm text-foreground">{children}</div>
    </div>
  );
}

export default function Intimacoes() {
  const [intimacoes, setIntimacoes] = useState<Intimacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [bulkAction, setBulkAction] = useState<"read" | "archive" | null>(null);
  const [filters, setFilters] = useState<FiltersState>({
    search: "",
    advogado: "all",
    periodo: "all",
    situacao: "ativas",
    tribunal: "all",
    tipo: "all",
  });
  const [summaryDialogOpen, setSummaryDialogOpen] = useState(false);
  const [summaryTarget, setSummaryTarget] = useState<Intimacao | null>(null);
  const [summaryContent, setSummaryContent] = useState<string | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [monitoredOabs, setMonitoredOabs] = useState<MonitoredOab[]>([]);
  const [monitoredOabsLoading, setMonitoredOabsLoading] = useState(false);
  const [oabModalOpen, setOabModalOpen] = useState(false);
  const [oabUf, setOabUf] = useState("");
  const [oabNumber, setOabNumber] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [oabSubmitting, setOabSubmitting] = useState(false);
  const [removingOabId, setRemovingOabId] = useState<string | null>(null);
  const [companyUsers, setCompanyUsers] = useState<CompanyUserOption[]>([]);
  const [companyUsersLoading, setCompanyUsersLoading] = useState(false);
  const summaryRequestIdRef = useRef(0);
  const oabPromptShownRef = useRef(false);
  const companyUsersLoadedRef = useRef(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [detailsTarget, setDetailsTarget] = useState<Intimacao | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  const canManageOabs = !loading && intimacoes.length === 0;

  const loadIntimacoes = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);

    try {
      const data = await fetchIntimacoes(signal);
      setIntimacoes(data);
      setPage(1);
    } catch (err) {
      if (signal?.aborted) {
        return;
      }

      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Não foi possível carregar as intimações.");
      }
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, []);

  const loadMonitoredOabs = useCallback(
    async (signal?: AbortSignal) => {
      setMonitoredOabsLoading(true);

      try {
        const response = await fetch(getApiUrl("intimacoes/oab-monitoradas"), {
          signal,
          headers: { Accept: "application/json" },
        });

        if (!response.ok) {
          throw new Error(`Não foi possível carregar as OABs monitoradas (HTTP ${response.status}).`);
        }

        const payload = await response.json();
        if (signal?.aborted) {
          return;
        }

        const monitors = sortMonitoredOabs(parseMonitoredOabArray(payload));
        setMonitoredOabs(monitors);
      } catch (loadError) {
        if (signal?.aborted) {
          return;
        }

        console.error("Falha ao carregar OABs monitoradas", loadError);
        const message =
          loadError instanceof Error
            ? loadError.message
            : "Não foi possível carregar as OABs monitoradas.";
        toast({
          title: "Erro ao carregar OABs monitoradas",
          description: message,
          variant: "destructive",
        });
      } finally {
        if (!signal?.aborted) {
          setMonitoredOabsLoading(false);
        }
      }
    },
    [toast],
  );

  const loadCompanyUsers = useCallback(
    async (signal?: AbortSignal) => {
      setCompanyUsersLoading(true);

      try {
        const endpoints = ["get_api_usuarios_empresa", "usuarios/empresa"] as const;
        let users: CompanyUserOption[] | null = null;
        let lastError: Error | null = null;

        for (const endpoint of endpoints) {
          try {
            const response = await fetch(getApiUrl(endpoint), {
              signal,
              headers: { Accept: "application/json" },
            });

            if (!response.ok) {
              lastError = new Error(
                `Não foi possível carregar os usuários da empresa (HTTP ${response.status}).`,
              );
              continue;
            }

            const payload = await response.json();

            if (signal?.aborted) {
              return;
            }

            const parsed = parseCompanyUsers(payload);

            if (parsed.length === 0 && endpoint !== endpoints[endpoints.length - 1]) {
              lastError = new Error("Nenhum usuário encontrado.");
              continue;
            }

            users = parsed;
            lastError = null;
            break;
          } catch (error) {
            if (signal?.aborted) {
              return;
            }

            lastError =
              error instanceof Error
                ? error
                : new Error("Não foi possível carregar os usuários da empresa.");
          }
        }

        if (signal?.aborted) {
          return;
        }

        if (users) {
          setCompanyUsers(users);
          companyUsersLoadedRef.current = true;
          return;
        }

        if (lastError) {
          throw lastError;
        }

        throw new Error("Não foi possível carregar os usuários da empresa.");
      } catch (usersError) {
        if (signal?.aborted) {
          return;
        }

        console.error("Falha ao carregar usuários da empresa", usersError);
        const message =
          usersError instanceof Error
            ? usersError.message
            : "Não foi possível carregar os usuários da empresa.";
        toast({
          title: "Erro ao carregar usuários",
          description: message,
          variant: "destructive",
        });
      } finally {
        if (!signal?.aborted) {
          setCompanyUsersLoading(false);
        }
      }
    },
    [companyUsersLoadedRef, toast],
  );

  useEffect(() => {
    const controller = new AbortController();
    loadIntimacoes(controller.signal);

    return () => {
      controller.abort();
    };
  }, [loadIntimacoes]);

  useEffect(() => {
    const controller = new AbortController();
    loadMonitoredOabs(controller.signal);

    return () => {
      controller.abort();
    };
  }, [loadMonitoredOabs]);

  useEffect(() => {
    if (!oabModalOpen || companyUsersLoadedRef.current) {
      return;
    }

    const controller = new AbortController();
    loadCompanyUsers(controller.signal);

    return () => {
      controller.abort();
    };
  }, [loadCompanyUsers, oabModalOpen]);

  useEffect(() => {
    if (canManageOabs && !oabPromptShownRef.current) {
      oabPromptShownRef.current = true;
      setOabModalOpen(true);
    }
  }, [canManageOabs]);

  const handleGenerateSummary = useCallback(
    async (intimacao: Intimacao, requestId: number) => {
      setSummaryLoading(true);
      setSummaryError(null);
      setSummaryContent(null);

      const textoParaResumo = normalizarTexto(intimacao.texto);

      if (!textoParaResumo) {
        if (summaryRequestIdRef.current !== requestId) {
          return;
        }

        setSummaryLoading(false);
        setSummaryError("Não há conteúdo disponível para resumir.");
        return;
      }

      try {
        const integracoes = await fetchIntegrationApiKeys();
        const integracaoAtiva = integracoes.find(
          (integracao) =>
            integracao.active && ["gemini", "openai"].includes(integracao.provider.trim().toLowerCase()),
        );

        if (!integracaoAtiva) {
          throw new Error("Nenhuma integração de IA ativa disponível.");
        }

        const promptResumo = montarPromptResumoIntimacao(intimacao);
        const resposta = await generateAiText({
          integrationId: integracaoAtiva.id,
          documentType: "Resumo:",
          prompt: promptResumo,
          mode: "summary",
        });

        const conteudoResumo = resposta.content?.trim();
        const resumoFormatado = prepararResumoIa(conteudoResumo);

        if (!resumoFormatado) {
          throw new Error("Não foi possível gerar um resumo com o conteúdo disponível.");
        }

        if (summaryRequestIdRef.current !== requestId) {
          return;
        }

        setSummaryContent(resumoFormatado);

        const providerLabel =
          integracaoAtiva.provider.trim().toLowerCase() === "gemini"
            ? "Gemini"
            : integracaoAtiva.provider.trim().toLowerCase() === "openai"
              ? "OpenAI"
              : integracaoAtiva.provider;

        toast({
          title: "Resumo gerado",
            description: `Resumo gerado com inteligência artificial. Pode conter imprecisões; recomenda-se revisão.`,
        });
      } catch (error) {
        const mensagem = error instanceof Error ? error.message : "Não foi possível gerar o resumo.";
        if (summaryRequestIdRef.current !== requestId) {
          return;
        }

        setSummaryError(mensagem);
        toast({
          title: "Falha ao gerar resumo",
          description: mensagem,
          variant: "destructive",
        });
      } finally {
        if (summaryRequestIdRef.current === requestId) {
          setSummaryLoading(false);
        }
      }
    },
    [toast],
  );

  const startSummaryGeneration = useCallback(
    (intimacao: Intimacao) => {
      const nextRequestId = summaryRequestIdRef.current + 1;
      summaryRequestIdRef.current = nextRequestId;
      void handleGenerateSummary(intimacao, nextRequestId);
    },
    [handleGenerateSummary],
  );

  const handleOpenSummary = useCallback(
    (intimacao: Intimacao) => {
      setSummaryTarget(intimacao);
      setSummaryDialogOpen(true);
      startSummaryGeneration(intimacao);
    },
    [startSummaryGeneration],
  );

  const handleSummaryDialogChange = useCallback((open: boolean) => {
    setSummaryDialogOpen(open);

    if (!open) {
      summaryRequestIdRef.current += 1;
      setSummaryTarget(null);
      setSummaryContent(null);
      setSummaryError(null);
      setSummaryLoading(false);
    }
  }, []);

  const applyReadUpdates = useCallback(
    (updates: Map<string, MarkIntimacaoAsReadResponse>) => {
      if (updates.size === 0) {
        return;
      }

      setIntimacoes((prev) =>
        prev.map((item) => {
          const update = updates.get(String(item.id));
          if (!update) {
            return item;
          }

          return {
            ...item,
            nao_lida: update.nao_lida,
            updated_at: update.updated_at,
            idusuario_leitura: update.idusuario_leitura ?? null,
            lida_em: update.lida_em ?? null,
          };
        }),
      );

      setDetailsTarget((prev) => {
        if (!prev) {
          return prev;
        }

        const update = updates.get(String(prev.id));
        if (!update) {
          return prev;
        }

        return {
          ...prev,
          nao_lida: update.nao_lida,
          updated_at: update.updated_at,
          idusuario_leitura: update.idusuario_leitura ?? null,
          lida_em: update.lida_em ?? null,
        };
      });
    },
    [setIntimacoes, setDetailsTarget],
  );

  const applyReadUpdate = useCallback(
    (result: MarkIntimacaoAsReadResponse) => {
      applyReadUpdates(new Map([[String(result.id), result]]));
    },
    [applyReadUpdates],
  );

  const handleOpenDetails = useCallback(
    (intimacao: Intimacao) => {
      setDetailsTarget(intimacao);
      setDetailsDialogOpen(true);

      if (intimacao.nao_lida) {
        void (async () => {
          try {
            const result = await markIntimacaoAsRead(intimacao.id);
            applyReadUpdate(result);
          } catch (error) {
            console.error('Falha ao marcar intimação como lida ao abrir detalhes', error);
          }
        })();
      }
    },
    [applyReadUpdate],
  );

  const handleDetailsDialogChange = useCallback((open: boolean) => {
    setDetailsDialogOpen(open);

    if (!open) {
      setDetailsTarget(null);
    }
  }, []);

  const handleOpenOabModal = useCallback(() => {
    setOabModalOpen(true);
  }, []);

  const handleOabModalChange = useCallback((open: boolean) => {
    setOabModalOpen(open);

    if (!open) {
      setOabNumber("");
      setOabUf("");
      setSelectedUserId("");
      setRemovingOabId(null);
      setOabSubmitting(false);
    }
  }, []);

  const handleSelectCompanyUser = useCallback(
    (value: string) => {
      setSelectedUserId(value);

      const option = companyUsers.find((item) => item.id === value);

      if (!option) {
        return;
      }

      setOabNumber(option.oabNumber ?? "");
      setOabUf(option.oabUf ?? "");
    },
    [companyUsers],
  );

  const handleRegisterOab = useCallback(async () => {
    const sanitizedNumber = oabNumber.replace(/\D/g, "");
    const sanitizedUf = oabUf.trim().toUpperCase();
    const parsedUserId = Number.parseInt(selectedUserId, 10);

    if (!sanitizedNumber || !sanitizedUf || !Number.isInteger(parsedUserId) || parsedUserId <= 0) {
      return;
    }

    setOabSubmitting(true);

    try {
      const response = await fetch(getApiUrl("intimacoes/oab-monitoradas"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uf: sanitizedUf, numero: sanitizedNumber, usuarioId: parsedUserId }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const message =
          payload && typeof payload === "object" && payload && "error" in payload
            ? String((payload as { error?: unknown }).error)
            : `Não foi possível cadastrar a OAB (HTTP ${response.status}).`;
        throw new Error(message);
      }

      const payload = await response.json();
      const monitor = mapApiMonitoredOab(payload);

      if (!monitor) {
        throw new Error("Não foi possível interpretar a resposta ao cadastrar a OAB.");
      }

      setMonitoredOabs((previous) => {
        const filtered = previous.filter((item) => item.id !== monitor.id);
        return sortMonitoredOabs([monitor, ...filtered]);
      });

      toast({
        title: "OAB cadastrada",
        description: `Monitoramento ativado para ${monitor.number}/${monitor.uf}.`,
      });

      setOabNumber("");
      setOabUf("");
      setSelectedUserId("");
    } catch (registerError) {
      const message =
        registerError instanceof Error
          ? registerError.message
          : "Não foi possível cadastrar a OAB informada.";
      toast({
        title: "Erro ao cadastrar OAB",
        description: message,
        variant: "destructive",
      });
    } finally {
      setOabSubmitting(false);
    }
  }, [oabNumber, oabUf, selectedUserId, toast]);

  const handleRemoveMonitoredOab = useCallback(
    async (id: string) => {
      if (!id) {
        return;
      }

      setRemovingOabId(id);

      try {
        const response = await fetch(getApiUrl(`intimacoes/oab-monitoradas/${id}`), {
          method: "DELETE",
        });

        if (response.status !== 204) {
          const payload = await response.json().catch(() => null);
          const message =
            payload && typeof payload === "object" && payload && "error" in payload
              ? String((payload as { error?: unknown }).error)
              : `Não foi possível remover a OAB (HTTP ${response.status}).`;
          throw new Error(message);
        }

        setMonitoredOabs((previous) => previous.filter((item) => item.id !== id));
        toast({
          title: "OAB removida",
          description: "O monitoramento foi encerrado.",
        });
      } catch (removeError) {
        const message =
          removeError instanceof Error
            ? removeError.message
            : "Não foi possível remover a OAB monitorada.";
        toast({
          title: "Erro ao remover OAB",
          description: message,
          variant: "destructive",
        });
      } finally {
        setRemovingOabId(null);
      }
    },
    [toast],
  );

  const sortedIntimacoes = useMemo(() => {
    return [...intimacoes].sort((a, b) => {
      const dateA =
        parseDateValue(a.data_disponibilizacao) ??
        parseDateValue(a.created_at) ??
        parseDateValue(a.updated_at);
      const dateB =
        parseDateValue(b.data_disponibilizacao) ??
        parseDateValue(b.created_at) ??
        parseDateValue(b.updated_at);

      if (dateA && dateB) {
        return dateB.getTime() - dateA.getTime();
      }

      if (dateA) {
        return -1;
      }

      if (dateB) {
        return 1;
      }

      const idA = typeof a.id === "number" ? a.id : Number(a.id) || 0;
      const idB = typeof b.id === "number" ? b.id : Number(b.id) || 0;
      return idB - idA;
    });
  }, [intimacoes]);

  const advogadoOptions = useMemo(() => {
    const map = new Map<string, string>();

    intimacoes.forEach((item) => {
      normalizeDestinatariosAdvogados(item.destinatarios_advogados).forEach((advogado) => {
        const key = createAdvogadoKey(advogado);

        if (!map.has(key)) {
          map.set(key, formatAdvogadoLabel(advogado));
        }
      });
    });

    return Array.from(map.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  }, [intimacoes]);

  const tribunalOptions = useMemo(() => {
    const map = new Map<string, string>();

    intimacoes.forEach((item) => {
      const label = item.siglaTribunal?.trim();

      if (label) {
        const value = label.toLowerCase();
        if (!map.has(value)) {
          map.set(value, label);
        }
      }
    });

    return Array.from(map.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  }, [intimacoes]);

  const tipoOptions = useMemo(() => {
    const map = new Map<string, string>();

    intimacoes.forEach((item) => {
      const label = item.tipoComunicacao?.trim();

      if (label) {
        const value = label.toLowerCase();
        if (!map.has(value)) {
          map.set(value, label);
        }
      }
    });

    return Array.from(map.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  }, [intimacoes]);

  const filteredIntimacoes = useMemo(() => {
    const now = new Date();
    const nowTime = now.getTime();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const normalizedSearch = filters.search.trim().toLowerCase();
    const normalizedSearchDigits = normalizedSearch.replace(/\D+/g, "");

    return sortedIntimacoes.filter((item) => {
      if (filters.situacao === "ativas" && item.arquivada) {
        return false;
      }

      if (filters.situacao === "arquivadas" && !item.arquivada) {
        return false;
      }

      if (filters.situacao === "nao-lidas" && !item.nao_lida) {
        return false;
      }

      if (filters.tribunal !== "all") {
        const tribunal = item.siglaTribunal?.trim().toLowerCase() ?? "";
        if (tribunal !== filters.tribunal) {
          return false;
        }
      }

      if (filters.tipo !== "all") {
        const tipo = item.tipoComunicacao?.trim().toLowerCase() ?? "";
        if (tipo !== filters.tipo) {
          return false;
        }
      }

      if (normalizedSearch) {
        const processValue = item.numero_processo ?? "";
        const normalizedProcess = processValue.toLowerCase();

        if (!normalizedProcess.includes(normalizedSearch)) {
          const digits = processValue.replace(/\D+/g, "");

          if (!normalizedSearchDigits || !digits.includes(normalizedSearchDigits)) {
            return false;
          }
        }
      }

      if (filters.advogado !== "all") {
        const advogados = normalizeDestinatariosAdvogados(item.destinatarios_advogados);
        const matches = advogados.some((advogado) => createAdvogadoKey(advogado) === filters.advogado);

        if (!matches) {
          return false;
        }
      }

      if (filters.periodo !== "all") {
        const date =
          parseDateValue(item.data_disponibilizacao) ??
          parseDateValue(item.created_at) ??
          parseDateValue(item.updated_at);

        if (!date) {
          return false;
        }

        const time = date.getTime();

        if (filters.periodo === "7d" && time < nowTime - 7 * 24 * 60 * 60 * 1000) {
          return false;
        }

        if (filters.periodo === "30d" && time < nowTime - 30 * 24 * 60 * 60 * 1000) {
          return false;
        }

        if (filters.periodo === "90d" && time < nowTime - 90 * 24 * 60 * 60 * 1000) {
          return false;
        }

        if (
          filters.periodo === "month"
          && (date.getMonth() !== currentMonth || date.getFullYear() !== currentYear)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [sortedIntimacoes, filters]);

  const totalPages = Math.max(Math.ceil(filteredIntimacoes.length / ITEMS_PER_PAGE), 1);

  useEffect(() => {
    setPage((prev) => Math.min(prev, totalPages));
  }, [totalPages]);

  const paginatedIntimacoes = useMemo(() => {
    const start = (page - 1) * ITEMS_PER_PAGE;
    return filteredIntimacoes.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredIntimacoes, page]);

  const summary = useMemo(() => {
    const total = sortedIntimacoes.length;
    let unread = 0;
    let archived = 0;
    let currentMonth = 0;
    const statusMap = new Map<string, number>();
    const monthlyMap = new Map<string, { year: number; month: number; total: number }>();
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();

    sortedIntimacoes.forEach((item) => {
      if (item.nao_lida) {
        unread += 1;
      }

      if (item.arquivada) {
        archived += 1;
      }

      const statusLabel = item.status?.trim() ?? "Sem status";
      statusMap.set(statusLabel, (statusMap.get(statusLabel) ?? 0) + 1);

      const date =
        parseDateValue(item.data_disponibilizacao) ??
        parseDateValue(item.created_at) ??
        parseDateValue(item.updated_at);

      if (date) {
        const key = `${date.getFullYear()}-${date.getMonth()}`;
        const entry =
          monthlyMap.get(key) ?? { year: date.getFullYear(), month: date.getMonth(), total: 0 };
        entry.total += 1;
        monthlyMap.set(key, entry);

        if (date.getMonth() === month && date.getFullYear() === year) {
          currentMonth += 1;
        }
      }
    });

    const statusDistribution = Array.from(statusMap.entries())
      .map(([status, value]) => ({ status, value }))
      .sort((a, b) => b.value - a.value);

    const monthlyDistribution = Array.from(monthlyMap.values())
      .sort((a, b) => (a.year === b.year ? a.month - b.month : a.year - b.year))
      .slice(-6)
      .map((entry) => ({
        label: format(new Date(entry.year, entry.month, 1), "MMM yyyy", { locale: ptBR }),
        total: entry.total,
      }));

    return {
      total,
      unread,
      archived,
      currentMonth,
      active: Math.max(total - archived, 0),
      statusDistribution,
      monthlyDistribution,
    };
  }, [sortedIntimacoes]);

  const paginationRange = useMemo(() => {
    if (totalPages <= 1) {
      return [1];
    }

    const uniquePages = new Set<number>();
    uniquePages.add(1);
    uniquePages.add(totalPages);

    for (let index = page - 1; index <= page + 1; index += 1) {
      if (index >= 1 && index <= totalPages) {
        uniquePages.add(index);
      }
    }

    return Array.from(uniquePages).sort((a, b) => a - b);
  }, [page, totalPages]);

  const paginationItems = useMemo(() => {
    const items: (number | "ellipsis")[] = [];
    let previous = 0;

    paginationRange.forEach((current) => {
      if (previous && current - previous > 1) {
        items.push("ellipsis");
      }

      items.push(current);
      previous = current;
    });

    return items;
  }, [paginationRange]);

  const handleRefresh = () => {
    loadIntimacoes();
  };

  const handleArchive = async (id: number | string) => {
    const stringId = String(id);
    setArchivingId(stringId);

    try {
      const result = await archiveIntimacao(id);
      setIntimacoes((prev) =>
        prev.map((item) =>
          String(item.id) === String(result.id)
            ? { ...item, arquivada: result.arquivada, updated_at: result.updated_at }
            : item,
        ),
      );
      if (detailsTarget && String(detailsTarget.id) === stringId) {
        setDetailsTarget(null);
        setDetailsDialogOpen(false);
      }
      toast({
        title: "Intimação arquivada",
        description: "Ela foi movida para a lista de intimações arquivadas.",
      });
    } catch (err) {
      toast({
        title: "Não foi possível arquivar a intimação",
        description: err instanceof Error ? err.message : "Tente novamente em instantes.",
        variant: "destructive",
      });
    } finally {
      setArchivingId(null);
    }
  };

  const handleMarkAsRead = async (id: number | string) => {
    const stringId = String(id);
    setMarkingId(stringId);

    try {
      const result = await markIntimacaoAsRead(id);
      applyReadUpdate(result);
      toast({
        title: "Intimação atualizada",
        description: "Ela foi marcada como lida.",
      });
    } catch (err) {
      toast({
        title: "Não foi possível marcar como lida",
        description: err instanceof Error ? err.message : "Tente novamente em instantes.",
        variant: "destructive",
      });
    } finally {
      setMarkingId(null);
    }
  };

  const handleMarkAllAsRead = useCallback(async () => {
    const pendentes = filteredIntimacoes.filter((item) => item.nao_lida);

    if (pendentes.length === 0) {
      return;
    }

    setBulkAction("read");

    try {
      const resultados = await Promise.allSettled(
        pendentes.map((item) => markIntimacaoAsRead(item.id)),
      );

      const sucedidos = resultados.filter(
        (resultado): resultado is PromiseFulfilledResult<MarkIntimacaoAsReadResponse> =>
          resultado.status === "fulfilled",
      );
      const falhas = resultados.filter((resultado) => resultado.status === "rejected");

      if (sucedidos.length > 0) {
        const atualizacoes = new Map(
          sucedidos.map((resultado) => [String(resultado.value.id), resultado.value] as const),
        );

        applyReadUpdates(atualizacoes);

        toast({
          title: "Intimações atualizadas",
          description: `${sucedidos.length} intimações foram marcadas como lidas.`,
        });
      }

      if (falhas.length > 0) {
        toast({
          title: "Algumas intimações não foram atualizadas",
          description: "Tente novamente para concluir a operação.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Não foi possível marcar como lidas",
        description: error instanceof Error ? error.message : "Tente novamente em instantes.",
        variant: "destructive",
      });
    } finally {
      setBulkAction(null);
    }
  }, [filteredIntimacoes, toast]);

  const handleArchiveAll = useCallback(async () => {
    const ativos = filteredIntimacoes.filter((item) => !item.arquivada);

    if (ativos.length === 0) {
      return;
    }

    setBulkAction("archive");

    try {
      const resultados = await Promise.allSettled(ativos.map((item) => archiveIntimacao(item.id)));

      const sucedidos = resultados.filter(
        (resultado): resultado is PromiseFulfilledResult<{ id: number; arquivada: boolean; updated_at: string }> =>
          resultado.status === "fulfilled",
      );
      const falhas = resultados.filter((resultado) => resultado.status === "rejected");

      if (sucedidos.length > 0) {
        const atualizacoes = new Map(
          sucedidos.map((resultado) => [String(resultado.value.id), resultado.value] as const),
        );

        setIntimacoes((anteriores) =>
          anteriores.map((item) => {
            const atualizacao = atualizacoes.get(String(item.id));
            if (!atualizacao) {
              return item;
            }
            return {
              ...item,
              arquivada: atualizacao.arquivada,
              updated_at: atualizacao.updated_at,
            };
          }),
        );

        toast({
          title: "Intimações arquivadas",
          description: `${sucedidos.length} intimações foram arquivadas.`,
        });
      }

      if (falhas.length > 0) {
        toast({
          title: "Algumas intimações não foram arquivadas",
          description: "Tente novamente para concluir a operação.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Não foi possível arquivar as intimações",
        description: error instanceof Error ? error.message : "Tente novamente em instantes.",
        variant: "destructive",
      });
    } finally {
      setBulkAction(null);
    }
  }, [filteredIntimacoes, toast]);

  const handleOpenTask = useCallback(
    (intimacao: Intimacao) => {
      const params = new URLSearchParams();
      const numero = typeof intimacao.numero_processo === "string" ? intimacao.numero_processo.trim() : "";
      const prazoDate = intimacao.prazo ? new Date(intimacao.prazo) : null;
      const hasValidPrazo = prazoDate && !Number.isNaN(prazoDate.getTime());
      const descricaoPartes: string[] = [];

      if (intimacao.nomeOrgao) {
        descricaoPartes.push(`Órgão: ${intimacao.nomeOrgao}`);
      }

      if (intimacao.tipoComunicacao) {
        descricaoPartes.push(`Tipo: ${intimacao.tipoComunicacao}`);
      }

      if (hasValidPrazo) {
        descricaoPartes.push(`Prazo: ${format(prazoDate!, "dd/MM/yyyy", { locale: ptBR })}`);
        params.set("data", prazoDate!.toISOString());
      }

      const tituloReferencia = numero || String(intimacao.id);
      params.set("origem", "intimacao");
      params.set("titulo", `Tratar intimação ${tituloReferencia}`);

      if (descricaoPartes.length > 0) {
        params.set("descricao", descricaoPartes.join(" • "));
      }

      if (intimacao.tipoComunicacao) {
        params.set("tipo", intimacao.tipoComunicacao);
      }

      if (numero) {
        params.set("processo", numero);
      } else {
        params.set("intimacao", String(intimacao.id));
      }

      const query = params.toString();
      navigate(query ? `/tarefas?${query}` : "/tarefas");
    },
    [navigate],
  );

  const handleAddToAgenda = useCallback(
    (intimacao: Intimacao) => {
      const params = new URLSearchParams();
      const numero = typeof intimacao.numero_processo === "string" ? intimacao.numero_processo.trim() : "";
      const prazoDate = intimacao.prazo ? new Date(intimacao.prazo) : null;
      const hasValidPrazo = prazoDate && !Number.isNaN(prazoDate.getTime());
      const descricaoPartes: string[] = [];

      if (intimacao.nomeOrgao) {
        descricaoPartes.push(`Órgão: ${intimacao.nomeOrgao}`);
      }

      if (intimacao.tipoComunicacao) {
        descricaoPartes.push(`Tipo: ${intimacao.tipoComunicacao}`);
      }

      if (hasValidPrazo) {
        descricaoPartes.push(`Prazo: ${format(prazoDate!, "dd/MM/yyyy", { locale: ptBR })}`);
        params.set("data", prazoDate!.toISOString());
      }

      const tituloReferencia = numero || String(intimacao.id);
      params.set("origem", "intimacao");
      params.set("titulo", `Compromisso da intimação ${tituloReferencia}`);

      if (descricaoPartes.length > 0) {
        params.set("descricao", descricaoPartes.join(" • "));
      }

      if (intimacao.tipoComunicacao) {
        params.set("tipo", intimacao.tipoComunicacao);
      }

      if (numero) {
        params.set("processo", numero);
      } else {
        params.set("intimacao", String(intimacao.id));
      }

      const query = params.toString();
      navigate(query ? `/agenda?${query}` : "/agenda");
    },
    [navigate],
  );

  const handleFiltersChange = <Key extends keyof FiltersState>(key: Key, value: FiltersState[Key]) => {
    setFilters((previous) => ({
      ...previous,
      [key]: value,
    }));
    setPage(1);
  };

  const { total, active, unread, currentMonth, archived, statusDistribution, monthlyDistribution } =
    summary;
  const isBulkProcessing = bulkAction !== null;
  const canMarkAllAsRead = filteredIntimacoes.some((item) => item.nao_lida);
  const canArchiveAll = filteredIntimacoes.some((item) => !item.arquivada);
  const summarySourceText = useMemo(
    () => (summaryTarget ? normalizarTexto(summaryTarget.texto) : ""),
    [summaryTarget],
  );
  const sanitizedOabInput = oabNumber.replace(/\D/g, "");
  const isOabFormValid =
    selectedUserId.trim().length > 0 && sanitizedOabInput.length > 0 && oabUf.trim().length === 2;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold">Intimações</h1>
          <p className="text-sm text-muted-foreground">
            Consulte as intimações mais recentes da sua empresa e expanda para visualizar os detalhes completos de cada caso.
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="secondary"
            onClick={handleMarkAllAsRead}
            disabled={isBulkProcessing || loading || !canMarkAllAsRead}
          >
            {bulkAction === "read" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CheckCheck className="mr-2 h-4 w-4" />
            )}
            Marcar todas como lidas
          </Button>
          <Button
            variant="outline"
            onClick={handleArchiveAll}
            disabled={isBulkProcessing || loading || !canArchiveAll}
          >
            {bulkAction === "archive" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Archive className="mr-2 h-4 w-4" />
            )}
            Arquivar todas
          </Button>
          <Button variant="outline" onClick={handleRefresh} disabled={loading || isBulkProcessing}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
            Atualizar
          </Button>
        </div>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Erro ao carregar dados</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border-border/60 bg-card/60 backdrop-blur">
          <CardHeader className="space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total de intimações</CardTitle>
            <div className="text-3xl font-semibold text-foreground">{numberFormatter.format(total)}</div>
          </CardHeader>
          <CardContent className="pt-0">
            <CardDescription>Inclui {numberFormatter.format(archived)} arquivadas.</CardDescription>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card/60 backdrop-blur">
          <CardHeader className="space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Intimações ativas</CardTitle>
            <div className="text-3xl font-semibold text-foreground">{numberFormatter.format(active)}</div>
          </CardHeader>
          <CardContent className="pt-0">
            <CardDescription>Intimações ainda não arquivadas.</CardDescription>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card/60 backdrop-blur">
          <CardHeader className="space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Não lidas</CardTitle>
            <div className="text-3xl font-semibold text-foreground">{numberFormatter.format(unread)}</div>
          </CardHeader>
          <CardContent className="pt-0">
            <CardDescription>Intimações aguardando leitura.</CardDescription>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card/60 backdrop-blur">
          <CardHeader className="space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Disponíveis neste mês</CardTitle>
            <div className="text-3xl font-semibold text-foreground">
              {numberFormatter.format(currentMonth)}
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <CardDescription>Intimações com disponibilização registrada no mês atual.</CardDescription>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/60 bg-card/60 shadow-sm">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg">OABs monitoradas</CardTitle>
            <CardDescription>
              Mantenha suas OABs cadastradas para monitorar e importar processos automaticamente.
            </CardDescription>
          </div>
          <Button variant="outline" onClick={handleOpenOabModal}>
            Adicionar OAB
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">
              Mantenha suas OABs cadastradas para monitorar e importar processos automaticamente.
            </p>
            <p className="text-sm text-muted-foreground">
              {monitoredOabsLoading && monitoredOabs.length === 0
                ? "Carregando OABs monitoradas..."
                : `Total de OABs monitoradas: ${monitoredOabs.length}`}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button variant="outline" size="sm" onClick={handleOpenOabModal}>
              Ver OABs monitoradas
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/60">
        <CardHeader className="pb-0">
          <CardTitle className="text-sm font-medium text-muted-foreground">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="filtro-processo">Buscar por processo</Label>
              <Input
                id="filtro-processo"
                placeholder="Número do processo"
                value={filters.search}
                onChange={(event) => handleFiltersChange("search", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="filtro-periodo">Período</Label>
              <Select
                value={filters.periodo}
                onValueChange={(value) => handleFiltersChange("periodo", value as PeriodFilter)}
              >
                <SelectTrigger id="filtro-periodo">
                  <SelectValue placeholder="Selecione o período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os períodos</SelectItem>
                  <SelectItem value="month">Mês atual</SelectItem>
                  <SelectItem value="7d">Últimos 7 dias</SelectItem>
                  <SelectItem value="30d">Últimos 30 dias</SelectItem>
                  <SelectItem value="90d">Últimos 90 dias</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="filtro-situacao">Situação</Label>
              <Select
                value={filters.situacao}
                onValueChange={(value) => handleFiltersChange("situacao", value as SituationFilter)}
              >
                <SelectTrigger id="filtro-situacao">
                  <SelectValue placeholder="Selecione a situação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativas">Ativas</SelectItem>
                  <SelectItem value="nao-lidas">Não lidas</SelectItem>
                  <SelectItem value="todas">Todas</SelectItem>
                  <SelectItem value="arquivadas">Arquivadas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="filtro-advogado">Advogado responsável</Label>
              <Select
                value={filters.advogado}
                onValueChange={(value) => handleFiltersChange("advogado", value)}
              >
                <SelectTrigger id="filtro-advogado">
                  <SelectValue placeholder="Selecione o advogado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os advogados</SelectItem>
                  {advogadoOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="filtro-tribunal">Tribunal</Label>
              <Select
                value={filters.tribunal}
                onValueChange={(value) => handleFiltersChange("tribunal", value)}
              >
                <SelectTrigger id="filtro-tribunal">
                  <SelectValue placeholder="Selecione o tribunal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {tribunalOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="filtro-tipo">Tipo de comunicação</Label>
              <Select
                value={filters.tipo}
                onValueChange={(value) => handleFiltersChange("tipo", value)}
              >
                <SelectTrigger id="filtro-tipo">
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {tipoOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr),minmax(0,2fr)]">
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-lg">Volume mensal</CardTitle>
            <CardDescription>Compare a quantidade de intimações disponíveis nos últimos meses.</CardDescription>
          </CardHeader>
          <CardContent className="h-72 pt-0">
            {monthlyDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyDistribution}>
                  <defs>
                    <linearGradient id="intimacoesMonthly" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip cursor={{ stroke: "hsl(var(--primary))" }} />
                  <Area type="monotone" dataKey="total" stroke="hsl(var(--primary))" fill="url(#intimacoesMonthly)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Nenhum dado suficiente para gerar o gráfico.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-lg">Distribuição por status</CardTitle>
            <CardDescription>Entenda como as intimações estão classificadas.</CardDescription>
          </CardHeader>
          <CardContent className="h-72 pt-0">
            {statusDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusDistribution}>
                  <CartesianGrid vertical={false} strokeOpacity={0.2} />
                  <XAxis dataKey="status" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip cursor={{ fill: "hsl(var(--muted)/0.3)" }} />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Nenhum status disponível para análise.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {loading && intimacoes.length === 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Card key={index} className="border-dashed border-border/60">
              <CardHeader className="space-y-3">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-3/4" />
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-5/6" />
                <Skeleton className="h-3 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {!loading && filteredIntimacoes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-muted-foreground/40 bg-card/50 p-10 text-center text-sm text-muted-foreground">
          <div className="space-y-4">
            <p>Nenhuma intimação encontrada.</p>
            {canManageOabs ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Cadastre uma OAB monitorada para começar a receber avisos assim que novas intimações forem disponibilizadas.
                </p>
                <div className="flex justify-center">
                  <Button onClick={handleOpenOabModal}>Cadastrar OAB</Button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {paginatedIntimacoes.length > 0 ? (
        <>
          <div className="space-y-3">
            {paginatedIntimacoes.map((intimacao, index) => {
              const itemId = String(intimacao.id ?? index);
              const numeroProcesso =
                typeof intimacao.numero_processo === "string" ? intimacao.numero_processo.trim() : "";
              const disponibilizadaEm = formatDateTime(intimacao.data_disponibilizacao);
              const disponibilizadaLabel = disponibilizadaEm ? disponibilizadaEm.split(" ")[0] : null;

              return (
                <div
                  key={itemId}
                  className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="flex flex-col gap-3 px-4 py-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-1">
                        {numeroProcesso ? (
                          <Link
                            to={`/processos/${encodeURIComponent(numeroProcesso)}`}
                            className="text-base font-semibold text-primary underline-offset-2 hover:underline"
                          >
                            {numeroProcesso}
                          </Link>
                        ) : (
                          <span className="text-base font-semibold text-muted-foreground">
                            Número do processo não informado
                          </span>
                        )}
                        <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-muted-foreground">
                          {intimacao.tipoComunicacao ? <Badge>{intimacao.tipoComunicacao}</Badge> : null}
                          {intimacao.nao_lida ? <Badge variant="destructive">Não lida</Badge> : null}
                          {intimacao.arquivada ? (
                            <Badge variant="secondary" className="bg-muted text-muted-foreground">
                              Arquivada
                            </Badge>
                          ) : null}
                          {disponibilizadaLabel ? (
                            <Badge variant="outline" className="border-primary/60 text-primary">
                              {disponibilizadaLabel}
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="ml-auto inline-flex items-center gap-1 text-xs font-semibold shadow-sm"
                        onClick={() => handleOpenDetails(intimacao)}
                      >
                        Ver detalhes
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                      {intimacao.siglaTribunal ? <span>{intimacao.siglaTribunal} -</span> : null}
                      {intimacao.nomeOrgao ? <span>{intimacao.nomeOrgao}</span> : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <Dialog open={detailsDialogOpen} onOpenChange={handleDetailsDialogChange}>
            <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-4xl">
              {detailsTarget
                ? (() => {
                    const current = detailsTarget!;
                    const destinatarios = normalizeDestinatarios(current.destinatarios);
                    const destinatariosAdv = normalizeDestinatariosAdvogados(current.destinatarios_advogados);
                    const prazoFormatado = formatDateOrText(current.prazo);
                    const cancelamentoFormatado = formatDateTime(current.data_cancelamento);
                    const disponibilizadaEm = formatDateTime(current.data_disponibilizacao);
                    const headerDate =
                      formatDateTime(current.data_disponibilizacao) ??
                      formatDateTime(current.created_at) ??
                      formatDateTime(current.updated_at);
                    const textoNormalizado = normalizeRichText(current.texto);
                    const numeroProcesso =
                      typeof current.numero_processo === "string"
                        ? current.numero_processo.trim()
                        : "";
                    const isArchiving = archivingId === String(current.id);
                    const isMarking = markingId === String(current.id);
                    const podeResumir = Boolean(normalizarTexto(current.texto));
                    const summaryInProgress =
                      summaryLoading &&
                      summaryTarget &&
                      String(summaryTarget.id) === String(current.id);

                    return (
                      <>
                        <DialogHeader className="gap-3 text-left sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
                          <div className="space-y-2">
                            {numeroProcesso ? (
                              <DialogTitle className="text-base font-semibold leading-tight text-foreground">
                                <Link
                                  to={`/processos/${encodeURIComponent(numeroProcesso)}`}
                                  className="text-primary underline-offset-2 hover:underline"
                                >
                                  {numeroProcesso}
                                </Link>
                              </DialogTitle>
                            ) : (
                              <DialogTitle className="text-base font-semibold leading-tight text-muted-foreground">
                                Número do processo não informado
                              </DialogTitle>
                            )}
                            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-muted-foreground">
                              {current.tipoComunicacao ? <Badge>{current.tipoComunicacao}</Badge> : null}
                              {current.nao_lida ? <Badge variant="destructive">Não lida</Badge> : null}
                              {current.arquivada ? (
                                <Badge variant="secondary" className="bg-muted text-muted-foreground">
                                  Arquivada
                                </Badge>
                              ) : null}
                              {disponibilizadaEm ? (
                                <Badge variant="outline" className="border-primary/60 text-primary">
                                  {disponibilizadaEm.split(" ")[0]}
                                </Badge>
                              ) : null}
                            </div>
                          </div>
                        </DialogHeader>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-sm text-muted-foreground">
                          {current.siglaTribunal ? <span>{current.siglaTribunal} -</span> : null}
                          {current.nomeOrgao ? <span>{current.nomeOrgao}</span> : null}
                        </div>
                        <div className="space-y-6 py-2">
                          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-muted-foreground">
                              {disponibilizadaEm ? <span>Disponibilizada {disponibilizadaEm}</span> : null}
                              {headerDate ? <span>Atualizada {headerDate}</span> : null}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {current.nao_lida ? (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => handleMarkAsRead(current.id)}
                                  disabled={isMarking || isArchiving || isBulkProcessing}
                                >
                                  {isMarking ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  ) : (
                                    <CheckCheck className="mr-2 h-4 w-4" />
                                  )}
                                  Marcar como lida
                                </Button>
                              ) : null}
                              {!current.arquivada ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleArchive(current.id)}
                                  disabled={isArchiving || isMarking || isBulkProcessing}
                                >
                                  {isArchiving ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  ) : (
                                    <Archive className="mr-2 h-4 w-4" />
                                  )}
                                  Arquivar intimação
                                </Button>
                              ) : null}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenTask(current)}
                                disabled={isBulkProcessing}
                              >
                                <ListChecks className="mr-2 h-4 w-4" />
                                Abrir tarefa
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleAddToAgenda(current)}
                                disabled={isBulkProcessing}
                              >
                                <CalendarPlus className="mr-2 h-4 w-4" />
                                Incluir na agenda
                              </Button>
                            </div>
                          </div>

                          <div className="grid gap-4 md:grid-cols-2">
                            <InfoItem label="Órgão">{current.nomeOrgao}</InfoItem>
                            <InfoItem label="Classe">
                              {current.nomeclasse ? (
                                <>
                                  {current.nomeclasse}
                                  {current.codigoclasse ? ` (${current.codigoclasse})` : null}
                                </>
                              ) : current.codigoclasse ? (
                                current.codigoclasse
                              ) : null}
                            </InfoItem>
                            <InfoItem label="Meio">
                              {current.meio === "D" ? "Diário de Justiça Eletrônico" : "Plataforma de Editais"}
                            </InfoItem>
                            <InfoItem label="Prazo">{prazoFormatado}</InfoItem>
                            <InfoItem label="Tipo de Documento">
                              {current.tipodocumento ? <span>{current.tipodocumento}</span> : null}
                            </InfoItem>
                            <InfoItem label="Data de disponibilização">{disponibilizadaEm}</InfoItem>
                            <InfoItem label="Motivo do cancelamento">{current.motivo_cancelamento}</InfoItem>
                            <InfoItem label="Data do cancelamento">{cancelamentoFormatado}</InfoItem>
                          </div>

                          <InfoItem label="Teor da Comunicação">
                            <div className="mb-3 flex w-full justify-end">
                              <Button
                                variant="default"
                                size="sm"
                                className="ml-auto bg-primary text-primary-foreground hover:bg-primary/90"
                                onClick={() => handleOpenSummary(current)}
                                disabled={!podeResumir || summaryLoading || isBulkProcessing}
                              >
                                {summaryInProgress ? (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                  <Sparkles className="mr-2 h-4 w-4" />
                                )}
                                Resumir com IA
                              </Button>
                            </div>
                            {textoNormalizado ? (
                              textoNormalizado.type === "html" ? (
                                <div
                                  className="prose prose-sm max-w-none rounded-md bg-muted/40 p-3 text-muted-foreground prose-headings:text-foreground prose-strong:text-foreground prose-em:text-foreground/90 prose-a:text-primary prose-a:no-underline hover:prose-a:underline dark:prose-invert"
                                  dangerouslySetInnerHTML={{ __html: textoNormalizado.value }}
                                />
                              ) : (
                                <div className="whitespace-pre-wrap rounded-md bg-muted/40 p-3 text-sm leading-relaxed">
                                  {textoNormalizado.value}
                                </div>
                              )
                            ) : null}
                          </InfoItem>

                          <InfoItem label="Parte(s)">
                            {destinatarios.length > 0 ? (
                              <ul className="list-disc space-y-1 pl-5">
                                {destinatarios.map((destinatario, destinatarioIndex) => (
                                  <li key={`${destinatario.nome}-${destinatario.polo ?? "p"}-${destinatarioIndex}`}>
                                    {destinatario.nome}
                                    {destinatario.polo
                                      ? ` - ${destinatario.polo === "P" ? "Polo Passivo" : "Polo Ativo"}`
                                      : null}
                                  </li>
                                ))}
                              </ul>
                            ) : null}
                          </InfoItem>

                          <InfoItem label="Advogado(s)">
                            {destinatariosAdv.length > 0 ? (
                              <ul className="list-disc space-y-1 pl-5">
                                {destinatariosAdv.map((advogado, advogadoIndex) => (
                                  <li key={`${advogado.nome}-${advogado.numeroOab ?? "adv"}-${advogadoIndex}`}>
                                    {advogado.nome}
                                    {advogado.ufOab || advogado.numeroOab
                                      ? ` (OAB ${advogado.ufOab ?? ""}${
                                          advogado.ufOab && advogado.numeroOab ? "-" : ""
                                        }${advogado.numeroOab ?? ""})`
                                      : null}
                                  </li>
                                ))}
                              </ul>
                            ) : null}
                          </InfoItem>

                          <InfoItem label="Inteiro teor">
                            {current.link ? (
                              <a
                                href={current.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-sm text-primary underline-offset-2 hover:underline"
                              >
                                Acessar publicação
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            ) : null}
                          </InfoItem>
                        </div>
                      </>
                    );
                  })()
                : null}
            </DialogContent>
          </Dialog>

          {totalPages > 1 ? (
            <Pagination className="justify-center">
              <PaginationContent>
                <PaginationItem>
                  <PaginationLink
                    href="#"
                    size="default"
                    onClick={(event) => {
                      event.preventDefault();
                      setPage((current) => Math.max(current - 1, 1));
                    }}
                    aria-disabled={page === 1}
                    className={page === 1 ? "pointer-events-none opacity-50" : undefined}
                  >
                    <ChevronLeft className="mr-1 h-4 w-4" />
                    <span>Anterior</span>
                  </PaginationLink>
                </PaginationItem>
                {paginationItems.map((item, itemIndex) =>
                  typeof item === "number" ? (
                    <PaginationItem key={item}>
                      <PaginationLink
                        href="#"
                        isActive={item === page}
                        size="default"
                        onClick={(event) => {
                          event.preventDefault();
                          setPage(item);
                        }}
                      >
                        {item}
                      </PaginationLink>
                    </PaginationItem>
                  ) : (
                    <PaginationItem key={`ellipsis-${itemIndex}`}>
                      <PaginationEllipsis />
                    </PaginationItem>
                  ),
                )}
                <PaginationItem>
                  <PaginationLink
                    href="#"
                    size="default"
                    onClick={(event) => {
                      event.preventDefault();
                      setPage((current) => Math.min(current + 1, totalPages));
                    }}
                    aria-disabled={page === totalPages}
                    className={page === totalPages ? "pointer-events-none opacity-50" : undefined}
                  >
                    <span>Próxima</span>
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </PaginationLink>
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          ) : null}
        </>
      ) : null}
      <Dialog open={oabModalOpen} onOpenChange={handleOabModalChange}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Gerenciar OABs monitoradas</DialogTitle>
            <DialogDescription>
              Cadastre novas OABs monitoradas ou remova registros que não deseja mais acompanhar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div className="space-y-3">
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">OABs cadastradas</p>
                <p className="text-xs text-muted-foreground">
                  Visualize e gerencie os números monitorados pela sua empresa.
                </p>
              </div>
              {monitoredOabsLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Carregando OABs monitoradas...
                </div>
              ) : monitoredOabs.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhuma OAB cadastrada no momento.
                </p>
              ) : (
                <div className="space-y-2">
                  {monitoredOabs.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-card/60 p-3"
                    >
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-foreground">
                          OAB {item.number}/{item.uf}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {item.usuarioNome ?? "Usuário não identificado"}
                          {item.usuarioOabNumero
                            ? ` • OAB ${item.usuarioOabNumero}${
                                item.usuarioOabUf ? `/${item.usuarioOabUf}` : ""
                              }`
                            : ""}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          void handleRemoveMonitoredOab(item.id);
                        }}
                        disabled={removingOabId === item.id || oabSubmitting}
                      >
                        {removingOabId === item.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                        <span className="sr-only">Remover</span>
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="oab-user">Responsável</Label>
                <Select
                  value={selectedUserId}
                  onValueChange={handleSelectCompanyUser}
                  disabled={companyUsersLoading || companyUsers.length === 0}
                >
                  <SelectTrigger id="oab-user">
                    <SelectValue
                      placeholder={
                        companyUsersLoading
                          ? "Carregando usuários..."
                          : "Selecione o responsável"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {companyUsers.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name}
                        {user.oabNumber
                          ? ` • OAB ${user.oabNumber}${user.oabUf ? `/${user.oabUf}` : ""}`
                          : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {companyUsersLoading ? (
                  <p className="text-xs text-muted-foreground">Carregando lista de usuários...</p>
                ) : companyUsers.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Nenhum usuário disponível para seleção.
                  </p>
                ) : null}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="oab-uf">Estado</Label>
                  <Select value={oabUf} onValueChange={setOabUf} disabled={Boolean(selectedUserId)}>
                    <SelectTrigger id="oab-uf">
                      <SelectValue placeholder="Selecione o estado" />
                    </SelectTrigger>
                    <SelectContent>
                      {BRAZILIAN_STATES.map((state) => (
                        <SelectItem key={state.value} value={state.value}>
                          {state.label} ({state.value})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="oab-number">Número da OAB</Label>
                  <Input
                    id="oab-number"
                    placeholder="000000"
                    value={oabNumber}
                    onChange={(event) => setOabNumber(event.target.value)}
                    disabled={Boolean(selectedUserId)}
                  />
                </div>
              </div>
              {!canManageOabs ? (
                <p className="text-xs text-muted-foreground">
                  Cadastros disponíveis quando não houver intimações pendentes para o período atual.
                </p>
              ) : null}
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              onClick={() => {
                void handleRegisterOab();
              }}
              disabled={!isOabFormValid || oabSubmitting || !canManageOabs}
            >
              {oabSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Cadastrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={summaryDialogOpen} onOpenChange={handleSummaryDialogChange}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
            <DialogTitle>Resumo da intimação</DialogTitle>
            {summaryTarget ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (summaryTarget) {
                    startSummaryGeneration(summaryTarget);
                  }
                }}
                disabled={summaryLoading}
                className="inline-flex items-center gap-2"
              >
                {summaryLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Resumindo...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Gerar novamente
                  </>
                )}
              </Button>
            ) : null}
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1 text-sm text-muted-foreground">
              <div>
                Processo: {summaryTarget?.numero_processo ? summaryTarget.numero_processo : "Não informado"}
              </div>
              {summaryTarget?.siglaTribunal || summaryTarget?.nomeOrgao ? (
                <div>
                  {[summaryTarget?.siglaTribunal, summaryTarget?.nomeOrgao].filter(Boolean).join(" • ")}
                </div>
              ) : null}
              {summaryTarget ? (
                <div>
                  Disponibilizada em: {formatDateTime(summaryTarget.data_disponibilizacao) ?? "Data não informada"}
                </div>
              ) : null}
            </div>
            {summaryLoading ? (
              <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm text-primary">
                <Loader2 className="h-4 w-4 animate-spin" />
                Gerando resumo com IA...
              </div>
            ) : null}
            {summaryError ? <p className="text-sm text-destructive">{summaryError}</p> : null}
            {summaryContent ? (
              <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-4">
                <h3 className="text-sm font-semibold text-primary">Resumo com IA</h3>
                <SafeMarkdown content={summaryContent} className="text-primary" />
              </div>
            ) : null}
            {summarySourceText ? (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Conteúdo utilizado
                </h3>
                <div className="rounded-lg border border-muted-foreground/10 bg-muted/40 p-4">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                    {summarySourceText}
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
