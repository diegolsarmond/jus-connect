import { useEffect, useMemo, useState, type ComponentProps } from "react";
import { Link } from "react-router-dom";
import { Plus, Search, CreditCard, TrendingUp, Calendar, AlertTriangle } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { routes } from "@/config/routes";
import { getApiUrl } from "@/lib/api";

type SubscriptionStatus = "active" | "trial" | "inactive";
type PlanRecurrence = "mensal" | "anual" | "nenhuma" | null;

interface ApiCompany {
  id: number;
  nome_empresa?: string | null;
  email?: string | null;
  plano?: number | string | null;
  ativo?: boolean | string | number | null;
  datacadastro?: string | Date | null;
  recorrencia?: string | null;
  plano_recorrencia?: string | null;
  plano_periodicidade?: string | null;
}

type ApiPlanLimits = {
  usuarios?: number | string | null;
  processos?: number | string | null;
  propostas?: number | string | null;
};

interface ApiPlan {
  id?: number;
  nome?: string | null;
  valor?: number | string | null;
  valor_mensal?: number | string | null;
  valorMensal?: number | string | null;
  valor_anual?: number | string | null;
  valorAnual?: number | string | null;
  preco_mensal?: number | string | null;
  precoMensal?: number | string | null;
  preco_anual?: number | string | null;
  precoAnual?: number | string | null;
  recorrencia?: string | null;
  limites?: ApiPlanLimits | null;
  limite_usuarios?: number | string | null;
  limite_processos?: number | string | null;
  limite_propostas?: number | string | null;
  qtde_usuarios?: number | string | null;
  max_casos?: number | string | null;
  max_propostas?: number | string | null;
}

type PlanLimits = {
  users: number | null;
  processes: number | null;
  proposals: number | null;
};

interface Subscription {
  id: string;
  companyId: number;
  companyName: string;
  companyEmail: string;
  planId: string | null;
  planName: string;
  planPrice: number | null;
  planMonthlyPrice: number | null;
  planAnnualPrice: number | null;
  planRecurrence: PlanRecurrence;
  planLimits: PlanLimits;
  status: SubscriptionStatus;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  nextCharge: string | null;
  trialEnd: string | null;
  mrr: number;
}

const STATUS_LABELS: Record<SubscriptionStatus, string> = {
  active: "Ativa",
  trial: "Trial",
  inactive: "Inativa",
};

const parseDataArray = <T,>(payload: unknown): T[] => {
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
};

const toIsoString = (value: unknown): string | null => {
  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return null;
};

const parseBoolean = (value: unknown): boolean | null => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    if (value === 1) {
      return true;
    }
    if (value === 0) {
      return false;
    }
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "t", "1", "yes", "y", "s", "sim"].includes(normalized)) {
      return true;
    }
    if (["false", "f", "0", "no", "n", "nao", "não"].includes(normalized)) {
      return false;
    }
  }

  return null;
};

const parseRecurrence = (value: unknown): PlanRecurrence => {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "mensal" || normalized === "anual" || normalized === "nenhuma") {
    return normalized;
  }

  return null;
};

const parseNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const sanitized = trimmed.replace(/[^\d.,-]+/g, "").replace(/\.(?=.*\.)/g, "");
    const normalized = sanitized.replace(",", ".");
    const parsed = Number(normalized);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
};

const parseInteger = (value: unknown): number | null => {
  const numeric = parseNumber(value);
  if (numeric == null) {
    return null;
  }

  return Math.trunc(numeric);
};

const addDuration = (start: string | null, recurrence: PlanRecurrence): string | null => {
  if (!start || !recurrence || recurrence === "nenhuma") {
    return null;
  }

  const startDate = new Date(start);
  if (Number.isNaN(startDate.getTime())) {
    return null;
  }

  const endDate = new Date(startDate);
  if (recurrence === "anual") {
    endDate.setFullYear(endDate.getFullYear() + 1);
  } else {
    endDate.setMonth(endDate.getMonth() + 1);
  }

  return endDate.toISOString();
};

