import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  mockAnalytics,
  mockMonthlyData,
  mockCohortData,
  mockAreaDistribution,
  mockConversionFunnel,
  mockRevenueByPlan,
  mockMonthlyFinancials,
} from "@/data/mockData";
import {
  TrendingUp,
  Users,
  CheckCircle,
  Gavel,
  Wallet,
  CircleDollarSign,
} from "lucide-react";
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
  AreaChart,
  Area,
} from "recharts";

const COLORS = ["hsl(var(--primary))", "hsl(var(--secondary))", "hsl(var(--accent))"];

export default function Relatorios() {
  const {
    processosAtivos,
    processosConcluidos,
    indiceEncerramento,
    clientesAtivos,
    clientesProspecto,
    totalClientes,
    taxaConversao,
    crescimentoMensal,
  } = mockAnalytics;

  const totalRevenue = mockRevenueByPlan.reduce((acc, plan) => acc + plan.revenue, 0);
  const payingClients = mockRevenueByPlan.reduce((acc, plan) => acc + plan.customers, 0);
  const averageTicket = payingClients > 0 ? totalRevenue / payingClients : 0;
  const currentMonth = mockMonthlyFinancials.at(-1);
  const previousMonth = mockMonthlyFinancials.at(-2);
  const revenueGrowth = previousMonth && previousMonth.receita > 0 && currentMonth
    ? ((currentMonth.receita - previousMonth.receita) / previousMonth.receita) * 100
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Relatórios Jurídicos</h1>
        <p className="text-muted-foreground">Análise de performance do seu CRM jurídico</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Processos Ativos</CardTitle>
            <Gavel className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{processosAtivos}</div>
            <div className="flex items-center text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3 mr-1 text-green-500" />
              +{crescimentoMensal}% vs mês anterior
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes Ativos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{clientesAtivos}</div>
            <p className="text-xs text-muted-foreground">Total de clientes ativos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Índice de Encerramento</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{indiceEncerramento}%</div>
            <p className="text-xs text-muted-foreground">Casos concluídos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Conversão</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{taxaConversao}%</div>
            <p className="text-xs text-muted-foreground">De prospects para clientes</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Faturamento Total</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              R$ {totalRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">Receita acumulada por planos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
            <CircleDollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              R$ {averageTicket.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">Faturamento médio por cliente</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes Pagantes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{payingClients}</div>
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
              {revenueGrowth >= 0 ? "+" : ""}
              {revenueGrowth.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">Comparação com o mês anterior</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Evolução de Processos</CardTitle>
            <CardDescription>Crescimento de processos ao longo do tempo</CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={mockMonthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
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
                <Tooltip formatter={(value) => [`${value}%`, "Percentual"]} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Composição do Faturamento</CardTitle>
            <CardDescription>Receita gerada por cada plano</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={mockRevenueByPlan}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip
                  formatter={(value: number | string) => [
                    Number(value).toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    }),
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
              <AreaChart data={mockMonthlyFinancials}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip
                  formatter={(value: number | string, name) => [
                    Number(value).toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    }),
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

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Retenção de Clientes</CardTitle>
            <CardDescription>Percentual de clientes retidos</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={mockCohortData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value) => [`${value}%`, "Retidos"]} />
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
              <BarChart data={mockConversionFunnel} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="stage" type="category" width={100} />
                <Tooltip
                  formatter={(value, name) => [
                    name === "count" ? value : `${value}%`,
                    name === "count" ? "Quantidade" : "Conversão",
                  ]}
                />
                <Bar dataKey="count" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Métricas de Processos</CardTitle>
            <CardDescription>Visão geral dos processos jurídicos</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm">Processos Ativos</span>
              <span className="font-medium">{processosAtivos}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Processos Concluídos</span>
              <span className="font-medium">{processosConcluidos}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Índice de Encerramento</span>
              <span className="font-medium text-green-600">{indiceEncerramento}%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Crescimento Mensal</span>
              <span className="font-medium text-green-600">+{crescimentoMensal}%</span>
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
              <span className="font-medium">{clientesAtivos}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Clientes Prospectos</span>
              <span className="font-medium">{clientesProspecto}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Total de Clientes</span>
              <span className="font-medium">{totalClientes}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Taxa de Conversão</span>
              <span className="font-medium text-green-600">{taxaConversao}%</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

