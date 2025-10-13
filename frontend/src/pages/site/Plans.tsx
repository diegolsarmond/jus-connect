import { useState } from "react";
import { useNavigate } from "react-router-dom";
import PendingSubscriptions from "@/components/PendingSubscriptions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Check } from "lucide-react";
import { plans, Plan } from "@/data/plans";

const Plans = () => {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("yearly");
  const navigate = useNavigate();

  const handleSelectPlan = (planId: Plan["id"]) => {
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
          {plans.map((plan) => (
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
              >
                Selecionar Plano
              </Button>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Plans;
