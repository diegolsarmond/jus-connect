import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { archiveIntimacao, fetchIntimacoes, type Intimacao } from "@/services/intimacoes";
import { Archive, ExternalLink, Loader2, RotateCcw } from "lucide-react";
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

const ITEMS_PER_PAGE = 15;
const numberFormatter = new Intl.NumberFormat("pt-BR");

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

function formatDateTime(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return format(date, "dd/MM/yyyy HH:mm", { locale: ptBR });
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const { toast } = useToast();

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

  useEffect(() => {
    const controller = new AbortController();
    loadIntimacoes(controller.signal);

    return () => {
      controller.abort();
    };
  }, [loadIntimacoes]);

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

  const totalPages = Math.max(Math.ceil(sortedIntimacoes.length / ITEMS_PER_PAGE), 1);

  useEffect(() => {
    setPage((prev) => Math.min(prev, totalPages));
  }, [totalPages]);

  const paginatedIntimacoes = useMemo(() => {
    const start = (page - 1) * ITEMS_PER_PAGE;
    return sortedIntimacoes.slice(start, start + ITEMS_PER_PAGE);
  }, [sortedIntimacoes, page]);

  const summary = useMemo(() => {
    const total = sortedIntimacoes.length;
    let unread = 0;
    let archived = 0;
    let withDeadline = 0;
    const statusMap = new Map<string, number>();
    const monthlyMap = new Map<string, { year: number; month: number; total: number }>();

    sortedIntimacoes.forEach((item) => {
      if (item.nao_lida) {
        unread += 1;
      }

      if (item.arquivada) {
        archived += 1;
      }

      if (typeof item.prazo === "string" && item.prazo.trim().length > 0) {
        withDeadline += 1;
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
      withDeadline,
      active: Math.max(total - archived, 0),
      statusDistribution,
      monthlyDistribution,
    };
  }, [sortedIntimacoes]);

  const pageNumbers = useMemo(
    () => Array.from({ length: totalPages }, (_, index) => index + 1),
    [totalPages],
  );

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

  const { total, active, unread, withDeadline, archived, statusDistribution, monthlyDistribution } =
    summary;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold">Intimações</h1>
          <p className="text-sm text-muted-foreground">
            Consulte as intimações mais recentes da sua empresa e expanda para visualizar os detalhes completos de cada caso.
          </p>
        </div>
        <Button variant="outline" onClick={handleRefresh} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
          Atualizar
        </Button>
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
            <CardTitle className="text-sm font-medium text-muted-foreground">Com prazo definido</CardTitle>
            <div className="text-3xl font-semibold text-foreground">
              {numberFormatter.format(withDeadline)}
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <CardDescription>Acompanhe as publicações com prazo ativo.</CardDescription>
          </CardContent>
        </Card>
      </div>

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

      {!loading && sortedIntimacoes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-muted-foreground/40 bg-card/50 p-10 text-center text-sm text-muted-foreground">
          Nenhuma intimação encontrada.
        </div>
      ) : null}

      {paginatedIntimacoes.length > 0 ? (
        <>
          <Accordion type="single" collapsible className="space-y-3">
            {paginatedIntimacoes.map((intimacao, index) => {
              const headerDate =
                formatDateTime(intimacao.data_disponibilizacao) ??
                formatDateTime(intimacao.created_at) ??
                formatDateTime(intimacao.updated_at);
              const destinatarios = normalizeDestinatarios(intimacao.destinatarios);
              const destinatariosAdv = normalizeDestinatariosAdvogados(intimacao.destinatarios_advogados);
              const prazoFormatado = formatDateOrText(intimacao.prazo);
              const cancelamentoFormatado = formatDateTime(intimacao.data_cancelamento);
              const disponibilizadaEm = formatDateTime(intimacao.data_disponibilizacao);
              const textoNormalizado = normalizeRichText(intimacao.texto);
              const itemId = String(intimacao.id ?? index);
              const isArchiving = archivingId === String(intimacao.id);

              return (
                <AccordionItem
                  key={itemId}
                  value={itemId}
                  className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm transition-shadow hover:shadow-md"
                >
                  <AccordionTrigger className="px-4 py-3">
                    <div className="flex w-full flex-col gap-3 text-left">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="space-y-1">
                          {intimacao.numero_processo ? (
                            <Link
                              to="/processos"
                              className="text-sm font-semibold text-primary underline-offset-2 hover:underline"
                            >
                              {intimacao.numero_processo}
                            </Link>
                          ) : (
                            <span className="text-sm font-semibold text-muted-foreground">
                              Número do processo não informado
                            </span>
                          )}
                          <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-muted-foreground">
                                          
                              <Badge>
                               {intimacao.tipoComunicacao}
                              </Badge>

                          </div>
                        </div>
                           {disponibilizadaEm ? (
                          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                          <Badge variant="outline" className="border-primary/60 text-primary">
                                              {disponibilizadaEm.split(' ')[0]}
                                          </Badge>
                          </span>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                        {intimacao.siglaTribunal ? <span>{intimacao.siglaTribunal} -</span> : null}
                                  {intimacao.nomeOrgao ? <span>{intimacao.nomeOrgao}</span> : null}
                        
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    <div className="space-y-6 py-2">
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-muted-foreground">
                          
                          {intimacao.arquivada ? (
                            <Badge variant="secondary" className="bg-primary/10 text-primary">
                              
                            </Badge>
                          ) : null}
                        </div>
                        {!intimacao.arquivada ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleArchive(intimacao.id)}
                            disabled={isArchiving}
                          >
                            {isArchiving ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Archive className="mr-2 h-4 w-4" />
                            )}
                            Arquivar intimação
                          </Button>
                        ) : null}
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <InfoItem label="Órgão">{intimacao.nomeOrgao}</InfoItem>
                        <InfoItem label="Classe">
                          {intimacao.nomeclasse ? (
                            <>
                              {intimacao.nomeclasse}
                              {intimacao.codigoclasse ? ` (${intimacao.codigoclasse})` : null}
                            </>
                          ) : intimacao.codigoclasse ? (
                            intimacao.codigoclasse
                          ) : null}
                        </InfoItem>
                        <InfoItem label="Meio">{intimacao.meio === "D" ? "Diário de Justiça Eletrônico" : "Plataforma de Editais"}</InfoItem>
                        <InfoItem label="Prazo">{prazoFormatado}</InfoItem>
                        <InfoItem label="Tipo de Documento">{intimacao.tipodocumento ? <span>{intimacao.tipodocumento}</span> : null}</InfoItem>
                        <InfoItem label="Data de disponibilização">{disponibilizadaEm}</InfoItem>
                        <InfoItem label="Motivo do cancelamento">{intimacao.motivo_cancelamento}</InfoItem>
                        <InfoItem label="Data do cancelamento">{cancelamentoFormatado}</InfoItem>
                      </div>

                        <InfoItem label="Teor da Comunicação">
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
                                {destinatario.polo ? ` - ${destinatario.polo === "P" ? "Polo Passivo" : "Polo Ativo"}` : null}
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
                        {intimacao.link ? (
                          <a
                            href={intimacao.link}
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
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>

          {totalPages > 1 ? (
            <Pagination className="justify-center">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(event) => {
                      event.preventDefault();
                      setPage((current) => Math.max(current - 1, 1));
                    }}
                    aria-disabled={page === 1}
                    className={page === 1 ? "pointer-events-none opacity-50" : undefined}
                  />
                </PaginationItem>
                {pageNumbers.map((pageNumber) => (
                  <PaginationItem key={pageNumber}>
                    <PaginationLink
                      href="#"
                      isActive={pageNumber === page}
                      size="default"
                      onClick={(event) => {
                        event.preventDefault();
                        setPage(pageNumber);
                      }}
                    >
                      {pageNumber}
                    </PaginationLink>
                  </PaginationItem>
                ))}
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={(event) => {
                      event.preventDefault();
                      setPage((current) => Math.min(current + 1, totalPages));
                    }}
                    aria-disabled={page === totalPages}
                    className={page === totalPages ? "pointer-events-none opacity-50" : undefined}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
