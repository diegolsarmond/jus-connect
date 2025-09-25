import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { routes } from "@/config/routes";
import { useAuth } from "@/features/auth/AuthProvider";
import { PlanSelection } from "@/features/plans/PlanSelection";
import { evaluateSubscriptionAccess } from "@/features/auth/subscriptionStatus";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Crown,
  Loader2,
  Sparkles,
} from "lucide-react";

import { getApiBaseUrl, joinUrl } from "@/lib/api";

type PricingMode = "mensal" | "anual";

type PlanoDetalhe = {
  id: number;
  nome: string;
  ativo: boolean;
  descricao: string | null;
  recursos: string[];
  dataCadastro: Date | null;
  valorMensal: number | null;
  valorAnual: number | null;
  limiteUsuarios: number | null;
  limiteProcessos: number | null;
  limitePropostas: number | null;
  precoMensal: string | null;
  precoAnual: string | null;
  descontoAnualPercentual: number | null;
  economiaAnual: number | null;
  economiaAnualFormatada: string | null;
};

type UsageMetrics = {
  usuariosAtivos: number | null;
  clientesAtivos: number | null;
  processosAtivos: number | null;
  propostasEmitidas: number | null;
};

type UsageItem = {
  label: string;
  current: number | null;
  limit?: number | null;
};

type PricingDisplay = {
  mainPrice: string;
  cadenceLabel: string;
  helper?: string | null;
  savingsLabel?: string | null;
  discountBadge?: string | null;
};

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
});
const countFormatter = new Intl.NumberFormat("pt-BR");

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

export default function MeuPlano() {
  const { user } = useAuth();
  const { hasAccess } = evaluateSubscriptionAccess(user?.subscription ?? null);

  if (!hasAccess) {
    return <PlanSelection />;
  }

  return <MeuPlanoContent />;
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
    const result = Number(normalized);
    return Number.isFinite(result) ? result : null;
  }

  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }

  return null;
}

