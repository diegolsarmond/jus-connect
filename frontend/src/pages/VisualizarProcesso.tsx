import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Calendar,
  Clock,
  FileText,
  Landmark,
  MapPin,
  Users,
  AlertCircle,
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
import { getApiUrl } from "@/lib/api";

interface ApiProcessoCliente {
  id?: number | null;
  nome?: string | null;
  documento?: string | null;
  tipo?: string | null;
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

  useEffect(() => {
    let cancelled = false;

    const fetchProcesso = async () => {
      if (!processoId) {
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

  const criadoEmLabel = useMemo(
    () => formatDateTimeOrNull(processo?.criadoEm),
    [processo?.criadoEm],
  );

  const atualizadoEmLabel = useMemo(
    () => formatDateTimeOrNull(processo?.atualizadoEm),
    [processo?.atualizadoEm],
  );

  const dataDistribuicaoLabel = useMemo(
    () =>
      processo?.dataDistribuicaoFormatada ??
      (processo?.dataDistribuicao
        ? formatDateToPtBR(processo.dataDistribuicao)
        : null),
    [processo?.dataDistribuicao, processo?.dataDistribuicaoFormatada],
  );

  const handleGerarContrato = useCallback(() => {
    if (!processo || !clienteIdParam) {
      return;
    }

    navigate(`/clientes/${clienteIdParam}/processos/${processo.id}/contrato`);
  }, [clienteIdParam, navigate, processo]);

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="space-y-4">
          <Skeleton className="h-10 w-1/2 rounded-lg" />
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 space-y-4">
        <Button variant="outline" onClick={() => navigate(-1)} className="w-fit">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erro ao carregar processo</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!processo) {
    return (
      <div className="p-6 space-y-4">
        <Button variant="outline" onClick={() => navigate(-1)} className="w-fit">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Processo não encontrado</AlertTitle>
          <AlertDescription>
            Não foi possível localizar o processo solicitado.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-4">
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
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={handleGerarContrato} disabled={!clienteIdParam}>
            Gerar contrato
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-3">
            <CardTitle className="text-2xl font-semibold text-foreground">
              Número {processo.numero}
            </CardTitle>
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
          <CardDescription>
            {atualizadoEmLabel
              ? `Última atualização em ${atualizadoEmLabel}.`
              : "Dados conforme o cadastro do processo."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
            <div className="rounded-lg border border-dashed border-border/60 bg-muted/40 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Jurisdição
              </p>
              <div className="mt-2 flex items-start gap-2 text-sm text-foreground">
                <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <span>{processo.jurisdicao}</span>
              </div>
            </div>
            <div className="rounded-lg border border-dashed border-border/60 bg-muted/40 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Órgão julgador
              </p>
              <div className="mt-2 flex items-start gap-2 text-sm text-foreground">
                <Landmark className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <span>{processo.orgaoJulgador}</span>
              </div>
            </div>
            <div className="rounded-lg border border-dashed border-border/60 bg-muted/40 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Classe judicial
              </p>
              <div className="mt-2 flex items-start gap-2 text-sm text-foreground">
                <FileText className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <span>{processo.classeJudicial}</span>
              </div>
            </div>
            <div className="rounded-lg border border-dashed border-border/60 bg-muted/40 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Assunto principal
              </p>
              <div className="mt-2 flex items-start gap-2 text-sm text-foreground">
                <Clock className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <span>{processo.assunto}</span>
              </div>
            </div>
            <div className="rounded-lg border border-dashed border-border/60 bg-muted/40 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Advogado responsável
              </p>
              <div className="mt-2 flex items-start gap-2 text-sm text-foreground">
                <Users className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <span>{processo.advogadoResponsavel}</span>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-dashed border-border/60 bg-muted/30 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Movimentações externas
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              As integrações automáticas com o CNJ estão desativadas. Consulte o andamento diretamente no sistema do tribunal, se necessário.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-semibold">Informações complementares</CardTitle>
          <CardDescription>
            Dados adicionais registrados no sistema para fins de acompanhamento.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
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
    </div>
  );
}

