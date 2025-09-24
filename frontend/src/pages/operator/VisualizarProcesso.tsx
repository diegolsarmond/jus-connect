import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  AlertCircle,
  Archive,
  ArrowLeft,
  Calendar,
  Clock,
  FileText,
  Landmark,
  MapPin,
  Newspaper,
  Users,
} from "lucide-react";

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
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getApiUrl } from "@/lib/api";

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

interface ApiProcessoResponse {
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
}

interface ProcessoPropostaDetalhe {
  id: number;
  label: string;
  solicitante?: string | null;
  dataCriacao?: string | null;
  sequencial?: number | null;
}

interface ProcessoDetalhes {
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
    return "Data não informada";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Data não informada";
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
  return formatted === "Data não informada" ? null : formatted;
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
    return "Pessoa Jurídica";
  }

  if (
    normalized.includes("FISICA") ||
    ["1", "F", "PF"].includes(normalized)
  ) {
    return "Pessoa Física";
  }

  return "Parte";
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

  return `Proposta #${numero}/${ano}${solicitanteNome ? ` - ${solicitanteNome}` : ""}`;
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
    const tipo = normalizeString(raw.tipo) || "Movimentação";
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
          nome: nome || "Classificação predita",
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




const mapApiProcessoToDetalhes = (
  processo: ApiProcessoResponse,
  fallbackId?: string | number,
): ProcessoDetalhes => {
  const rawNumero = normalizeString(processo.numero);
  const rawStatus = normalizeString(processo.status) || "Não informado";
  const rawTipo = normalizeString(processo.tipo) || "Não informado";
  const rawClasse = normalizeString(processo.classe_judicial) || "Não informada";
  const rawAssunto = normalizeString(processo.assunto) || "Não informado";
  const rawOrgao = normalizeString(processo.orgao_julgador) || "Não informado";
  const rawAdvogado =
    normalizeString(processo.advogado_responsavel) || "Não informado";
  const rawMunicipio = normalizeString(processo.municipio);
  const rawUf = normalizeString(processo.uf);
  const jurisdicao =
    normalizeString(processo.jurisdicao) ||
    [rawMunicipio, rawUf].filter(Boolean).join(" - ") ||
    "Não informado";
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
    normalizeString(clienteResumo?.nome) || "Cliente não informado";
  const clienteDocumento = normalizeString(clienteResumo?.documento) || null;
  const clientePapel = resolveClientePapel(clienteResumo?.tipo);
  const movimentacoes = mapApiMovimentacoes(processo.movimentacoes);
  const consultasApiCount = parseInteger(processo.consultas_api_count);
  const movimentacoesCount = Math.max(
    parseInteger(processo.movimentacoes_count),
    movimentacoes.length,
  );
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
    numero: rawNumero || "Não informado",
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
  };
};

const getStatusBadgeClassName = (status: string) => {
  const normalized = status.toLowerCase();

  if (normalized.includes("andamento") || normalized.includes("ativo")) {
    return "border-emerald-200 bg-emerald-500/10 text-emerald-600";
  }

  if (normalized.includes("arquiv")) {
    return "border-slate-200 bg-slate-500/10 text-slate-600";
  }

  if (normalized.includes("urg")) {
    return "border-amber-200 bg-amber-500/10 text-amber-600";
  }

  return "border-primary/20 bg-primary/5 text-primary";
};

const getTipoBadgeClassName = (tipo: string) => {
  if (!tipo || tipo.toLowerCase() === "não informado") {
    return "border-muted-foreground/20 bg-muted text-muted-foreground";
  }

  return "border-blue-200 bg-blue-500/10 text-blue-600";
};

