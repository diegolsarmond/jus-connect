import { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  CartesianGrid,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from "recharts";
import {
  TrendingUp,
  Users,
  CheckCircle,
  Gavel,
  Wallet,
  CircleDollarSign,
  AlertCircle,
} from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  loadReportsAnalytics,
  type ReportsAnalytics,
  type FinancialSeriesPoint,
  type RevenueByPlanSlice,
  type CohortPoint,
  type FunnelStage,
} from "@/services/analytics";

const COLORS = ["hsl(var(--primary))", "hsl(var(--secondary))", "hsl(var(--accent))"];

const formatCurrency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function Relatorios() {
  const [analytics, setAnalytics] = useState<ReportsAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let mounted = true;

    const loadData = async () => {
      setIsLoading(true);
      try {
        const data = await loadReportsAnalytics(controller.signal);
        if (!mounted) {
          return;
        }

        setAnalytics(data);
        setError(null);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }

        console.error("Falha ao carregar relatórios analíticos", err);
        if (mounted) {
          setError("Não foi possível carregar os relatórios analíticos.");
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    void loadData();

    return () => {
      mounted = false;
      controller.abort();
    };
  }, []);

  const overview = analytics?.overview;
  const monthlySeries = overview?.monthlySeries ?? [];
  const areaDistribution = overview?.areaDistribution ?? [];
  const revenueByPlan: RevenueByPlanSlice[] = analytics?.revenueByPlan ?? [];
  const financialSeries: FinancialSeriesPoint[] = analytics?.financialSeries ?? [];
  const cohort: CohortPoint[] = analytics?.cohort ?? [];
  const funnel: FunnelStage[] = analytics?.funnel ?? [];
  const revenueSummary = analytics?.revenueSummary ?? {
    totalRevenue: 0,
    payingClients: 0,
    averageTicket: 0,
    revenueGrowth: 0,
  };

  const processMetrics = overview?.processMetrics ?? {
    total: 0,
    active: 0,
    concluded: 0,
    closingRate: 0,
  };
  const clientMetrics = overview?.clientMetrics ?? {
    total: 0,
    active: 0,
    prospects: 0,
  };
  const conversionRate = overview?.kpis.conversionRate ?? 0;
  const monthlyGrowth = overview?.kpis.monthlyGrowth ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Relatórios Jurídicos</h1>
        <p className="text-muted-foreground">Análise de performance do seu CRM jurídico</p>
      </div>

      {error ? (
        <Card className="border-destructive/50 bg-destructive/10 text-destructive">
          <CardContent className="flex items-center gap-3 py-4 text-sm">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4" aria-busy={isLoading}>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Processos Ativos</CardTitle>
            <Gavel className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{processMetrics.active}</div>
            <div className="flex items-center text-xs text-muted-foreground">
              <TrendingUp className="mr-1 h-3 w-3 text-green-500" />
              {monthlyGrowth >= 0 ? "+" : ""}
              {monthlyGrowth}% vs mês anterior
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes Ativos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{clientMetrics.active}</div>
            <p className="text-xs text-muted-foreground">Total de clientes ativos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Índice de Encerramento</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{processMetrics.closingRate}%</div>
            <p className="text-xs text-muted-foreground">Casos concluídos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Conversão</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{conversionRate}%</div>
            <p className="text-xs text-muted-foreground">De prospects para clientes</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4" aria-busy={isLoading}>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Faturamento Total</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(revenueSummary.totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">Receita acumulada por planos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
            <CircleDollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(revenueSummary.averageTicket)}</div>
            <p className="text-xs text-muted-foreground">Faturamento médio por cliente</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes Pagantes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{revenueSummary.payingClients}</div>
            <p className="text-xs text-muted-foreground">Distribuídos entre todos os planos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Crescimento do Faturamento</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {revenueSummary.revenueGrowth >= 0 ? "+" : ""}
              {revenueSummary.revenueGrowth.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">Comparação com o mês anterior</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7" aria-busy={isLoading}>
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Evolução de Processos</CardTitle>
            <CardDescription>Crescimento de processos ao longo do tempo</CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={monthlySeries}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="processos"
                  stroke="hsl(var(--primary))"
                  fill="hsl(var(--primary))"
                  fillOpacity={0.3}
                  name="Novos"
                />
                <Area
                  type="monotone"
                  dataKey="encerrados"
                  stroke="hsl(var(--secondary))"
                  fill="hsl(var(--secondary))"
                  fillOpacity={0.3}
                  name="Encerrados"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Distribuição por Área</CardTitle>
            <CardDescription>Processos por área de atuação</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={areaDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value.toFixed(1)}%`}
                  outerRadius={80}
                  dataKey="value"
                >
                  {areaDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => [`${value.toFixed(1)}%`, "Percentual"]} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2" aria-busy={isLoading}>
        <Card>
          <CardHeader>
            <CardTitle>Composição do Faturamento</CardTitle>
            <CardDescription>Receita gerada por cada plano</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={revenueByPlan}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip
                  formatter={(value: number | string) => [
                    formatCurrency(Number(value)),
                    "Faturamento",
                  ]}
                />
                <Bar dataKey="revenue" fill="hsl(var(--primary))" name="Receita" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Fluxo Financeiro Mensal</CardTitle>
            <CardDescription>Receitas e despesas consolidadas</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={financialSeries}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis allowDecimals={false} />
                <Tooltip
                  formatter={(value: number, name) => [
                    formatCurrency(value),
                    name === "receita" ? "Receita" : "Despesas",
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="receita"
                  stroke="hsl(var(--primary))"
                  fill="hsl(var(--primary))"
                  fillOpacity={0.3}
                  name="Receita"
                />
                <Area
                  type="monotone"
                  dataKey="despesas"
                  stroke="hsl(var(--secondary))"
                  fill="hsl(var(--secondary))"
                  fillOpacity={0.3}
                  name="Despesas"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2" aria-busy={isLoading}>
        <Card>
          <CardHeader>
            <CardTitle>Retenção de Clientes</CardTitle>
            <CardDescription>Percentual de clientes retidos</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={cohort}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis domain={[0, 100]} />
                <Tooltip formatter={(value: number) => [`${value.toFixed(1)}%`, "Retidos"]} />
                <Line
                  type="monotone"
                  dataKey="retained"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  name="Retidos"
                />
                <Line
                  type="monotone"
                  dataKey="churned"
                  stroke="hsl(var(--destructive))"
                  strokeWidth={2}
                  name="Churn"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Funil de Conversão</CardTitle>
            <CardDescription>Da aquisição até clientes ativos</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={funnel} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="stage" type="category" width={140} />
                <Tooltip
                  formatter={(value: number, name) => [
                    name === "count" ? value : `${value.toFixed(1)}%`,
                    name === "count" ? "Quantidade" : "Conversão",
                  ]}
                />
                <Bar dataKey="count" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2" aria-busy={isLoading}>
        <Card>
          <CardHeader>
            <CardTitle>Métricas de Processos</CardTitle>
            <CardDescription>Visão geral dos processos jurídicos</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm">Processos Ativos</span>
              <span className="font-medium">{processMetrics.active}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Processos Concluídos</span>
              <span className="font-medium">{processMetrics.concluded}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Índice de Encerramento</span>
              <span className="font-medium text-green-600">{processMetrics.closingRate}%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Crescimento Mensal</span>
              <span className="font-medium text-green-600">{monthlyGrowth >= 0 ? "+" : ""}{monthlyGrowth}%</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Métricas de Clientes</CardTitle>
            <CardDescription>Visão geral da base de clientes</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm">Clientes Ativos</span>
              <span className="font-medium">{clientMetrics.active}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Clientes Prospectos</span>
              <span className="font-medium">{clientMetrics.prospects}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Total de Clientes</span>
              <span className="font-medium">{clientMetrics.total}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Taxa de Conversão</span>
              <span className="font-medium text-green-600">{conversionRate}%</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
