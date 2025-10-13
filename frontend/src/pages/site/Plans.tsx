import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Check } from "lucide-react";

import PendingSubscriptions from "@/components/PendingSubscriptions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { plans, Plan } from "@/data/plans";
import { useAuth } from "@/features/auth/AuthProvider";
import { routes } from "@/config/routes";
import {
  persistManagePlanSelection,
  type ManagePlanSelection,
  type PricingMode,
} from "@/features/plans/managePlanPaymentStorage";
import { fetchPlanOptions, type PlanOption } from "@/features/plans/api";

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

const Plans = () => {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("yearly");
  const [pendingPlan, setPendingPlan] = useState<Plan["id"] | null>(null);
  const [apiPlans, setApiPlans] = useState<PlanOption[] | null>(null);
  const [apiPlansLoaded, setApiPlansLoaded] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  const ensureApiPlans = useCallback(async () => {
    if (apiPlansLoaded) {
      return apiPlans;
    }

    try {
      const options = await fetchPlanOptions();
      setApiPlans(options);
      setApiPlansLoaded(true);
      return options;
    } catch (error) {
      setApiPlans(null);
      setApiPlansLoaded(true);
      return null;
    }
  }, [apiPlans, apiPlansLoaded]);

  const handleSelectPlan = async (planId: Plan["id"]) => {
    const selectedPlan = plans.find((item) => item.id === planId);
    if (!selectedPlan) {
      return;
    }

    if (user?.empresa_id) {
      setPendingPlan(planId);
      try {
        const options = apiPlansLoaded ? apiPlans : await ensureApiPlans();
        const normalizedName = selectedPlan.name.trim().toLowerCase();
        const apiPlan =
          options?.find((option) => option.name.trim().toLowerCase() === normalizedName) ?? null;

        if (!apiPlan) {
          navigate(`/checkout?plan=${planId}&cycle=${billingCycle}`);
          return;
        }

        const pricingMode: PricingMode = billingCycle === "yearly" ? "anual" : "mensal";
        const selection: ManagePlanSelection = {
          plan: {
            id: apiPlan.id,
            nome: apiPlan.name,
            descricao: apiPlan.description,
            recursos: selectedPlan.features,
            valorMensal: apiPlan.monthlyPrice,
            valorAnual: apiPlan.annualPrice,
            precoMensal: formatCurrency(apiPlan.monthlyPrice),
            precoAnual: formatCurrency(apiPlan.annualPrice),
            descontoAnualPercentual: null,
            economiaAnual: null,
            economiaAnualFormatada: null,
          },
          pricingMode,
        };

        persistManagePlanSelection(selection);
        navigate(routes.meuPlanoPayment, { state: selection });
        return;
      } catch (error) {
        navigate(`/checkout?plan=${planId}&cycle=${billingCycle}`);
        return;
      } finally {
        setPendingPlan(null);
      }
    }

    navigate(`/checkout?plan=${planId}&cycle=${billingCycle}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto px-4 py-16">
        <PendingSubscriptions />

        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Escolha seu Plano
          </h1>
          <p className="text-lg text-muted-foreground mb-8">
            Soluções completas para advocacia moderna
          </p>

          <div className="inline-flex items-center gap-4 p-1 bg-muted rounded-lg">
            <Button
              variant={billingCycle === "monthly" ? "default" : "ghost"}
              onClick={() => setBillingCycle("monthly")}
              className="transition-all"
            >
              Mensal
            </Button>
            <Button
              variant={billingCycle === "yearly" ? "default" : "ghost"}
              onClick={() => setBillingCycle("yearly")}
              className="transition-all"
            >
              Anual
              <Badge variant="secondary" className="ml-2 bg-accent text-accent-foreground">
                2 meses grátis
              </Badge>
            </Button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan) => {
            const isPending = pendingPlan === plan.id;
            return (
            <Card
              key={plan.id}
              className={`relative p-8 transition-all hover:shadow-xl ${
                plan.popular ? "border-accent shadow-lg scale-105" : "hover:border-accent/50"
              }`}
            >
              {plan.popular && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-accent to-accent/80">
                  Mais Popular
                </Badge>
              )}

              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                <p className="text-muted-foreground text-sm">{plan.description}</p>
              </div>

              <div className="text-center mb-8">
                <div className="flex items-baseline justify-center gap-2">
                  <span className="text-4xl font-bold">
                    R$ {billingCycle === "monthly" ? plan.monthlyPrice : plan.yearlyPrice}
                  </span>
                  <span className="text-muted-foreground">
                    /{billingCycle === "monthly" ? "mês" : "ano"}
                  </span>
                </div>
                {billingCycle === "yearly" && (
                  <p className="text-sm text-muted-foreground mt-2">
                    R$ {(plan.yearlyPrice / 12).toFixed(2)} por mês
                  </p>
                )}
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                onClick={() => handleSelectPlan(plan.id)}
                className={`w-full ${
                  plan.popular
                    ? "bg-gradient-to-r from-accent to-accent/80 hover:from-accent/90 hover:to-accent/70"
                    : ""
                }`}
                size="lg"
                disabled={isPending}
              >
                {isPending ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" /> Processando…
                  </span>
                ) : (
                  "Selecionar Plano"
                )}
              </Button>
            </Card>
          );
          })}
        </div>
      </div>
    </div>
  );
};

export default Plans;
