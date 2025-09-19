export const mockAnalytics = {
  processosAtivos: 120,
  processosConcluidos: 45,
  indiceEncerramento: 15,
  clientesAtivos: 80,
  clientesProspecto: 25,
  totalClientes: 105,
  taxaConversao: 75,
  crescimentoMensal: 5.2,
  mrr: 19800,
  arr: 237600,
  churnRate: 3.2,
  conversionRate: 22,
  activeSubscriptions: 80,
  trialSubscriptions: 25,
  totalCompanies: 105,
  monthlyGrowth: 5.2,
};

export const mockMonthlyData = [
  { month: "Jan", processos: 20, encerrados: 5, clientes: 90, customers: 90, mrr: 18000, churn: 3.5 },
  { month: "Feb", processos: 25, encerrados: 4, clientes: 94, customers: 94, mrr: 18600, churn: 3.2 },
  { month: "Mar", processos: 30, encerrados: 3, clientes: 98, customers: 98, mrr: 19500, churn: 2.9 },
  { month: "Apr", processos: 28, encerrados: 6, clientes: 100, customers: 100, mrr: 20500, churn: 2.6 },
  { month: "May", processos: 32, encerrados: 2, clientes: 103, customers: 103, mrr: 22150, churn: 2.3 },
  { month: "Jun", processos: 35, encerrados: 4, clientes: 105, customers: 105, mrr: 22800, churn: 2.1 },
];

export const mockCohortData = [
  { month: "Jan", retained: 100, churned: 0 },
  { month: "Feb", retained: 85, churned: 15 },
  { month: "Mar", retained: 72, churned: 28 },
  { month: "Apr", retained: 65, churned: 35 },
  { month: "May", retained: 60, churned: 40 },
  { month: "Jun", retained: 58, churned: 42 },
];

export const mockRevenueByPlan = [
  { name: "Básico", revenue: 990, customers: 10 },
  { name: "Profissional", revenue: 1592, customers: 8 },
  { name: "Enterprise", revenue: 2793, customers: 7 },
];

export const mockPlanDistribution = [
  { name: "Básico", value: 45 },
  { name: "Profissional", value: 35 },
  { name: "Enterprise", value: 20 },
];

export const mockMonthlyFinancials = [
  { month: "Jan", receita: 18500, despesas: 11200 },
  { month: "Feb", receita: 19600, despesas: 11800 },
  { month: "Mar", receita: 20500, despesas: 12000 },
  { month: "Apr", receita: 21300, despesas: 12500 },
  { month: "May", receita: 22150, despesas: 12950 },
  { month: "Jun", receita: 22800, despesas: 13200 },
];

export const mockAreaDistribution = [
  { name: "Cível", value: 40 },
  { name: "Trabalhista", value: 32 },
  { name: "Tributário", value: 28 },
];

export const mockConversionFunnel = [
  { stage: "Visitantes", count: 1000, conversion: 100 },
  { stage: "Sign-ups", count: 250, conversion: 25 },
  { stage: "Trials", count: 200, conversion: 20 },
  { stage: "Pagantes", count: 157, conversion: 15.7 },
  { stage: "Ativos 3m+", count: 142, conversion: 14.2 },

];
