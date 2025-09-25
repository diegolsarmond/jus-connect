import { getApiUrl } from "@/lib/api";
import { fetchFlows, type Flow } from "@/lib/flows";
import {
  evaluateCompanySubscription,
  type CompanySubscriptionSource,
} from "@/lib/companySubscription";

const JSON_HEADERS: HeadersInit = { Accept: "application/json" };

interface ApiProcesso {
  status?: unknown;
  tipo?: unknown;
  classe_judicial?: unknown;
  assunto?: unknown;
  data_distribuicao?: unknown;
  criado_em?: unknown;
}

interface ApiCliente {
  ativo?: unknown;
  status?: unknown;
  situacao?: unknown;
  situacao_cliente?: unknown;
  datacadastro?: unknown;
}

interface ApiEmpresa extends CompanySubscriptionSource {
  id?: unknown;
  nome_empresa?: unknown;
  plano?: unknown;
  responsavel?: unknown;
  ativo?: unknown;
  datacadastro?: unknown;
  atualizacao?: unknown;
}

interface ApiPlano {
  id?: unknown;
  nome?: unknown;
  valor?: unknown;
  valor_mensal?: unknown;
}

interface ApiNotification {
  id?: unknown;
  title?: unknown;
  message?: unknown;
  category?: unknown;
  type?: unknown;
  createdAt?: unknown;
  metadata?: unknown;
}

export interface DashboardAnalytics {
  processMetrics: {
    total: number;
    active: number;
    concluded: number;
    closingRate: number;
  };
  clientMetrics: {
    total: number;
    active: number;
    prospects: number;
  };
  kpis: {
    conversionRate: number;
    monthlyGrowth: number;
  };
  monthlySeries: MonthlySeriesPoint[];
  areaDistribution: DistributionSlice[];
}

export interface ReportsAnalytics {
  overview: DashboardAnalytics;
  revenueByPlan: RevenueByPlanSlice[];
  financialSeries: FinancialSeriesPoint[];
  cohort: CohortPoint[];
  funnel: FunnelStage[];
  revenueSummary: {
    totalRevenue: number;
    payingClients: number;
    averageTicket: number;
    revenueGrowth: number;
  };
}

export interface AdminDashboardAnalytics {
  metrics: AdminMetrics;
  monthlySeries: AdminMonthlyPoint[];
  planDistribution: DistributionSlice[];
}

export interface AdminAnalyticsOverview {
  dashboard: AdminDashboardAnalytics;
  revenueByPlan: RevenueByPlanSlice[];
  cohort: CohortPoint[];
  funnel: FunnelStage[];
  retention: {
    gross: number;
    net: number;
    logo: number;
  };
  revenueMetrics: {
    currentArpu: number;
    previousArpu: number;
    revenueGrowthRate: number;
    expansionRevenue: number;
    contractionRevenue: number;
  };
  customerMetrics: {
    cac: number;
    ltv: number;
    paybackPeriodMonths: number;
    trialConversion: number;
  };
}

export interface LogEvent {
  id: string;
  level: "info" | "warn" | "error";
  timestamp: string;
  message: string;
  source: string;
  metadata?: Record<string, unknown>;
  request?: {
    method?: string;
    uri?: string;
    status?: number;
    durationMs?: number;
    clientIp?: string;
    protocol?: string;
    host?: string;
    userAgent?: string;
  };
}

export interface MonthlySeriesPoint {
  key: string;
  month: string;
  processos: number;
  encerrados: number;
  clientes: number;
  clientesNovos: number;
}

export interface FinancialSeriesPoint {
  key: string;
  month: string;
  receita: number;
  despesas: number;
}

export interface CohortPoint {
  key: string;
  month: string;
  retained: number;
  churned: number;
}

export interface FunnelStage {
  stage: string;
  count: number;
  conversion: number;
}

export interface RevenueByPlanSlice {
  id: string;
  name: string;
  revenue: number;
  customers: number;
}

