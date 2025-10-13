import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Loader2, Sparkles } from "lucide-react";

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/components/ui/use-toast";
import { routes } from "@/config/routes";
import { useAuth } from "@/features/auth/AuthProvider";
import { evaluateSubscriptionAccess } from "@/features/auth/subscriptionStatus";
import {
  persistManagePlanSelection,
  type ManagePlanSelection,
  type PricingMode,
} from "@/features/plans/managePlanPaymentStorage";
import { getApiUrl } from "@/lib/api";
import { fetchPlanOptions, formatPlanPriceLabel, type PlanOption } from "./api";

const graceDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "long",
});

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const formatCurrency = (value: number | null): string | null => {
  if (value === null || !Number.isFinite(value)) {
    return null;
  }

  return currencyFormatter.format(value);
};

export const PlanSelection = () => {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const subscriptionAccess = useMemo(
    () => evaluateSubscriptionAccess(user?.subscription ?? null),
    [user?.subscription],
  );
  const blockedReason = subscriptionAccess.hasAccess ? null : subscriptionAccess.reason;
  const graceDeadline = subscriptionAccess.hasAccess ? null : subscriptionAccess.graceDeadline;

  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingPlanId, setPendingPlanId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadPlans = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const options = await fetchPlanOptions();
        if (cancelled) {
          return;
        }

        setPlans(options);
      } catch (loadError) {
        if (cancelled) {
          return;
        }

        const message =
          loadError instanceof Error
            ? loadError.message
            : "Não foi possível carregar a lista de planos.";
        setError(message);
        setPlans([]);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadPlans();

    return () => {
      cancelled = true;
    };
  }, []);

  const canSubscribe = user?.empresa_id != null;
  const infoMessage = useMemo(() => {
    if (!canSubscribe) {
      return "Associe o usuário a uma empresa para iniciar a avaliação de um plano.";
    }
    return null;
  }, [canSubscribe]);

  const headerContent = useMemo(() => {
    const defaultContent = {
      icon: <Sparkles className="h-4 w-4" />,
      badge: "Ative seu período de teste de 14 dias",
      title: "Selecione um plano para começar",
      description:
        "Escolha o plano que melhor atende ao seu escritório. Você poderá explorar todos os recursos antes de decidir.",
    } as const;

    if (!blockedReason || blockedReason === "missing" || blockedReason === "inactive") {
      return defaultContent;
    }

    const formattedDeadline = graceDeadline ? graceDateFormatter.format(graceDeadline) : null;

    return {
      icon: <AlertTriangle className="h-4 w-4" />,
      badge: "Regularize sua assinatura",
      title: "Atualize seu plano para continuar",
      description: formattedDeadline
        ? `Seu acesso foi interrompido em ${formattedDeadline}. Regularize o pagamento ou selecione um novo plano para continuar utilizando o JusConnect.`
        : "Sua assinatura foi desativada. Regularize o pagamento ou selecione um novo plano para continuar utilizando o JusConnect.",
    } as const;
  }, [blockedReason, graceDeadline]);

  const handleSelectPlan = async (planId: number) => {
    if (!canSubscribe) {
      setError("Usuário não possui empresa vinculada para criar a assinatura.");
      return;
    }

    const selectedPlan = plans.find((plan) => plan.id === planId) ?? null;

    if (selectedPlan && user?.empresa_id) {
      const pricingMode: PricingMode = selectedPlan.monthlyPrice !== null ? "mensal" : "anual";
      const selection: ManagePlanSelection = {
        plan: {
          id: selectedPlan.id,
          nome: selectedPlan.name,
          descricao: selectedPlan.description,
          recursos: [],
          valorMensal: selectedPlan.monthlyPrice,
          valorAnual: selectedPlan.annualPrice,
          precoMensal: formatCurrency(selectedPlan.monthlyPrice),
          precoAnual: formatCurrency(selectedPlan.annualPrice),
          descontoAnualPercentual: null,
          economiaAnual: null,
          economiaAnualFormatada: null,
        },
        pricingMode,
      };

      persistManagePlanSelection(selection);
      toast({
        title: "Plano selecionado",
        description: "Revise as opções de pagamento para concluir a contratação.",
      });
      navigate(routes.meuPlanoPayment, { state: selection });
      return;
    }

    setPendingPlanId(planId);
    setError(null);

    try {
      const response = await fetch(getApiUrl("subscriptions"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          companyId: user?.empresa_id,
          planId,
          status: "trialing",
          startDate: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        const message =
          response.status === 409
            ? "Já existe uma assinatura ativa para esta empresa."
            : `Falha ao ativar o plano (HTTP ${response.status}).`;
        throw new Error(message);
      }

      toast({
        title: "Plano ativado",
        description: "Sua avaliação de 14 dias foi iniciada com sucesso.",
      });

      await refreshUser();
      navigate("/", { replace: true });
    } catch (subscribeError) {
      const message =
        subscribeError instanceof Error
          ? subscribeError.message
          : "Não foi possível ativar o plano selecionado.";
      setError(message);
    } finally {
      setPendingPlanId(null);
    }
  };

  return (
    <div className="relative isolate min-h-screen bg-gradient-to-b from-background via-background to-muted/40 py-16">
      <div className="container mx-auto flex max-w-6xl flex-col gap-10 px-4">
        <div className="space-y-4 text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1 text-sm font-medium text-primary">
            {headerContent.icon} {headerContent.badge}
          </span>
          <h1 className="text-4xl font-bold text-foreground sm:text-5xl">{headerContent.title}</h1>
          <p className="mx-auto max-w-2xl text-muted-foreground">{headerContent.description}</p>
        </div>

        {infoMessage && (
          <Alert>
            <AlertTitle>Vincule uma empresa</AlertTitle>
            <AlertDescription>{infoMessage}</AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive" data-testid="plan-selection-error">
            <AlertTitle>Não foi possível concluir a solicitação</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {isLoading ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Carregando planos disponíveis…</span>
            </div>
          </div>
        ) : plans.length === 0 ? (
          <Card className="border-dashed bg-background/80">
            <CardContent className="py-10 text-center text-muted-foreground">
              Nenhum plano está disponível no momento. Entre em contato com o suporte para prosseguir.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-3">
            {plans.map((plan) => {
              const isPending = pendingPlanId === plan.id;
              return (
                <Card
                  key={plan.id}
                  className="group flex h-full flex-col justify-between overflow-hidden border-border/60 bg-gradient-to-b from-background to-muted/20 shadow-lg transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-2xl"
                  data-testid={`plan-card-${plan.id}`}
                >
                  <CardHeader className="space-y-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-2xl font-semibold">{plan.name}</CardTitle>
                      <span className="text-sm font-medium text-primary">Plano recomendado</span>
                    </div>
                    {plan.description && <CardDescription>{plan.description}</CardDescription>}
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <p className="text-3xl font-bold text-foreground">{formatPlanPriceLabel(plan)}</p>
                      <p className="text-sm text-muted-foreground">
                        {plan.annualPrice !== null && plan.monthlyPrice !== null
                          ? `Economize ${formatCurrency(Math.max(0, plan.monthlyPrice * 12 - plan.annualPrice))} ao optar pelo plano anual.`
                          : ""}
                      </p>
                    </div>
                  </CardContent>
                  <CardFooter className="flex flex-col gap-3">
                    <Button
                      className="w-full"
                      onClick={() => handleSelectPlan(plan.id)}
                      disabled={isPending || !canSubscribe}
                      data-testid={`select-plan-${plan.id}`}
                    >
                      {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Selecionar plano"}
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
