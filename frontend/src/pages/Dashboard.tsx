import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { mockAnalytics, mockMonthlyData, mockAreaDistribution } from "@/data/mockData";
import { TrendingUp, TrendingDown, Gavel, CheckCircle, Users } from "lucide-react";
import { getApiUrl } from "@/lib/api";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from "recharts";

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))'];

type ProcessoDashboardMetrics = {
  total: number;
  active: number;
  concluded: number;
  closingRate: number;
};

type ProcessoApiSummary = {
  status?: string | null;
};

const CLOSED_STATUS_KEYWORDS = [
  "encerrado",
  "concluido",
  "finalizado",
  "arquivado",
  "baixado",
  "baixa",
];

const normalizeStatus = (status: unknown): string => {
  if (typeof status !== "string") {
    return "";
  }

  return status
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
};

const isConcludedStatus = (status: unknown): boolean => {
  const normalized = normalizeStatus(status);

  if (!normalized) {
    return false;
  }

  return CLOSED_STATUS_KEYWORDS.some((keyword) => normalized.includes(keyword));
};

export default function Dashboard() {
  const { clientesAtivos, clientesProspecto, totalClientes, taxaConversao, crescimentoMensal } = mockAnalytics;
  const [processMetrics, setProcessMetrics] = useState<ProcessoDashboardMetrics>({
    total: mockAnalytics.processosAtivos + mockAnalytics.processosConcluidos,
    active: mockAnalytics.processosAtivos,
    concluded: mockAnalytics.processosConcluidos,
    closingRate: mockAnalytics.indiceEncerramento,
  });

  useEffect(() => {
    const abortController = new AbortController();
    let isMounted = true;

    const loadProcessMetrics = async () => {
      try {
        const response = await fetch(getApiUrl("processos"), {
          headers: { Accept: "application/json" },
          signal: abortController.signal,
        });

        if (!response.ok) {
          console.error(`Falha ao carregar processos para o dashboard (HTTP ${response.status})`);
          return;
        }

        const data = (await response.json()) as unknown;

        if (!Array.isArray(data)) {
          console.error("Resposta inválida da API ao listar processos para o dashboard.");
          return;
        }

        const processos = data as ProcessoApiSummary[];

        const concludedCount = processos.reduce((total, processo) => {
          return isConcludedStatus(processo.status) ? total + 1 : total;
        }, 0);

        const totalCount = data.length;
        const activeCount = Math.max(totalCount - concludedCount, 0);
        const closingRate = totalCount === 0 ? 0 : Math.round((concludedCount / totalCount) * 100);

        if (!isMounted) {
          return;
        }

        setProcessMetrics({
          total: totalCount,
          active: activeCount,
          concluded: concludedCount,
          closingRate,
        });
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }

        console.error("Erro ao carregar processos para o dashboard", error);
      }
    };

    void loadProcessMetrics();

    return () => {
      isMounted = false;
      abortController.abort();
    };
  }, []);

  const processosPorCliente = clientesAtivos > 0
    ? (processMetrics.active / clientesAtivos).toFixed(1)
    : "0.0";

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Visão geral do seu CRM jurídico</p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Processos Ativos</CardTitle>
            <Gavel className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{processMetrics.active}</div>
            <div className="flex items-center text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3 mr-1 text-green-500" />
              +{crescimentoMensal}% mês anterior
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
            <p className="text-xs text-muted-foreground">Encerrados no mês</p>
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
            <div className="text-2xl font-bold">{totalClientes}</div>
            <div className="flex gap-2 text-xs">
              <Badge variant="secondary">{clientesAtivos} ativos</Badge>
              <Badge variant="outline">{clientesProspecto} prospectos</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Abertura de Processos</CardTitle>
            <CardDescription>Quantidade de processos por mês</CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={mockMonthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value) => [value, 'Processos']} />
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

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Distribuição por Área do Direito</CardTitle>
            <CardDescription>Processos por área</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={mockAreaDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {mockAreaDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Churn and Customer Growth */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Encerramentos Mensais</CardTitle>
            <CardDescription>Quantidade de processos encerrados por mês</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={mockMonthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value) => [value, 'Encerrados']} />
                <Bar dataKey="encerrados" fill="hsl(var(--destructive))" />
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
              <LineChart data={mockMonthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value) => [value, 'Clientes']} />
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

      {/* Quick Stats */}
      <Card>
        <CardHeader>
          <CardTitle>Métricas Rápidas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{taxaConversao}%</div>
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
              <div className="text-2xl font-bold text-primary">{clientesAtivos}</div>
              <p className="text-sm text-muted-foreground">Clientes Ativos</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