export interface DistributionSlice {
  name: string;
  value: number;
}

export interface AdminMetrics {
  mrr: number;
  arr: number;
  churnRate: number;
  conversionRate: number;
  activeSubscriptions: number;
  trialSubscriptions: number;
  totalCompanies: number;
  monthlyGrowth: number;
}

export interface AdminMonthlyPoint {
  key: string;
  month: string;
  mrr: number;
  arr: number;
  churn: number;
  customers: number;
}

const CLOSED_STATUS_KEYWORDS = [
  "encerrado",
  "concluido",
  "concluído",
  "finalizado",
  "arquivado",
  "baixado",
  "baixa",
];

const POSITIVE_FLAGS = new Set([
  "true",
  "1",
  "sim",
  "s",
  "yes",
  "y",
  "ativo",
  "ativa",
  "habilitado",
  "habilitada",
]);

const NEGATIVE_FLAGS = new Set([
  "false",
  "0",
  "nao",
  "n",
  "não",
  "no",
  "inativo",
  "inativa",
  "desativado",
  "desativada",
  "desabilitado",
  "desabilitada",
]);

const LEVEL_MAP: Record<string, LogEvent["level"]> = {
  info: "info",
  success: "info",
  warning: "warn",
  warn: "warn",
  error: "error",
  danger: "error",
};

const MONTHS_WINDOW = 6;

const monthFormatter = new Intl.DateTimeFormat("pt-BR", {
  month: "short",
});

const monthLabelFormatter = new Intl.DateTimeFormat("pt-BR", {
  month: "short",
  year: "2-digit",
});

function normalizeString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed) {
      return trimmed;
    }
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }

  if (value != null && typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}

function normalizeDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }

    const match = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (match) {
      const [, day, month, year] = match;
      const formatted = `${year}-${month}-${day}`;
      const date = new Date(formatted);
      return Number.isNaN(date.getTime()) ? null : date;
    }
  }

  return null;
}

function normalizeNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.replace(/[\sR$]/g, "");
    if (!trimmed) {
      return null;
    }

    const normalized = Number.parseFloat(trimmed.replace(",", "."));
    return Number.isFinite(normalized) ? normalized : null;
  }

  return null;
}

function normalizeBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value === 0 ? false : true;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      return null;
    }

    if (POSITIVE_FLAGS.has(normalized)) {
      return true;
    }

    if (NEGATIVE_FLAGS.has(normalized)) {
      return false;
    }
  }

  return null;
}

function normalizeStatus(value: unknown): string | null {
  const normalized = normalizeString(value);
  if (!normalized) {
    return null;
  }

  return normalized
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function isConcludedStatus(status: unknown): boolean {
  const normalized = normalizeStatus(status);
  if (!normalized) {
    return false;
  }

  return CLOSED_STATUS_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

function isClienteAtivo(cliente: ApiCliente): boolean {
  const ativoFlag = normalizeBoolean(cliente.ativo);
  if (ativoFlag !== null) {
    return ativoFlag;
  }

  const candidates = [cliente.status, cliente.situacao, cliente.situacao_cliente];
  for (const candidate of candidates) {
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
}

function getMonthKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function formatMonthKey(key: string, includeYear = false): string {
  const [year, month] = key.split("-");
  if (!year || !month) {
    return key;
  }

  const date = new Date(Number(year), Number(month) - 1, 1);
  if (Number.isNaN(date.getTime())) {
    return key;
  }

  const label = includeYear
    ? monthLabelFormatter.format(date)
    : monthFormatter.format(date);

  // Remover ponto final comum em abreviações (ex.: "jan.")
  const sanitized = label.replace(/\.$/, "");
  return sanitized.charAt(0).toUpperCase() + sanitized.slice(1);
}

function buildMonthSequence(limit: number, referenceDate = new Date()): string[] {
  const months: string[] = [];
  const base = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);

  for (let index = limit - 1; index >= 0; index -= 1) {
    const current = new Date(base);
    current.setMonth(base.getMonth() - index);
    months.push(getMonthKey(current));
  }

  return months;
}

function collectMonthKeys(maps: Array<Map<string, unknown>>, limit: number): string[] {
  const keys = new Set<string>();
  maps.forEach((map) => {
    map.forEach((_value, key) => {
      keys.add(key);
    });
  });

  if (keys.size === 0) {
    return buildMonthSequence(limit);
  }

  return Array.from(keys)
    .sort()
    .slice(-limit);
}

function ensureArray<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) {
    return payload as T[];
  }

  if (payload && typeof payload === "object") {
    const rows = (payload as { rows?: unknown }).rows;
    if (Array.isArray(rows)) {
      return rows as T[];
    }

    const data = (payload as { data?: unknown }).data;
    if (Array.isArray(data)) {
      return data as T[];
    }

    if (data && typeof data === "object") {
      const nestedRows = (data as { rows?: unknown }).rows;
      if (Array.isArray(nestedRows)) {
        return nestedRows as T[];
      }
    }
  }

  return [];
}

