import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
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
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Crown,
  Loader2,
  Sparkles,
} from "lucide-react";

import { getApiBaseUrl, joinUrl } from "@/lib/api";

type Recorrencia = "mensal" | "anual" | "nenhuma";
type PricingMode = "mensal" | "anual";

type PlanoDetalhe = {
  id: number;
  nome: string;
  ativo: boolean;
  descricao: string;
  recorrencia: Recorrencia | null;
  qtdeUsuarios: number | null;
  recursos: string[];
  dataCadastro: Date | null;
  valorMensal: number | null;
  valorAnual: number | null;
  precoMensal: string;
  precoAnual: string | null;
  descontoAnualPercentual: number | null;
  economiaAnual: number | null;
  economiaAnualFormatada: string | null;
};

type UsageMetrics = {
  usuariosAtivos: number | null;
  clientesAtivos: number | null;
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

const recorrenciaLabels: Record<Recorrencia, string> = {
  mensal: "Mensal",
  anual: "Anual",
  nenhuma: "Sem recorrência",
};

const ANNUAL_DISCOUNT_PERCENTAGE = 17;

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
    const result = Number(normalized);
    return Number.isFinite(result) ? result : null;
  }

  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }

  return null;
}

function parseRecursos(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(/[\n;,]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function parseRecorrencia(value: unknown): Recorrencia | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "mensal" || normalized === "anual" || normalized === "nenhuma") {
    return normalized;
  }

  return null;
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

function formatCurrencyValue(value: unknown): string {
  const numeric = toNumber(value);
  if (numeric !== null) {
    return currencyFormatter.format(numeric);
  }

  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  return "Sob consulta";
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function computeAnnualPricing(valorMensal: number | null) {
  if (valorMensal === null) {
    return {
      valorAnual: null,
      precoAnual: null,
      economiaAnual: null,
      economiaAnualFormatada: null,
      descontoPercentual: null,
    } as const;
  }

  const bruto = valorMensal * 12;
  const desconto = bruto * (ANNUAL_DISCOUNT_PERCENTAGE / 100);
  const valorAnual = roundCurrency(bruto - desconto);
  const economiaAnual = roundCurrency(desconto);

  return {
    valorAnual,
    precoAnual: currencyFormatter.format(valorAnual),
    economiaAnual,
    economiaAnualFormatada: economiaAnual > 0 ? currencyFormatter.format(economiaAnual) : null,
    descontoPercentual: ANNUAL_DISCOUNT_PERCENTAGE,
  } as const;
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
          ? `Plano mensal: ${plan.precoMensal}`
          : null;

    const savingsLabel = plan.economiaAnualFormatada
      ? `Economize ${plan.economiaAnualFormatada} em relação à cobrança mensal`
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

  const mainPrice = plan.precoMensal ?? fallback;
  const helper = plan.precoAnual
    ? `Ou ${plan.precoAnual}/ano${
        plan.descontoAnualPercentual !== null ? ` (${plan.descontoAnualPercentual}% off)` : ""
      }`
    : plan.recorrencia && plan.recorrencia !== "nenhuma"
      ? `Cobrança ${recorrenciaLabels[plan.recorrencia].toLowerCase()}`
      : "Cobrança sob demanda";

  const savingsLabel =
    plan.precoAnual && plan.economiaAnualFormatada
      ? `Economize ${plan.economiaAnualFormatada} escolhendo o plano anual`
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

function calculateNextBilling(recorrencia: Recorrencia | null, dataCadastro: Date | null): string | null {
  if (!recorrencia || recorrencia === "nenhuma") {
    return null;
  }

  const incrementMonths = recorrencia === "mensal" ? 1 : 12;
  const base = dataCadastro ?? new Date();
  if (Number.isNaN(base.getTime())) {
    return null;
  }

  const now = new Date();
  const next = new Date(base.getTime());
  let iterations = 0;
  const maxIterations = 1000;

  if (next <= now) {
    while (next <= now && iterations < maxIterations) {
      next.setMonth(next.getMonth() + incrementMonths);
      iterations += 1;
    }
  }

  if (iterations >= maxIterations) {
    return null;
  }

  return next.toLocaleDateString("pt-BR");
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

export default function MeuPlano() {
  const apiBaseUrl = getApiBaseUrl();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [planoAtual, setPlanoAtual] = useState<PlanoDetalhe | null>(null);
  const [previewPlano, setPreviewPlano] = useState<PlanoDetalhe | null>(null);
  const [planosDisponiveis, setPlanosDisponiveis] = useState<PlanoDetalhe[]>([]);
  const [pricingMode, setPricingMode] = useState<PricingMode>("mensal");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [metrics, setMetrics] = useState<UsageMetrics>({ usuariosAtivos: null, clientesAtivos: null });

  useEffect(() => {
    let disposed = false;

    async function fetchData() {
      setLoading(true);
      setError(null);

      const planosUrl = joinUrl(apiBaseUrl, "/api/planos");
      const empresasUrl = joinUrl(apiBaseUrl, "/api/empresas");
      const usuariosUrl = joinUrl(apiBaseUrl, "/api/usuarios");
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
            const descricao =
              typeof raw.descricao === "string" ? raw.descricao.trim() : raw.descricao ? String(raw.descricao) : "";
            const recorrencia = parseRecorrencia(raw.recorrencia);
            const qtdeUsuarios = toNumber(raw.qtde_usuarios);
            const recursos = parseRecursos(raw.recursos);
            const dataCadastro = parseDate(raw.datacadastro);
            const valorMensal = toNumber(raw.valor);
            const precoMensal = valorMensal !== null ? currencyFormatter.format(valorMensal) : formatCurrencyValue(raw.valor);
            const annualPricing = computeAnnualPricing(valorMensal);

            return {
              id: idNumber,
              nome,
              ativo,
              descricao,
              recorrencia,
              qtdeUsuarios: qtdeUsuarios ?? null,
              recursos,
              dataCadastro,
              valorMensal,
              valorAnual: annualPricing.valorAnual,
              precoMensal,
              precoAnual: annualPricing.precoAnual,
              descontoAnualPercentual: annualPricing.descontoPercentual,
              economiaAnual: annualPricing.economiaAnual,
              economiaAnualFormatada: annualPricing.economiaAnualFormatada,
            } satisfies PlanoDetalhe;
          })
          .filter((item): item is PlanoDetalhe => item !== null);

        if (parsedPlanos.length === 0) {
          throw new Error("Nenhum plano cadastrado.");
        }

        const empresasRows = empresasJson ? normalizeApiRows(empresasJson) : [];
        const planoSelecionado =
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
          setPricingMode(planoSelecionado.recorrencia === "anual" ? "anual" : "mensal");
          setMetrics({ usuariosAtivos: usuariosCount, clientesAtivos });
        }
      } catch (err) {
        console.error(err);
        if (!disposed) {
          setError(err instanceof Error ? err.message : "Não foi possível carregar os dados do plano.");
          setPlanosDisponiveis([]);
          setPlanoAtual(null);
          setPreviewPlano(null);
          setMetrics({ usuariosAtivos: null, clientesAtivos: null });
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
  }, [apiBaseUrl]);

  const planoExibido = previewPlano ?? planoAtual;

  useEffect(() => {
    if (pricingMode === "anual" && planoExibido && !planoExibido.precoAnual) {
      setPricingMode("mensal");
    }
  }, [pricingMode, planoExibido]);

  const pricingDisplay = useMemo(() => buildPricingDisplay(planoExibido, pricingMode), [planoExibido, pricingMode]);

  const proximaCobranca = useMemo(() => {
    if (!planoAtual) {
      return null;
    }

    return calculateNextBilling(planoAtual.recorrencia, planoAtual.dataCadastro);
  }, [planoAtual]);

  const usageItems = useMemo<UsageItem[]>(() => {
    if (!planoExibido) {
      return [];
    }

    const items: UsageItem[] = [];
    if (planoExibido.qtdeUsuarios !== null || metrics.usuariosAtivos !== null) {
      items.push({
        label: "Usuários ativos",
        current: metrics.usuariosAtivos,
        limit: planoExibido.qtdeUsuarios,
      });
    }
    if (metrics.clientesAtivos !== null) {
      items.push({
        label: "Clientes ativos",
        current: metrics.clientesAtivos,
      });
    }

    return items;
  }, [metrics.clientesAtivos, metrics.usuariosAtivos, planoExibido]);

  const beneficios = planoExibido?.recursos ?? [];

  const destaquePlanoId = useMemo(() => {
    if (planosDisponiveis.length === 0) {
      return null;
    }

    const sorted = [...planosDisponiveis]
      .filter((item) => item.valorMensal !== null)
      .sort((a, b) => (b.valorMensal ?? 0) - (a.valorMensal ?? 0));

    return sorted[0]?.id ?? null;
  }, [planosDisponiveis]);

  const handlePreviewPlan = useCallback(
    (plan: PlanoDetalhe) => {
      setPreviewPlano(plan);
      setDialogOpen(false);
      setPricingMode((current) => {
        if (current === "anual" && !plan.precoAnual) {
          return "mensal";
        }
        return current;
      });
      toast({
        title: `Pré-visualizando ${plan.nome}`,
        description:
          "Os valores e limites exibidos foram atualizados com base neste plano. Finalize em Configurações > Planos para confirmar a alteração.",
      });
    },
    [toast],
  );

  const resetPreview = useCallback(() => {
    setPreviewPlano(null);
    if (planoAtual) {
      setPricingMode(planoAtual.recorrencia === "anual" ? "anual" : "mensal");
    }
    toast({
      title: "Plano atual restabelecido",
      description: "Você voltou a visualizar o plano contratado atualmente.",
    });
  }, [planoAtual, toast]);

  const hasAnnualPricing = Boolean(planoExibido?.precoAnual);

  return (
    <div className="p-6 space-y-6">
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
            <CardContent className="relative z-10 space-y-8 p-6 md:p-10">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
                      {previewPlano ? "Pré-visualização" : "Plano atual"}
                    </Badge>
                    <Badge variant={planoExibido?.ativo ? "secondary" : "outline"}>
                      {planoExibido?.ativo ? "Disponível" : "Indisponível"}
                    </Badge>
                    {planoExibido?.recorrencia && (
                      <Badge variant="outline">{recorrenciaLabels[planoExibido.recorrencia]}</Badge>
                    )}
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
                    <ToggleGroupItem value="mensal" className="rounded-full px-4 py-2 text-sm">Mensal</ToggleGroupItem>
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

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-primary">Plano contratado</p>
                  <p className="text-sm font-semibold text-foreground">{planoAtual.nome}</p>
                  {previewPlano && (
                    <p className="text-xs text-muted-foreground">Visualizando {planoExibido?.nome}</p>
                  )}
                </div>
                <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Próxima cobrança</p>
                  <p className="text-sm font-semibold text-foreground">
                    {proximaCobranca ?? "Cobrança sob demanda"}
                  </p>
                  <p className="text-xs text-muted-foreground">Referente ao plano atual</p>
                </div>
                <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Usuários incluídos</p>
                  <p className="text-sm font-semibold text-foreground">
                    {planoExibido?.qtdeUsuarios ? `${planoExibido.qtdeUsuarios} usuários` : "Ilimitado"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {previewPlano ? "Limite estimado para o plano em pré-visualização" : "Limite do plano atual"}
                  </p>
                </div>
                <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Recorrência</p>
                  <p className="text-sm font-semibold text-foreground">
                    {planoExibido?.recorrencia
                      ? recorrenciaLabels[planoExibido.recorrencia]
                      : "Cobrança sob demanda"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {previewPlano ? "Configuração sugerida para o plano escolhido" : "Configuração atual"}
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
                  <DialogContent className="sm:max-w-4xl">
                    <DialogHeader>
                      <DialogTitle>Escolha um novo plano</DialogTitle>
                      <DialogDescription>
                        Compare os planos disponíveis e pré-visualize como cada opção se encaixa nas necessidades do seu time.
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
                        <ToggleGroupItem value="mensal" className="rounded-full px-4 py-2 text-sm">Mensal</ToggleGroupItem>
                        <ToggleGroupItem value="anual" className="rounded-full px-4 py-2 text-sm">Anual</ToggleGroupItem>
                      </ToggleGroup>
                      <Carousel className="relative">
                        <CarouselContent>
                          {planosDisponiveis.map((plano) => {
                            const carouselPricing = buildPricingDisplay(plano, pricingMode);
                            const isAtual = planoAtual.id === plano.id;
                            const isPreviewing = previewPlano?.id === plano.id;
                            const isSelecionado = previewPlano ? isPreviewing : isAtual;
                            const isDestaque = destaquePlanoId === plano.id;

                            return (
                              <CarouselItem key={plano.id} className="md:basis-1/2 lg:basis-1/3">
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

                                  <CardHeader className="space-y-6 pb-0 text-left">
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
                                        <CardTitle className="text-3xl font-semibold text-white">
                                          {plano.nome}
                                        </CardTitle>
                                      </div>

                                      <div className="space-y-2">
                                        <span className="text-xs uppercase tracking-[0.3em] text-slate-300">
                                          Investimento
                                        </span>
                                        <div className="flex items-baseline gap-2">
                                          <span className="text-4xl font-bold text-white">
                                            {carouselPricing.mainPrice}
                                          </span>
                                          <span className="text-base font-medium text-slate-300">
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
                                          <p className="text-xs text-slate-300">{carouselPricing.helper}</p>
                                        )}
                                      </div>

                                      {plano.descricao && (
                                        <CardDescription className="text-sm text-slate-200/90">
                                          {plano.descricao}
                                        </CardDescription>
                                      )}
                                    </div>
                                  </CardHeader>

                                  <CardContent className="flex flex-1 flex-col gap-5">
                                    <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200">
                                      <span className="font-semibold text-sky-200">
                                        Inclui recursos essenciais para sua equipe
                                      </span>
                                    </div>
                                    <div className="space-y-3">
                                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                                        Principais benefícios
                                      </p>
                                      <ul className="space-y-2 text-sm text-slate-100">
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

                                  <CardFooter className="mt-auto flex flex-col gap-3 p-6 pt-0">
                                    <Button
                                      className={cn(
                                        "w-full font-semibold",
                                        isSelecionado
                                          ? "bg-white text-slate-950 hover:bg-white/90"
                                          : "bg-primary text-primary-foreground hover:bg-primary/90",
                                      )}
                                      onClick={() => handlePreviewPlan(plano)}
                                      disabled={isAtual && !previewPlano}
                                    >
                                      {isSelecionado ? "Visualizando" : "Pré-visualizar"}
                                    </Button>
                                    <Button
                                      variant="outline"
                                      className="w-full border-white/30 bg-white/10 text-white hover:bg-white/20"
                                      asChild
                                    >
                                      <Link to="/configuracoes/planos">Gerenciar no painel</Link>
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
                <Button size="lg" variant="ghost" className="rounded-full" asChild>
                  <Link to="/configuracoes/planos" className="flex items-center gap-2">
                    Gerenciar no painel
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
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
                    return (
                      <div key={item.label} className="space-y-2 rounded-2xl border border-border/60 p-4">
                        <div className="flex items-center justify-between text-sm font-medium">
                          <span>{item.label}</span>
                          <span className="text-foreground">
                            {hasLimit
                              ? `${hasCurrent ? item.current : "—"}/${limit}`
                              : hasCurrent
                                ? item.current
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
