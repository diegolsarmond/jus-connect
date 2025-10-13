import { FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { plans } from "@/data/plans";
import { getApiUrl } from "@/lib/api";
import { CreditCard, FileText, Loader2, QrCode } from "lucide-react";

const Checkout = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
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

  if (!plan) {
    return null;
  }

  const value = cycle === "monthly" ? plan.monthlyPrice : plan.yearlyPrice;
  const cycleType = cycle === "monthly" ? "MONTHLY" : "YEARLY";

  const requestJson = async <T>(url: string, init?: RequestInit): Promise<T> => {
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
    if (loading) {
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
                        onChange={(event) =>
                          setCustomerData((prev) => ({ ...prev, addressNumber: event.target.value }))
                        }
                      />
                    </div>
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <h2 className="text-xl font-semibold mb-4">Forma de Pagamento</h2>
                <RadioGroup value={billingType} onValueChange={(value: "CREDIT_CARD" | "BOLETO" | "PIX") => setBillingType(value)}>
                  <div className="flex items-center space-x-2 p-4 border rounded-lg hover:bg-muted/50 cursor-pointer">
                    <RadioGroupItem value="PIX" id="pix" />
                    <Label htmlFor="pix" className="flex items-center gap-2 cursor-pointer flex-1">
                      <QrCode className="w-5 h-5" />
                      PIX - Aprovação instantânea
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 p-4 border rounded-lg hover:bg-muted/50 cursor-pointer">
                    <RadioGroupItem value="BOLETO" id="boleto" />
                    <Label htmlFor="boleto" className="flex items-center gap-2 cursor-pointer flex-1">
                      <FileText className="w-5 h-5" />
                      Boleto - Aprovação em 1-2 dias úteis
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 p-4 border rounded-lg hover:bg-muted/50 cursor-pointer">
                    <RadioGroupItem value="CREDIT_CARD" id="card" />
                    <Label htmlFor="card" className="flex items-center gap-2 cursor-pointer flex-1">
                      <CreditCard className="w-5 h-5" />
                      Cartão de Crédito
                    </Label>
                  </div>
                </RadioGroup>

                {billingType === "CREDIT_CARD" && (
                  <div className="mt-6 space-y-4">
                    <div>
                      <Label htmlFor="cardHolder">Nome no Cartão</Label>
                      <Input
                        id="cardHolder"
                        required
                        value={creditCardData.holderName}
                        onChange={(event) =>
                          setCreditCardData((prev) => ({ ...prev, holderName: event.target.value }))
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="cardNumber">Número do Cartão</Label>
                      <Input
                        id="cardNumber"
                        required
                        placeholder="1234 5678 9012 3456"
                        value={creditCardData.number}
                        onChange={(event) =>
                          setCreditCardData((prev) => ({ ...prev, number: event.target.value }))
                        }
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="expiryMonth">Mês</Label>
                        <Input
                          id="expiryMonth"
                          required
                          placeholder="MM"
                          maxLength={2}
                          value={creditCardData.expiryMonth}
                          onChange={(event) =>
                            setCreditCardData((prev) => ({ ...prev, expiryMonth: event.target.value }))
                          }
                        />
                      </div>
                      <div>
                        <Label htmlFor="expiryYear">Ano</Label>
                        <Input
                          id="expiryYear"
                          required
                          placeholder="AAAA"
                          maxLength={4}
                          value={creditCardData.expiryYear}
                          onChange={(event) =>
                            setCreditCardData((prev) => ({ ...prev, expiryYear: event.target.value }))
                          }
                        />
                      </div>
                      <div>
                        <Label htmlFor="ccv">CVV</Label>
                        <Input
                          id="ccv"
                          required
                          placeholder="123"
                          maxLength={4}
                          value={creditCardData.ccv}
                          onChange={(event) => setCreditCardData((prev) => ({ ...prev, ccv: event.target.value }))}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </Card>

              <Button type="submit" size="lg" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processando...
                  </>
                ) : (
                  "Confirmar Assinatura"
                )}
              </Button>
            </form>
          </div>

          <div>
            <Card className="p-6 sticky top-4">
              <h3 className="font-semibold mb-4">Resumo</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Plano</span>
                  <span className="font-medium">{plan.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Período</span>
                  <span className="font-medium capitalize">{cycle === "monthly" ? "Mensal" : "Anual"}</span>
                </div>
                <div className="border-t pt-2 mt-2">
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total</span>
                    <span>R$ {value.toFixed(2)}</span>
                  </div>
                  {cycle === "yearly" && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Economia de R$ {(plan.monthlyPrice * 12 - plan.yearlyPrice).toFixed(2)} por ano
                    </p>
                  )}
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Checkout;