async function fetchCollection<T>(path: string, signal?: AbortSignal): Promise<T[]> {
  const response = await fetch(getApiUrl(path), {
    headers: JSON_HEADERS,
    signal,
  });

  if (!response.ok) {
    throw new Error(`Falha ao carregar '${path}' (HTTP ${response.status}).`);
  }

  try {
    const data = await response.json();
    return ensureArray<T>(data);
  } catch (error) {
    throw new Error(`Resposta inválida do endpoint '${path}'.`);
  }
}

function getPlanMonthlyValue(plan: ApiPlano): number {
  const directValue = normalizeNumber(plan.valor);
  if (directValue !== null) {
    return directValue;
  }

  const monthly = normalizeNumber(plan.valor_mensal);
  return monthly ?? 0;
}

function getPlanName(plan: ApiPlano | undefined, planId: string | null): string {
  if (plan && typeof plan.nome === "string" && plan.nome.trim()) {
    return plan.nome.trim();
  }

  if (planId) {
    return `Plano ${planId}`;
  }

  return "Sem plano";
}

function sum(values: Iterable<number>): number {
  let total = 0;
  for (const value of values) {
    total += value;
  }
  return total;
}

function calculatePercentage(part: number, total: number): number {
  if (!Number.isFinite(part) || !Number.isFinite(total) || total <= 0) {
    return 0;
  }

  return Number(((part / total) * 100).toFixed(1));
}

function buildDistribution(map: Map<string, number>): DistributionSlice[] {
  const total = sum(map.values());
  if (total === 0) {
    return [];
  }

  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({
      name,
      value: calculatePercentage(count, total),
    }));
}

function buildCohortFromCounts(
  months: string[],
  newCounts: Map<string, number>,
  activeCounts: Map<string, number>,
): CohortPoint[] {
  return months.map((key) => {
    const created = newCounts.get(key) ?? 0;
    const active = activeCounts.get(key) ?? 0;
    const retained = created > 0 ? calculatePercentage(active, created) : 0;
    return {
      key,
      month: formatMonthKey(key),
      retained,
      churned: Number((100 - retained).toFixed(1)),
    };
  });
}

function buildFunnelStages(stages: Array<{ stage: string; count: number }>): FunnelStage[] {
  const first = stages[0]?.count ?? 0;
  return stages.map(({ stage, count }) => ({
    stage,
    count,
    conversion: first > 0 ? Number(((count / first) * 100).toFixed(1)) : 0,
  }));
}

