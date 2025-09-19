import { useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getApiUrl } from "@/lib/api";
import { routes } from "@/config/routes";
import { Plus, Check, Package, Users, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";

type BillingCadence = "monthly" | "annual" | "none" | "custom";

type Plan = {
  id: number;
  name: string;
  description: string;
  price: number | null;
  priceLabel: string;
  billingCycle: BillingCadence;
  maxUsers: number | null;
  maxCases: number | null;
  features: string[];
  isActive: boolean;
  createdAt: Date | null;
};

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
});

const billingCycleDescriptions: Record<BillingCadence, { short: string; description: string }> = {
  monthly: { short: "mês", description: "Cobrança mensal" },
  annual: { short: "ano", description: "Cobrança anual" },
  none: { short: "período", description: "Cobrança única" },
  custom: { short: "ciclo", description: "Ciclo personalizado" },
};

function normalizeApiRows(data: unknown): unknown[] {
  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray((data as { rows?: unknown[] })?.rows)) {
    return (data as { rows: unknown[] }).rows;
  }

  const nestedData = (data as { data?: unknown })?.data;
  if (Array.isArray(nestedData)) {
    return nestedData;
  }

  if (Array.isArray((nestedData as { rows?: unknown[] })?.rows)) {
    return (nestedData as { rows: unknown[] }).rows;
  }

  return [];
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const sanitized = trimmed.replace(/[^\d,.-]/g, "").replace(/\.(?=.*\.)/g, "");
    const normalized = sanitized.replace(",", ".");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }

  return null;
}

function parseLimit(value: unknown): number | null {
  const numeric = toNumber(value);
  if (numeric === null || !Number.isFinite(numeric)) {
    return null;
  }

  return Math.trunc(numeric);
}

function parseBillingCadence(value: unknown): BillingCadence {
  if (typeof value !== "string") {
    return "custom";
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return "custom";
  }

  if (["mensal", "monthly", "mes", "mês"].includes(normalized)) {
    return "monthly";
  }

  if (["anual", "annual", "ano", "yearly"].includes(normalized)) {
    return "annual";
  }

  if (
    [
      "nenhuma",
      "none",
      "sem recorrencia",
      "sem recorrência",
      "unico",
      "único",
      "once",
    ].includes(normalized)
  ) {
    return "none";
  }

  return "custom";
}

function parseRecursosValue(value: unknown): { features: string[]; maxCases: number | null } {
  const features: string[] = [];
  let maxCases: number | null = null;

  const addFeature = (entry: unknown) => {
    if (entry === null || entry === undefined) {
      return;
    }

    let text: string | null = null;

    if (typeof entry === "string") {
      text = entry.replace(/^[•\-*\u2022]+\s*/, "").trim();
    } else if (typeof entry === "number" || typeof entry === "boolean") {
      text = String(entry);
    }

    if (text) {
      features.push(text);
    }
  };

  const visit = (input: unknown): void => {
    if (input === null || input === undefined) {
      return;
    }

    if (typeof input === "string") {
      const trimmed = input.trim();
      if (!trimmed) {
        return;
      }

      try {
        const parsed = JSON.parse(trimmed);
        visit(parsed);
        return;
      } catch {
        // fallback to split string into individual features
      }

      trimmed
        .split(/[\n;,]+/)
        .map((item) => item.trim())
        .filter(Boolean)
        .forEach((item) => addFeature(item));

      return;
    }

    if (typeof input === "number" || typeof input === "boolean") {
      addFeature(input);
      return;
    }

    if (Array.isArray(input)) {
      input.forEach((item) => visit(item));
      return;
    }

    if (typeof input === "object") {
      const obj = input as Record<string, unknown>;

      const featureCandidates: unknown[] = [];
      for (const key of [
        "features",
        "recursos",
        "items",
        "itens",
        "lista",
        "listaRecursos",
        "lista_recursos",
        "values",
        "value",
        "feature",
        "recurso",
      ]) {
        if (key in obj) {
          featureCandidates.push(obj[key]);
        }
      }

      featureCandidates.forEach((candidate) => visit(candidate));

      for (const key of [
        "maxCases",
        "max_casos",
        "maxProcessos",
        "max_processos",
        "limiteCasos",
        "limite_casos",
        "limiteProcessos",
        "limite_processos",
        "maximoCasos",
        "maximo_casos",
      ]) {
        if (key in obj) {
          const parsed = parseLimit(obj[key]);
          if (parsed !== null) {
            maxCases = parsed;
            break;
          }
        }
      }
    }
  };

  visit(value);

  return {
    features: Array.from(new Set(features)),
    maxCases,
  };
}

