export const mockAnalytics = {
  mrr: 45000,
  arr: 540000,
  churnRate: 4.5,
  conversionRate: 15.7,
  activeSubscriptions: 250,
  trialSubscriptions: 35,
  totalCompanies: 25,
  monthlyGrowth: 5.2,
};

export const mockMonthlyData = [
  { month: "Jan", mrr: 35000, churn: 4, customers: 200 },
  { month: "Feb", mrr: 37000, churn: 5, customers: 210 },
  { month: "Mar", mrr: 39000, churn: 3, customers: 220 },
  { month: "Apr", mrr: 41000, churn: 4, customers: 230 },
  { month: "May", mrr: 43000, churn: 2, customers: 240 },
  { month: "Jun", mrr: 45000, churn: 3, customers: 250 },
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
  { name: "Básico", value: 40 },
  { name: "Profissional", value: 32 },
  { name: "Enterprise", value: 28 },
];

export const mockConversionFunnel = [
  { stage: "Visitantes", count: 1000, conversion: 100 },
  { stage: "Sign-ups", count: 250, conversion: 25 },
  { stage: "Trials", count: 200, conversion: 20 },
  { stage: "Pagantes", count: 157, conversion: 15.7 },
  { stage: "Ativos 3m+", count: 142, conversion: 14.2 },

];
