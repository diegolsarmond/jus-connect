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

export const mockPlans = [
  {
    id: "plan-basic",
    name: "Básico",
    description: "Ideal para escritórios que estão começando a digitalizar a operação",
    price: 199,
    billingCycle: "monthly",
    maxUsers: 5,
    maxCases: 100,
    features: [
      "Gestão de processos essencial",
      "Painel de clientes e compromissos",
      "Relatórios mensais básicos",
    ],
    isActive: true,
  },
  {
    id: "plan-professional",
    name: "Profissional",
    description: "Plano completo para escritórios em crescimento",
    price: 499,
    billingCycle: "monthly",
    maxUsers: 20,
    maxCases: 500,
    features: [
      "Todos os recursos do Básico",
      "Automação de documentos",
      "Integração com sistemas financeiros",
      "Suporte prioritário",
    ],
    isActive: true,
  },
  {
    id: "plan-enterprise",
    name: "Enterprise",
    description: "Para operações jurídicas que necessitam de alta personalização",
    price: 1299,
    billingCycle: "monthly",
    maxUsers: -1,
    maxCases: -1,
    features: [
      "Todos os recursos do Profissional",
      "API e integrações avançadas",
      "Gestor de sucesso dedicado",
      "Treinamento personalizado",
    ],
    isActive: true,
  },
];

export const mockCompanies = [
  {
    id: "company-001",
    name: "Silva & Associados",
    email: "contato@silvaassociados.com",
    status: "active",
    createdAt: "2023-11-10T10:00:00Z",
    lastActivity: "2024-06-20T14:30:00Z",
    subscription: {
      planId: "plan-professional",
      mrr: 1499,
    },
    users: [
      {
        id: "user-001",
        name: "Mariana Silva",
        email: "mariana@silvaassociados.com",
        role: "admin",
        isActive: true,
        lastLogin: "2024-06-21T12:15:00Z",
      },
      {
        id: "user-002",
        name: "Rafael Costa",
        email: "rafael@silvaassociados.com",
        role: "user",
        isActive: true,
        lastLogin: "2024-06-20T09:20:00Z",
      },
      {
        id: "user-003",
        name: "Ana Paula Mendes",
        email: "ana@silvaassociados.com",
        role: "support",
        isActive: false,
        lastLogin: "2024-05-30T16:45:00Z",
      },
    ],
  },
  {
    id: "company-002",
    name: "Ferreira Advocacia",
    email: "contato@ferreiraadv.com",
    status: "trial",
    createdAt: "2024-02-05T09:00:00Z",
    lastActivity: "2024-06-18T11:10:00Z",
    subscription: {
      planId: "plan-basic",
      mrr: 299,
    },
    users: [
      {
        id: "user-004",
        name: "João Ferreira",
        email: "joao@ferreiraadv.com",
        role: "admin",
        isActive: true,
        lastLogin: "2024-06-18T08:00:00Z",
      },
      {
        id: "user-005",
        name: "Luiza Ramos",
        email: "luiza@ferreiraadv.com",
        role: "user",
        isActive: true,
        lastLogin: "2024-06-17T17:30:00Z",
      },
    ],
  },
  {
    id: "company-003",
    name: "Barbosa & Lima Consultoria Jurídica",
    email: "contato@barbosalimajur.com",
    status: "active",
    createdAt: "2023-07-22T13:30:00Z",
    lastActivity: "2024-06-21T09:45:00Z",
    subscription: {
      planId: "plan-enterprise",
      mrr: 2999,
    },
    users: [
      {
        id: "user-006",
        name: "Camila Barbosa",
        email: "camila@barbosalimajur.com",
        role: "admin",
        isActive: true,
        lastLogin: "2024-06-21T08:20:00Z",
      },
      {
        id: "user-007",
        name: "Thiago Lima",
        email: "thiago@barbosalimajur.com",
        role: "user",
        isActive: true,
        lastLogin: "2024-06-20T19:05:00Z",
      },
      {
        id: "user-008",
        name: "Paula Nogueira",
        email: "paula@barbosalimajur.com",
        role: "user",
        isActive: true,
        lastLogin: "2024-06-19T15:40:00Z",
      },
    ],
  },
  {
    id: "company-004",
    name: "Oliveira & Santos Sociedade de Advogados",
    email: "contato@oliveirasantos.adv.br",
    status: "inactive",
    createdAt: "2022-04-12T15:15:00Z",
    lastActivity: "2024-04-02T10:00:00Z",
    subscription: null,
    users: [
      {
        id: "user-009",
        name: "Eduardo Oliveira",
        email: "eduardo@oliveirasantos.adv.br",
        role: "admin",
        isActive: false,
        lastLogin: "2024-03-28T18:10:00Z",
      },
      {
        id: "user-010",
        name: "Fernanda Santos",
        email: "fernanda@oliveirasantos.adv.br",
        role: "user",
        isActive: false,
        lastLogin: "2024-03-18T10:55:00Z",
      },
    ],
  },
];