export default function VisualizarProcesso() {
  const { id: clienteIdParam, processoId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [processo, setProcesso] = useState<ProcessoDetalhes | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"resumo" | "historico">(
    "resumo",
  );

  useEffect(() => {
    let cancelled = false;

    const fetchProcesso = async () => {
      if (!processoId) {
        setProcesso(null);
        setError("Processo inválido");
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
            console.error("Não foi possível interpretar os dados do processo", parseError);
          }
        }

        if (!res.ok) {
          const message =
            json && typeof json === "object" &&
            "error" in json &&
            typeof (json as { error: unknown }).error === "string"
              ? (json as { error: string }).error
              : `Não foi possível carregar o processo (HTTP ${res.status})`;
          throw new Error(message);
        }

        if (!json || typeof json !== "object") {
          throw new Error("Resposta inválida do servidor ao carregar o processo");
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
            : "Erro ao carregar o processo";
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



  const dataDistribuicaoLabel = useMemo(() => {
    if (!processo) {
      return null;
    }

    return (
      processo.dataDistribuicaoFormatada ||
      (processo.dataDistribuicao
        ? formatDateToPtBR(processo.dataDistribuicao)
        : null)
    );
  }, [processo]);

  const criadoEmLabel = useMemo(() => {
    if (!processo?.criadoEm) {
      return null;
    }

    return formatDateTimeToPtBR(processo.criadoEm);
  }, [processo?.criadoEm]);

  const atualizadoEmLabel = useMemo(() => {
    if (!processo?.atualizadoEm) {
      return null;
    }

    return formatDateTimeToPtBR(processo.atualizadoEm);
  }, [processo?.atualizadoEm]);

  const ultimaSincronizacaoLabel = useMemo(() => {
    if (!processo?.ultimaSincronizacao) {
      return null;
    }

    return formatDateTimeToPtBR(processo.ultimaSincronizacao);
  }, [processo?.ultimaSincronizacao]);

  const ultimasMovimentacoes = useMemo(() => {
    if (!processo) {
      return [];
    }

    return processo.movimentacoes.slice(0, 3);
  }, [processo]);



  const handleGerarContrato = useCallback(() => {
    if (!clienteIdParam || !processoId) {
      return;
    }

    navigate(`/clientes/${clienteIdParam}/processos/${processoId}/contrato`);
  }, [clienteIdParam, navigate, processoId]);

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
          Voltar
        </Button>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erro ao carregar processo</AlertTitle>
          <AlertDescription>
            {error ?? "Não foi possível encontrar os dados deste processo."}

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
          Voltar
        </Button>
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">
            Processo {processo.numero}
          </h1>
          <p className="text-sm text-muted-foreground">
            Consulte os dados cadastrados do processo e mantenha o acompanhamento organizado em um só lugar.
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="w-full justify-start bg-muted/50">
          <TabsTrigger value="resumo">Resumo</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="resumo" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
            <div className="space-y-6">
              <Card>
                <CardHeader className="space-y-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-2xl font-semibold text-foreground">
                        Dados do processo
                      </CardTitle>
                      <CardDescription>
                        {atualizadoEmLabel
                          ? `Última atualização em ${atualizadoEmLabel}.`
                          : "Dados conforme o cadastro do processo."}
                      </CardDescription>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={`text-xs ${getStatusBadgeClassName(processo.status)}`}>
                        {processo.status}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`text-xs ${getTipoBadgeClassName(processo.tipo)}`}
                      >
                        {processo.tipo}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {[
                      { label: "Número do processo", value: processo.numero },
                      { label: "Classe judicial", value: processo.classeJudicial },
                      { label: "Assunto principal", value: processo.assunto },
                      { label: "Jurisdição", value: processo.jurisdicao },
                      { label: "Órgão julgador", value: processo.orgaoJulgador },
                      { label: "Advogado responsável", value: processo.advogadoResponsavel },
                      {
                        label: "Distribuído em",
                        value: dataDistribuicaoLabel ?? "Data não informada",
                      },
                      {
                        label: "Última atualização",
                        value: atualizadoEmLabel ?? "Não informada",
                      },
                      {
                        label: "Movimentações registradas",
                        value: `${processo.movimentacoesCount}`,
                      },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className="rounded-lg border border-border/60 bg-muted/30 p-4"
                      >
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {item.label}
                        </p>
                        <div className="mt-1 text-sm font-medium text-foreground">{item.value}</div>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-lg border border-dashed border-border/60 bg-muted/40 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Cliente
                    </p>
                    <div className="mt-2 flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {processo.cliente?.nome ?? "Cliente não informado"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {processo.cliente?.documento ?? "Documento não informado"}
                        </p>
                      </div>
                      {processo.cliente?.papel ? (
                        <Badge
                          variant="outline"
                          className="text-[10px] uppercase tracking-wide text-muted-foreground"
                        >
                          {processo.cliente.papel}
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                </CardContent>
              </Card>


              <Card>
                <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg font-semibold">Últimos históricos</CardTitle>
                    <CardDescription>
                      Principais andamentos registrados recentemente para o processo.
                    </CardDescription>
                  </div>
                  {processo.movimentacoes.length > 0 ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2 w-full sm:mt-0 sm:w-auto"
                      onClick={() => setActiveTab("historico")}
                    >
                      Ver histórico completo
                    </Button>
                  ) : null}
                </CardHeader>
                <CardContent>
                  {ultimasMovimentacoes.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border/60 bg-muted/30 p-4 sm:p-6 text-sm text-muted-foreground">
                      Nenhuma movimentação foi registrada até o momento.
                    </div>
                  ) : (
                    <div className="space-y-5">
                      {ultimasMovimentacoes.map((movimentacao, index) => {
                        const fonteDescricao = movimentacao.fonte
                          ? [
                              movimentacao.fonte.sigla && movimentacao.fonte.nome
                                ? `${movimentacao.fonte.sigla} • ${movimentacao.fonte.nome}`
                                : movimentacao.fonte.nome ?? movimentacao.fonte.sigla,
                              movimentacao.fonte.caderno,
                              movimentacao.fonte.grauFormatado ?? movimentacao.fonte.grau,
                              movimentacao.fonte.tipo,
                            ]
                              .filter(Boolean)
                              .join(" · ")
                          : null;
                        const dataPrincipal =
                          movimentacao.dataFormatada ??
                          movimentacao.data ??
                          "Data não informada";
                        const indicatorColor =
                          index === 0 ? "bg-primary" : "bg-muted-foreground/50";

                        return (
                          <div key={movimentacao.id} className="relative pl-6">
                            <span
                              className={`absolute left-0 top-2 h-2 w-2 rounded-full ${indicatorColor}`}
                              aria-hidden
                            />
                            <div className="rounded-lg border border-border/60 bg-background/80 p-4 shadow-sm">
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                <div className="space-y-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="text-sm font-semibold text-foreground">
                                      {movimentacao.tipo}
                                    </p>
                                    {movimentacao.tipoPublicacao ? (
                                      <Badge
                                        variant="outline"
                                        className="rounded-full px-2.5 text-[10px] uppercase tracking-wide"
                                      >
                                        {movimentacao.tipoPublicacao}
                                      </Badge>
                                    ) : null}
                                    {movimentacao.classificacao ? (
                                      <Badge
                                        variant="secondary"
                                        className="rounded-full px-2.5 text-[10px] uppercase tracking-wide"
                                      >
                                        {movimentacao.classificacao.nome}
                                      </Badge>
                                    ) : null}
                                  </div>
                                  {fonteDescricao ? (
                                    <p className="text-xs text-muted-foreground">{fonteDescricao}</p>
                                  ) : null}
                                </div>
                                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                  <Calendar className="h-3.5 w-3.5" />
                                  {dataPrincipal}
                                </span>
                              </div>
                              {movimentacao.conteudo ? (
                                <p className="mt-2 text-sm text-muted-foreground line-clamp-3">
                                  {movimentacao.conteudo}
                                </p>
                              ) : null}
                              {movimentacao.textoCategoria ? (
                                <p className="mt-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                                  {movimentacao.textoCategoria}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg font-semibold">Informações complementares</CardTitle>
                  <CardDescription>
                    Dados adicionais registrados no sistema para fins de acompanhamento.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  <div className="flex flex-wrap items-center gap-3 text-foreground">
                    <span className="flex items-center gap-1.5 text-sm font-medium">
                      <Calendar className="h-4 w-4 text-primary" />
                      {dataDistribuicaoLabel
                        ? `Distribuído em ${dataDistribuicaoLabel}`
                        : "Data de distribuição não informada"}
                    </span>
                    {criadoEmLabel ? (
                      <>
                        <span aria-hidden className="h-4 w-px bg-border/60" />
                        <span>Criado em {criadoEmLabel}</span>
                      </>
                    ) : null}
                    {atualizadoEmLabel ? (
                      <>
                        <span aria-hidden className="h-4 w-px bg-border/60" />
                        <span>Atualizado em {atualizadoEmLabel}</span>
                      </>
                    ) : null}
                  </div>
                  <p>
                    {processo.uf && processo.municipio
                      ? `Localização cadastrada: ${processo.municipio} - ${processo.uf}`
                      : "Localização não informada."}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg font-semibold">Recursos e desdobramentos</CardTitle>
                  <CardDescription>
                    Acompanhe recursos vinculados e outras ramificações do processo.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-lg border border-dashed border-border/60 bg-muted/30 p-4 sm:p-6 text-sm text-muted-foreground">
                    Nenhum recurso ou desdobramento cadastrado para este processo.
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg font-semibold">Apensos</CardTitle>
                  <CardDescription>
                    Visualize processos apensados relacionados.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-lg border border-dashed border-border/60 bg-muted/30 p-4 sm:p-6 text-sm text-muted-foreground">
                    Nenhum processo apensado foi registrado.
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg font-semibold">Próximas atividades</CardTitle>
                  <CardDescription>
                    Organize as tarefas planejadas para manter o processo em dia.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="rounded-lg border border-dashed border-border/60 bg-muted/30 p-4 text-sm text-muted-foreground">
                    Nenhuma atividade agendada para este processo.
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-center"
                    disabled
                  >
                    Agendar atividade
                  </Button>
                </CardContent>
              </Card>


              <Card>
                <CardHeader>
                  <CardTitle className="text-lg font-semibold">Atendimentos</CardTitle>
                  <CardDescription>
                    Centralize os contatos realizados com as partes envolvidas.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="rounded-lg border border-dashed border-border/60 bg-muted/30 p-4 text-sm text-muted-foreground">
                    Nenhum atendimento registrado.
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-center"
                    disabled
                  >
                    Registrar atendimento
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg font-semibold">Honorários</CardTitle>
                  <CardDescription>
                    Acompanhe propostas e contratos relacionados ao processo.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {processo.proposta ? (
                    <>
                      <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
                        <p className="text-sm font-medium text-foreground">
                          {processo.proposta.label}
                        </p>
                        {processo.proposta.solicitante ? (
                          <p className="text-xs text-muted-foreground">
                            Solicitante: {processo.proposta.solicitante}
                          </p>
                        ) : null}
                        {processo.proposta.dataCriacao ? (
                          <p className="text-xs text-muted-foreground">
                            Criada em {formatDateToPtBR(processo.proposta.dataCriacao) ?? processo.proposta.dataCriacao}
                          </p>
                        ) : null}
                      </div>
                      <Button
                        size="sm"
                        className="w-full justify-center"
                        onClick={handleGerarContrato}
                        disabled={!clienteIdParam || !processoId}
                      >
                        Gerar contrato
                      </Button>
                    </>
                  ) : (
                    <div className="rounded-lg border border-dashed border-border/60 bg-muted/30 p-4 text-sm text-muted-foreground">
                      Nenhuma proposta de honorários vinculada ao processo.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

          <TabsContent value="historico" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-xl font-semibold">
                  Movimentações registradas
                </CardTitle>
                <CardDescription>
                  Acompanhe as publicações e andamentos registrados para o processo.
                </CardDescription>
              </CardHeader>
            <CardContent className="space-y-6">
              {processo.movimentacoes.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border/60 bg-muted/30 p-4 sm:p-6 text-sm text-muted-foreground">
                  Nenhuma movimentação foi registrada até o momento.
                </div>
              ) : (
                <div className="relative">
                  <div
                    className="pointer-events-none absolute left-3 top-3 bottom-3 w-px bg-border/60 sm:left-4"
                    aria-hidden
                  />
                  <div className="space-y-6">
                    {processo.movimentacoes.map((movimentacao, index) => {
                      const fonteDescricao = movimentacao.fonte
                        ? [
                            movimentacao.fonte.sigla && movimentacao.fonte.nome
                              ? `${movimentacao.fonte.sigla} • ${movimentacao.fonte.nome}`
                              : movimentacao.fonte.nome ?? movimentacao.fonte.sigla,
                            movimentacao.fonte.caderno,
                            movimentacao.fonte.grauFormatado ?? movimentacao.fonte.grau,
                            movimentacao.fonte.tipo,
                          ]
                            .filter(Boolean)
                            .join(" · ")
                        : null;
                      const dataPrincipal =
                        movimentacao.dataFormatada ??
                        movimentacao.data ??
                        "Data não informada";
                      const isLast = index === processo.movimentacoes.length - 1;
                      const indicatorDotClasses = isLast
                        ? "bg-muted-foreground"
                        : "bg-primary";

                      return (
                        <div key={movimentacao.id} className="relative pl-10 sm:pl-12">
                          <span
                            className="absolute left-1 top-2 flex h-4 w-4 items-center justify-center rounded-full border border-border/60 bg-background"
                            aria-hidden
                          >
                            <span className={`h-2 w-2 rounded-full ${indicatorDotClasses}`} />
                          </span>
                          <div className="rounded-xl border border-border/60 bg-background/80 p-5 shadow-sm transition hover:border-primary/40 hover:shadow-md">
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                              <div className="space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-base font-semibold text-foreground">
                                    {movimentacao.tipo}
                                  </p>
                                  {movimentacao.tipoPublicacao ? (
                                    <Badge
                                      variant="outline"
                                      className="rounded-full px-2.5 text-[10px] uppercase tracking-wide"
                                    >
                                      {movimentacao.tipoPublicacao}
                                    </Badge>
                                  ) : null}
                                  {movimentacao.classificacao ? (
                                    <Badge
                                      variant="secondary"
                                      className="rounded-full px-2.5 text-[10px] uppercase tracking-wide"
                                    >
                                      {movimentacao.classificacao.nome}
                                    </Badge>
                                  ) : null}
                                </div>
                                {fonteDescricao ? (
                                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                                    <Newspaper className="h-3.5 w-3.5" />
                                    <span>{fonteDescricao}</span>
                                  </div>
                                ) : null}
                              </div>
                              <div className="flex flex-col items-start gap-1 text-xs text-muted-foreground sm:items-end">
                                <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                                  <Calendar className="h-4 w-4 text-primary" />
                                  {dataPrincipal}
                                </span>
                                {movimentacao.criadoEm ? (
                                  <span>
                                    Registrado em {formatDateTimeToPtBR(movimentacao.criadoEm)}
                                  </span>
                                ) : null}
                                {movimentacao.atualizadoEm &&
                                movimentacao.atualizadoEm !== movimentacao.criadoEm ? (
                                  <span>
                                    Atualizado em {formatDateTimeToPtBR(movimentacao.atualizadoEm)}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                            {movimentacao.conteudo ? (
                              <div className="mt-3 rounded-lg border border-border/40 bg-muted/30 p-3 text-sm text-foreground whitespace-pre-line">
                                {movimentacao.conteudo}
                              </div>
                            ) : null}
                            {movimentacao.textoCategoria ? (
                              <div className="mt-3 rounded-lg border border-dashed border-border/40 bg-background/50 p-3 text-sm text-foreground whitespace-pre-line">
                                {movimentacao.textoCategoria}
                              </div>
                            ) : null}
                            {movimentacao.classificacao?.descricao ? (
                              <p className="mt-3 text-xs text-muted-foreground whitespace-pre-line">
                                {movimentacao.classificacao.descricao}
                              </p>
                            ) : null}
                            {movimentacao.classificacao?.hierarquia ? (
                              <p className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                                Hierarquia: {movimentacao.classificacao.hierarquia}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}