function buildMonthlySeries(
  months: string[],
  processCounts: Map<string, { total: number; concluded: number }>,
  clientNewCounts: Map<string, number>,
  clientCumulative: Map<string, number>,
): MonthlySeriesPoint[] {
  return months.map((key) => ({
    key,
    month: formatMonthKey(key),
    processos: processCounts.get(key)?.total ?? 0,
    encerrados: processCounts.get(key)?.concluded ?? 0,
    clientes: clientCumulative.get(key) ?? 0,
    clientesNovos: clientNewCounts.get(key) ?? 0,
  }));
}

function buildFinancialSeries(months: string[], revenue: Map<string, number>, expenses: Map<string, number>): FinancialSeriesPoint[] {
  return months.map((key) => ({
    key,
    month: formatMonthKey(key),
    receita: revenue.get(key) ?? 0,
    despesas: expenses.get(key) ?? 0,
  }));
}

function buildAdminMonthlySeries(
  months: string[],
  revenue: Map<string, number>,
  churnRate: Map<string, number>,
  customers: Map<string, number>,
): AdminMonthlyPoint[] {
  return months.map((key) => {
    const mrr = revenue.get(key) ?? 0;
    return {
      key,
      month: formatMonthKey(key, true),
      mrr,
      arr: Number((mrr * 12).toFixed(2)),
      churn: churnRate.get(key) ?? 0,
      customers: customers.get(key) ?? 0,
    };
  });
}

function computeGrowth(current: number, previous: number): number {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) {
    return 0;
  }

  return Number((((current - previous) / previous) * 100).toFixed(1));
}

function safeDivide(numerator: number, denominator: number): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return 0;
  }

  return numerator / denominator;
}

export async function loadDashboardAnalytics(signal?: AbortSignal): Promise<DashboardAnalytics> {
  const [processos, clientes] = await Promise.all<[
    ApiProcesso[],
    ApiCliente[],
  ]>([
    fetchCollection<ApiProcesso>("processos", signal),
    fetchCollection<ApiCliente>("clientes", signal),
  ]);

  const processCounts = new Map<string, { total: number; concluded: number }>();
  let concluded = 0;

  processos.forEach((processo) => {
    const date = normalizeDate(processo.data_distribuicao ?? processo.criado_em);
    const key = date ? getMonthKey(date) : null;
    if (key) {
      const entry = processCounts.get(key) ?? { total: 0, concluded: 0 };
      entry.total += 1;
      if (isConcludedStatus(processo.status)) {
        entry.concluded += 1;
      }
      processCounts.set(key, entry);
    }

    if (isConcludedStatus(processo.status)) {
      concluded += 1;
    }
  });

  const totalProcessos = processos.length;
  const activeProcessos = Math.max(totalProcessos - concluded, 0);
  const closingRate = totalProcessos > 0 ? Math.round((concluded / totalProcessos) * 100) : 0;

  const clientNewCounts = new Map<string, number>();
  const clientActiveCounts = new Map<string, number>();
  const clientActiveCumulative = new Map<string, number>();

  clientes.forEach((cliente) => {
    const date = normalizeDate(cliente.datacadastro);
    if (!date) {
      return;
    }

    const key = getMonthKey(date);
    clientNewCounts.set(key, (clientNewCounts.get(key) ?? 0) + 1);
    if (isClienteAtivo(cliente)) {
      clientActiveCounts.set(key, (clientActiveCounts.get(key) ?? 0) + 1);
    }
  });

  const monthKeys = collectMonthKeys([processCounts, clientNewCounts], MONTHS_WINDOW);
  let runningClients = 0;
  monthKeys.forEach((key) => {
    runningClients += clientNewCounts.get(key) ?? 0;
    clientActiveCumulative.set(key, runningClients);
  });

  const totalClientes = clientes.length;
  const activeClientes = clientes.filter((cliente) => isClienteAtivo(cliente)).length;
  const prospects = Math.max(totalClientes - activeClientes, 0);
  const conversionRate = totalClientes > 0 ? Number(((activeClientes / totalClientes) * 100).toFixed(1)) : 0;

  const lastMonthKey = monthKeys.at(-1);
  const previousMonthKey = monthKeys.at(-2);
  const currentNewClients = lastMonthKey ? clientNewCounts.get(lastMonthKey) ?? 0 : 0;
  const previousNewClients = previousMonthKey ? clientNewCounts.get(previousMonthKey) ?? 0 : 0;
  const monthlyGrowth = computeGrowth(currentNewClients, previousNewClients);

  const areaMap = new Map<string, number>();
  processos.forEach((processo) => {
    const area =
      normalizeString(processo.classe_judicial) ||
      normalizeString(processo.tipo) ||
      normalizeString(processo.assunto);

    if (!area) {
      return;
    }

    const label = area.charAt(0).toUpperCase() + area.slice(1);
    areaMap.set(label, (areaMap.get(label) ?? 0) + 1);
  });

  return {
    processMetrics: {
      total: totalProcessos,
      active: activeProcessos,
      concluded,
      closingRate,
    },
    clientMetrics: {
      total: totalClientes,
      active: activeClientes,
      prospects,
    },
    kpis: {
      conversionRate,
      monthlyGrowth,
    },
    monthlySeries: buildMonthlySeries(monthKeys, processCounts, clientNewCounts, clientActiveCumulative),
    areaDistribution: buildDistribution(areaMap),
  };
}

