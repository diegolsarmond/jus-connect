import { FormEvent, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { plans as staticPlans } from "@/data/plans";
import { Subscription } from "@/types/subscription";
import { useToast } from "@/hooks/use-toast";
import { getApiUrl } from "@/lib/api";
import { Loader2 } from "lucide-react";
import { fetchPlanOptions, type PlanOption } from "@/features/plans/api";

type UpdatePlanDialogProps = {
  subscription: Subscription;
  onUpdate: () => void;
};

const UpdatePlanDialog = ({ subscription, onUpdate }: UpdatePlanDialogProps) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [planOptions, setPlanOptions] = useState<PlanOption[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [plansError, setPlansError] = useState<string | null>(null);
  const featuresIndex = useMemo(() => {
    const index = new Map<string, string[]>();
    staticPlans.forEach((plan) => {
      const key = plan.name.trim().toLowerCase();
      if (!index.has(key)) {
        index.set(key, plan.features);
      }
    });
    return index;
  }, []);
  const availablePlans = useMemo(() =>
    planOptions.map((plan) => {
      const normalizedName = plan.name.trim().toLowerCase();
      return {
        id: String(plan.id),
        name: plan.name,
        description: plan.description,
        monthlyPrice: plan.monthlyPrice,
        annualPrice: plan.annualPrice,
        features: featuresIndex.get(normalizedName) ?? [],
      };
    }),
  [planOptions, featuresIndex]);
  const defaultPlan = useMemo(() => {
    if (availablePlans.length === 0) {
      return "";
    }

    const planIdCandidate = (subscription as Subscription & { planId?: unknown }).planId;
    if (typeof planIdCandidate === "number" || typeof planIdCandidate === "string") {
      const normalizedId = String(planIdCandidate).trim();
      if (normalizedId.length > 0) {
        const byId = availablePlans.find((plan) => plan.id === normalizedId);
        if (byId) {
          return byId.id;
        }
      }
    }

    const normalized = subscription.description?.toLowerCase() ?? "";
    return (
      availablePlans.find((plan) => normalized.includes(plan.name.toLowerCase()))?.id ??
      availablePlans[0]?.id ??
      ""
    );
  }, [availablePlans, subscription]);
  const [selectedPlan, setSelectedPlan] = useState(defaultPlan);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const controller = new AbortController();
    let cancelled = false;

    const loadPlans = async () => {
      setPlansLoading(true);
      setPlansError(null);

      try {
        const options = await fetchPlanOptions(controller.signal);
        if (!cancelled) {
          setPlanOptions(options);
        }
      } catch (error) {
        if (cancelled) {
          return;
        }
        if ((error as DOMException)?.name === "AbortError") {
          return;
        }
        const message =
          error instanceof Error ? error.message : "Não foi possível carregar os planos disponíveis.";
        setPlansError(message);
        setPlanOptions([]);
      } finally {
        if (!cancelled) {
          setPlansLoading(false);
        }
      }
    };

    void loadPlans();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [open]);

  useEffect(() => {
    setSelectedPlan(defaultPlan);
  }, [defaultPlan]);

  const formatCurrency = (value: number | null) => {
    if (value === null || !Number.isFinite(value)) {
      return null;
    }
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  const requestJson = async (url: string, init?: RequestInit) => {
    const response = await fetch(url, {
      ...init,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });

    let payload: unknown = null;
    if (response.status !== 204) {
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }
    }

    if (!response.ok) {
      const message =
        (payload && typeof payload === "object" && "error" in payload && payload.error)
          ? String(payload.error)
          : response.statusText || "Falha ao comunicar com o servidor.";
      throw new Error(message);
    }

    return payload;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (loading) {
      return;
    }

    if (!selectedPlan) {
      toast({
        title: "Selecione um plano",
        description: "Escolha uma opção antes de confirmar a mudança.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    const numericPlanId = Number(selectedPlan);
    const normalizedPlanId = Number.isFinite(numericPlanId) ? numericPlanId : selectedPlan;

    try {
      await requestJson(getApiUrl(`site/asaas/subscriptions/${encodeURIComponent(subscription.id)}`), {
        method: "PUT",
        body: JSON.stringify({ planId: normalizedPlanId }),
      });

      toast({
        title: "Plano atualizado",
        description: "As informações da assinatura foram atualizadas.",
      });
      setOpen(false);
      onUpdate();
    } catch (err: any) {
      toast({
        title: "Não foi possível atualizar",
        description: err?.message ?? "Verifique os dados e tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        if (!value) {
          setSelectedPlan(defaultPlan);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button>Alterar plano</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          <DialogHeader>
            <DialogTitle>Atualizar plano</DialogTitle>
            <DialogDescription>
              Escolha um dos planos disponíveis para migrar sua assinatura.
            </DialogDescription>
          </DialogHeader>

          {plansLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : availablePlans.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {plansError ?? "Nenhum plano disponível no momento."}
            </p>
          ) : (
            <RadioGroup value={selectedPlan} onValueChange={setSelectedPlan} className="space-y-4">
              {availablePlans.map((plan) => (
                <label
                  key={plan.id}
                  htmlFor={plan.id}
                  className={`block border rounded-lg p-4 cursor-pointer transition-all hover:border-accent/60 ${
                    selectedPlan === plan.id ? "border-accent shadow" : "border-border"
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value={plan.id} id={plan.id} />
                        <span className="font-semibold text-lg">{plan.name}</span>
                      </div>
                      {(plan.description || plan.features.length > 0) && (
                        <div className="text-sm text-muted-foreground mt-1 space-y-1">
                          {plan.description && <p>{plan.description}</p>}
                          {plan.features.length > 0 && (
                            <ul className="space-y-1 pl-6 list-disc">
                              {plan.features.map((feature) => (
                                <li key={feature}>{feature}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="text-right space-y-1">
                      {formatCurrency(plan.monthlyPrice) && (
                        <p className="font-bold">{formatCurrency(plan.monthlyPrice)}/mês</p>
                      )}
                      {formatCurrency(plan.annualPrice) && (
                        <p className="text-xs text-muted-foreground">
                          ou {formatCurrency(plan.annualPrice)}/ano
                        </p>
                      )}
                      {!formatCurrency(plan.monthlyPrice) && !formatCurrency(plan.annualPrice) && (
                        <p className="text-xs text-muted-foreground">Consulte condições</p>
                      )}
                    </div>
                  </div>
                </label>
              ))}
            </RadioGroup>
          )}

          {plansError && availablePlans.length > 0 && (
            <p className="text-sm text-destructive">{plansError}</p>
          )}

          <DialogFooter>
            <Button type="submit" disabled={loading || plansLoading || !selectedPlan}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Atualizando...
                </>
              ) : (
                "Confirmar mudança"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default UpdatePlanDialog;