export const mockSubscriptions = [
  {
    id: "subscription-001",
    companyId: "company-001",
    planId: "plan-professional",
    status: "active",
    mrr: 1499,
    currentPeriodStart: "2024-06-01T00:00:00Z",
    currentPeriodEnd: "2024-06-30T23:59:59Z",
    trialEnd: null,
  },
  {
    id: "subscription-002",
    companyId: "company-002",
    planId: "plan-basic",
    status: "trialing",
    mrr: 299,
    currentPeriodStart: "2024-06-10T00:00:00Z",
    currentPeriodEnd: "2024-07-09T23:59:59Z",
    trialEnd: "2024-06-24T23:59:59Z",
  },
  {
    id: "subscription-003",
    companyId: "company-003",
    planId: "plan-enterprise",
    status: "active",
    mrr: 2999,
    currentPeriodStart: "2024-06-05T00:00:00Z",
    currentPeriodEnd: "2024-07-04T23:59:59Z",
    trialEnd: null,
  },
  {
    id: "subscription-004",
    companyId: "company-004",
    planId: "plan-basic",
    status: "canceled",
    mrr: 0,
    currentPeriodStart: "2023-12-01T00:00:00Z",
    currentPeriodEnd: "2023-12-31T23:59:59Z",
    trialEnd: null,
  },
];

export const mockSupportTickets = [
  {
    id: "ticket-001",
    companyId: "company-001",
    title: "Erro ao gerar relatório financeiro",
    description: "Ao tentar exportar o relatório financeiro mensal o sistema retorna erro 500.",
    status: "open",
    priority: "high",
    createdAt: "2024-06-20T13:00:00Z",
    updatedAt: "2024-06-21T09:30:00Z",
    assignedTo: "Ana Costa",
  },
  {
    id: "ticket-002",
    companyId: "company-002",
    title: "Dúvidas sobre migração de dados",
    description: "Cliente solicitou auxílio para importar processos do sistema antigo.",
    status: "in_progress",
    priority: "medium",
    createdAt: "2024-06-18T10:15:00Z",
    updatedAt: "2024-06-20T16:45:00Z",
    assignedTo: "Bruno Lima",
  },
  {
    id: "ticket-003",
    companyId: "company-003",
    title: "Solicitação de nova integração",
    description: "Escritório solicitou integração com sistema de BI externo.",
    status: "resolved",
    priority: "urgent",
    createdAt: "2024-06-10T09:40:00Z",
    updatedAt: "2024-06-19T14:20:00Z",
    assignedTo: "Equipe Enterprise",
  },
  {
    id: "ticket-004",
    companyId: "company-004",
    title: "Treinamento adicional",
    description: "Solicitação para agendar treinamento de novos usuários.",
    status: "closed",
    priority: "low",
    createdAt: "2024-04-05T11:00:00Z",
    updatedAt: "2024-04-15T15:30:00Z",
    assignedTo: null,
  },
];

export type ServerLog = {
  id: string;
  level: "info" | "warn" | "error";
  timestamp: string;
  message: string;
  logger?: string;
  metadata?: Record<string, unknown>;
  request?: {
    method: string;
    uri: string;
    status: number;
    durationMs: number;
    clientIp: string;
    protocol: string;
    host: string;
    userAgent?: string;
  };
};

export const mockServerLogs: ServerLog[] = [
  {
    id: "log-001",
    level: "info",
    timestamp: "2024-06-21T12:40:12Z",
    message: "Scheduled backup completed successfully",
    logger: "scheduler",
    metadata: {
      duration: "3m24s",
      backupSize: "1.2GB",
    },
  },
  {
    id: "log-002",
    level: "warn",
    timestamp: "2024-06-21T12:35:02Z",
    message: "High memory usage detected on worker-2",
    logger: "infrastructure",
    metadata: {
      usage: 82,
      threshold: 80,
      service: "reporting",
    },
  },
  {
    id: "log-003",
    level: "error",
    timestamp: "2024-06-21T12:30:45Z",
    message: "Unhandled exception during invoice generation",
    logger: "billing",
    metadata: {
      companyId: "company-002",
      planId: "plan-basic",
      retryCount: 1,
    },
    request: {
      method: "POST",
      uri: "/api/billing/invoices",
      status: 500,
      durationMs: 842,
      clientIp: "177.32.15.10",
      protocol: "HTTP/2",
      host: "api.jusconnect.app",
      userAgent: "jus-connect/1.4.2",
    },
  },
  {
    id: "log-004",
    level: "info",
    timestamp: "2024-06-21T12:28:19Z",
    message: "GET /admin/companies responded successfully",
    logger: "caddy",
    request: {
      method: "GET",
      uri: "/admin/companies",
      status: 200,
      durationMs: 112,
      clientIp: "200.182.50.42",
      protocol: "HTTP/3",
      host: "app.jusconnect.app",
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    },
  },
  {
    id: "log-005",
    level: "warn",
    timestamp: "2024-06-21T12:25:54Z",
    message: "Multiple failed login attempts detected",
    logger: "security",
    metadata: {
      email: "suspeito@empresa.com",
      attempts: 5,
      lockApplied: true,
    },
    request: {
      method: "POST",
      uri: "/api/auth/login",
      status: 401,
      durationMs: 214,
      clientIp: "45.160.10.200",
      protocol: "HTTP/2",
      host: "api.jusconnect.app",
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    },
  },
  {
    id: "log-006",
    level: "info",
    timestamp: "2024-06-21T12:20:03Z",
    message: "Background sync finished",
    logger: "sync-service",
    metadata: {
      processedRecords: 248,
      durationMs: 5632,
    },
  },
];