const TRIAL_DURATION_DAYS = 14;

const calculateTrialEnd = (start: string | null): string | null => {
  if (!start) {
    return null;
  }

  const startDate = new Date(start);
  if (Number.isNaN(startDate.getTime())) {
    return null;
  }

  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + TRIAL_DURATION_DAYS);
  return endDate.toISOString();
};

const resolveStatus = (isActive: boolean | null, planId: string | null): SubscriptionStatus => {
  if (isActive === false) {
    return "inactive";
  }

  if (planId) {
    return "active";
  }

  return "trial";
};

const roundToTwo = (value: number): number => Math.round(value * 100) / 100;

const calculateMrr = (price: number | null, recurrence: PlanRecurrence): number => {
  if (typeof price !== "number" || Number.isNaN(price)) {
    return 0;
  }

  if (recurrence === "anual") {
    return roundToTwo(price / 12);
  }

  return roundToTwo(price);
};

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const formatDate = (value: string | null): string => {
  if (!value) {
    return "--";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "--";
  }

  return date.toLocaleDateString("pt-BR");
};

const formatPeriodRange = (start: string | null, end: string | null): string => {
  const startLabel = formatDate(start);
  const endLabel = formatDate(end);

  if (startLabel === "--" && endLabel === "--") {
    return "--";
  }

  if (endLabel === "--") {
    return startLabel;
  }

  if (startLabel === "--") {
    return endLabel;
  }

  return `${startLabel} - ${endLabel}`;
};

const RECURRENCE_LABELS: Record<Exclude<PlanRecurrence, null>, string> = {
  mensal: "Mensal",
  anual: "Anual",
  nenhuma: "Sem recorrência",
};

const formatLimitValue = (value: number | null): string => {
  if (value == null) {
    return "Ilimitado";
  }

  if (Number.isNaN(value)) {
    return "—";
  }

  return new Intl.NumberFormat("pt-BR").format(value);
};

const resolvePlanRecurrence = (
  company: ApiCompany,
  plan: ApiPlan | undefined,
  monthlyPrice: number | null,
  annualPrice: number | null,
): PlanRecurrence => {
  const recurrenceCandidates: unknown[] = [
    company.plano_recorrencia,
    company.recorrencia,
    company.plano_periodicidade,
    plan?.recorrencia,
  ];

  for (const candidate of recurrenceCandidates) {
    const parsed = parseRecurrence(candidate);
    if (parsed) {
      return parsed;
    }
  }

  if (annualPrice != null && monthlyPrice == null) {
    return "anual";
  }

  if (monthlyPrice != null) {
    return "mensal";
  }

  return null;
};

const extractPlanLimits = (plan: ApiPlan | undefined): PlanLimits => {
  const rawLimits = (plan?.limites && typeof plan.limites === "object") ? plan.limites : null;
  const limitsRecord = rawLimits as Record<string, unknown> | null;

  const users =
    parseInteger(limitsRecord?.usuarios) ??
    parseInteger(limitsRecord?.users) ??
    parseInteger(plan?.limite_usuarios) ??
    parseInteger(plan?.qtde_usuarios);

  const processes =
    parseInteger(limitsRecord?.processos) ??
    parseInteger(limitsRecord?.cases) ??
    parseInteger(limitsRecord?.casos) ??
    parseInteger(plan?.limite_processos) ??
    parseInteger(plan?.max_casos);

  const proposals =
    parseInteger(limitsRecord?.propostas) ??
    parseInteger(limitsRecord?.proposals) ??
    parseInteger(plan?.limite_propostas) ??
    parseInteger(plan?.max_propostas);

  return {
    users: users ?? null,
    processes: processes ?? null,
    proposals: proposals ?? null,
  };
};

const getPlanMonthlyPrice = (plan: ApiPlan | undefined): number | null =>
  parseNumber(plan?.valor_mensal ?? plan?.valorMensal ?? plan?.preco_mensal ?? plan?.precoMensal ?? plan?.valor ?? null);