function formatLimit(value: number | null, singular: string, plural: string): string {
  if (value === null) {
    return "Sob consulta";
  }

  if (value === -1) {
    return `${plural} ilimitados`;
  }

  if (value < 0) {
    return "Sob consulta";
  }

  if (value === 0) {
    return `Sem ${plural}`;
  }

  if (value === 1) {
    return `Até 1 ${singular}`;
  }

  return `Até ${value} ${plural}`;
}

function hasPrioritarySupport(features: string[]): boolean {
  return features.some((feature) => {
    const normalized = feature.toLowerCase();
    return normalized.includes("prioritário") || normalized.includes("prioritario") || normalized.includes("24/7");
  });
}

function hasApiAccess(features: string[]): boolean {
  return features.some((feature) => feature.toLowerCase().includes("api"));
}

function parsePlan(row: unknown): Plan | null {
  if (!row || typeof row !== "object") {
    return null;
  }

  const raw = row as Record<string, unknown>;

  const id = toNumber(raw.id ?? raw.ID ?? raw.plano_id ?? raw.plan_id);
  if (id === null) {
    return null;
  }

  let name = `Plano ${id}`;
  if (typeof raw.nome === "string" && raw.nome.trim()) {
    name = raw.nome.trim();
  } else if (typeof raw.name === "string" && raw.name.trim()) {
    name = raw.name.trim();
  }

  let description = "";
  if (typeof raw.descricao === "string" && raw.descricao.trim()) {
    description = raw.descricao.trim();
  } else if (typeof raw.description === "string" && raw.description.trim()) {
    description = raw.description.trim();
  }

  const billingCycle = parseBillingCadence(
    raw.recorrencia ?? raw.billingCycle ?? raw.ciclo ?? raw.ciclo_cobranca
  );

  const priceValue = toNumber(
    raw.valor ?? raw.price ?? raw.valor_mensal ?? raw.preco ?? raw.preco_mensal
  );

  let priceLabel: string;
  if (priceValue !== null) {
    priceLabel = currencyFormatter.format(priceValue);
  } else if (typeof raw.valor === "string" && raw.valor.trim()) {
    priceLabel = raw.valor.trim();
  } else if (typeof raw.price === "string" && raw.price.trim()) {
    priceLabel = raw.price.trim();
  } else {
    priceLabel = "Sob consulta";
  }

  const maxUsers = parseLimit(
    raw.qtde_usuarios ??
      raw.maxUsers ??
      raw.qtdeUsuarios ??
      raw.limiteUsuarios ??
      raw.limite_usuarios ??
      raw.max_usuarios
  );

  const recursosCandidates =
    raw.recursos ?? raw.features ?? raw.recursos_detalhes ?? raw.detalhes_recursos ?? raw.resources;
  const parsedRecursos = parseRecursosValue(recursosCandidates);

  const explicitMaxCases = parseLimit(
    raw.max_casos ??
      raw.maxCases ??
      raw.max_processos ??
      raw.maxProcessos ??
      raw.limiteCasos ??
      raw.limite_casos ??
      raw.limiteProcessos ??
      raw.limite_processos ??
      raw.maximoCasos ??
      raw.maximo_casos
  );

  const maxCases = explicitMaxCases ?? parsedRecursos.maxCases ?? null;

  const ativoRaw = raw.ativo ?? raw.isActive ?? raw.status;
  let isActive = true;
  if (typeof ativoRaw === "boolean") {
    isActive = ativoRaw;
  } else if (typeof ativoRaw === "number") {
    isActive = ativoRaw !== 0;
  } else if (typeof ativoRaw === "string") {
    const normalized = ativoRaw.trim().toLowerCase();
    if (["false", "0", "inativo", "inactive", "desativado"].includes(normalized)) {
      isActive = false;
    } else if (["true", "1", "ativo", "active"].includes(normalized)) {
      isActive = true;
    }
  }

  let createdAt: Date | null = null;
  if (typeof raw.datacadastro === "string" && raw.datacadastro.trim()) {
    const parsedDate = new Date(raw.datacadastro);
    if (!Number.isNaN(parsedDate.getTime())) {
      createdAt = parsedDate;
    }
  } else if (raw.datacadastro instanceof Date && !Number.isNaN(raw.datacadastro.getTime())) {
    createdAt = raw.datacadastro;
  }

  return {
    id,
    name,
    description,
    price: priceValue,
    priceLabel,
    billingCycle,
    maxUsers,
    maxCases,
    features: parsedRecursos.features,
    isActive,
    createdAt,
  };
}

