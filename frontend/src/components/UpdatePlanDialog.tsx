import { FormEvent, useMemo, useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { plans } from "@/data/plans";
import { Subscription } from "@/types/subscription";
import { useToast } from "@/hooks/use-toast";
import { getApiUrl } from "@/lib/api";
import { Loader2 } from "lucide-react";

type UpdatePlanDialogProps = {
  subscription: Subscription;
  onUpdate: () => void;
};

const UpdatePlanDialog = ({ subscription, onUpdate }: UpdatePlanDialogProps) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const defaultPlan = useMemo(() => {
    const normalized = subscription.description?.toLowerCase() ?? "";
    return plans.find((plan) => normalized.includes(plan.name.toLowerCase()))?.id ?? plans[0]?.id ?? "";
  }, [subscription.description]);
  const [selectedPlan, setSelectedPlan] = useState(defaultPlan);

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

    setLoading(true);

    try {
      await requestJson(getApiUrl(`site/asaas/subscriptions/${encodeURIComponent(subscription.id)}`), {
        method: "PUT",
        body: JSON.stringify({ planId: selectedPlan }),
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

          <RadioGroup value={selectedPlan} onValueChange={setSelectedPlan} className="space-y-4">
            {plans.map((plan) => (
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
                      {plan.popular && (
                        <Badge className="bg-accent text-accent-foreground">Mais Popular</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">R$ {plan.monthlyPrice}/mês</p>
                    <p className="text-xs text-muted-foreground">ou R$ {plan.yearlyPrice}/ano</p>
                  </div>
                </div>
                <ul className="text-sm text-muted-foreground space-y-1 pl-6 list-disc">
                  {plan.features.map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>
              </label>
            ))}
          </RadioGroup>

          <DialogFooter>
            <Button type="submit" disabled={loading}>
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