export async function loadReportsAnalytics(signal?: AbortSignal): Promise<ReportsAnalytics> {
  const [overview, empresas, planos, flows] = await Promise.all([
    loadDashboardAnalytics(signal),
    fetchCollection<ApiEmpresa>("empresas", signal).catch(() => []),
    fetchCollection<ApiPlano>("planos", signal).catch(() => []),
    fetchFlows().catch<Flow[]>(() => []),
  ]);

  const planIndex = new Map<string, ApiPlano>();
  planos.forEach((plan) => {
    const id = normalizeString(plan.id);
    if (id) {
      planIndex.set(id, plan);
    }
  });

  const planStats = new Map<string, { name: string; revenue: number; customers: number }>();
  empresas.forEach((empresa) => {
    const planId = normalizeString(empresa.plano);
    if (!planId) {
      return;
    }

    const plan = planIndex.get(planId);
    const name = getPlanName(plan, planId);
    const monthlyValue = getPlanMonthlyValue(plan ?? {});
    const current = planStats.get(planId) ?? { name, revenue: 0, customers: 0 };
    current.revenue += monthlyValue;
    current.customers += 1;
    planStats.set(planId, current);
  });

  const revenueByPlan: RevenueByPlanSlice[] = Array.from(planStats.values())
    .sort((a, b) => b.revenue - a.revenue)
    .map((entry, index) => ({
      id: String(index),
      name: entry.name,
      revenue: Number(entry.revenue.toFixed(2)),
      customers: entry.customers,
    }));

  const revenueSeries = new Map<string, number>();
  const expenseSeries = new Map<string, number>();

  flows.forEach((flow) => {
    const dueDate = normalizeDate(flow.vencimento ?? flow.pagamento);
    if (!dueDate) {
      return;
    }
    const key = getMonthKey(dueDate);
    if (flow.tipo === "receita") {
      revenueSeries.set(key, (revenueSeries.get(key) ?? 0) + flow.valor);
    } else if (flow.tipo === "despesa") {
      expenseSeries.set(key, (expenseSeries.get(key) ?? 0) + flow.valor);
    }
  });

  const months = collectMonthKeys([
    new Map(overview.monthlySeries.map((point) => [point.key, point])),
    revenueSeries,
    expenseSeries,
  ], MONTHS_WINDOW);

  const financialSeries = buildFinancialSeries(months, revenueSeries, expenseSeries);
  const totalRevenue = sum(financialSeries.map((point) => point.receita));
  const payingClients = revenueByPlan.reduce((acc, slice) => acc + slice.customers, 0);
  const averageTicket = payingClients > 0 ? totalRevenue / payingClients : 0;

  const lastRevenue = financialSeries.at(-1)?.receita ?? 0;
  const previousRevenue = financialSeries.at(-2)?.receita ?? 0;
  const revenueGrowth = computeGrowth(lastRevenue, previousRevenue);

  const cohort = buildCohortFromCounts(
    months,
    new Map(overview.monthlySeries.map((point) => [point.key, point.clientesNovos])),
    new Map(overview.monthlySeries.map((point) => [point.key, point.clientes])),
  );

  const funnel = buildFunnelStages([
    { stage: "Prospects", count: overview.clientMetrics.prospects },
    { stage: "Clientes", count: overview.clientMetrics.total },
    { stage: "Clientes ativos", count: overview.clientMetrics.active },
    { stage: "Empresas", count: empresas.length },
    {
      stage: "Empresas ativas",
      count: empresas.filter((empresa) => normalizeBoolean(empresa.ativo) !== false).length,
    },
  ]);

  return {
    overview,
    revenueByPlan,
    financialSeries,
    cohort,
    funnel,
    revenueSummary: {
      totalRevenue,
      payingClients,
      averageTicket,
      revenueGrowth,
    },
  };
}