export default function Plans() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    const controller = new AbortController();

    const fetchPlans = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(getApiUrl("planos"), {
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });

        if (!response.ok) {
          const message = await response.text();
          throw new Error(
            `Falha ao carregar planos (HTTP ${response.status})${message ? `: ${message}` : ""}`
          );
        }

        const data = await response.json();
        const rows = normalizeApiRows(data);
        const parsed = rows
          .map((row) => parsePlan(row))
          .filter((plan): plan is Plan => plan !== null);

        if (!disposed) {
          setPlans(parsed);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }

        console.error(err);
        if (!disposed) {
          setError(err instanceof Error ? err.message : "Não foi possível carregar os planos.");
          setPlans([]);
        }
      } finally {
        if (!disposed) {
          setLoading(false);
        }
      }
    };

    fetchPlans();

    return () => {
      disposed = true;
      controller.abort();
    };
  }, []);

  const stats = useMemo(() => {
    if (plans.length === 0) {
      return {
        totalPlans: 0,
        activeCount: 0,
        hasPrice: false,
        totalRevenue: 0,
        totalRevenueLabel: "—",
        mostPopularPlan: null as Plan | null,
        popularPlanId: null as number | null,
      };
    }

    const totalPlans = plans.length;
    const activeCount = plans.filter((plan) => plan.isActive).length;
    const totalRevenue = plans.reduce((sum, plan) => sum + (plan.price ?? 0), 0);
    const hasPrice = plans.some((plan) => plan.price !== null);
    const totalRevenueLabel = hasPrice ? currencyFormatter.format(totalRevenue) : "—";

    const rankedSource = (() => {
      const withPrice = plans.filter((plan) => plan.isActive && plan.price !== null);
      if (withPrice.length > 0) {
        return withPrice;
      }

      const active = plans.filter((plan) => plan.isActive);
      return active.length > 0 ? active : plans;
    })();

    const [mostPopularPlan] = rankedSource
      .slice()
      .sort(
        (a, b) => (b.price ?? Number.NEGATIVE_INFINITY) - (a.price ?? Number.NEGATIVE_INFINITY)
      );

    return {
      totalPlans,
      activeCount,
      hasPrice,
      totalRevenue,
      totalRevenueLabel,
      mostPopularPlan: mostPopularPlan ?? null,
      popularPlanId: mostPopularPlan?.id ?? null,
    };
  }, [plans]);

  const showEmptyState = !loading && plans.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Planos</h1>
          <p className="text-muted-foreground">Gerencie os planos de assinatura do seu CRM</p>
        </div>
        <Button onClick={() => navigate(routes.admin.newPlan)}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Plano
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Planos Ativos</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeCount}</div>
            <p className="text-xs text-muted-foreground">
              De {stats.totalPlans} planos cadastrados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita Total</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.hasPrice ? stats.totalRevenueLabel : "—"}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.hasPrice
                ? "Potencial mensal cadastrado"
                : "Defina valores para estimar a receita"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Plano em Destaque</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.mostPopularPlan?.name ?? "—"}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.mostPopularPlan
                ? "Selecionado entre os planos ativos"
                : "Cadastre um plano para iniciar"}
            </p>
          </CardContent>
        </Card>
      </div>

      {error && (
        <div
          className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
          role="alert"
        >
          Não foi possível carregar os planos: {error}
        </div>
      )}

      {loading ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Carregando planos...
          </CardContent>
        </Card>
      ) : showEmptyState ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhum plano cadastrado até o momento.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => {
            const billingInfo = billingCycleDescriptions[plan.billingCycle];
            const userLimit = formatLimit(plan.maxUsers, "usuário", "usuários");
            const caseLimit = formatLimit(plan.maxCases, "caso", "casos");

            return (
              <Card key={plan.id} className="relative">
                {stats.popularPlanId === plan.id && (
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 transform">
                    <Badge className="bg-primary text-primary-foreground">Mais Popular</Badge>
                  </div>
                )}

                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xl">{plan.name}</CardTitle>
                    {plan.isActive ? (
                      <Badge variant="default">Ativo</Badge>
                    ) : (
                      <Badge variant="secondary">Inativo</Badge>
                    )}
                  </div>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold">{plan.priceLabel}</div>
                    <div className="text-sm text-muted-foreground">
                      {plan.billingCycle === "none"
                        ? "valor único"
                        : `por ${billingInfo.short}`}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-sm font-medium">Limites:</div>
                    <div className="text-sm text-muted-foreground">• {userLimit}</div>
                    <div className="text-sm text-muted-foreground">• {caseLimit}</div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-sm font-medium">Recursos inclusos:</div>
                    {plan.features.length > 0 ? (
                      <div className="space-y-1">
                        {plan.features.map((feature, index) => (
                          <div
                            key={`${plan.id}-feature-${index}`}
                            className="flex items-center gap-2 text-sm text-muted-foreground"
                          >
                            <Check className="h-3 w-3 text-green-500" />
                            {feature}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Nenhum recurso cadastrado.
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2 pt-4">
                    <Button variant="outline" size="sm" className="flex-1">
                      Editar
                    </Button>
                    <Button
                      variant={plan.isActive ? "destructive" : "default"}
                      size="sm"
                      className="flex-1"
                    >
                      {plan.isActive ? "Desativar" : "Ativar"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Comparação de Planos</CardTitle>
          <CardDescription>Visualize as diferenças entre os planos disponíveis</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">
              Carregando dados de comparação...
            </p>
          ) : plans.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Cadastre um plano para visualizar a comparação.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="py-2 text-left">Recurso</th>
                    {plans.map((plan) => (
                      <th key={`comparison-${plan.id}`} className="min-w-[140px] py-2 text-center">
                        {plan.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="py-2 font-medium">Preço</td>
                    {plans.map((plan) => (
                      <td key={`price-${plan.id}`} className="py-2 text-center">
                        {plan.priceLabel}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 font-medium">Ciclo de cobrança</td>
                    {plans.map((plan) => {
                      const billingInfo = billingCycleDescriptions[plan.billingCycle];
                      return (
                        <td key={`cycle-${plan.id}`} className="py-2 text-center">
                          {billingInfo.description}
                        </td>
                      );
                    })}
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 font-medium">Usuários</td>
                    {plans.map((plan) => (
                      <td key={`users-${plan.id}`} className="py-2 text-center">
                        {plan.maxUsers === null
                          ? "—"
                          : plan.maxUsers === -1
                            ? "Ilimitado"
                            : plan.maxUsers}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 font-medium">Casos</td>
                    {plans.map((plan) => (
                      <td key={`cases-${plan.id}`} className="py-2 text-center">
                        {plan.maxCases === null
                          ? "—"
                          : plan.maxCases === -1
                            ? "Ilimitado"
                            : plan.maxCases}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 font-medium">Suporte prioritário</td>
                    {plans.map((plan) => (
                      <td key={`support-${plan.id}`} className="py-2 text-center">
                        {hasPrioritarySupport(plan.features) ? (
                          <Check className="mx-auto h-4 w-4 text-green-500" />
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-2 font-medium">Acesso à API</td>
                    {plans.map((plan) => (
                      <td key={`api-${plan.id}`} className="py-2 text-center">
                        {hasApiAccess(plan.features) ? (
                          <Check className="mx-auto h-4 w-4 text-green-500" />
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