const getPlanAnnualPrice = (plan: ApiPlan | undefined): number | null =>
  parseNumber(plan?.valor_anual ?? plan?.valorAnual ?? plan?.preco_anual ?? plan?.precoAnual ?? null);

const formatPlanPrice = (price: number | null, recurrence: PlanRecurrence): string => {
  if (typeof price !== "number" || Number.isNaN(price)) {
    return "Sem valor definido";
  }

  const suffix = recurrence === "anual" ? "/ano" : recurrence === "mensal" ? "/mês" : "";
  return `${formatCurrency(price)}${suffix}`;
};

const buildPlanPricingLines = (subscription: Subscription): string[] => {
  if (!subscription.planId) {
    return [];
  }

  const lines: string[] = [];

  if (subscription.planMonthlyPrice != null) {
    lines.push(`Mensal: ${formatCurrency(subscription.planMonthlyPrice)}`);
  }

  if (subscription.planAnnualPrice != null) {
    lines.push(`Anual: ${formatCurrency(subscription.planAnnualPrice)}`);
  }

  if (subscription.planRecurrence) {
    const label = RECURRENCE_LABELS[subscription.planRecurrence];
    if (label) {
      lines.push(
        subscription.planRecurrence === "nenhuma"
          ? `Recorrência: ${label}`
          : `Recorrência atual: ${label}`,
      );
    }
  }

  if (lines.length === 0 && subscription.planPrice != null) {
    lines.push(formatPlanPrice(subscription.planPrice, subscription.planRecurrence));
  }

  if (lines.length === 0) {
    lines.push("Sem valor definido");
  }

  return lines;
};

const formatTrialInfo = (trialEnd: string | null): string => {
  if (!trialEnd) {
    return "--";
  }

  const label = formatDate(trialEnd);
  return label === "--" ? "--" : `Trial até ${label}`;
};

const mapApiCompanyToSubscription = (company: ApiCompany, plansIndex: Map<string, ApiPlan>): Subscription => {
  const planId = company.plano != null ? String(company.plano) : null;
  const plan = planId ? plansIndex.get(planId) : undefined;

  const planName = plan?.nome?.trim() || (planId ? `Plano ${planId}` : "Sem plano");
  const planMonthlyPrice = getPlanMonthlyPrice(plan);
  const planAnnualPrice = getPlanAnnualPrice(plan);
  const recurrence = resolvePlanRecurrence(company, plan, planMonthlyPrice, planAnnualPrice);
  const effectivePrice =
    recurrence === "anual"
      ? planAnnualPrice ?? (planMonthlyPrice != null ? roundToTwo(planMonthlyPrice * 12) : null)
      : recurrence === "mensal"
        ? planMonthlyPrice ?? (planAnnualPrice != null ? roundToTwo(planAnnualPrice / 12) : null)
        : planMonthlyPrice ?? planAnnualPrice ?? parseNumber(plan?.valor ?? null);
  const currentPeriodStart = toIsoString(company.datacadastro);
  const currentPeriodEnd = addDuration(currentPeriodStart, recurrence);
  const isActive = parseBoolean(company.ativo ?? null);
  const status = resolveStatus(isActive, planId);
  const trialEnd = status === "trial" ? calculateTrialEnd(currentPeriodStart) : null;
  const nextCharge = status === "trial"
    ? trialEnd
    : recurrence && recurrence !== "nenhuma"
      ? currentPeriodEnd
      : null;
  const planLimits = extractPlanLimits(plan);

  return {
    id: `subscription-${company.id}`,
    companyId: company.id,
    companyName: company.nome_empresa?.trim() || `Empresa #${company.id}`,
    companyEmail: company.email?.trim() || "",
    planId,
    planName,
    planPrice: effectivePrice ?? null,
    planMonthlyPrice,
    planAnnualPrice,
    planRecurrence: recurrence,
    planLimits,
    status,
    currentPeriodStart,
    currentPeriodEnd,
    nextCharge,
    trialEnd,
    mrr: calculateMrr(effectivePrice ?? null, recurrence),
  };
};

