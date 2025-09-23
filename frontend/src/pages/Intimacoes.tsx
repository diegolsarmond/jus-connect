import { useCallback, useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import TaskCreationDialog, { TaskCreationPrefill } from "@/components/tasks/TaskCreationDialog";
import {
  Download,
  FileText,
  CheckCircle,
  CalendarClock,
  Eye,
  User,
  Clock,
  Tag,
  AlertTriangle,
  Hash,
  MapPin,
  Gavel,
  UserCircle,
  CalendarDays,
  UserCheck,
  Loader2,
  RefreshCw,
  RotateCcw,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  fetchIntimacoesOverview,
  triggerProjudiSync,
  type IntimacaoMensal,
  type IntimacoesOverview,
  type IntimacaoStatusDistribuicao,
  type IntimacaoTipoDistribuicao,
  type ModeloIntimacao,
} from "@/services/intimacoes";

const PIE_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--secondary))",
  "hsl(var(--accent))",
];

const getStatusVariant = (status: ModeloIntimacao["status"]) => {
  switch (status) {
    case "Ativo":
      return "secondary" as const;
    case "Em revisão":
      return "outline" as const;
    case "Arquivado":
      return "destructive" as const;
    default:
      return "outline" as const;
  }
};

const formatPrazoTooltip = (value: number | string) => {
  const formatted = typeof value === "number" ? value.toFixed(1) : value;
  return [`${formatted} dias`, "Prazo médio"] as const;
};

const formatDateTimeLabel = (value: string | null | undefined) => {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
    .format(parsed)
    .replace(/\./g, "");
};