export async function loadAdminDashboardAnalytics(signal?: AbortSignal): Promise<AdminDashboardAnalytics> {
  const [empresas, planos, flows] = await Promise.all([
    fetchCollection<ApiEmpresa>("empresas", signal).catch(() => []),
    fetchCollection<ApiPlano>("planos", signal).catch(() => []),
    fetchFlows().catch<Flow[]>(() => []),
  ]);

  const planIndex = new Map<string, ApiPlano>();
  planos.forEach((plan) => {
    const id = normalizeString(plan.id);
    if (id) {
      planIndex.set(id, plan);
    }
  });

  let activeSubscriptions = 0;
  let trialSubscriptions = 0;
  let inactiveSubscriptions = 0;
  let totalMRR = 0;

  const planDistributionMap = new Map<string, number>();
  const customersPerMonth = new Map<string, number>();
  const churnPerMonth = new Map<string, number>();
  const revenuePerMonth = new Map<string, number>();

  empresas.forEach((empresa) => {
    const evaluation = evaluateCompanySubscription(empresa);
    const planId = evaluation.planId ?? normalizeString(empresa.plano);
    const plan = planId ? planIndex.get(planId) : undefined;
    const planName = getPlanName(plan, planId);
    const monthlyValue = plan ? getPlanMonthlyValue(plan) : 0;
    const status = evaluation.status;

    if (status === "active") {
      activeSubscriptions += 1;
      totalMRR += monthlyValue;
    } else if (status === "trial") {
      trialSubscriptions += 1;
    } else {
      inactiveSubscriptions += 1;
    }

    if (planId) {
      planDistributionMap.set(planName, (planDistributionMap.get(planName) ?? 0) + 1);
    }

    const createdAt = normalizeDate(empresa.datacadastro);
    if (createdAt) {
      const key = getMonthKey(createdAt);
      customersPerMonth.set(key, (customersPerMonth.get(key) ?? 0) + 1);
      if (status === "inactive") {
        churnPerMonth.set(key, (churnPerMonth.get(key) ?? 0) + 1);
      }
      if (status === "active") {
        revenuePerMonth.set(key, (revenuePerMonth.get(key) ?? 0) + monthlyValue);
      }
    }
  });

  const months = collectMonthKeys([customersPerMonth, revenuePerMonth], MONTHS_WINDOW);
  let runningCustomers = 0;
  const cumulativeCustomers = new Map<string, number>();
  const churnRate = new Map<string, number>();

  months.forEach((key) => {
    const newCustomers = customersPerMonth.get(key) ?? 0;
    runningCustomers += newCustomers;
    cumulativeCustomers.set(key, runningCustomers);
    const churned = churnPerMonth.get(key) ?? 0;
    const rate = newCustomers > 0 ? Number(((churned / newCustomers) * 100).toFixed(1)) : 0;
    churnRate.set(key, rate);
  });

  const lastMrr = revenuePerMonth.get(months.at(-1) ?? "") ?? totalMRR;
  const previousMrr = revenuePerMonth.get(months.at(-2) ?? "") ?? lastMrr;
  const monthlyGrowth = computeGrowth(lastMrr, previousMrr);

  const totalCompanies = empresas.length;
  const conversionRate = totalCompanies > 0
    ? Number(((activeSubscriptions / totalCompanies) * 100).toFixed(1))
    : 0;

  return {
    metrics: {
      mrr: Number(totalMRR.toFixed(2)),
      arr: Number((totalMRR * 12).toFixed(2)),
      churnRate: Number(((inactiveSubscriptions / Math.max(totalCompanies, 1)) * 100).toFixed(1)),
      conversionRate,
      activeSubscriptions,
      trialSubscriptions,
      totalCompanies,
      monthlyGrowth,
    },
    monthlySeries: buildAdminMonthlySeries(months, revenuePerMonth, churnRate, cumulativeCustomers),
    planDistribution: buildDistribution(planDistributionMap),
  };
}

