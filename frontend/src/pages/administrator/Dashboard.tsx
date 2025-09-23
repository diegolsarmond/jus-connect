import { useEffect, useState } from "react";
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
import {
  TrendingUp,
  TrendingDown,
  Users,
  CreditCard,
  Building2,
  DollarSign,
  AlertCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  loadAdminDashboardAnalytics,
  type AdminDashboardAnalytics,
  type DistributionSlice,
  type AdminMonthlyPoint,
} from "@/services/analytics";

const COLORS = ["hsl(var(--primary))", "hsl(var(--secondary))", "hsl(var(--accent))"];

const formatCurrency = (value: number) =>
  `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function Dashboard() {
  const [analytics, setAnalytics] = useState<AdminDashboardAnalytics | null>(null);
  const [monthlySeries, setMonthlySeries] = useState<AdminMonthlyPoint[]>([]);
  const [planDistribution, setPlanDistribution] = useState<DistributionSlice[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let mounted = true;

    const loadData = async () => {
      setIsLoading(true);
      try {
        const data = await loadAdminDashboardAnalytics(controller.signal);
        if (!mounted) {
          return;
        }

        setAnalytics(data);
        setMonthlySeries(data.monthlySeries);
        setPlanDistribution(data.planDistribution);
        setError(null);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }

        console.error("Falha ao carregar métricas administrativas", err);
        if (mounted) {
          setError("Não foi possível carregar as métricas administrativas.");
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

  const metrics = analytics?.metrics ?? {
    mrr: 0,
    arr: 0,
    churnRate: 0,
    conversionRate: 0,
    activeSubscriptions: 0,
    trialSubscriptions: 0,
    totalCompanies: 0,
    monthlyGrowth: 0,
  };

  const arpu = metrics.activeSubscriptions > 0 ? metrics.mrr / metrics.activeSubscriptions : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Visão geral do seu CRM SaaS</p>
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
            <CardTitle className="text-sm font-medium">MRR</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(metrics.mrr)}</div>
            <div className="flex items-center text-xs text-muted-foreground">
              <TrendingUp className="mr-1 h-3 w-3 text-green-500" />
              {metrics.monthlyGrowth >= 0 ? "+" : ""}
              {metrics.monthlyGrowth}% mês anterior
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">ARR</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(metrics.arr)}</div>
            <p className="text-xs text-muted-foreground">Receita anual recorrente</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Churn</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.churnRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">Cancelamentos mensais</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Empresas Ativas</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalCompanies}</div>
            <div className="flex gap-2 text-xs">
              <Badge variant="secondary">{metrics.activeSubscriptions} ativas</Badge>
              <Badge variant="outline">{metrics.trialSubscriptions} trial</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7" aria-busy={isLoading}>
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Crescimento MRR</CardTitle>
            <CardDescription>Evolução da receita mensal recorrente</CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthlySeries}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value: number) => [formatCurrency(value), "MRR"]} />
                <Line
                  type="monotone"
                  dataKey="mrr"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Distribuição por Plano</CardTitle>
            <CardDescription>Número de clientes por plano</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={planDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value.toFixed(1)}%`}
                  outerRadius={80}
                  dataKey="value"
                >
                  {planDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => [`${value.toFixed(1)}%`, "Percentual"]} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Churn and Customer Growth */}
      <div className="grid gap-4 md:grid-cols-2" aria-busy={isLoading}>
        <Card>
          <CardHeader>
            <CardTitle>Taxa de Churn Mensal</CardTitle>
            <CardDescription>Percentual de cancelamentos por mês</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={monthlySeries}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis domain={[0, 100]} />
                <Tooltip formatter={(value: number) => [`${value.toFixed(1)}%`, "Churn"]} />
                <Bar dataKey="churn" fill="hsl(var(--destructive))" />
              </BarChart>
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
                  dataKey="customers"
                  stroke="hsl(var(--secondary))"
                  strokeWidth={2}
                />
              </LineChart>
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
              <div className="text-2xl font-bold text-primary">{metrics.conversionRate.toFixed(1)}%</div>
              <p className="text-sm text-muted-foreground">Taxa de Conversão</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{formatCurrency(arpu)}</div>
              <p className="text-sm text-muted-foreground">ARPU (Receita média por usuário)</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">
                {metrics.churnRate > 0 ? (12 / Math.max(metrics.churnRate / 100, 1e-3)).toFixed(1) : "—"} meses
              </div>
              <p className="text-sm text-muted-foreground">Customer Lifetime (estimado)</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{formatCurrency(metrics.arr * 0.85)}</div>
              <p className="text-sm text-muted-foreground">LTV (Customer Lifetime Value)</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