const getStatusBadge = (status: SubscriptionStatus) => {
  const variants: Record<SubscriptionStatus, ComponentProps<typeof Badge>["variant"]> = {
    active: "default",
    trial: "secondary",
    inactive: "destructive",
  };

  return (
    <Badge variant={variants[status]}>
      {STATUS_LABELS[status]}
    </Badge>
  );
};

export default function Subscriptions() {
  const [searchTerm, setSearchTerm] = useState("");
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let isMounted = true;

    const loadSubscriptions = async () => {
      setIsLoading(true);
      try {
        const companiesResponse = await fetch(getApiUrl("empresas"), {
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });

        if (!companiesResponse.ok) {
          throw new Error(`Falha ao carregar empresas: ${companiesResponse.status}`);
        }

        const companiesPayload = await companiesResponse.json();
        const apiCompanies = parseDataArray<ApiCompany>(companiesPayload);

        const plansIndex = new Map<string, ApiPlan>();
        try {
          const plansResponse = await fetch(getApiUrl("planos"), {
            headers: { Accept: "application/json" },
            signal: controller.signal,
          });

          if (plansResponse.ok) {
            const plansPayload = await plansResponse.json();
            const apiPlans = parseDataArray<ApiPlan>(plansPayload);
            apiPlans.forEach((plan) => {
              if (plan?.id != null) {
                plansIndex.set(String(plan.id), plan);
              }
            });
          } else {
            console.warn("Falha ao carregar planos:", plansResponse.status);
          }
        } catch (planError) {
          if (planError instanceof DOMException && planError.name === "AbortError") {
            return;
          }
          console.warn("Erro ao carregar planos:", planError);
        }

        if (!isMounted) {
          return;
        }

        setSubscriptions(apiCompanies.map((company) => mapApiCompanyToSubscription(company, plansIndex)));
        setError(null);
      } catch (fetchError) {
        if (!isMounted) {
          return;
        }

        if (fetchError instanceof DOMException && fetchError.name === "AbortError") {
          return;
        }

        console.error("Erro ao carregar assinaturas:", fetchError);
        setSubscriptions([]);
        setError("Não foi possível carregar as assinaturas.");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadSubscriptions();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, []);

  const filteredSubscriptions = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) {
      return subscriptions;
    }

    return subscriptions.filter((subscription) => {
      const values = [
        subscription.companyName,
        subscription.companyEmail,
        subscription.planName,
        STATUS_LABELS[subscription.status],
      ];

      return values.some((value) => value && value.toLowerCase().includes(query));
    });
  }, [subscriptions, searchTerm]);

  const metrics = useMemo(() => {
    return subscriptions.reduce(
      (acc, subscription) => {
        acc.totalMRR += subscription.mrr;

        if (subscription.status === "active") {
          acc.activeSubscriptions += 1;
        }

        if (subscription.status === "trial") {
          acc.trialSubscriptions += 1;
        }

        return acc;
      },
      { totalMRR: 0, activeSubscriptions: 0, trialSubscriptions: 0 },
    );
  }, [subscriptions]);

  const { totalMRR, activeSubscriptions, trialSubscriptions } = metrics;
  const arpu = activeSubscriptions > 0 ? totalMRR / activeSubscriptions : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Assinaturas</h1>
          <p className="text-muted-foreground">Gerencie todas as assinaturas ativas e trials</p>
        </div>
        <Button asChild>
          <Link to={routes.admin.newSubscription}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Assinatura
          </Link>
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">MRR Total</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalMRR)}</div>
            <p className="text-xs text-muted-foreground">Receita mensal recorrente</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Assinaturas Ativas</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeSubscriptions}</div>
            <p className="text-xs text-muted-foreground">Cobranças ativas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Em Trial</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{trialSubscriptions}</div>
            <p className="text-xs text-muted-foreground">Potenciais conversões</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">ARPU</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(arpu)}</div>
            <p className="text-xs text-muted-foreground">Receita média por usuário</p>
          </CardContent>
        </Card>
      </div>

      {/* Subscriptions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Assinaturas</CardTitle>
          <CardDescription>Visualize e gerencie todas as assinaturas</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar assinaturas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead className="hidden xl:table-cell">Limites do Plano</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>MRR</TableHead>
                  <TableHead>Período Atual</TableHead>
                  <TableHead>Próxima Cobrança</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-6 text-center text-sm text-muted-foreground">
                      Carregando assinaturas...
                    </TableCell>
                  </TableRow>
                ) : error ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-6 text-center text-sm text-muted-foreground">
                      {error}
                    </TableCell>
                  </TableRow>
                ) : filteredSubscriptions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-6 text-center text-sm text-muted-foreground">
                      Nenhuma assinatura encontrada.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSubscriptions.map((subscription) => (
                    <TableRow key={subscription.id}>
                      <TableCell>
                        <div className="font-medium">{subscription.companyName}</div>
                        <div className="text-sm text-muted-foreground">
                          {subscription.companyEmail || "Sem e-mail"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{subscription.planName}</div>
                        {subscription.planId ? (
                          <div className="mt-1 space-y-1 text-xs text-muted-foreground">
                            {buildPlanPricingLines(subscription).map((line, index) => (
                              <div key={`${subscription.id}-pricing-${index}`}>{line}</div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-sm text-muted-foreground">Sem plano</div>
                        )}
                      </TableCell>
                      <TableCell className="hidden xl:table-cell align-top">
                        {subscription.planId ? (
                          <div className="space-y-1 text-xs text-muted-foreground">
                            <div>
                              <span className="font-medium text-foreground">Usuários:</span> {formatLimitValue(subscription.planLimits.users)}
                            </div>
                            <div>
                              <span className="font-medium text-foreground">Processos:</span> {formatLimitValue(subscription.planLimits.processes)}
                            </div>
                            <div>
                              <span className="font-medium text-foreground">Propostas:</span> {formatLimitValue(subscription.planLimits.proposals)}
                            </div>
                          </div>
                        ) : (
                          <div className="text-sm text-muted-foreground">--</div>
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(subscription.status)}</TableCell>
                      <TableCell>
                        <div className="font-medium">{formatCurrency(subscription.mrr)}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{formatPeriodRange(subscription.currentPeriodStart, subscription.currentPeriodEnd)}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {subscription.status === "trial"
                            ? formatTrialInfo(subscription.trialEnd)
                            : formatDate(subscription.nextCharge)}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          <Button variant="ghost" size="sm" disabled>
                            Ver Detalhes
                          </Button>
                          <Button variant="outline" size="sm" disabled>
                            Gerenciar
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Ações Rápidas</CardTitle>
            <CardDescription>Operações frequentes em assinaturas</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button asChild className="w-full justify-start" variant="outline">
              <Link to={routes.admin.newSubscription}>
                <Plus className="h-4 w-4 mr-2" />
                Criar Nova Assinatura
              </Link>
            </Button>
            <Button className="w-full justify-start" variant="outline">
              <CreditCard className="h-4 w-4 mr-2" />
              Processar Cobranças Pendentes
            </Button>
            <Button className="w-full justify-start" variant="outline">
              <AlertTriangle className="h-4 w-4 mr-2" />
              Revisar Trials Expirando
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Métricas de Conversão</CardTitle>
            <CardDescription>Performance de trials e upgrades</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm">Taxa de Conversão Trial</span>
              <span className="font-medium">78.5%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Upgrade Rate</span>
              <span className="font-medium">23.1%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Downgrade Rate</span>
              <span className="font-medium">4.2%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Churn Rate</span>
              <span className="font-medium text-destructive">5.2%</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}