import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  Calendar,
  Clock,
  FileText,
  Landmark,
  Loader2,
  MapPin,
  RefreshCcw,
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
import { useToast } from "@/hooks/use-toast";
import { getApiUrl } from "@/lib/api";
import {
  getDatajudCategoriaLabel,
  getDatajudTribunalLabel,
  normalizeDatajudAlias,
} from "@/data/datajud";

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
  datajud_tipo_justica?: string | null;
  datajud_alias?: string | null;
  criado_em?: string | null;
  atualizado_em?: string | null;
  cliente?: ApiProcessoCliente | null;
}

interface ApiProcessoMovimentacao {
  codigo?: number | string | null;
  nome?: string | null;
  descricao?: string | null;
  dataHora?: string | null;
}

type ProcessoDetalhes = {
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
  datajudTipoJustica: string | null;
  datajudAlias: string | null;
  datajudTribunal: string | null;
  uf: string;
  municipio: string;
  cliente: {
    id: number | null;
    nome: string;
    documento: string;
    papel: string;
  } | null;
};

type ProcessoMovimentacao = {
  codigo: number | null;
  nome: string;
  descricao: string;
  data: string;
  dataIso: string | null;
};

const normalizeString = (value: string | null | undefined): string => {
  if (!value) {
    return "";
  }

  return value.trim();
};

