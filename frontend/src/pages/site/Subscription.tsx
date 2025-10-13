import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Subscription, Payment, PixQRCode } from "@/types/subscription";
import UpdateCardDialog from "@/components/UpdateCardDialog";
import UpdatePlanDialog from "@/components/UpdatePlanDialog";
import { getApiUrl } from "@/lib/api";
import {
  ArrowLeft,
  Calendar,
  Check,
  Copy,
  CreditCard,
  Download,
  Loader2,
} from "lucide-react";

const SubscriptionDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [pixQrCode, setPixQrCode] = useState<PixQRCode | null>(null);
  const [boletoCode, setBoletoCode] = useState<string | null>(null);
  const [copiedPayload, setCopiedPayload] = useState(false);
  const [pollingInterval, setPollingInterval] = useState<ReturnType<typeof setInterval> | null>(null);
  const [lastPaymentStatus, setLastPaymentStatus] = useState<string | null>(null);

  useEffect(() => {
    loadSubscription();
    const interval = setInterval(() => {
      checkPaymentStatusInBackground();
    }, 15000);
    setPollingInterval(interval);

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

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

  const checkPaymentStatusInBackground = async () => {
    if (!id) {
      return;
    }

    try {
      const paymentsResp = await requestJson<{ data: Payment[] }>(
        getApiUrl(`site/asaas/subscriptions/${encodeURIComponent(id)}/payments`),
      );

      const paymentsList = paymentsResp?.data ?? [];
      const pendingPayment = paymentsList.find((payment) => payment.status === "PENDING");
      const confirmedPayment = paymentsList.find((payment) =>
        payment.status === "CONFIRMED" || payment.status === "RECEIVED",
      );

      if (confirmedPayment && lastPaymentStatus === "PENDING") {
        setPayments(paymentsList);
        if (pollingInterval) {
          clearInterval(pollingInterval);
          setPollingInterval(null);
        }
        toast({
          title: "Pagamento confirmado!",
          description: "Sua assinatura foi ativada.",
        });
        setLastPaymentStatus(confirmedPayment.status);
      } else if (pendingPayment) {
        setPayments(paymentsList);
        setLastPaymentStatus("PENDING");
      } else if (confirmedPayment) {
        setLastPaymentStatus(confirmedPayment.status);
      }
    } catch (error) {
      console.log("Erro ao verificar status (background):", error);
    }
  };

  const loadSubscription = async () => {
    if (!id) {
      return;
    }

    try {
      setLoading(true);

      const subscriptionResp = await requestJson<Subscription>(
        getApiUrl(`site/asaas/subscriptions/${encodeURIComponent(id)}`),
      );
      setSubscription(subscriptionResp ?? null);

      const paymentsResp = await requestJson<{ data: Payment[] }>(
        getApiUrl(`site/asaas/subscriptions/${encodeURIComponent(id)}/payments`),
      );

      const paymentsList = paymentsResp?.data ?? [];
      setPayments(paymentsList);

      const pendingPayment = paymentsList.find((payment) => payment.status === "PENDING");
      const confirmedPayment = paymentsList.find((payment) =>
        payment.status === "CONFIRMED" || payment.status === "RECEIVED",
      );

      if (confirmedPayment) {
        setLastPaymentStatus(confirmedPayment.status);
      } else if (pendingPayment) {
        setLastPaymentStatus("PENDING");
      }

      if (pendingPayment) {
        if (pendingPayment.billingType === "PIX") {
          loadPixQrCode(pendingPayment.id);
        } else if (pendingPayment.billingType === "BOLETO") {
          loadBoletoCode(pendingPayment.id);
        }
      } else {
        setPixQrCode(null);
        setBoletoCode(null);
      }
    } catch (error: any) {
      toast({
        title: "Erro ao carregar assinatura",
        description: error?.message ?? "Não foi possível carregar os dados.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadPixQrCode = async (paymentId: string) => {
    try {
      const data = await requestJson<PixQRCode>(
        getApiUrl(`site/asaas/payments/${encodeURIComponent(paymentId)}/pix`),
      );
      setPixQrCode(data);
    } catch {
      setPixQrCode(null);
    }
  };

  const loadBoletoCode = async (paymentId: string) => {
    try {
      const data = await requestJson<{ identificationField: string }>(
        getApiUrl(`site/asaas/payments/${encodeURIComponent(paymentId)}/boleto`),
      );
      setBoletoCode(data?.identificationField ?? null);
    } catch {
      setBoletoCode(null);
    }
  };

  const copyToClipboard = (value: string) => {
    navigator.clipboard.writeText(value);
    setCopiedPayload(true);
    toast({
      title: "Copiado!",
      description: "Conteúdo copiado para a área de transferência.",
    });
    setTimeout(() => setCopiedPayload(false), 2000);
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      ACTIVE: "bg-green-500",
      INACTIVE: "bg-gray-500",
      EXPIRED: "bg-red-500",
      PENDING: "bg-yellow-500",
      RECEIVED: "bg-green-500",
      CONFIRMED: "bg-green-500",
      OVERDUE: "bg-red-500",
    };
    return colors[status] ?? "bg-gray-500";
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      ACTIVE: "Ativa",
      INACTIVE: "Inativa",
      EXPIRED: "Expirada",
      PENDING: "Pendente",
      RECEIVED: "Recebido",
      CONFIRMED: "Confirmado",
      OVERDUE: "Atrasado",
    };
    return labels[status] ?? status;
  };

  const formatCurrency = (value: number) => {
    const normalized = typeof value === "number" ? value : Number(value);
    return Number.isFinite(normalized)
      ? normalized.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
      : "R$ 0,00";
  };

  const formatDate = (input: string) => {
    const date = new Date(input);
    return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString("pt-BR");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-bold">Assinatura não encontrada</h2>
          <Button onClick={() => navigate("/plans")}>Voltar para Planos</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        <Button variant="ghost" onClick={() => navigate("/plans")} className="mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <Card className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h1 className="text-2xl font-bold mb-2">{subscription.description}</h1>
                  <Badge className={getStatusColor(subscription.status)}>
                    {getStatusLabel(subscription.status)}
                  </Badge>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold">{formatCurrency(subscription.value)}</div>
                  <div className="text-sm text-muted-foreground">
                    {subscription.cycle === "MONTHLY" ? "por mês" : "por ano"}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-6">
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Próximo vencimento</div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <span className="font-medium">{formatDate(subscription.nextDueDate)}</span>
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Forma de pagamento</div>
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4" />
                    <span className="font-medium">{subscription.billingType}</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-4 mt-6">
                {subscription.billingType === "CREDIT_CARD" && (
                  <UpdateCardDialog subscriptionId={subscription.id} onUpdate={loadSubscription} />
                )}
                <UpdatePlanDialog subscription={subscription} onUpdate={loadSubscription} />
              </div>
            </Card>

            <Card className="p-6">
              <Tabs defaultValue={pixQrCode ? "pix" : boletoCode ? "boleto" : "payments"}>
                <TabsList className="w-full">
                  {pixQrCode && <TabsTrigger value="pix" className="flex-1">Pagar com PIX</TabsTrigger>}
                  {boletoCode && <TabsTrigger value="boleto" className="flex-1">Boleto</TabsTrigger>}
                  <TabsTrigger value="payments" className="flex-1">Cobranças</TabsTrigger>
                </TabsList>

                <TabsContent value="payments" className="space-y-4 mt-4">
                  {payments.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">Nenhuma cobrança encontrada</p>
                  ) : (
                    payments.map((payment) => (
                      <div
                        key={payment.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div>
                          <div className="font-medium">{payment.description}</div>
                          <div className="text-sm text-muted-foreground">
                            Vencimento: {formatDate(payment.dueDate)}
                          </div>
                          <Badge className={`${getStatusColor(payment.status)} mt-2`}>
                            {getStatusLabel(payment.status)}
                          </Badge>
                        </div>
                        <div className="text-right">
                          <div className="font-bold">{formatCurrency(payment.value)}</div>
                          {payment.invoiceUrl && (
                            <Button
                              variant="link"
                              size="sm"
                              className="p-0 h-auto"
                              onClick={() => window.open(payment.invoiceUrl ?? "", "_blank")}
                            >
                              <Download className="w-3 h-3 mr-1" />
                              Fatura
                            </Button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </TabsContent>

                {pixQrCode && (
                  <TabsContent value="pix" className="space-y-4 mt-4">
                    <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 mb-4">
                      <p className="text-sm font-medium text-center">
                        ⏱️ Status será atualizado automaticamente após o pagamento
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground mb-4">
                        Escaneie o QR Code ou copie o código PIX para pagar
                      </p>
                      <div className="flex justify-center mb-4">
                        <img
                          src={`data:image/png;base64,${pixQrCode.encodedImage}`}
                          alt="QR Code PIX"
                          className="w-64 h-64 border rounded-lg"
                        />
                      </div>
                      <div className="bg-muted p-4 rounded-lg mb-4">
                        <div className="text-xs text-muted-foreground mb-2">Código PIX Copia e Cola</div>
                        <div className="font-mono text-xs break-all">{pixQrCode.payload}</div>
                      </div>
                      <Button onClick={() => copyToClipboard(pixQrCode.payload)} className="w-full">
                        {copiedPayload ? (
                          <>
                            <Check className="w-4 h-4 mr-2" />
                            Copiado!
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4 mr-2" />
                            Copiar código PIX
                          </>
                        )}
                      </Button>
                      <p className="text-xs text-muted-foreground mt-4">
                        Válido até: {new Date(pixQrCode.expirationDate).toLocaleString("pt-BR")}
                      </p>
                    </div>
                  </TabsContent>
                )}

                {boletoCode && (
                  <TabsContent value="boleto" className="space-y-4 mt-4">
                    <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 mb-4">
                      <p className="text-sm font-medium text-center">
                        ⏱️ Status será atualizado automaticamente após o pagamento (1-2 dias úteis)
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground mb-4">
                        Copie o código de barras para pagar
                      </p>
                      <div className="bg-muted p-4 rounded-lg mb-4">
                        <div className="text-xs text-muted-foreground mb-2">Código de Barras</div>
                        <div className="font-mono text-sm">{boletoCode}</div>
                      </div>
                      <Button onClick={() => copyToClipboard(boletoCode)} className="w-full">
                        <Copy className="w-4 h-4 mr-2" />
                        Copiar código de barras
                      </Button>
                    </div>
                  </TabsContent>
                )}
              </Tabs>
            </Card>
          </div>

          <div>
            <Card className="p-6 sticky top-4">
              <h3 className="font-semibold mb-4">Informações da Assinatura</h3>
              <div className="space-y-3 text-sm">
                <div>
                  <div className="text-muted-foreground mb-1">ID da Assinatura</div>
                  <div className="font-mono text-xs break-all">{subscription.id}</div>
                </div>
                <div>
                  <div className="text-muted-foreground mb-1">Data de criação</div>
                  <div>{formatDate(subscription.dateCreated)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground mb-1">Cliente</div>
                  <div className="font-mono text-xs break-all">{subscription.customer}</div>
                </div>
                {subscription.externalReference && (
                  <div>
                    <div className="text-muted-foreground mb-1">Referência</div>
                    <div className="font-mono text-xs break-all">{subscription.externalReference}</div>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionDetails;
