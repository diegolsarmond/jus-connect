import { useEffect, useMemo, useState } from "react";
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
  TrendingDown,
  DollarSign,
  Users,
  Target,
  AlertCircle,
} from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  loadAdminAnalyticsOverview,
  loadProcessSyncReport,
  type AdminAnalyticsOverview,
  type RevenueByPlanSlice,
  type CohortPoint,
  type FunnelStage,
  type AdminMonthlyPoint,
  type ProcessSyncReport,
} from "@/services/analytics";

const COLORS = ["hsl(var(--primary))", "hsl(var(--secondary))", "hsl(var(--accent))"];

const formatCurrency = (value: number) =>
  `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function Analytics() {
  const [analytics, setAnalytics] = useState<AdminAnalyticsOverview | null>(null);
  const [syncReport, setSyncReport] = useState<ProcessSyncReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let mounted = true;

    const loadData = async () => {
      setIsLoading(true);
      try {
        const [overview, report] = await Promise.all([
          loadAdminAnalyticsOverview(controller.signal),
          loadProcessSyncReport(controller.signal),
        ]);
        if (!mounted) {
          return;
        }
        setAnalytics(overview);
        setSyncReport(report);
        setError(null);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        console.error("Falha ao carregar analytics administrativos", err);
        if (mounted) {
          setError("Não foi possível carregar as métricas de analytics.");
          setSyncReport(null);
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

  const dashboard = analytics?.dashboard;
  const metrics = dashboard?.metrics ?? {
    mrr: 0,
    arr: 0,
    churnRate: 0,
    conversionRate: 0,
    activeSubscriptions: 0,
    trialSubscriptions: 0,
    totalCompanies: 0,
    monthlyGrowth: 0,
  };

  const monthlySeries: AdminMonthlyPoint[] = dashboard?.monthlySeries ?? [];
  const revenueByPlan: RevenueByPlanSlice[] = analytics?.revenueByPlan ?? [];
  const cohort: CohortPoint[] = analytics?.cohort ?? [];
  const funnel: FunnelStage[] = analytics?.funnel ?? [];
  const retention = analytics?.retention ?? { gross: 0, net: 0, logo: 0 };
  const revenueMetrics = analytics?.revenueMetrics ?? {
    currentArpu: 0,
    previousArpu: 0,
    revenueGrowthRate: 0,
    expansionRevenue: 0,
    contractionRevenue: 0,
  };
  const customerMetrics = analytics?.customerMetrics ?? {
    cac: 0,
    ltv: 0,
    paybackPeriodMonths: 0,
    trialConversion: 0,
  };

  const formattedRetention = useMemo(
    () => ({
      gross: `${retention.gross.toFixed(1)}%`,
      net: `${retention.net.toFixed(1)}%`,
      logo: `${retention.logo.toFixed(1)}%`,
    }),
    [retention.gross, retention.net, retention.logo],
  );

  const syncPeriodLabel = useMemo(() => {
    if (!syncReport) {
      return "—";
    }
    const { from, to } = syncReport.period;
    if (from && to) {
      return `${from} — ${to}`;
    }
    if (from || to) {
      return from ?? to ?? "—";
    }
    return "Não informado";
  }, [syncReport]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Relatórios e Analytics</h1>
        <p className="text-muted-foreground">Análise completa de performance e métricas de negócio</p>
      </div>

      {error ? (
        <Card className="border-destructive/50 bg-destructive/10 text-destructive">
          <CardContent className="flex items-center gap-3 py-4 text-sm">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </CardContent>
        </Card>
      ) : null}

      {/* Executive Summary */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4" aria-busy={isLoading}>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">MRR</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(metrics.mrr)}</div>
            <div className="flex items-center text-xs text-muted-foreground">
              <TrendingUp className="mr-1 h-3 w-3 text-green-500" />
              {metrics.monthlyGrowth >= 0 ? "+" : ""}
              {metrics.monthlyGrowth}% vs mês anterior
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Customer LTV</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(customerMetrics.ltv)}</div>
            <p className="text-xs text-muted-foreground">Lifetime Value médio</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CAC Payback</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{customerMetrics.paybackPeriodMonths.toFixed(1)} meses</div>
            <p className="text-xs text-muted-foreground">Tempo para recuperar CAC</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Revenue Retention</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formattedRetention.net}</div>
            <div className="flex items-center text-xs text-muted-foreground">
              <TrendingUp className="mr-1 h-3 w-3 text-green-500" />
              Expansão &gt; Churn
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Analytics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7" aria-busy={isLoading}>
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Evolução MRR e ARR</CardTitle>
            <CardDescription>Crescimento da receita recorrente ao longo do tempo</CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={monthlySeries}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value: number) => [formatCurrency(value), "MRR"]} />
                <Area
                  type="monotone"
                  dataKey="mrr"
                  stroke="hsl(var(--primary))"
                  fill="hsl(var(--primary))"
                  fillOpacity={0.3}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Receita por Plano</CardTitle>
            <CardDescription>Contribuição de cada plano para o MRR</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={revenueByPlan}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, revenue }) => `${name}: ${formatCurrency(revenue)}`}
                  outerRadius={80}
                  dataKey="revenue"
                >
                  {revenueByPlan.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => [formatCurrency(value), "Receita"]} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Cohort and Churn Analysis */}
      <div className="grid gap-4 md:grid-cols-2" aria-busy={isLoading}>
        <Card>
          <CardHeader>
            <CardTitle>Análise de Cohort - Retenção</CardTitle>
            <CardDescription>% de clientes retidos ao longo do tempo</CardDescription>
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
            <CardDescription>Da aquisição até cliente ativo</CardDescription>
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

      {/* Detailed Metrics */}
      <div className="grid gap-4 md:grid-cols-3" aria-busy={isLoading}>
        <Card>
          <CardHeader>
            <CardTitle>SaaS Metrics</CardTitle>
            <CardDescription>Principais indicadores SaaS</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm">Monthly Churn Rate</span>
              <span className="font-medium text-destructive">{metrics.churnRate.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Annual Churn Rate</span>
              <span className="font-medium">{(metrics.churnRate * 12).toFixed(1)}%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Gross Revenue Retention</span>
              <span className="font-medium">{formattedRetention.gross}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Net Revenue Retention</span>
              <span className="font-medium text-green-600">{formattedRetention.net}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Logo Retention</span>
              <span className="font-medium">{formattedRetention.logo}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Revenue Metrics</CardTitle>
            <CardDescription>Métricas de receita detalhadas</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm">ARPU (Atual)</span>
              <span className="font-medium">{formatCurrency(revenueMetrics.currentArpu)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">ARPU (Período Anterior)</span>
              <span className="font-medium">{formatCurrency(revenueMetrics.previousArpu)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Revenue Growth Rate</span>
              <span className="font-medium text-green-600">{revenueMetrics.revenueGrowthRate.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Expansion Revenue</span>
              <span className="font-medium">{formatCurrency(revenueMetrics.expansionRevenue)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Contraction Revenue</span>
              <span className="font-medium text-destructive">{formatCurrency(revenueMetrics.contractionRevenue)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Customer Metrics</CardTitle>
            <CardDescription>Métricas de aquisição e retenção</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm">CAC (Customer Acquisition Cost)</span>
              <span className="font-medium">{formatCurrency(customerMetrics.cac)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">LTV (Lifetime Value)</span>
              <span className="font-medium">{formatCurrency(customerMetrics.ltv)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">LTV:CAC Ratio</span>
              <span className="font-medium text-green-600">
                {customerMetrics.cac > 0
                  ? `${(customerMetrics.ltv / customerMetrics.cac).toFixed(1)}:1`
                  : "—"}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Payback Period</span>
              <span className="font-medium">{customerMetrics.paybackPeriodMonths.toFixed(1)} meses</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Trial to Paid Conversion</span>
              <span className="font-medium">{customerMetrics.trialConversion.toFixed(1)}%</span>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-3">
          <CardHeader>
            <CardTitle>Relatório de Sincronização Judit</CardTitle>
            <CardDescription>
              Custos consolidados por serviço{syncReport ? ` (${syncPeriodLabel})` : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="text-sm text-muted-foreground">Carregando relatório...</div>
            ) : syncReport ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-sm text-muted-foreground">Período consultado</span>
                    <div className="text-sm font-medium">{syncPeriodLabel}</div>
                  </div>
                  <div className="flex flex-wrap gap-6 text-sm">
                    <div className="space-y-1 text-right">
                      <span className="text-muted-foreground">Total de requisições</span>
                      <div className="text-lg font-semibold">
                        {syncReport.totalRequests.toLocaleString("pt-BR")}
                      </div>
                    </div>
                    <div className="space-y-1 text-right">
                      <span className="text-muted-foreground">Custo total</span>
                      <div className="text-lg font-semibold">{formatCurrency(syncReport.totalCost)}</div>
                    </div>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-border text-sm">
                    <thead>
                      <tr className="text-left text-muted-foreground">
                        <th className="py-2 pr-4 font-medium">Serviço</th>
                        <th className="py-2 pr-4 font-medium text-right">Quantidade</th>
                        <th className="py-2 font-medium text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {syncReport.subtotals.map((item) => (
                        <tr key={item.service}>
                          <td className="py-2 pr-4">{item.service}</td>
                          <td className="py-2 pr-4 text-right">{item.quantity.toLocaleString("pt-BR")}</td>
                          <td className="py-2 text-right">{formatCurrency(item.totalCost)}</td>
                        </tr>
                      ))}
                      {syncReport.subtotals.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="py-4 text-center text-muted-foreground">
                            Nenhum subtotal disponível para o período.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="text-sm text-muted-foreground">
                Nenhum dado disponível para o período selecionado.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