const formatDateToPtBR = (value: string | null | undefined): string => {
  if (!value) {
    return "Não informado";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Não informado";
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

const mapApiProcessoToDetalhes = (processo: ApiProcessoResponse): ProcessoDetalhes => {
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
  const datajudTipoJustica = normalizeString(processo.datajud_tipo_justica) || null;
  const datajudAlias = normalizeDatajudAlias(processo.datajud_alias);
  const datajudCategoriaLabel = getDatajudCategoriaLabel(datajudTipoJustica);
  const datajudTribunal = getDatajudTribunalLabel(datajudAlias);
  const clienteResumo = processo.cliente ?? null;
  const clienteId =
    typeof clienteResumo?.id === "number"
      ? clienteResumo.id
      : typeof processo.cliente_id === "number"
        ? processo.cliente_id
        : null;
  const clienteNome = normalizeString(clienteResumo?.nome) || "Cliente não informado";
  const clienteDocumento = normalizeString(clienteResumo?.documento);
  const clientePapel = resolveClientePapel(clienteResumo?.tipo);

  return {
    id:
      typeof processo.id === "number"
        ? processo.id
        : Number.parseInt(String(processo.id ?? 0), 10) || 0,
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
    datajudTipoJustica: datajudCategoriaLabel ?? datajudTipoJustica,
    datajudAlias,
    datajudTribunal,
    uf: rawUf,
    municipio: rawMunicipio,
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

const mapApiMovimentacaoToLocal = (
  movimentacao: ApiProcessoMovimentacao,
): ProcessoMovimentacao => {
  const rawCodigo = movimentacao.codigo;
  let codigo: number | null = null;

  if (typeof rawCodigo === "number" && Number.isFinite(rawCodigo)) {
    codigo = rawCodigo;
  } else if (typeof rawCodigo === "string") {
    const parsed = Number.parseInt(rawCodigo, 10);
    codigo = Number.isNaN(parsed) ? null : parsed;
  }

  const nome =
    typeof movimentacao.nome === "string" && movimentacao.nome.trim()
      ? movimentacao.nome.trim()
      : "Movimentação";

  const descricao =
    typeof movimentacao.descricao === "string" &&
    movimentacao.descricao.trim()
      ? movimentacao.descricao.trim()
      : nome;

  return {
    codigo,
    nome,
    descricao,
    data: formatDateTimeToPtBR(movimentacao.dataHora ?? null),
    dataIso: movimentacao.dataHora ?? null,
  };
};

function InfoBox({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-dashed border-border/60 bg-muted/40 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="mt-2 flex items-start gap-2 text-sm text-foreground">
        <Icon className="mt-0.5 h-4 w-4 text-muted-foreground" />
        <span>{value}</span>
      </div>
    </div>
  );
}

export default function VisualizarProcesso() {
  const { id: clienteIdParam, processoId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [processo, setProcesso] = useState<ProcessoDetalhes | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [movimentacoes, setMovimentacoes] = useState<ProcessoMovimentacao[]>([]);
  const [movimentacoesLoading, setMovimentacoesLoading] = useState(false);
  const [movimentacoesError, setMovimentacoesError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [autoSyncAttempted, setAutoSyncAttempted] = useState(false);

  useEffect(() => {
    setMovimentacoes([]);
    setMovimentacoesError(null);
    setMovimentacoesLoading(false);
    setLastSync(null);
    setAutoSyncAttempted(false);
  }, [processoId]);

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
            console.error(
              "Não foi possível interpretar os dados do processo",
              parseError,
            );
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

        const mapped = mapApiProcessoToDetalhes(json as ApiProcessoResponse);
        if (!cancelled) {
          setProcesso(mapped);
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

  const syncMovimentacoes = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (!processoId) {
        setMovimentacoes([]);
        setMovimentacoesError("Processo inválido para sincronização");
        if (!silent) {
          toast({
            title: "Erro ao sincronizar",
            description: "Processo inválido para sincronização",
            variant: "destructive",
          });
        }
        return;
      }

      const parsedId = Number.parseInt(String(processoId), 10);
      if (!Number.isInteger(parsedId) || parsedId <= 0) {
        setMovimentacoes([]);
        const message = "Identificador do processo inválido";
        setMovimentacoesError(message);
        if (!silent) {
          toast({ title: "Erro ao sincronizar", description: message, variant: "destructive" });
        }
        return;
      }

      setMovimentacoesLoading(true);
      setMovimentacoesError(null);

      try {
        const res = await fetch(
          getApiUrl(`processos/${parsedId}/movimentacoes`),
          {
            headers: { Accept: "application/json" },
          },
        );

        const text = await res.text();
        let json: unknown = null;

        if (text) {
          try {
            json = JSON.parse(text);
          } catch (parseError) {
            console.error(
              "Não foi possível interpretar as movimentações do processo",
              parseError,
            );
          }
        }

        if (!res.ok) {
          const message =
            json && typeof json === "object" &&
            "error" in json &&
            typeof (json as { error: unknown }).error === "string"
              ? (json as { error: string }).error
              : `Não foi possível sincronizar as movimentações (HTTP ${res.status})`;
          throw new Error(message);
        }

        const data: ApiProcessoMovimentacao[] = Array.isArray(json)
          ? (json as ApiProcessoMovimentacao[])
          : [];

        const mapped = data
          .map((item) => mapApiMovimentacaoToLocal(item))
          .sort((a, b) => {
            const dateA = a.dataIso ? new Date(a.dataIso).getTime() : 0;
            const dateB = b.dataIso ? new Date(b.dataIso).getTime() : 0;
            return dateB - dateA;
          });

        setMovimentacoes(mapped);
        setLastSync(new Date());
        setAutoSyncAttempted(true);

        if (!silent) {
          toast({
            title: "Movimentações atualizadas",
            description:
              mapped.length > 0
                ? `Recebemos ${mapped.length} movimentação${
                    mapped.length === 1 ? "" : "es"
                  } da API do CNJ.`
                : "Nenhuma movimentação foi retornada pela API do CNJ.",
          });
        }
      } catch (syncError) {
        const message =
          syncError instanceof Error
            ? syncError.message
            : "Erro ao sincronizar movimentações";
        setMovimentacoes([]);
        setMovimentacoesError(message);
        if (!silent) {
          toast({
            title: "Erro ao sincronizar",
            description: message,
            variant: "destructive",
          });
        }
      } finally {
        setMovimentacoesLoading(false);
      }
    },
    [processoId, toast],
  );

  const canSync = Boolean(processo?.datajudAlias);

  useEffect(() => {
    if (!autoSyncAttempted && canSync) {
      void syncMovimentacoes({ silent: true });
    }
  }, [autoSyncAttempted, canSync, syncMovimentacoes]);

  const lastSyncLabel = useMemo(
    () => (lastSync ? formatDateTimeToPtBR(lastSync.toISOString()) : null),
    [lastSync],
  );

  const criadoEmLabel = useMemo(
    () => formatDateTimeOrNull(processo?.criadoEm),
    [processo?.criadoEm],
  );

  const atualizadoEmLabel = useMemo(
    () => formatDateTimeOrNull(processo?.atualizadoEm),
    [processo?.atualizadoEm],
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
        <Button variant="outline" onClick={() => navigate(-1)} className="w-fit">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
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
              Acompanhe os dados cadastrais e sincronize as movimentações oficiais
              disponibilizadas pelo CNJ para este processo.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={() => syncMovimentacoes()}
            disabled={movimentacoesLoading || !canSync}
            title={
              !canSync
                ? "Configure o tribunal do processo para habilitar a sincronização com o CNJ"
                : undefined
            }
          >
            {movimentacoesLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="mr-2 h-4 w-4" />
            )}
            {movimentacoesLoading ? "Sincronizando..." : "Sincronizar"}
          </Button>
          <Button onClick={handleGerarContrato} disabled={!clienteIdParam}>
            Gerar contrato
          </Button>
          <Button variant="outline">Gerar termo de hipossuficiência</Button>
          <Button variant="outline">Anexar documentos</Button>
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
            {processo.datajudTipoJustica ? (
              <Badge className="text-xs border-violet-200 bg-violet-500/10 text-violet-600 dark:border-violet-400/40 dark:bg-violet-500/10 dark:text-violet-300">
                {processo.datajudTipoJustica}
              </Badge>
            ) : null}
          </div>
          <CardDescription>
            {atualizadoEmLabel
              ? `Última atualização em ${atualizadoEmLabel}.`
              : "Dados conforme o cadastro do processo."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <InfoBox
              icon={Calendar}
              label="Distribuído em"
              value={processo.dataDistribuicaoFormatada}
            />
            <InfoBox
              icon={FileText}
              label="Classe judicial"
              value={processo.classeJudicial}
            />
            <InfoBox icon={Clock} label="Assunto" value={processo.assunto} />
            <InfoBox
              icon={Users}
              label="Advogado responsável"
              value={processo.advogadoResponsavel}
            />
            <InfoBox
              icon={Landmark}
              label="Órgão julgador"
              value={processo.orgaoJulgador}
            />
            <InfoBox icon={MapPin} label="Jurisdição" value={processo.jurisdicao} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-dashed border-border/60 bg-muted/40 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Cliente vinculado
              </p>
              <div className="mt-2 space-y-1 text-sm text-foreground">
                <p className="font-medium">
                  {processo.cliente?.nome ?? "Cliente não informado"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {processo.cliente?.documento
                    ? `Documento: ${processo.cliente.documento}`
                    : "Documento não informado"}
                </p>
              </div>
              {processo.cliente?.papel ? (
                <Badge
                  variant="outline"
                  className="mt-3 text-[10px] uppercase tracking-wide text-muted-foreground"
                >
                  {processo.cliente.papel}
                </Badge>
              ) : null}
            </div>

            <div className="rounded-lg border border-dashed border-violet-200 bg-violet-500/10 p-4 dark:border-violet-400/40 dark:bg-violet-500/10">
              <p className="text-xs font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
                Integração CNJ (DataJud)
              </p>
              <div className="mt-2 space-y-2 text-sm text-foreground">
                <p>
                  Tribunal: {processo.datajudTribunal ?? "Não informado"}
                </p>
                {processo.datajudAlias ? (
                  <p className="text-xs text-muted-foreground">
                    Alias: {processo.datajudAlias}
                  </p>
                ) : null}
                {processo.datajudTipoJustica ? (
                  <Badge className="text-xs border-violet-200 bg-violet-500/10 text-violet-600 dark:border-violet-400/40 dark:text-violet-300">
                    {processo.datajudTipoJustica}
                  </Badge>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            {criadoEmLabel ? <span>Criado em {criadoEmLabel}</span> : null}
            {criadoEmLabel && atualizadoEmLabel ? (
              <span aria-hidden className="h-4 w-px bg-border/60" />
            ) : null}
            {atualizadoEmLabel ? <span>Atualizado em {atualizadoEmLabel}</span> : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <CardTitle className="text-xl font-semibold">
                Movimentações (CNJ)
              </CardTitle>
              <CardDescription>
                {canSync
                  ? lastSyncLabel
                    ? `Última sincronização em ${lastSyncLabel}.`
                    : "Clique em sincronizar para consultar as movimentações oficiais."
                  : "Configure o tribunal do processo para habilitar a consulta ao CNJ."}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {movimentacoesError ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Não foi possível sincronizar</AlertTitle>
              <AlertDescription>{movimentacoesError}</AlertDescription>
            </Alert>
          ) : null}

          {movimentacoesLoading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((item) => (
                <div key={item} className="flex gap-4">
                  <Skeleton className="mt-1 h-3 w-3 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : movimentacoes.length > 0 ? (
            <ul className="relative space-y-6">
              {movimentacoes.map((movimentacao, index) => (
                <li
                  key={`${movimentacao.codigo ?? "mov"}-${movimentacao.dataIso ?? index}`}
                  className="relative flex gap-4"
                >
                  <div className="flex flex-col items-center">
                    <span className="mt-1 h-2 w-2 rounded-full bg-primary" />
                    {index < movimentacoes.length - 1 ? (
                      <span className="mt-2 w-px flex-1 bg-border/60" />
                    ) : null}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-foreground">
                        {movimentacao.nome}
                      </span>
                      {movimentacao.data && movimentacao.data !== "Data não informada" ? (
                        <span className="text-xs text-muted-foreground">
                          {movimentacao.data}
                        </span>
                      ) : null}
                      {movimentacao.codigo ? (
                        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                          Cód. {movimentacao.codigo}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {movimentacao.descricao}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              {canSync
                ? "Nenhuma movimentação foi localizada para este processo no momento."
                : "Configure o tribunal para sincronizar movimentações com o CNJ."}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

