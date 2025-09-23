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

type ClienteDashboardMetrics = {
  total: number;
  active: number;
  prospects: number;
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

type ClienteApiSummary = {
  ativo?: unknown;
  status?: unknown;
  situacao?: unknown;
  situacao_cliente?: unknown;
};

const isClienteAtivo = (cliente: ClienteApiSummary): boolean => {
  const { ativo } = cliente;

  if (typeof ativo === "boolean") {
    return ativo;
  }

  if (typeof ativo === "number") {
    return ativo > 0;
  }

  if (typeof ativo === "string") {
    const normalized = normalizeStatus(ativo);

    if (!normalized) {
      // Continua a avaliação com base em outros campos
    } else if (["true", "1", "sim", "s", "yes", "y"].includes(normalized)) {
      return true;
    } else if (["false", "0", "nao", "não", "n"].includes(normalized)) {
      return false;
    } else if (normalized.includes("inativ") || normalized.includes("desativ")) {
      return false;
    } else if (normalized.startsWith("ativo")) {
      return true;
    }
  }

  const statusCandidates = [cliente.status, cliente.situacao, cliente.situacao_cliente];

  for (const candidate of statusCandidates) {
    const normalized = normalizeStatus(candidate);

    if (!normalized) {
      continue;
    }

    if (normalized.includes("prospec")) {
      return false;
    }

    if (normalized.includes("inativ") || normalized.includes("desativ")) {
      return false;
    }

    if (normalized.startsWith("ativo")) {
      return true;
    }
  }

  return false;
};

export default function Dashboard() {
  const { taxaConversao, crescimentoMensal } = mockAnalytics;
  const [processMetrics, setProcessMetrics] = useState<ProcessoDashboardMetrics>({
    total: mockAnalytics.processosAtivos + mockAnalytics.processosConcluidos,
    active: mockAnalytics.processosAtivos,
    concluded: mockAnalytics.processosConcluidos,
    closingRate: mockAnalytics.indiceEncerramento,
  });
  const [clientMetrics, setClientMetrics] = useState<ClienteDashboardMetrics>({
    total: mockAnalytics.totalClientes,
    active: mockAnalytics.clientesAtivos,
    prospects: mockAnalytics.clientesProspecto,
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

  useEffect(() => {
    const abortController = new AbortController();
    let isMounted = true;

    const extractClientes = (payload: unknown): ClienteApiSummary[] => {
      if (Array.isArray(payload)) {
        return payload as ClienteApiSummary[];
      }

      if (payload && typeof payload === "object") {
        const maybeRows = (payload as { rows?: unknown }).rows;

        if (Array.isArray(maybeRows)) {
          return maybeRows as ClienteApiSummary[];
        }

        const maybeData = (payload as { data?: unknown }).data;

        if (Array.isArray(maybeData)) {
          return maybeData as ClienteApiSummary[];
        }

        if (maybeData && typeof maybeData === "object") {
          const nestedRows = (maybeData as { rows?: unknown }).rows;

          if (Array.isArray(nestedRows)) {
            return nestedRows as ClienteApiSummary[];
          }
        }
      }

      return [];
    };

    const loadClientMetrics = async () => {
      try {
        const response = await fetch(getApiUrl("clientes"), {
          headers: { Accept: "application/json" },
          signal: abortController.signal,
        });

        if (!response.ok) {
          console.error(`Falha ao carregar clientes para o dashboard (HTTP ${response.status})`);
          return;
        }

        const payload = (await response.json()) as unknown;
        const clientes = extractClientes(payload);

        const total = clientes.length;
        const active = clientes.reduce((count, cliente) => (isClienteAtivo(cliente) ? count + 1 : count), 0);
        const prospects = Math.max(total - active, 0);

        if (!isMounted) {
          return;
        }

        setClientMetrics({
          total,
          active,
          prospects,
        });
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }

        console.error("Erro ao carregar clientes para o dashboard", error);
      }
    };

    void loadClientMetrics();

    return () => {
      isMounted = false;
      abortController.abort();
    };
  }, []);

  const processosPorCliente = clientMetrics.active > 0
    ? (processMetrics.active / clientMetrics.active).toFixed(1)
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
            <div className="text-2xl font-bold">{clientMetrics.total}</div>
            <div className="flex gap-2 text-xs">
              <Badge variant="secondary">{clientMetrics.active} ativos</Badge>
              <Badge variant="outline">{clientMetrics.prospects} prospectos</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-7">
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
              <div className="text-2xl font-bold text-primary">{clientMetrics.active}</div>
              <p className="text-sm text-muted-foreground">Clientes Ativos</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

