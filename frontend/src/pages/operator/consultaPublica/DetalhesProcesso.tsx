import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Calendar,
  ChevronDown,
  ChevronUp,
  Download,
  FileText,
  Gavel,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { getApiUrl } from "@/lib/api";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Movement {
  id: string;
  date: string;
  description: string;
  details?: string;
}

interface ProcessDetail {
  id: string;
  number: string;
  court: string;
  status: string;
  distributionDate: string;
  lastUpdate: string;
  processClass: string;
  subject: string;
  value: string;
  parties: {
    plaintiffs: string[];
    defendants: string[];
  };
  movements: Movement[];
}

type ApiErrorPayload = {
  error?: unknown;
};

type ProcessoPayload = Record<string, unknown> & {
  numeroProcesso?: string;
  situacao?: string;
  tramitacoes?: unknown[];
  tramitacaoAtual?: Record<string, unknown>;
};

const formatDate = (value: unknown): string => {
  if (!value) return "Não informado";

  const dateString = typeof value === "string" || value instanceof Date ? value : String(value);

  try {
    const parsed = new Date(dateString);
    if (Number.isNaN(parsed.getTime())) {
      return "Não informado";
    }
    return format(parsed, "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return "Não informado";
  }
};

const formatCurrency = (value: unknown): string => {
  if (value === null || value === undefined) {
    return "Não informado";
  }

  const numeric = typeof value === "string" ? Number(value.replace(/[^0-9,-]+/g, "").replace(",", ".")) : Number(value);

  if (!Number.isFinite(numeric)) {
    return "Não informado";
  }

  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(numeric);
};

const extractProcessFromPayload = (payload: unknown): ProcessoPayload | null => {
  if (!payload) return null;

  if (Array.isArray(payload)) {
    return (payload[0] as ProcessoPayload) ?? null;
  }

  if (typeof payload === "object") {
    const record = payload as Record<string, unknown>;

    if (Array.isArray(record.content) && record.content.length > 0) {
      return (record.content[0] as ProcessoPayload) ?? null;
    }

    if ("numeroProcesso" in record) {
      return record as ProcessoPayload;
    }
  }

  return null;
};

const DetalhesProcesso = () => {
  const navigate = useNavigate();
  const params = useParams<{ numeroProcesso: string }>();
  const numeroProcesso = params.numeroProcesso ?? "";
  const { toast } = useToast();
  const [process, setProcess] = useState<ProcessDetail | null>(null);
  const [expandedMovements, setExpandedMovements] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProcessDetails = async () => {
      const trimmedNumber = numeroProcesso.trim();

      if (!trimmedNumber) {
        toast({ title: "Número do processo não informado", variant: "destructive" });
        navigate("/consulta-publica");
        return;
      }

      setLoading(true);

      try {
        const response = await fetch(getApiUrl(`consulta-publica/processos/${encodeURIComponent(trimmedNumber)}`), {
          headers: { Accept: "application/json" },
        });
        const data = (await response.json().catch(() => null)) as unknown;

        if (!response.ok) {
          const message =
            data && typeof data === "object" && data !== null && "error" in data
              ? String((data as ApiErrorPayload).error ?? "Falha ao consultar processo.")
              : "Não foi possível consultar o processo.";
          throw new Error(message);
        }

        const apiProcess = extractProcessFromPayload(data);

        if (!apiProcess) {
          throw new Error("Processo não encontrado.");
        }

        const tramitacoes = Array.isArray(apiProcess.tramitacoes)
          ? (apiProcess.tramitacoes as Array<Record<string, unknown>>)
          : [];
        const tramitacaoAtual =
          apiProcess.tramitacaoAtual && typeof apiProcess.tramitacaoAtual === "object"
            ? (apiProcess.tramitacaoAtual as Record<string, unknown>)
            : undefined;

        const tramitacaoRaw =
          tramitacaoAtual && Object.keys(tramitacaoAtual).length > 0 ? tramitacaoAtual : tramitacoes[0] ?? {};

        const partes = Array.isArray(tramitacaoRaw?.partes)
          ? (tramitacaoRaw.partes as Array<Record<string, unknown>>)
          : [];

        const plaintiffs = partes
          .filter((parte) => parte?.polo === "ATIVO")
          .map((parte) => (typeof parte?.nome === "string" && parte.nome ? parte.nome : "Não informado"));

        const defendants = partes
          .filter((parte) => parte?.polo === "PASSIVO")
          .map((parte) => (typeof parte?.nome === "string" && parte.nome ? parte.nome : "Não informado"));

        const movimentosRaw = Array.isArray(tramitacaoRaw?.movimentos)
          ? (tramitacaoRaw.movimentos as Array<Record<string, unknown>>)
          : [];

        const movements = movimentosRaw
          .map((movement, index): Movement => ({
            id: String(movement.id ?? `mov-${index}`),
            date: formatDate(movement.dataHora),
            description:
              typeof movement.descricao === "string" && movement.descricao.length > 0
                ? movement.descricao
                : typeof movement.tipoMovimento === "object" && movement.tipoMovimento && "descricao" in movement.tipoMovimento
                ? String((movement.tipoMovimento as Record<string, unknown>).descricao ?? "Movimentação")
                : "Movimentação",
            details:
              typeof movement.complemento === "string" && movement.complemento.length > 0
                ? movement.complemento
                : typeof movement.observacao === "string" && movement.observacao.length > 0
                ? movement.observacao
                : typeof movement.detalhes === "string" && movement.detalhes.length > 0
                ? movement.detalhes
                : undefined,
          }));

        const orgaoDireto = Array.isArray(tramitacaoRaw?.orgaoJulgador)
          ? (tramitacaoRaw.orgaoJulgador as Array<Record<string, unknown>>)[0]
          : typeof tramitacaoRaw?.orgaoJulgador === "object" && tramitacaoRaw.orgaoJulgador
          ? (tramitacaoRaw.orgaoJulgador as Record<string, unknown>)
          : undefined;

        let courtName =
          orgaoDireto && typeof orgaoDireto.nome === "string" && orgaoDireto.nome ? orgaoDireto.nome : "";

        if (!courtName) {
          const distribuicoes = Array.isArray(tramitacaoRaw?.distribuicao)
            ? (tramitacaoRaw.distribuicao as Array<Record<string, unknown>>)
            : [];

          for (const distribuicao of distribuicoes) {
            if (!distribuicao || typeof distribuicao !== "object") {
              continue;
            }

            const orgaoDistribuicao = Array.isArray(distribuicao.orgaoJulgador)
              ? (distribuicao.orgaoJulgador as Array<Record<string, unknown>>)[0]
              : typeof distribuicao.orgaoJulgador === "object" && distribuicao.orgaoJulgador
              ? (distribuicao.orgaoJulgador as Record<string, unknown>)
              : undefined;

            if (orgaoDistribuicao && typeof orgaoDistribuicao.nome === "string" && orgaoDistribuicao.nome) {
              courtName = orgaoDistribuicao.nome;
              break;
            }
          }

          if (!courtName && tramitacaoRaw && typeof tramitacaoRaw.orgaoJulgadorLocal === "object" && tramitacaoRaw.orgaoJulgadorLocal) {
            const local = tramitacaoRaw.orgaoJulgadorLocal as Record<string, unknown>;

            if (typeof local.nome === "string" && local.nome) {
              courtName = local.nome;
            }
          }
        }

        const distributionDateRaw =
          tramitacaoRaw?.dataHoraUltimaDistribuicao ??
          tramitacaoRaw?.dataHoraAjuizamento ??
          tramitacaoRaw?.dataDistribuicao ??
          tramitacaoRaw?.dataDistribuicaoInicial ??
          (Array.isArray(tramitacaoRaw?.distribuicao) && tramitacaoRaw.distribuicao.length > 0
            ? (tramitacaoRaw.distribuicao[0] as Record<string, unknown>).dataHora
            : undefined);

        const classe = Array.isArray(tramitacaoRaw?.classe) ? (tramitacaoRaw.classe as Array<Record<string, unknown>>) : [];
        const assunto = Array.isArray(tramitacaoRaw?.assunto)
          ? (tramitacaoRaw.assunto as Array<Record<string, unknown>>)
          : [];

        const status =
          typeof apiProcess.situacao === "string" && apiProcess.situacao.trim().length > 0
            ? apiProcess.situacao
            : tramitacaoRaw?.ativo === false
            ? "Inativo"
            : "Ativo";

        const detail: ProcessDetail = {
          id: typeof apiProcess.id === "string" ? apiProcess.id : trimmedNumber,
          number: typeof apiProcess.numeroProcesso === "string" ? apiProcess.numeroProcesso : trimmedNumber,
          court: courtName || "Não informado",
          status,
          distributionDate: formatDate(distributionDateRaw),
          lastUpdate: formatDate(tramitacaoRaw?.ultimoMovimento && (tramitacaoRaw.ultimoMovimento as Record<string, unknown>).dataHora),
          processClass:
            classe.length > 0
              ? `${classe[0]?.descricao ?? "Não informado"}${classe[0]?.codigo ? ` (${classe[0]?.codigo})` : ""}`
              : "Não informado",
          subject:
            assunto.length > 0
              ? assunto
                  .map((item) =>
                    typeof item?.descricao === "string" && item.descricao.length > 0 ? item.descricao : null,
                  )
                  .filter((descricao): descricao is string => Boolean(descricao))
                  .join(" | ") || "Não informado"
              : "Não informado",
          value: formatCurrency(tramitacaoRaw?.valorAcao),
          parties: {
            plaintiffs: plaintiffs.length > 0 ? plaintiffs : ["Não informado"],
            defendants: defendants.length > 0 ? defendants : ["Não informado"],
          },
          movements,
        };

        setProcess(detail);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Erro ao consultar processo.";
        toast({ title: "Erro ao carregar processo", description: message, variant: "destructive" });
        navigate("/consulta-publica");
      } finally {
        setLoading(false);
      }
    };

    void fetchProcessDetails();
  }, [navigate, numeroProcesso, toast]);

  const toggleMovement = (movementId: string) => {
    setExpandedMovements((prev) =>
      prev.includes(movementId) ? prev.filter((id) => id !== movementId) : [...prev, movementId],
    );
  };

  const movementsWithIndex = useMemo(() => process?.movements ?? [], [process?.movements]);

  if (loading) {
    return (
      <div className="p-4 sm:p-6 space-y-6">
        <Skeleton className="h-10 w-40" />
        <Card className="p-6 space-y-4">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </Card>
      </div>
    );
  }

  if (!process) {
    return (
      <div className="p-4 sm:p-6 space-y-6">
        <Button variant="ghost" onClick={() => navigate(-1)} className="w-fit">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
        <Card className="p-10 text-center text-muted-foreground">Não foi possível carregar os dados do processo.</Card>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <Button variant="ghost" onClick={() => navigate(-1)} className="w-fit">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Voltar
      </Button>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-1">
              <CardTitle className="text-2xl">Processo {process.number}</CardTitle>
              <p className="text-sm text-muted-foreground">{process.court}</p>
            </div>
            <Badge className="self-start lg:self-auto">{process.status}</Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <div className="flex gap-3">
            <Calendar className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">Data de distribuição</p>
              <p className="font-medium text-foreground">{process.distributionDate}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Calendar className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">Última atualização</p>
              <p className="font-medium text-foreground">{process.lastUpdate}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Gavel className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">Classe</p>
              <p className="font-medium text-foreground">{process.processClass}</p>
            </div>
          </div>
          <div className="flex gap-3 md:col-span-2">
            <FileText className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">Assunto</p>
              <p className="font-medium text-foreground">{process.subject}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <FileText className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">Valor da causa</p>
              <p className="font-medium text-foreground">{process.value}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5 text-primary" /> Parte autora
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {process.parties.plaintiffs.map((plaintiff, index) => (
                <li key={`${plaintiff}-${index}`} className="font-medium text-foreground">
                  {plaintiff}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5 text-primary" /> Parte ré
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {process.parties.defendants.map((defendant, index) => (
                <li key={`${defendant}-${index}`} className="font-medium text-foreground">
                  {defendant}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <CardTitle className="flex items-center gap-2 text-xl">
            <FileText className="h-5 w-5 text-primary" /> Movimentações processuais
          </CardTitle>
          <Button variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" /> Exportar
          </Button>
        </CardHeader>
        <Separator />
        <CardContent className="p-0">
          {movementsWithIndex.length > 0 ? (
            <div className="divide-y divide-border">
              {movementsWithIndex.map((movement, index) => (
                <Collapsible
                  key={movement.id}
                  open={expandedMovements.includes(movement.id)}
                  onOpenChange={() => toggleMovement(movement.id)}
                >
                  <div className="p-4 transition-colors hover:bg-muted/30">
                    <CollapsibleTrigger className="w-full">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex flex-1 gap-4 text-left">
                          <div className="flex flex-col items-center">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                              {movementsWithIndex.length - index}
                            </div>
                            {index < movementsWithIndex.length - 1 && <div className="mt-2 h-12 w-0.5 bg-border" />}
                          </div>
                          <div className="flex-1">
                            <div className="mb-1 flex items-center gap-2">
                              <span className="text-sm font-medium text-muted-foreground">{movement.date}</span>
                              <Badge variant="outline" className="text-xs">
                                {movement.description}
                              </Badge>
                            </div>
                            {movement.details && (
                              <CollapsibleContent>
                                <p className="mt-2 text-sm leading-relaxed text-foreground">{movement.details}</p>
                              </CollapsibleContent>
                            )}
                          </div>
                        </div>
                        {movement.details && (
                          <Button variant="ghost" size="sm" className="flex-shrink-0">
                            {expandedMovements.includes(movement.id) ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                      </div>
                    </CollapsibleTrigger>
                  </div>
                </Collapsible>
              ))}
            </div>
          ) : (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Nenhuma movimentação foi encontrada para este processo.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DetalhesProcesso;