export default function Intimacoes() {
  const [overview, setOverview] = useState<IntimacoesOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [viewingModelo, setViewingModelo] = useState<ModeloIntimacao | null>(null);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [taskPrefill, setTaskPrefill] = useState<TaskCreationPrefill | undefined>();

  const loadOverview = useCallback(
    async (signal?: AbortSignal) => {
      setError(null);
      setLoading(true);
      try {
        const result = await fetchIntimacoesOverview(signal);
        setOverview(result);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        setError(err instanceof Error ? err.message : "Não foi possível carregar as intimações.");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadOverview(controller.signal);
    return () => controller.abort();
  }, [loadOverview]);

  const handleRefresh = useCallback(() => {
    void loadOverview();
  }, [loadOverview]);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    setSyncError(null);
    try {
      await triggerProjudiSync();
      await loadOverview();
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }
      setSyncError(err instanceof Error ? err.message : "Falha ao sincronizar com o Projudi.");
    } finally {
      setSyncing(false);
    }
  }, [loadOverview]);

  const handleViewDialogChange = (open: boolean) => {
    setIsViewDialogOpen(open);
    if (!open) {
      setViewingModelo(null);
    }
  };

  const handleOpenView = (modelo: ModeloIntimacao) => {
    setViewingModelo(modelo);
    setIsViewDialogOpen(true);
  };

  const handleTaskDialogChange = (open: boolean) => {
    setTaskDialogOpen(open);
    if (!open) {
      setTaskPrefill(undefined);
    }
  };

  const handleOpenTaskDialog = (modelo: ModeloIntimacao) => {
    const parts = [modelo.numeroProcesso, modelo.cliente].filter(
      (value) => value && value !== "Não informado",
    );

    setTaskPrefill({
      title: modelo.titulo,
      description: modelo.descricao,
      processLabel: parts.length > 0 ? parts.join(" · ") : undefined,
    });
    setTaskDialogOpen(true);
  };

  const summary = overview?.summary;
  const monthlyData: IntimacaoMensal[] = overview?.intimacoesMensais ?? [];
  const statusData: IntimacaoStatusDistribuicao[] = overview?.intimacoesPorStatus ?? [];
  const typeData: IntimacaoTipoDistribuicao[] = overview?.intimacoesPorTipo ?? [];
  const modelos = overview?.modelos ?? [];
  const modelosAtivos = modelos.filter((modelo) => modelo.status === "Ativo").length;
  const showSkeleton = loading && !overview;

  const totalEnviadas = summary?.totalEnviadas ?? 0;
  const totalCumpridas = summary?.totalCumpridas ?? 0;
  const totalPendentes = summary?.totalPendentes ?? 0;
  const taxaCumprimento = summary ? Math.round(summary.taxaCumprimento) : 0;
  const prazoMedioResposta = summary?.prazoMedioResposta ?? 0;
  const prazoMedioFormatado = Number.isFinite(prazoMedioResposta) ? prazoMedioResposta : 0;

  const unreadCount = overview?.unreadCount ?? 0;

  const lastSyncAt = overview?.syncStatus?.lastSuccessAt ?? overview?.syncStatus?.lastRunAt;
  const formattedLastSync = formatDateTimeLabel(lastSyncAt);
  const hasMonthlyData = monthlyData.some(
    (item) => item.enviadas > 0 || item.cumpridas > 0 || item.pendentes > 0 || item.emAndamento > 0,
  );
  const hasStatusData = statusData.some((item) => item.value > 0);
  const hasTypeData = typeData.some((item) => item.value > 0);

  return (
    <div className="p-6 space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold">Intimações</h1>
          <p className="text-muted-foreground">
            Acompanhe os indicadores das intimações e utilize modelos padronizados elaborados por juízes.
          </p>
          {formattedLastSync && (
            <p className="text-xs text-muted-foreground">Última sincronização: {formattedLastSync}</p>
          )}
          {overview && (
            <p className="text-xs text-muted-foreground">
              Intimações não lidas: {unreadCount.toLocaleString("pt-BR")}
              {overview.syncStatus?.running ? " · Sincronização em andamento" : ""}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleRefresh} disabled={loading || syncing}>
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RotateCcw className="mr-2 h-4 w-4" />
            )}
            Atualizar
          </Button>
          <Button variant="outline" onClick={handleSync} disabled={syncing}>
            {syncing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Sincronizar Projudi
          </Button>
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Exportar dados
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Erro ao carregar dados</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {syncError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Falha na sincronização</AlertTitle>
          <AlertDescription>{syncError}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Intimações enviadas</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {showSkeleton ? <Skeleton className="h-8 w-24" /> : totalEnviadas.toLocaleString("pt-BR")}
            </div>
            <p className="text-xs text-muted-foreground">Registradas nos últimos 6 meses</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de cumprimento</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {showSkeleton ? <Skeleton className="h-8 w-24" /> : `${taxaCumprimento}%`}
            </div>
            <p className="text-xs text-muted-foreground">Proporção de intimações cumpridas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Prazo médio de resposta</CardTitle>
            <CalendarClock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {showSkeleton ? <Skeleton className="h-8 w-32" /> : `${prazoMedioFormatado.toFixed(1)} dias`}
            </div>
            <p className="text-xs text-muted-foreground">Tempo médio entre envio e cumprimento</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Intimações pendentes</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {showSkeleton ? <Skeleton className="h-8 w-24" /> : totalPendentes.toLocaleString("pt-BR")}
            </div>
            <p className="text-xs text-muted-foreground">Aguardando providências</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Intimações por mês</CardTitle>
            <CardDescription>Tendência de volumes e prazos médios nos últimos meses.</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            {showSkeleton ? (
              <Skeleton className="h-full w-full" />
            ) : hasMonthlyData ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyData} margin={{ top: 16, right: 16, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="mes" />
                  <YAxis yAxisId="left" allowDecimals={false} />
                  <YAxis yAxisId="right" orientation="right" width={60} tickFormatter={(value) => `${value}d`} />
                  <Tooltip
                    formatter={(value, name) =>
                      name === "Prazo médio"
                        ? formatPrazoTooltip(value as number)
                        : [`${(value as number).toLocaleString("pt-BR")}`, name]
                    }
                    labelFormatter={(label) => `Mês: ${label}`}
                  />
                  <Legend />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="enviadas"
                    name="Enviadas"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="cumpridas"
                    name="Cumpridas"
                    stroke="hsl(var(--secondary))"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="prazoMedio"
                    name="Prazo médio"
                    stroke="hsl(var(--accent))"
                    strokeDasharray="5 5"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Nenhum dado disponível para o período.
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Distribuição por status</CardTitle>
            <CardDescription>Visão geral das intimações concluídas e pendentes.</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            {showSkeleton ? (
              <Skeleton className="h-full w-full" />
            ) : hasStatusData ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusData} dataKey="value" nameKey="status" cx="50%" cy="50%" outerRadius={90}>
                    {statusData.map((entry, index) => (
                      <Cell key={entry.status} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => value.toLocaleString("pt-BR")} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Nenhuma intimação registrada.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tipos de intimação</CardTitle>
          <CardDescription>Comparativo entre os principais tipos registrados.</CardDescription>
        </CardHeader>
        <CardContent className="h-[320px]">
          {showSkeleton ? (
            <Skeleton className="h-full w-full" />
          ) : hasTypeData ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={typeData} margin={{ top: 16, right: 16, bottom: 0, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="tipo" />
                <YAxis allowDecimals={false} />
                <Tooltip formatter={(value: number) => value.toLocaleString("pt-BR")} />
                <Bar dataKey="value" name="Intimações" radius={[4, 4, 0, 0]}>
                  {typeData.map((entry, index) => (
                    <Cell key={entry.tipo} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Nenhum tipo de intimação disponível.
            </div>
          )}
        </CardContent>
      </Card>

      <section className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold">Modelos de intimação</h2>
            <p className="text-muted-foreground">
              {modelosAtivos} modelos ativos disponíveis para personalização e envio rápido.
            </p>
        </div>
      </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {showSkeleton
            ? Array.from({ length: 3 }).map((_, index) => (
                <Card key={`modelo-skeleton-${index}`} className="flex flex-col">
                  <CardHeader className="space-y-2">
                    <Skeleton className="h-5 w-2/3" />
                    <Skeleton className="h-4 w-full" />
                  </CardHeader>
                  <CardContent className="flex-1 space-y-3">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-2/3" />
                  </CardContent>
                  <CardFooter className="flex flex-wrap gap-2">
                    <Skeleton className="h-9 w-24" />
                    <Skeleton className="h-9 w-24" />
                  </CardFooter>
                </Card>
              ))
            : modelos.length > 0
            ? modelos.map((modelo) => (
                <Card key={modelo.id} className="flex flex-col">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <CardTitle className="text-lg">{modelo.titulo}</CardTitle>
                        <CardDescription>{modelo.descricao}</CardDescription>
                      </div>
                      <Badge variant={getStatusVariant(modelo.status)}>{modelo.status}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 space-y-4 text-sm">
                    <div className="grid gap-3 text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Hash className="h-4 w-4" />
                        <span>
                          Nº do processo: <span className="font-medium text-foreground">{modelo.numeroProcesso}</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        <span>
                          Comarca: <span className="font-medium text-foreground">{modelo.comarca}</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Gavel className="h-4 w-4" />
                        <span>
                          Vara: <span className="font-medium text-foreground">{modelo.vara}</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <UserCircle className="h-4 w-4" />
                        <span>
                          Cliente: <span className="font-medium text-foreground">{modelo.cliente}</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CalendarDays className="h-4 w-4" />
                        <span>
                          Distribuído em <span className="font-medium text-foreground">{modelo.dataDistribuicao}</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <UserCheck className="h-4 w-4" />
                        <span>
                          Advogado responsável: <span className="font-medium text-foreground">{modelo.advogadoResponsavel}</span>
                        </span>
                      </div>
                    </div>
                    <div className="grid gap-2 border-t border-border/60 pt-4 text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        <span>
                          Juiz responsável: <span className="font-medium text-foreground">{modelo.juizResponsavel}</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CalendarClock className="h-4 w-4" />
                        <span>
                          Atualizado em <span className="font-medium text-foreground">{modelo.ultimaAtualizacao}</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        <span>{modelo.prazoResposta}</span>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 text-muted-foreground">
                      <Tag className="mt-1 h-4 w-4" />
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary">{modelo.area}</Badge>
                        {modelo.tags.map((tag) => (
                          <Badge key={tag} variant="outline">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="flex flex-wrap gap-2">
                    <Button size="sm" variant="default" onClick={() => handleOpenView(modelo)}>
                      <Eye className="mr-2 h-4 w-4" />
                      Visualizar intimação
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleOpenTaskDialog(modelo)}>
                      <FileText className="mr-2 h-4 w-4" />
                      Criar Tarefa
                    </Button>
                  </CardFooter>
                </Card>
              ))
            : (
                <Card className="md:col-span-2 xl:col-span-3">
                  <CardHeader>
                    <CardTitle>Nenhum modelo disponível</CardTitle>
                    <CardDescription>Sincronize com o Projudi para obter modelos atualizados.</CardDescription>
                  </CardHeader>
                </Card>
              )}
        </div>
      </section>

      <Dialog open={isViewDialogOpen} onOpenChange={handleViewDialogChange}>
        <DialogContent className="max-w-2xl">
          {viewingModelo && (
            <>
              <DialogHeader>
                <DialogTitle>{viewingModelo.titulo}</DialogTitle>
                <DialogDescription>{viewingModelo.descricao}</DialogDescription>
              </DialogHeader>
              <ScrollArea className="max-h-[70vh] pr-2">
                <div className="space-y-6 py-2">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={getStatusVariant(viewingModelo.status)}>{viewingModelo.status}</Badge>
                    <Badge variant="secondary">{viewingModelo.area}</Badge>
                    {viewingModelo.tags.map((tag) => (
                      <Badge key={tag} variant="outline">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  <div className="grid gap-4 text-sm sm:grid-cols-2">
                    {[
                      { label: "Número do processo", value: viewingModelo.numeroProcesso },
                      { label: "Comarca", value: viewingModelo.comarca },
                      { label: "Vara", value: viewingModelo.vara },
                      { label: "Cliente", value: viewingModelo.cliente },
                      { label: "Data de distribuição", value: viewingModelo.dataDistribuicao },
                      { label: "Advogado responsável", value: viewingModelo.advogadoResponsavel },
                    ].map((item) => (
                      <div key={item.label} className="space-y-1">
                        <p className="text-xs font-medium uppercase text-muted-foreground">{item.label}</p>
                        <p className="font-semibold text-foreground">{item.value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="grid gap-4 text-sm sm:grid-cols-2">
                    {[
                      { label: "Juiz responsável", value: viewingModelo.juizResponsavel },
                      { label: "Prazo de resposta", value: viewingModelo.prazoResposta },
                      { label: "Última atualização", value: viewingModelo.ultimaAtualizacao },
                    ].map((item) => (
                      <div key={item.label} className="space-y-1">
                        <p className="text-xs font-medium uppercase text-muted-foreground">{item.label}</p>
                        <p className="font-semibold text-foreground">{item.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </ScrollArea>
            </>
          )}
        </DialogContent>
      </Dialog>

      <TaskCreationDialog
        open={taskDialogOpen}
        onOpenChange={handleTaskDialogChange}
        prefill={taskPrefill}
      />
    </div>
  );
}
