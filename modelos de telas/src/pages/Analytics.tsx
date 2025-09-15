import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { mockAnalytics, mockMonthlyData, mockPlanDistribution } from "@/data/mockData";
import { TrendingUp, TrendingDown, DollarSign, Users, Target, AlertCircle } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, AreaChart, Area } from "recharts";

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))'];

// Extended mock data for analytics
const cohortData = [
  { month: 'Jan', retained: 100, churned: 0 },
  { month: 'Feb', retained: 85, churned: 15 },
  { month: 'Mar', retained: 72, churned: 28 },
  { month: 'Apr', retained: 65, churned: 35 },
  { month: 'May', retained: 60, churned: 40 },
  { month: 'Jun', retained: 58, churned: 42 },
];

const revenueByPlan = [
  { name: 'Básico', revenue: 990, customers: 10 },
  { name: 'Profissional', revenue: 1592, customers: 8 },
  { name: 'Enterprise', revenue: 2793, customers: 7 },
];

const conversionFunnel = [
  { stage: 'Visitantes', count: 1000, conversion: 100 },
  { stage: 'Sign-ups', count: 250, conversion: 25 },
  { stage: 'Trials', count: 200, conversion: 20 },
  { stage: 'Pagantes', count: 157, conversion: 15.7 },
  { stage: 'Ativos 3m+', count: 142, conversion: 14.2 },
];

export default function Analytics() {
  const { mrr, arr, churnRate, conversionRate, activeSubscriptions, totalCompanies, monthlyGrowth } = mockAnalytics;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Relatórios e Analytics</h1>
        <p className="text-muted-foreground">Análise completa de performance e métricas de negócio</p>
      </div>

      {/* Executive Summary */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">MRR</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ {mrr.toLocaleString()}</div>
            <div className="flex items-center text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3 mr-1 text-green-500" />
              +{monthlyGrowth}% vs mês anterior
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Customer LTV</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ {(arr * 0.85).toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Lifetime Value médio</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CAC Payback</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">8.5 meses</div>
            <p className="text-xs text-muted-foreground">Tempo para recuperar CAC</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Revenue Retention</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">112%</div>
            <div className="flex items-center text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3 mr-1 text-green-500" />
              Expansão &gt; Churn
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Analytics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Evolução MRR e ARR</CardTitle>
            <CardDescription>Crescimento da receita recorrente ao longo do tempo</CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={mockMonthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value) => [`R$ ${value}`, 'MRR']} />
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
                  label={({ name, revenue }) => `${name}: R$ ${revenue}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="revenue"
                >
                  {revenueByPlan.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [`R$ ${value}`, 'Receita']} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Cohort and Churn Analysis */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Análise de Cohort - Retenção</CardTitle>
            <CardDescription>% de clientes retidos ao longo do tempo</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={cohortData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value) => [`${value}%`, 'Retidos']} />
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
              <BarChart data={conversionFunnel} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="stage" type="category" width={100} />
                <Tooltip formatter={(value, name) => [
                  name === 'count' ? value : `${value}%`,
                  name === 'count' ? 'Quantidade' : 'Conversão'
                ]} />
                <Bar dataKey="count" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Metrics */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>SaaS Metrics</CardTitle>
            <CardDescription>Principais indicadores SaaS</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm">Monthly Churn Rate</span>
              <span className="font-medium text-destructive">{churnRate}%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Annual Churn Rate</span>
              <span className="font-medium">{(churnRate * 12).toFixed(1)}%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Gross Revenue Retention</span>
              <span className="font-medium">94.8%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Net Revenue Retention</span>
              <span className="font-medium text-green-600">112%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Logo Retention</span>
              <span className="font-medium">96.2%</span>
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
              <span className="font-medium">R$ {(mrr / activeSubscriptions).toFixed(0)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">ARPU (6m atrás)</span>
              <span className="font-medium">R$ 180</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Revenue Growth Rate</span>
              <span className="font-medium text-green-600">+{monthlyGrowth}%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Expansion Revenue</span>
              <span className="font-medium">R$ 89</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Contraction Revenue</span>
              <span className="font-medium text-destructive">R$ 23</span>
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
              <span className="font-medium">R$ 150</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">LTV (Lifetime Value)</span>
              <span className="font-medium">R$ {(arr * 0.85 / activeSubscriptions).toFixed(0)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">LTV:CAC Ratio</span>
              <span className="font-medium text-green-600">
                {((arr * 0.85 / activeSubscriptions) / 150).toFixed(1)}:1
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Payback Period</span>
              <span className="font-medium">8.5 meses</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Trial to Paid Conversion</span>
              <span className="font-medium">{conversionRate}%</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}