export async function loadAdminAnalyticsOverview(signal?: AbortSignal): Promise<AdminAnalyticsOverview> {
  const [dashboard, reports, flows] = await Promise.all([
    loadAdminDashboardAnalytics(signal),
    loadReportsAnalytics(signal),
    fetchFlows().catch<Flow[]>(() => []),
  ]);

  const revenueSeries = new Map<string, number>();
  const expenseSeries = new Map<string, number>();

  flows.forEach((flow) => {
    const dueDate = normalizeDate(flow.vencimento ?? flow.pagamento);
    if (!dueDate) {
      return;
    }
    const key = getMonthKey(dueDate);
    if (flow.tipo === "receita") {
      revenueSeries.set(key, (revenueSeries.get(key) ?? 0) + flow.valor);
    } else if (flow.tipo === "despesa") {
      expenseSeries.set(key, (expenseSeries.get(key) ?? 0) + flow.valor);
    }
  });

  const months = collectMonthKeys([revenueSeries, expenseSeries], MONTHS_WINDOW);
  const revenuePoints = buildFinancialSeries(months, revenueSeries, expenseSeries);
  const lastRevenue = revenuePoints.at(-1)?.receita ?? dashboard.metrics.mrr;
  const previousRevenue = revenuePoints.at(-2)?.receita ?? lastRevenue;
  const grossRetention = previousRevenue > 0 ? Number(((lastRevenue / previousRevenue) * 100).toFixed(1)) : 100;
  const netRetention = Number((grossRetention + Math.max(dashboard.metrics.monthlyGrowth, 0)).toFixed(1));
  const logoRetention = dashboard.metrics.totalCompanies > 0
    ? Number(((dashboard.metrics.totalCompanies - dashboard.metrics.trialSubscriptions) /
        dashboard.metrics.totalCompanies) * 100).toFixed(1)
    : 0;

  const currentArpu = dashboard.metrics.activeSubscriptions > 0
    ? Number((dashboard.metrics.mrr / dashboard.metrics.activeSubscriptions).toFixed(2))
    : 0;
  const previousArpu = previousRevenue > 0 && dashboard.metrics.activeSubscriptions > 0
    ? Number((previousRevenue / dashboard.metrics.activeSubscriptions).toFixed(2))
    : currentArpu;

  const revenueGrowthRate = computeGrowth(lastRevenue, previousRevenue);
  const revenueDelta = lastRevenue - previousRevenue;
  const expansionRevenue = revenueDelta > 0 ? Number(revenueDelta.toFixed(2)) : 0;
  const contractionRevenue = revenueDelta < 0 ? Number(Math.abs(revenueDelta).toFixed(2)) : 0;

  const marketingExpenses = expenseSeries.get(months.at(-1) ?? "") ?? 0;
  const newCustomers = dashboard.monthlySeries.at(-1)?.customers ?? dashboard.metrics.totalCompanies;
  const cac = newCustomers > 0 ? Number((marketingExpenses / newCustomers).toFixed(2)) : 0;
  const churnRate = dashboard.metrics.churnRate > 0 ? dashboard.metrics.churnRate / 100 : 0;
  const ltv = churnRate > 0 ? Number((currentArpu / churnRate).toFixed(2)) : currentArpu * 12;
  const paybackPeriodMonths = currentArpu > 0 ? Number((cac / currentArpu).toFixed(1)) : 0;
  const trialConversion = dashboard.metrics.totalCompanies > 0
    ? Number(((dashboard.metrics.totalCompanies - dashboard.metrics.trialSubscriptions) /
        dashboard.metrics.totalCompanies) * 100).toFixed(1)
    : 0;

  return {
    dashboard,
    revenueByPlan: reports.revenueByPlan,
    cohort: reports.cohort,
    funnel: reports.funnel,
    retention: {
      gross: grossRetention,
      net: netRetention,
      logo: Number(logoRetention),
    },
    revenueMetrics: {
      currentArpu,
      previousArpu,
      revenueGrowthRate,
      expansionRevenue,
      contractionRevenue,
    },
    customerMetrics: {
      cac,
      ltv,
      paybackPeriodMonths,
      trialConversion: Number(trialConversion),
    },
  };
}

