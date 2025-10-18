import { useEffect, useMemo, useState } from "react";
import { TrendingUp, TrendingDown, Gavel, CheckCircle, Users, AlertCircle } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  loadDashboardAnalytics,
  type DashboardAnalytics,
  type DistributionSlice,
  type MonthlySeriesPoint,
} from "@/services/analytics";

const COLORS = ["hsl(var(--primary))", "hsl(var(--secondary))", "hsl(var(--accent))"];

const formatPercentage = (value: number) => `${value.toFixed(1)}%`;

export default function Dashboard() {
  const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null);
  const [monthlySeries, setMonthlySeries] = useState<MonthlySeriesPoint[]>([]);
  const [areaDistribution, setAreaDistribution] = useState<DistributionSlice[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let mounted = true;

    const loadData = async () => {
      setIsLoading(true);
      try {
        const data = await loadDashboardAnalytics(controller.signal);

        if (!mounted) {
          return;
        }

        setAnalytics(data);
        setMonthlySeries(data.monthlySeries);
        setAreaDistribution(data.areaDistribution);
        setError(null);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }

        console.error("Falha ao carregar métricas do dashboard", err);
        if (mounted) {
          setError("Não foi possível carregar as métricas do dashboard.");
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

  const processMetrics = analytics?.processMetrics ?? {
    total: 0,
    active: 0,
    concluded: 0,
    closingRate: 0,
  };

  const clientMetrics = analytics?.clientMetrics ?? {
    total: 0,
    active: 0,
    prospects: 0,
  };

  const conversionRate = analytics?.kpis.conversionRate ?? 0;
  const monthlyGrowth = analytics?.kpis.monthlyGrowth ?? 0;

  const processosPorCliente = useMemo(() => {
    if (clientMetrics.active === 0) {
      return "0.0";
    }

    return (processMetrics.active / clientMetrics.active).toFixed(1);
  }, [clientMetrics.active, processMetrics.active]);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Visão geral do seu CRM jurídico</p>
      </div>

      {error ? (
        <Card className="border-destructive/50 bg-destructive/10 text-destructive">
          <CardContent className="flex items-center gap-3 py-4 text-sm">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </CardContent>
        </Card>
      ) : null}

      {/* KPI Cards */}
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
              {monthlyGrowth}% mês anterior
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Processos Concluídos</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{processMetrics.concluded}</div>
            <p className="text-xs text-muted-foreground">Encerrados no período</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Índice de Encerramento</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{processMetrics.closingRate}%</div>
            <p className="text-xs text-muted-foreground">Casos finalizados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{clientMetrics.total}</div>
            <div className="flex gap-2 text-xs">
              <Badge variant="secondary">{clientMetrics.active} ativos</Badge>
              <Badge variant="outline">{clientMetrics.prospects} prospectos</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-4 xl:grid-cols-12" aria-busy={isLoading}>
        <Card className="xl:col-span-7">
          <CardHeader>
            <CardTitle>Abertura de Processos</CardTitle>
            <CardDescription>Quantidade de processos por mês</CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthlySeries}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis allowDecimals={false} />
                <Tooltip formatter={(value: number) => [value, "Processos"]} />
                <Line
                  type="monotone"
                  dataKey="processos"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <div className="grid gap-4 xl:col-span-5">
          <Card>
            <CardHeader>
              <CardTitle>Distribuição por Área do Direito</CardTitle>
              <CardDescription>Processos por área</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={areaDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${formatPercentage(value)}`}
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

          <Card>
            <CardHeader>
              <CardTitle>Crescimento de Clientes</CardTitle>
              <CardDescription>Número total de clientes ao longo do tempo</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={monthlySeries}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis allowDecimals={false} />
                  <Tooltip formatter={(value: number) => [value, "Clientes"]} />
                  <Line
                    type="monotone"
                    dataKey="clientes"
                    stroke="hsl(var(--secondary))"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Churn and Customer Growth */}
      <div className="grid gap-4 md:grid-cols-2" aria-busy={isLoading}>
        <Card>
          <CardHeader>
            <CardTitle>Encerramentos Mensais</CardTitle>
            <CardDescription>Quantidade de processos encerrados por mês</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={monthlySeries}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis allowDecimals={false} />
                <Tooltip formatter={(value: number) => [value, "Encerrados"]} />
                <Bar dataKey="encerrados" fill="hsl(var(--destructive))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats */}
      <Card aria-busy={isLoading}>
        <CardHeader>
          <CardTitle>Métricas Rápidas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{conversionRate}%</div>
              <p className="text-sm text-muted-foreground">Taxa de Conversão de Clientes</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{processosPorCliente}</div>
              <p className="text-sm text-muted-foreground">Processos por Cliente</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{processMetrics.closingRate}%</div>
              <p className="text-sm text-muted-foreground">Índice de Encerramento</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{clientMetrics.active}</div>
              <p className="text-sm text-muted-foreground">Clientes Ativos</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