function parseRecursos(value: unknown): string[] {
  const seen = new Set<string>();
  const seenObjects = new Set<object>();
  const result: string[] = [];

  const add = (entry: string) => {
    const normalized = entry.trim();
    if (!normalized || seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    result.push(normalized);
  };

  const handleString = (input: string) => {
    input
      .split(/[\n;,]+/)
      .map((item) => item.trim())
      .filter(Boolean)
      .forEach(add);
  };

  const visit = (input: unknown): void => {
    if (input == null) {
      return;
    }

    if (typeof input === "string") {
      handleString(input);
      return;
    }

    if (typeof input === "number" || typeof input === "boolean") {
      add(String(input));
      return;
    }

    if (Array.isArray(input)) {
      input.forEach(visit);
      return;
    }

    if (typeof input === "object") {
      if (seenObjects.has(input as object)) {
        return;
      }

      seenObjects.add(input as object);

      const record = input as Record<string, unknown>;
      const candidateKeys = [
        "disponiveis",
        "disponiveisPersonalizados",
        "available",
        "availableFeatures",
        "inclusos",
        "incluidos",
        "lista",
        "items",
        "features",
        "recursosDisponiveis",
        "recursos_disponiveis",
        "recursos",
        "modulos",
        "modules",
        "rows",
        "data",
        "values",
        "value",
      ];

      const excludedPattern = /(indispon|unavailable|exclu|negad)/i;
      let matchedCandidate = false;

      for (const key of candidateKeys) {
        if (key in record) {
          matchedCandidate = true;
          visit(record[key]);
        }
      }

      if (!matchedCandidate) {
        for (const [key, entry] of Object.entries(record)) {
          if (excludedPattern.test(key)) {
            continue;
          }

          if (/^\d+$/.test(key)) {
            visit(entry);
          }
        }
      }
    }
  };

  visit(value);

  return result;
}

function parseDate(value: unknown): Date | null {
  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  return null;
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function computePricingDetails(valorMensal: number | null, valorAnual: number | null) {
  const precoMensal = valorMensal !== null ? currencyFormatter.format(valorMensal) : null;
  const precoAnual = valorAnual !== null ? currencyFormatter.format(valorAnual) : null;

  if (valorMensal === null || valorAnual === null) {
    return {
      precoMensal,
      precoAnual,
      descontoPercentual: null,
      economiaAnual: null,
      economiaAnualFormatada: null,
    } as const;
  }

  const totalMensal = valorMensal * 12;
  const economiaBruta = roundCurrency(Math.max(0, totalMensal - valorAnual));
  const descontoPercentual =
    totalMensal > 0 && economiaBruta > 0 ? Math.round((economiaBruta / totalMensal) * 100) : null;

  return {
    precoMensal,
    precoAnual,
    descontoPercentual,
    economiaAnual: economiaBruta > 0 ? economiaBruta : null,
    economiaAnualFormatada: economiaBruta > 0 ? currencyFormatter.format(economiaBruta) : null,
  } as const;
}

function hasMensalPricing(plan: PlanoDetalhe | null): boolean {
  if (!plan) {
    return false;
  }

  return Boolean(
    (typeof plan.valorMensal === "number" && Number.isFinite(plan.valorMensal)) ||
      (typeof plan.precoMensal === "string" && plan.precoMensal.trim()),
  );
}

function hasAnualPricing(plan: PlanoDetalhe | null): boolean {
  if (!plan) {
    return false;
  }

  return Boolean(
    (typeof plan.valorAnual === "number" && Number.isFinite(plan.valorAnual)) ||
      (typeof plan.precoAnual === "string" && plan.precoAnual.trim()),
  );
}

function getDefaultPricingMode(plan: PlanoDetalhe | null): PricingMode {
  if (hasMensalPricing(plan)) {
    return "mensal";
  }

  if (hasAnualPricing(plan)) {
    return "anual";
  }

  return "mensal";
}

function formatAvailableModes(plan: PlanoDetalhe | null): string | null {
  if (!plan) {
    return null;
  }

  const modes: string[] = [];
  if (hasMensalPricing(plan)) {
    modes.push("Mensal");
  }
  if (hasAnualPricing(plan)) {
    modes.push("Anual");
  }

  if (modes.length === 0) {
    return null;
  }

  return modes.length === 2 ? `${modes[0]} ou ${modes[1]}` : modes[0];
}

function formatLimitValue(value: number | null, singular: string, plural: string): string {
  if (value === null || !Number.isFinite(value) || value <= 0) {
    return "Ilimitado";
  }

  const formatted = countFormatter.format(value);
  return `${formatted} ${value === 1 ? singular : plural}`;
}

function buildPricingDisplay(plan: PlanoDetalhe | null, mode: PricingMode): PricingDisplay {
  const fallback = "Sob consulta";

  if (!plan) {
    return {
      mainPrice: fallback,
      cadenceLabel: mode === "anual" ? "por ano" : "por mês",
      helper: null,
      savingsLabel: null,
      discountBadge: null,
    };
  }

  if (mode === "anual") {
    const mainPrice = plan.precoAnual ?? plan.precoMensal ?? fallback;
    const helper =
      plan.valorAnual !== null && plan.valorMensal !== null
        ? `Equivalente a ${currencyFormatter.format(plan.valorAnual / 12)}/mês`
        : plan.precoMensal
          ? `Modalidade mensal: ${plan.precoMensal}`
          : null;

    const savingsLabel = plan.economiaAnualFormatada
      ? `Economize ${plan.economiaAnualFormatada} em relação à contratação mensal`
      : null;

    const discountBadge =
      plan.descontoAnualPercentual !== null ? `-${plan.descontoAnualPercentual}%` : null;

    return {
      mainPrice,
      cadenceLabel: "por ano",
      helper,
      savingsLabel,
      discountBadge,
    };
  }

  const derivedMensal =
    plan.precoMensal ??
    (plan.valorAnual !== null ? currencyFormatter.format(plan.valorAnual / 12) : null) ??
    null;
  const mainPrice = derivedMensal ?? fallback;
  const helper = plan.precoAnual
    ? `Plano anual: ${plan.precoAnual}${
        plan.descontoAnualPercentual !== null ? ` (${plan.descontoAnualPercentual}% de economia)` : ""
      }`
    : plan.valorMensal !== null
      ? `Cobrança mensal em ${currencyFormatter.format(plan.valorMensal)}`
      : "Consulte condições comerciais";

  const savingsLabel =
    plan.precoAnual && plan.economiaAnualFormatada
      ? `Economize ${plan.economiaAnualFormatada} escolhendo a modalidade anual`
      : null;

  const discountBadge =
    plan.precoAnual && plan.descontoAnualPercentual !== null
      ? `-${plan.descontoAnualPercentual}%`
      : null;

  return {
    mainPrice,
    cadenceLabel: "por mês",
    helper,
    savingsLabel,
    discountBadge,
  };
}

function estimateNextBilling(plan: PlanoDetalhe | null): { nextBilling: string | null; cadenceLabel: string } {
  if (!plan) {
    return { nextBilling: null, cadenceLabel: "Sob consulta" };
  }

  const hasMensal = plan.valorMensal !== null;
  const hasAnual = plan.valorAnual !== null;

  const cadenceLabel = hasMensal && hasAnual
    ? "Mensal ou anual"
    : hasMensal
      ? "Mensal"
      : hasAnual
        ? "Anual"
        : "Sob consulta";

  if (!plan.dataCadastro || Number.isNaN(plan.dataCadastro.getTime())) {
    return { nextBilling: null, cadenceLabel };
  }

  const baseDate = plan.dataCadastro;
  const now = new Date();
  const next = new Date(baseDate.getTime());

  const incrementMonths = hasMensal && !hasAnual ? 1 : !hasMensal && hasAnual ? 12 : null;
  if (!incrementMonths) {
    return { nextBilling: null, cadenceLabel };
  }

  let iterations = 0;
  const maxIterations = 1000;

  if (next <= now) {
    while (next <= now && iterations < maxIterations) {
      next.setMonth(next.getMonth() + incrementMonths);
      iterations += 1;
    }
  }

  if (iterations >= maxIterations) {
    return { nextBilling: null, cadenceLabel };
  }

  return { nextBilling: next.toLocaleDateString("pt-BR"), cadenceLabel };
}

function formatDate(value: Date | null): string | null {
  if (!value) {
    return null;
  }

  return value.toLocaleDateString("pt-BR");
}

type ApiEmpresa = { plano?: unknown; plano_id?: unknown };

function findPlanFromEmpresa(planos: PlanoDetalhe[], empresasRows: unknown[]): PlanoDetalhe | null {
  if (planos.length === 0) {
    return null;
  }

  const identifiers = empresasRows
    .map((row) => row as ApiEmpresa)
    .flatMap((empresa) => {
      const results: { id: number | null; name: string | null }[] = [];
      const idFromPlano = toNumber(empresa.plano);
      if (idFromPlano !== null) {
        results.push({ id: idFromPlano, name: null });
      } else if (typeof empresa.plano === "string" && empresa.plano.trim()) {
        results.push({ id: null, name: empresa.plano.trim() });
      }

      const idFromPlanoId = toNumber(empresa.plano_id);
      if (idFromPlanoId !== null) {
        results.push({ id: idFromPlanoId, name: null });
      }

      return results;
    });

  for (const identifier of identifiers) {
    if (identifier.id !== null) {
      const match = planos.find((plano) => plano.id === identifier.id);
      if (match) {
        return match;
      }
    }

    if (identifier.name) {
      const normalized = identifier.name.toLowerCase();
      const match = planos.find((plano) => plano.nome.toLowerCase() === normalized);
      if (match) {
        return match;
      }
    }
  }

  return null;
}

function MeuPlanoContent() {
  const apiBaseUrl = getApiBaseUrl();
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const subscriptionPlanId = toNumber(user?.subscription?.planId ?? null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [planoAtual, setPlanoAtual] = useState<PlanoDetalhe | null>(null);
  const [previewPlano, setPreviewPlano] = useState<PlanoDetalhe | null>(null);
  const [planosDisponiveis, setPlanosDisponiveis] = useState<PlanoDetalhe[]>([]);
  const [pricingMode, setPricingMode] = useState<PricingMode>("mensal");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [metrics, setMetrics] = useState<UsageMetrics>({
    usuariosAtivos: null,
    clientesAtivos: null,
    processosAtivos: null,
    propostasEmitidas: null,
  });

  useEffect(() => {
    let disposed = false;

    async function fetchData() {
      setLoading(true);
      setError(null);

      const planosUrl = joinUrl(apiBaseUrl, "/api/planos");
      const empresasUrl = joinUrl(apiBaseUrl, "/api/empresas");
      const usuariosUrl = joinUrl(apiBaseUrl, "/api/usuarios/empresa");
      const clientesUrl = joinUrl(apiBaseUrl, "/api/clientes/ativos/total");

      try {
        const [planosJson, empresasJson, usuariosJson, clientesJson] = await Promise.all([
          fetch(planosUrl, { headers: { Accept: "application/json" } }).then((res) => {
            if (!res.ok) {
              throw new Error(`Falha ao carregar planos (HTTP ${res.status})`);
            }
            return res.json();
          }),
          fetch(empresasUrl, { headers: { Accept: "application/json" } })
            .then((res) => {
              if (!res.ok) {
                throw new Error(`Falha ao carregar empresas (HTTP ${res.status})`);
              }
              return res.json();
            })
            .catch((err) => {
              console.warn(err);
              return null;
            }),
          fetch(usuariosUrl, { headers: { Accept: "application/json" } })
            .then((res) => {
              if (!res.ok) {
                throw new Error(`Falha ao carregar usuários (HTTP ${res.status})`);
              }
              return res.json();
            })
            .catch((err) => {
              console.warn(err);
              return null;
            }),
          fetch(clientesUrl, { headers: { Accept: "application/json" } })
            .then((res) => {
              if (!res.ok) {
                throw new Error(`Falha ao carregar clientes (HTTP ${res.status})`);
              }
              return res.json();
            })
            .catch((err) => {
              console.warn(err);
              return null;
            }),
        ]);

        const planosRows = normalizeApiRows(planosJson);
        const parsedPlanos = planosRows
          .map((row) => {
            const raw = row as Record<string, unknown>;
            const idNumber = toNumber(raw.id);
            if (idNumber === null) {
              return null;
            }

            const nome = typeof raw.nome === "string" ? raw.nome.trim() : String(raw.nome ?? `Plano ${idNumber}`);
            const ativo = typeof raw.ativo === "boolean" ? raw.ativo : true;
            const descricaoRaw =
              typeof raw.descricao === "string"
                ? raw.descricao.trim()
                : typeof raw.detalhes === "string"
                  ? raw.detalhes.trim()
                  : null;
            const recursos = parseRecursos([
              raw.recursos,
              raw.recursosDisponiveis,
              raw.recursos_disponiveis,
              raw.features,
              raw.items,
              raw.lista,
              raw.modules,
              raw.modulos,
              raw.recursos_personalizados,
              raw.recursosPersonalizados,
              raw.customResources,
              raw.personalizados,
            ]);
            const dataCadastro = parseDate((raw.datacadastro ?? raw.data_cadastro) as unknown);

            const rawValorMensal = (raw.valor_mensal ?? raw.valorMensal ?? raw.preco_mensal ?? raw.precoMensal) as unknown;
            const rawValorAnual = (raw.valor_anual ?? raw.valorAnual ?? raw.preco_anual ?? raw.precoAnual) as unknown;

            const valorMensal = toNumber(rawValorMensal);
            const valorAnual = toNumber(rawValorAnual);

            const pricingDetails = computePricingDetails(valorMensal, valorAnual);
            const precoMensal =
              pricingDetails.precoMensal ??
              (typeof rawValorMensal === "string" && rawValorMensal.trim() ? rawValorMensal.trim() : null);
            const precoAnual =
              pricingDetails.precoAnual ??
              (typeof rawValorAnual === "string" && rawValorAnual.trim() ? rawValorAnual.trim() : null);

            const limiteUsuarios = toNumber(raw.limite_usuarios ?? raw.limiteUsuarios);
            const limiteProcessos = toNumber(raw.limite_processos ?? raw.limiteProcessos);
            const limitePropostas = toNumber(raw.limite_propostas ?? raw.limitePropostas);

            return {
              id: idNumber,
              nome,
              ativo,
              descricao: descricaoRaw && descricaoRaw.length > 0 ? descricaoRaw : null,
              recursos,
              dataCadastro,
              valorMensal,
              valorAnual,
              limiteUsuarios: limiteUsuarios ?? null,
              limiteProcessos: limiteProcessos ?? null,
              limitePropostas: limitePropostas ?? null,
              precoMensal,
              precoAnual,
              descontoAnualPercentual: pricingDetails.descontoPercentual,
              economiaAnual: pricingDetails.economiaAnual,
              economiaAnualFormatada: pricingDetails.economiaAnualFormatada,
            } satisfies PlanoDetalhe;
          })
          .filter((item): item is PlanoDetalhe => item !== null);

        if (parsedPlanos.length === 0) {
          throw new Error("Nenhum plano cadastrado.");
        }

        const empresasRows = empresasJson ? normalizeApiRows(empresasJson) : [];
        const planoSelecionado =
          (subscriptionPlanId !== null
            ? parsedPlanos.find((item) => item.id === subscriptionPlanId) ?? null
            : null) ??
          findPlanFromEmpresa(parsedPlanos, empresasRows) ??
          parsedPlanos.find((item) => item.ativo) ??
          parsedPlanos[0];

        const usuariosCount = usuariosJson ? normalizeApiRows(usuariosJson).length : null;

        let clientesAtivos: number | null = null;
        if (clientesJson && typeof clientesJson === "object" && clientesJson !== null) {
          const maybeDirect = (clientesJson as { total_clientes_ativos?: unknown }).total_clientes_ativos;
          const maybeNested = (clientesJson as { data?: { total_clientes_ativos?: unknown } }).data?.total_clientes_ativos;
          const maybeTotal = (clientesJson as { total?: unknown }).total;
          clientesAtivos = toNumber(maybeDirect) ?? toNumber(maybeNested) ?? toNumber(maybeTotal);
        }

        if (!disposed) {
          setPlanosDisponiveis(parsedPlanos);
          setPlanoAtual(planoSelecionado);
          setPreviewPlano(null);
          setPricingMode(getDefaultPricingMode(planoSelecionado));
          setMetrics({
            usuariosAtivos: usuariosCount,
            clientesAtivos,
            processosAtivos: null,
            propostasEmitidas: null,
          });
        }
      } catch (err) {
        console.error(err);
        if (!disposed) {
          setError(err instanceof Error ? err.message : "Não foi possível carregar os dados do plano.");
          setPlanosDisponiveis([]);
          setPlanoAtual(null);
          setPreviewPlano(null);
          setMetrics({ usuariosAtivos: null, clientesAtivos: null, processosAtivos: null, propostasEmitidas: null });
        }
      } finally {
        if (!disposed) {
          setLoading(false);
        }
      }
    }

    fetchData();

    return () => {
      disposed = true;
    };
  }, [apiBaseUrl, subscriptionPlanId]);

  const planoExibido = previewPlano ?? planoAtual;

  useEffect(() => {
    if (!planoExibido) {
      return;
    }

    if (pricingMode === "anual" && !hasAnualPricing(planoExibido)) {
      setPricingMode(hasMensalPricing(planoExibido) ? "mensal" : "anual");
      return;
    }

    if (pricingMode === "mensal" && !hasMensalPricing(planoExibido)) {
      setPricingMode(hasAnualPricing(planoExibido) ? "anual" : "mensal");
    }
  }, [pricingMode, planoExibido]);

  const pricingDisplay = useMemo(() => buildPricingDisplay(planoExibido, pricingMode), [planoExibido, pricingMode]);

  const cobrancaInfo = useMemo(() => estimateNextBilling(planoAtual), [planoAtual]);

  const availableModesLabel = useMemo(() => formatAvailableModes(planoExibido), [planoExibido]);

  const usageItems = useMemo<UsageItem[]>(() => {
    if (!planoExibido) {
      return [];
    }

    const items: UsageItem[] = [];
    if (planoExibido.limiteUsuarios !== null || metrics.usuariosAtivos !== null) {
      items.push({
        label: "Usuários ativos",
        current: metrics.usuariosAtivos,
        limit: planoExibido.limiteUsuarios,
      });
    }
    if (planoExibido.limiteProcessos !== null || metrics.processosAtivos !== null) {
      items.push({
        label: "Processos cadastrados",
        current: metrics.processosAtivos,
        limit: planoExibido.limiteProcessos,
      });
    }
    if (planoExibido.limitePropostas !== null || metrics.propostasEmitidas !== null) {
      items.push({
        label: "Propostas enviadas",
        current: metrics.propostasEmitidas,
        limit: planoExibido.limitePropostas,
      });
    }
    if (metrics.clientesAtivos !== null) {
      items.push({
        label: "Clientes ativos",
        current: metrics.clientesAtivos,
      });
    }

    return items;
  }, [
    metrics.clientesAtivos,
    metrics.processosAtivos,
    metrics.propostasEmitidas,
    metrics.usuariosAtivos,
    planoExibido,
  ]);

  const beneficios = planoExibido?.recursos ?? [];

  const destaquePlanoId = useMemo(() => {
    if (planosDisponiveis.length === 0) {
      return null;
    }

    const sorted = [...planosDisponiveis]
      .map((item) => {
        const monthlyEquivalent =
          item.valorMensal !== null
            ? item.valorMensal
            : item.valorAnual !== null
              ? item.valorAnual / 12
              : null;
        return { item, monthlyEquivalent };
      })
      .filter((entry) => entry.monthlyEquivalent !== null)
      .sort((a, b) => (b.monthlyEquivalent ?? 0) - (a.monthlyEquivalent ?? 0));

    return sorted[0]?.item.id ?? null;
  }, [planosDisponiveis]);

  const anyMensalPlan = useMemo(() => planosDisponiveis.some((plan) => hasMensalPricing(plan)), [planosDisponiveis]);
  const anyAnualPlan = useMemo(() => planosDisponiveis.some((plan) => hasAnualPricing(plan)), [planosDisponiveis]);

  const planosOrdenados = useMemo(() => {
    if (planosDisponiveis.length === 0) {
      return [];
    }

    const collator = new Intl.Collator("pt-BR", { sensitivity: "base" });

    const getComparablePrice = (plan: PlanoDetalhe): number | null => {
      const hasMensalPrice = typeof plan.valorMensal === "number" && Number.isFinite(plan.valorMensal);
      const hasAnualPrice = typeof plan.valorAnual === "number" && Number.isFinite(plan.valorAnual);

      if (pricingMode === "anual") {
        if (hasAnualPrice) {
          return plan.valorAnual as number;
        }
        if (hasMensalPrice) {
          return (plan.valorMensal as number) * 12;
        }
        return null;
      }

      if (hasMensalPrice) {
        return plan.valorMensal as number;
      }
      if (hasAnualPrice) {
        return (plan.valorAnual as number) / 12;
      }
      return null;
    };

    return [...planosDisponiveis].sort((a, b) => {
      const priceA = getComparablePrice(a);
      const priceB = getComparablePrice(b);

      if (priceA === null && priceB === null) {
        return collator.compare(a.nome, b.nome);
      }
      if (priceA === null) {
        return 1;
      }
      if (priceB === null) {
        return -1;
      }
      if (priceA !== priceB) {
        return priceA - priceB;
      }
      return collator.compare(a.nome, b.nome);
    });
  }, [planosDisponiveis, pricingMode]);

  const handlePlanSelection = useCallback(
    (plan: PlanoDetalhe) => {
      setPreviewPlano(plan);
      setDialogOpen(false);
      setPricingMode((current) => {
        if (current === "anual" && !hasAnualPricing(plan)) {
          return hasMensalPricing(plan) ? "mensal" : "anual";
        }
        if (current === "mensal" && !hasMensalPricing(plan)) {
          return hasAnualPricing(plan) ? "anual" : "mensal";
        }
        return current;
      });
      toast({
        title: `Plano ${plan.nome} selecionado`,
        description: "Revise as opções de pagamento para confirmar a alteração do seu plano.",
      });
      navigate(routes.meuPlanoPayment, {
        state: {
          plan: {
            id: plan.id,
            nome: plan.nome,
            descricao: plan.descricao,
            recursos: plan.recursos,
            valorMensal: plan.valorMensal,
            valorAnual: plan.valorAnual,
            precoMensal: plan.precoMensal,
            precoAnual: plan.precoAnual,
            descontoAnualPercentual: plan.descontoAnualPercentual,
            economiaAnual: plan.economiaAnual,
            economiaAnualFormatada: plan.economiaAnualFormatada,
          },
          pricingMode,
        },
      });
    },
    [navigate, pricingMode, toast],
  );

  const resetPreview = useCallback(() => {
    setPreviewPlano(null);
    if (planoAtual) {
      setPricingMode(getDefaultPricingMode(planoAtual));
    }
    toast({
      title: "Plano atual restabelecido",
      description: "Você voltou a visualizar o plano contratado atualmente.",
    });
  }, [planoAtual, toast]);

  const hasAnnualPricing = hasAnualPricing(planoExibido);
  const hasMensalPricingAvailable = hasMensalPricing(planoExibido);

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Meu Plano</h1>
        <p className="text-muted-foreground">
          Acompanhe as informações do plano contratado e compare facilmente com outras opções disponíveis.
        </p>
      </div>

      {loading ? (
        <Card className="border-dashed">
          <CardContent className="flex items-center gap-3 py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Carregando informações do plano…</span>
          </CardContent>
        </Card>
      ) : error ? (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Não foi possível carregar o plano</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : !planoAtual ? (
        <Alert>
          <AlertTitle>Nenhum plano encontrado</AlertTitle>
          <AlertDescription>
            Cadastre um plano em <strong>Configurações &gt; Planos</strong> para visualizar os detalhes aqui.
          </AlertDescription>
        </Alert>
      ) : (
        <>
          {previewPlano && (
            <Alert>
              <Sparkles className="h-4 w-4 text-primary" />
              <AlertTitle>Pré-visualizando o plano {previewPlano.nome}</AlertTitle>
              <AlertDescription>
                Os limites e valores abaixo refletem uma simulação. O plano atual permanece <strong>{planoAtual.nome}</strong>.
                Para contratar definitivamente, acesse <strong>Configurações &gt; Planos</strong>.
              </AlertDescription>
            </Alert>
          )}

          <Card className="relative overflow-hidden border-none bg-gradient-to-br from-primary/5 via-background to-background shadow-xl">
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
              <div className="absolute -bottom-24 -left-10 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
            </div>
            <CardContent className="relative z-10 space-y-8 p-4 sm:p-6 md:p-10">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
                      {previewPlano ? "Pré-visualização" : "Plano atual"}
                    </Badge>
                    <Badge variant={planoExibido?.ativo ? "secondary" : "outline"}>
                      {planoExibido?.ativo ? "Disponível" : "Indisponível"}
                    </Badge>
                    {availableModesLabel && <Badge variant="outline">{availableModesLabel}</Badge>}
                  </div>
                  <div className="flex items-center gap-3 text-3xl font-semibold tracking-tight md:text-4xl">
                    <Sparkles className="h-7 w-7 text-primary" />
                    <span>{planoExibido?.nome}</span>
                  </div>
                  <p className="max-w-xl text-sm text-muted-foreground">
                    {planoExibido?.descricao ||
                      "Uma combinação equilibrada de recursos para manter a operação do seu time em alta performance."}
                  </p>
                </div>

                <div className="flex flex-col items-start gap-4 lg:items-end">
                  <ToggleGroup
                    type="single"
                    value={pricingMode}
                    onValueChange={(value) => value && setPricingMode(value as PricingMode)}
                    variant="outline"
                    className="rounded-full border border-primary/30 bg-background/60 p-1"
                  >
                    <ToggleGroupItem
                      value="mensal"
                      className="rounded-full px-4 py-2 text-sm"
                      disabled={!hasMensalPricingAvailable}
                    >
                      Mensal
                    </ToggleGroupItem>
                    <ToggleGroupItem value="anual" className="rounded-full px-4 py-2 text-sm" disabled={!hasAnnualPricing}>
                      Anual
                    </ToggleGroupItem>
                  </ToggleGroup>
                  <div className="flex flex-col items-start gap-2 lg:items-end">
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-bold md:text-5xl">{pricingDisplay.mainPrice}</span>
                      <span className="text-sm font-medium text-muted-foreground">{pricingDisplay.cadenceLabel}</span>
                    </div>
                    {pricingDisplay.discountBadge && (
                      <Badge variant="secondary" className="rounded-full bg-primary/15 text-primary">
                        {pricingDisplay.discountBadge} na modalidade anual
                      </Badge>
                    )}
                    {pricingDisplay.savingsLabel && (
                      <p className="text-xs font-medium text-primary/80">{pricingDisplay.savingsLabel}</p>
                    )}
                    {pricingDisplay.helper && (
                      <p className="text-xs text-muted-foreground">{pricingDisplay.helper}</p>
                    )}
                  </div>
                </div>
              </div>

              <Separator className="border-primary/20" />

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
                <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-primary">Plano contratado</p>
                  <p className="text-sm font-semibold text-foreground">{planoAtual.nome}</p>
                  {previewPlano && (
                    <p className="text-xs text-muted-foreground">Visualizando {planoExibido?.nome}</p>
                  )}
                </div>
                <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Informações de cobrança</p>
                  <p className="text-sm font-semibold text-foreground">{cobrancaInfo.cadenceLabel}</p>
                  <p className="text-xs text-muted-foreground">
                    {cobrancaInfo.nextBilling
                      ? `Próxima cobrança estimada em ${cobrancaInfo.nextBilling}`
                      : "Consulte o time financeiro para confirmar a próxima cobrança."}
                  </p>
                </div>
                <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Usuários incluídos</p>
                  <p className="text-sm font-semibold text-foreground">
                    {formatLimitValue(planoExibido?.limiteUsuarios ?? null, "usuário", "usuários")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {previewPlano ? "Limite estimado para o plano em pré-visualização" : "Limite do plano atual"}
                  </p>
                </div>
                <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Processos incluídos</p>
                  <p className="text-sm font-semibold text-foreground">
                    {formatLimitValue(planoExibido?.limiteProcessos ?? null, "processo", "processos")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {previewPlano ? "Estimativa para o plano selecionado" : "Limite do plano atual"}
                  </p>
                </div>
                <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Propostas incluídas</p>
                  <p className="text-sm font-semibold text-foreground">
                    {formatLimitValue(planoExibido?.limitePropostas ?? null, "proposta", "propostas")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {previewPlano ? "Estimativa para o plano selecionado" : "Limite do plano atual"}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="lg" className="rounded-full shadow-lg shadow-primary/20">
                      Alterar plano
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-5xl lg:max-w-6xl xl:max-w-7xl">
                    <DialogHeader>
                      <DialogTitle>Escolha um novo plano</DialogTitle>
                      <DialogDescription>
                        Compare os planos disponíveis e avance para a etapa de pagamento da opção que melhor atende às necessidades do seu time.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-6">
                      <ToggleGroup
                        type="single"
                        value={pricingMode}
                        onValueChange={(value) => value && setPricingMode(value as PricingMode)}
                        variant="outline"
                        className="mx-auto w-fit rounded-full border border-primary/20 bg-background p-1"
                      >
                        <ToggleGroupItem
                          value="mensal"
                          className="rounded-full px-4 py-2 text-sm"
                          disabled={!anyMensalPlan}
                        >
                          Mensal
                        </ToggleGroupItem>
                        <ToggleGroupItem
                          value="anual"
                          className="rounded-full px-4 py-2 text-sm"
                          disabled={!anyAnualPlan}
                        >
                          Anual
                        </ToggleGroupItem>
                      </ToggleGroup>
                      <Carousel className="relative">
                        <CarouselContent>
                          {planosOrdenados.map((plano) => {
                            const carouselPricing = buildPricingDisplay(plano, pricingMode);
                            const isAtual = planoAtual.id === plano.id;
                            const isPreviewing = previewPlano?.id === plano.id;
                            const isSelecionado = previewPlano ? isPreviewing : isAtual;
                            const isDestaque = destaquePlanoId === plano.id;

                            return (
                              <CarouselItem
                                key={plano.id}
                                className="md:basis-1/2 lg:basis-1/3 xl:basis-1/4"
                              >

                                <Card
                                  className={cn(
                                    "relative flex h-full flex-col overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100 shadow-[0_24px_45px_-35px_rgba(15,23,42,0.9)] transition-transform duration-300 hover:-translate-y-1 hover:shadow-[0_35px_65px_-35px_rgba(15,23,42,0.55)]",
                                    isSelecionado
                                      ? "border-primary/60 shadow-[0_0_40px_rgba(59,130,246,0.35)]"
                                      : undefined,
                                    isAtual && !isSelecionado ? "border-emerald-400/60" : undefined,
                                  )}
                                >
                                  <div className="pointer-events-none absolute -top-24 right-0 h-48 w-48 rounded-full bg-primary/15 blur-3xl" />
                                  <div className="pointer-events-none absolute -bottom-32 left-0 h-56 w-56 rounded-full bg-sky-500/10 blur-3xl" />

                                  <CardHeader className="space-y-4 pb-0 text-left">

                                    <div className="flex flex-wrap items-center gap-2">
                                      {isAtual && (
                                        <Badge className="flex items-center gap-2 border border-emerald-400/60 bg-emerald-500/20 text-emerald-100">
                                          <Sparkles className="h-3.5 w-3.5" /> Plano atual
                                        </Badge>
                                      )}
                                      {isPreviewing && (
                                        <Badge className="border border-primary/50 bg-primary/20 text-primary-foreground">
                                          Pré-visualizando
                                        </Badge>
                                      )}
                                      {isDestaque && (
                                        <Badge className="flex items-center gap-2 border border-amber-400/60 bg-amber-500/20 text-amber-100">
                                          <Crown className="h-3.5 w-3.5" /> Mais completo
                                        </Badge>
                                      )}
                                    </div>

                                    <div className="space-y-4">
                                      <div className="space-y-2">
                                        <span className="text-xs uppercase tracking-[0.3em] text-slate-300">
                                          Plano
                                        </span>
                                        <CardTitle className="text-2xl font-semibold text-white">
                                          {plano.nome}
                                        </CardTitle>
                                      </div>

                                      <div className="space-y-2">
                                        <span className="text-xs uppercase tracking-[0.3em] text-slate-300">
                                          Investimento
                                        </span>
                                        <div className="flex items-baseline gap-1.5">
                                          <span className="text-3xl font-bold text-white">
                                            {carouselPricing.mainPrice}
                                          </span>
                                          <span className="text-sm font-medium text-slate-300">
                                            {carouselPricing.cadenceLabel}
                                          </span>
                                        </div>
                                        {carouselPricing.discountBadge && (
                                          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-sky-400/60 bg-sky-500/20 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-sky-100">
                                            {carouselPricing.discountBadge} na modalidade anual
                                          </span>
                                        )}
                                        {carouselPricing.savingsLabel && (
                                          <p className="text-xs font-medium text-sky-200">
                                            {carouselPricing.savingsLabel}
                                          </p>
                                        )}
                                        {carouselPricing.helper && (
                                          <p className="text-[11px] text-slate-300">{carouselPricing.helper}</p>
                                        )}
                                      </div>

                                      {plano.descricao && (
                                        <CardDescription className="text-sm text-slate-200/90">
                                          {plano.descricao}
                                        </CardDescription>
                                      )}
                                    </div>
                                  </CardHeader>

                                  <CardContent className="flex flex-1 flex-col gap-4">
                                    <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-slate-200">
                                      <span className="font-semibold text-sky-200">
                                        Inclui recursos essenciais para sua equipe
                                      </span>
                                    </div>
                                    <div className="space-y-3">
                                      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-300">
                                        Principais benefícios
                                      </p>
                                      <ul className="space-y-2 text-xs text-slate-100">
                                        {plano.recursos.length > 0 ? (
                                          plano.recursos.slice(0, 6).map((recurso) => (
                                            <li key={recurso} className="flex items-start gap-3 text-left">
                                              <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-sky-300" />
                                              <span>{recurso}</span>
                                            </li>
                                          ))
                                        ) : (
                                          <li className="text-xs text-slate-300">
                                            Atualize o cadastro do plano para listar os benefícios.
                                          </li>
                                        )}
                                      </ul>
                                    </div>
                                  </CardContent>

                                  <CardFooter className="mt-auto flex flex-col gap-2 p-4 pt-0">
                                    <Button
                                      className={cn(
                                        "w-full font-semibold",
                                        isSelecionado
                                          ? "bg-white text-slate-950 hover:bg-white/90"
                                          : "bg-primary text-primary-foreground hover:bg-primary/90",
                                      )}
                                      onClick={() => handlePlanSelection(plano)}
                                      disabled={isAtual && !previewPlano}
                                    >
                                      Escolher este plano
                                    </Button>
                                  </CardFooter>
                                </Card>
                              </CarouselItem>
                            );
                          })}
                        </CarouselContent>
                        <CarouselPrevious className="hidden md:flex" />
                        <CarouselNext className="hidden md:flex" />
                      </Carousel>
                    </div>
                  </DialogContent>
                </Dialog>
                {previewPlano && (
                  <Button size="lg" variant="outline" className="rounded-full" onClick={resetPreview}>
                    Voltar ao plano atual
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <Card className="rounded-3xl border border-border/60">
              <CardHeader>
                <CardTitle>Utilização dos recursos</CardTitle>
                <CardDescription>
                  {previewPlano
                    ? "Confira como os seus dados atuais se encaixam nos limites do plano pré-visualizado."
                    : "Acompanhe o consumo dos principais limites do plano."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {usageItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Ainda não há métricas disponíveis para este plano.
                  </p>
                ) : (
                  usageItems.map((item) => {
                    const limit = item.limit ?? null;
                    const hasLimit = limit !== null && Number.isFinite(limit) && limit > 0;
                    const hasCurrent = typeof item.current === "number" && Number.isFinite(item.current);
                    const progress = hasLimit && hasCurrent ? Math.min(100, Math.round((item.current / limit) * 100)) : 0;
                    const limitFormatted = hasLimit ? countFormatter.format(limit) : null;
                    const currentFormatted = hasCurrent ? countFormatter.format(item.current ?? 0) : "—";
                    return (
                      <div key={item.label} className="space-y-2 rounded-2xl border border-border/60 p-4">
                        <div className="flex items-center justify-between text-sm font-medium">
                          <span>{item.label}</span>
                          <span className="text-foreground">
                            {hasLimit
                              ? `${hasCurrent ? currentFormatted : "—"}/${limitFormatted}`
                              : hasCurrent
                                ? currentFormatted
                                : "—"}
                          </span>
                        </div>
                        {hasLimit ? (
                          hasCurrent ? (
                            <Progress value={progress} aria-label={`Consumo de ${item.label}`} />
                          ) : (
                            <p className="text-xs text-muted-foreground">
                              Dados indisponíveis para este recurso no momento.
                            </p>
                          )
                        ) : (
                          <p className="text-xs text-muted-foreground">Sem limite definido para este recurso.</p>
                        )}
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>

            <Card className="rounded-3xl border border-border/60">
              <CardHeader>
                <CardTitle>Benefícios inclusos</CardTitle>
                <CardDescription>
                  {previewPlano
                    ? "Principais recursos contemplados no plano selecionado."
                    : "Recursos disponíveis no plano contratado."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {beneficios.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Este plano não possui benefícios listados. Atualize os dados do plano para exibir aqui.
                  </p>
                ) : (
                  <ul className="grid gap-3 sm:grid-cols-2">
                    {beneficios.map((beneficio) => (
                      <li
                        key={beneficio}
                        className="flex items-start gap-2 rounded-2xl border border-border/60 bg-background/80 p-3 text-sm"
                      >
                        <Check className="mt-0.5 h-4 w-4 text-primary" />
                        <span>{beneficio}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
