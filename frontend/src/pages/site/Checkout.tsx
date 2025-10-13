import { FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CreditCard, FileText, Loader2, QrCode } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { plans } from "@/data/plans";
import { getApiUrl } from "@/lib/api";
import { useAuth } from "@/features/auth/AuthProvider";
import { routes } from "@/config/routes";
import {
  persistManagePlanSelection,
  type ManagePlanSelection,
  type PricingMode,
} from "@/features/plans/managePlanPaymentStorage";
import { fetchPlanOptions } from "@/features/plans/api";

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

const Checkout = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [billingType, setBillingType] = useState<"CREDIT_CARD" | "BOLETO" | "PIX">("PIX");
  const [customerData, setCustomerData] = useState({
    name: "",
    email: "",
    cpfCnpj: "",
    phone: "",
    postalCode: "",
    addressNumber: "",
  });
  const [creditCardData, setCreditCardData] = useState({
    holderName: "",
    number: "",
    expiryMonth: "",
    expiryYear: "",
    ccv: "",
  });

  const planId = searchParams.get("plan");
  const cycle = (searchParams.get("cycle") as "monthly" | "yearly") ?? "monthly";
  const plan = useMemo(() => plans.find((item) => item.id === planId) ?? null, [planId]);

  useEffect(() => {
    if (!plan) {
      navigate("/plans", { replace: true });
    }
  }, [plan, navigate]);

  useEffect(() => {
    if (!user) {
      return;
    }

    setCustomerData((previous) => {
      const next = { ...previous };
      if (!previous.name.trim()) {
        next.name = user.nome_completo;
      }
      if (!previous.email.trim()) {
        next.email = user.email;
      }
      return next;
    });
  }, [user]);

  useEffect(() => {
    if (!plan || !user?.empresa_id) {
      setIsRedirecting(false);
      return;
    }

    let cancelled = false;
    setIsRedirecting(true);

    const redirectToInternalCheckout = async () => {
      try {
        const options = await fetchPlanOptions();
        if (cancelled) {
          return;
        }

        const normalizedName = plan.name.trim().toLowerCase();
        const apiPlan =
          options.find((option) => option.name.trim().toLowerCase() === normalizedName) ?? null;

        if (!apiPlan) {
          if (!cancelled) {
            setIsRedirecting(false);
          }
          return;
        }

        const pricingMode: PricingMode = cycle === "yearly" ? "anual" : "mensal";
        const selection: ManagePlanSelection = {
          plan: {
            id: apiPlan.id,
            nome: apiPlan.name,
            descricao: apiPlan.description,
            recursos: plan.features,
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
        if (!cancelled) {
          navigate(routes.meuPlanoPayment, { state: selection, replace: true });
        }
      } catch (error) {
        if (!cancelled) {
          setIsRedirecting(false);
        }
      }
    };

    void redirectToInternalCheckout();

    return () => {
      cancelled = true;
    };
  }, [cycle, navigate, plan, user?.empresa_id]);

  if (!plan) {
    return null;
  }

  if (isRedirecting) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 py-16">
        <div className="container mx-auto flex max-w-4xl flex-col items-center gap-4 px-4 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Redirecionando para o checkout interno…</p>
        </div>
      </div>
    );
  }

  const value = cycle === "monthly" ? plan.monthlyPrice : plan.yearlyPrice;
  const cycleType = cycle === "monthly" ? "MONTHLY" : "YEARLY";

  const requestJson = async <T,>(url: string, init?: RequestInit): Promise<T> => {
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

    return payload as T;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading || isRedirecting) {
      return;
    }

    setLoading(true);

    try {
      const customerResp = await requestJson<{ id?: string }>(getApiUrl("site/asaas/customers"), {
        method: "POST",
        body: JSON.stringify(customerData),
      });

      const customerId = customerResp?.id;
      if (!customerId) {
        throw new Error("Não foi possível identificar o cliente");
      }

      const nextDueDate = new Date();
      nextDueDate.setDate(nextDueDate.getDate() + 7);

      const subscriptionData = {
        customer: customerId,
        billingType,
        value,
        nextDueDate: nextDueDate.toISOString().split("T")[0],
        cycle: cycleType,
        description: `Assinatura ${plan.name} (${cycle === "monthly" ? "mensal" : "anual"})`,
        externalReference: `plan-${plan.id}-${Date.now()}`,
        ...(billingType === "CREDIT_CARD" && {
          creditCard: creditCardData,
          creditCardHolderInfo: customerData,
        }),
      };

      const subscriptionResp = await requestJson<{ id?: string }>(
        getApiUrl("site/asaas/subscriptions"),
        {
          method: "POST",
          body: JSON.stringify(subscriptionData),
        },
      );

      const subscriptionId = subscriptionResp?.id;
      if (subscriptionId) {
        if (typeof window !== "undefined") {
          localStorage.setItem("subscriptionId", subscriptionId);
          localStorage.setItem("customerId", customerId);
        }
      }

      toast({
        title: "Assinatura criada com sucesso!",
        description: "Você pode acompanhar o pagamento na próxima tela.",
      });
      navigate(`/subscription/${subscriptionId}`);
    } catch (error: any) {
      toast({
        title: "Erro ao criar assinatura",
        description: error?.message ?? "Tente novamente mais tarde.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 py-16">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Finalizar Assinatura</h1>
          <p className="text-muted-foreground">
            Plano {plan.name} - R$ {value}/{cycle === "monthly" ? "mês" : "ano"}
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          <div className="md:col-span-2">
            <form onSubmit={handleSubmit} className="space-y-6">
              <Card className="p-6">
                <h2 className="text-xl font-semibold mb-4">Dados do Cliente</h2>
                <div className="grid gap-4">
                  <div>
                    <Label htmlFor="name">Nome Completo</Label>
                    <Input
                      id="name"
                      required
                      value={customerData.name}
                      onChange={(event) => setCustomerData((prev) => ({ ...prev, name: event.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      required
                      value={customerData.email}
                      onChange={(event) => setCustomerData((prev) => ({ ...prev, email: event.target.value }))}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="cpfCnpj">CPF/CNPJ</Label>
                      <Input
                        id="cpfCnpj"
                        required
                        value={customerData.cpfCnpj}
                        onChange={(event) => setCustomerData((prev) => ({ ...prev, cpfCnpj: event.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="phone">Telefone</Label>
                      <Input
                        id="phone"
                        required
                        value={customerData.phone}
                        onChange={(event) => setCustomerData((prev) => ({ ...prev, phone: event.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="postalCode">CEP</Label>
                      <Input
                        id="postalCode"
                        required
                        value={customerData.postalCode}
                        onChange={(event) => setCustomerData((prev) => ({ ...prev, postalCode: event.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="addressNumber">Número</Label>
                      <Input
                        id="addressNumber"
                        required
                        value={customerData.addressNumber}
                        onChange={(event) => setCustomerData((prev) => ({ ...prev, addressNumber: event.target.value }))}
                      />
                    </div>
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <h2 className="text-xl font-semibold mb-4">Forma de Pagamento</h2>
                <RadioGroup value={billingType} onValueChange={(value) => setBillingType(value as typeof billingType)}>
                  <div className="grid gap-4 md:grid-cols-3">
                    <label className={`flex cursor-pointer flex-col gap-2 rounded-lg border p-4 ${billingType === "PIX" ? "border-primary bg-primary/5" : ""}`}>
                      <RadioGroupItem value="PIX" className="sr-only" />
                      <QrCode className="h-6 w-6" />
                      <span className="font-semibold">PIX</span>
                      <span className="text-sm text-muted-foreground">Pagamento instantâneo com QR Code</span>
                    </label>
                    <label className={`flex cursor-pointer flex-col gap-2 rounded-lg border p-4 ${billingType === "BOLETO" ? "border-primary bg-primary/5" : ""}`}>
                      <RadioGroupItem value="BOLETO" className="sr-only" />
                      <FileText className="h-6 w-6" />
                      <span className="font-semibold">Boleto</span>
                      <span className="text-sm text-muted-foreground">Receba o boleto por email imediatamente</span>
                    </label>
                    <label className={`flex cursor-pointer flex-col gap-2 rounded-lg border p-4 ${billingType === "CREDIT_CARD" ? "border-primary bg-primary/5" : ""}`}>
                      <RadioGroupItem value="CREDIT_CARD" className="sr-only" />
                      <CreditCard className="h-6 w-6" />
                      <span className="font-semibold">Cartão de Crédito</span>
                      <span className="text-sm text-muted-foreground">Aprovação imediata com parcelamento</span>
                    </label>
                  </div>
                </RadioGroup>

                {billingType === "CREDIT_CARD" && (
                  <div className="mt-6 grid gap-4">
                    <div>
                      <Label htmlFor="holderName">Nome impresso no cartão</Label>
                      <Input
                        id="holderName"
                        required
                        value={creditCardData.holderName}
                        onChange={(event) => setCreditCardData((prev) => ({ ...prev, holderName: event.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="number">Número do cartão</Label>
                      <Input
                        id="number"
                        required
                        value={creditCardData.number}
                        onChange={(event) => setCreditCardData((prev) => ({ ...prev, number: event.target.value }))}
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="expiryMonth">Mês</Label>
                        <Input
                          id="expiryMonth"
                          placeholder="MM"
                          required
                          value={creditCardData.expiryMonth}
                          onChange={(event) => setCreditCardData((prev) => ({ ...prev, expiryMonth: event.target.value }))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="expiryYear">Ano</Label>
                        <Input
                          id="expiryYear"
                          placeholder="AA"
                          required
                          value={creditCardData.expiryYear}
                          onChange={(event) => setCreditCardData((prev) => ({ ...prev, expiryYear: event.target.value }))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="ccv">CVV</Label>
                        <Input
                          id="ccv"
                          required
                          value={creditCardData.ccv}
                          onChange={(event) => setCreditCardData((prev) => ({ ...prev, ccv: event.target.value }))}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </Card>

              <Button type="submit" className="w-full" disabled={loading || isRedirecting}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Finalizar Assinatura"}
              </Button>
            </form>
          </div>

          <div className="space-y-6">
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Resumo</h2>
              <div className="flex justify-between text-sm">
                <span>Plano</span>
                <span>{plan.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Ciclo</span>
                <span>{cycle === "monthly" ? "Mensal" : "Anual"}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Valor</span>
                <span>R$ {value}</span>
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Segurança</h2>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li>Transações criptografadas com padrão PCI DSS</li>
                <li>Dados armazenados com segurança na Asaas</li>
                <li>Suporte especializado para dúvidas e ajustes</li>
              </ul>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Checkout;