export async function loadAdminLogs(signal?: AbortSignal): Promise<LogEvent[]> {
  const notifications = await fetchCollection<ApiNotification>("notifications", signal).catch(() => []);

  const events: LogEvent[] = notifications.map((notification, index) => {
    const id = normalizeString(notification.id) ?? `notification-${index}`;
    const type = normalizeString(notification.type)?.toLowerCase() ?? "info";
    const level = LEVEL_MAP[type] ?? "info";
    const message =
      normalizeString(notification.message) ??
      normalizeString(notification.title) ??
      "Evento sem mensagem";
    const timestamp = normalizeString(notification.createdAt) ?? new Date().toISOString();
    const category = normalizeString(notification.category) ?? "Sistema";

    const metadata = ((): Record<string, unknown> | undefined => {
      if (notification.metadata && typeof notification.metadata === "object") {
        return { ...(notification.metadata as Record<string, unknown>) };
      }
      return undefined;
    })();

    const request = (() => {
      if (!metadata) {
        return undefined;
      }

      const extractNumber = (key: string): number | undefined => {
        const value = metadata?.[key];
        const normalized = normalizeNumber(value);
        return normalized ?? undefined;
      };

      const method = normalizeString(metadata.httpMethod ?? metadata.method ?? metadata.requestMethod);
      const uri = normalizeString(metadata.httpPath ?? metadata.uri ?? metadata.path);
      const status = extractNumber("httpStatus") ?? extractNumber("status");
      const durationMs = extractNumber("durationMs") ?? extractNumber("duration");
      const clientIp = normalizeString(metadata.clientIp ?? metadata.ip ?? metadata.remoteAddress);
      const protocol = normalizeString(metadata.protocol);
      const host = normalizeString(metadata.host);
      const userAgent = normalizeString(metadata.userAgent ?? metadata.ua);

      if (!method && !uri && !status && !durationMs && !clientIp && !protocol && !host && !userAgent) {
        return undefined;
      }

      return {
        method: method ?? undefined,
        uri: uri ?? undefined,
        status: status ?? undefined,
        durationMs: durationMs ?? undefined,
        clientIp: clientIp ?? undefined,
        protocol: protocol ?? undefined,
        host: host ?? undefined,
        userAgent: userAgent ?? undefined,
      };
    })();

    return {
      id,
      level,
      timestamp,
      message,
      source: category,
      metadata,
      request,
    };
  });

  return events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}
