import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Loader2, Sparkles } from "lucide-react";

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/components/ui/use-toast";
import { getApiUrl } from "@/lib/api";
import { useAuth } from "@/features/auth/AuthProvider";
import { evaluateSubscriptionAccess } from "@/features/auth/subscriptionStatus";
import { fetchPlanOptions, formatPlanPriceLabel, type PlanOption } from "./api";

const graceDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "long",
});

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
          companyId: user.empresa_id,
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
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-4 py-10">
      <div className="space-y-2 text-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1 text-sm font-medium text-primary">
          {headerContent.icon} {headerContent.badge}
        </span>
        <h1 className="text-3xl font-bold text-foreground sm:text-4xl">{headerContent.title}</h1>
        <p className="text-muted-foreground">{headerContent.description}</p>
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
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-muted-foreground">
            Nenhum plano está disponível no momento. Entre em contato com o suporte para prosseguir.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {plans.map((plan) => {
            const isPending = pendingPlanId === plan.id;
            return (
              <Card key={plan.id} className="flex h-full flex-col justify-between" data-testid={`plan-card-${plan.id}`}>
                <CardHeader>
                  <CardTitle>{plan.name}</CardTitle>
                  <CardDescription>{plan.description ?? "Inclui recursos essenciais para o seu time."}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-lg font-semibold text-primary">{formatPlanPriceLabel(plan)}</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Inicie agora e conheça todos os módulos disponíveis para o seu escritório.
                  </p>
                </CardContent>
                <CardFooter>
                  <Button
                    className="w-full"
                    onClick={() => handleSelectPlan(plan.id)}
                    disabled={isPending || !canSubscribe}
                    data-testid={`select-plan-${plan.id}`}
                  >
                    {isPending ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" /> Iniciando teste…
                      </span>
                    ) : (
                      "Iniciar teste gratuito"
                    )}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
