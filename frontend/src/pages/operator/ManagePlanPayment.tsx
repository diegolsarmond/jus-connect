import { useMemo, useState, useCallback, useEffect, useRef, type ChangeEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  Copy,
  Loader2,
  QrCode,
  Receipt,
  ShieldCheck,
  Wallet,
} from "lucide-react";

import { routes } from "@/config/routes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/components/ui/use-toast";
import { createPlanPayment, PlanPaymentMethod, PlanPaymentResult } from "@/features/plans/api";
import { useAuth } from "@/features/auth/AuthProvider";
import { getApiUrl } from "@/lib/api";
import { fetchFlows, tokenizeCard, type CardTokenPayload, type Flow } from "@/lib/flows";
import {
  clearPersistedManagePlanSelection,
  getPersistedManagePlanSelection,
  persistManagePlanSelection,
  type ManagePlanSelection,
  type PricingMode,
} from "@/features/plans/managePlanPaymentStorage";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" });

const getFormattedPrice = (display: string | null, numeric: number | null) => {
  if (typeof display === "string" && display.trim().length > 0) {
    return display;
  }

  if (typeof numeric === "number" && Number.isFinite(numeric)) {
    return currencyFormatter.format(numeric);
  }

  return null;
};

const sanitizeDigits = (value: string): string => value.replace(/\D+/g, "");

const formatCpfCnpj = (value: string): string => {
  const digits = sanitizeDigits(value).slice(0, 14);

  if (digits.length <= 11) {
    if (digits.length <= 3) {
      return digits;
    }

    if (digits.length <= 6) {
      return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    }

    if (digits.length <= 9) {
      return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    }

    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  }

  if (digits.length <= 2) {
    return digits;
  }

  if (digits.length <= 5) {
    return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  }

  if (digits.length <= 8) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  }

  if (digits.length <= 12) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  }

  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
};

type CardFormState = {
  holderName: string;
  holderEmail: string;
  document: string;
  number: string;
  expiryMonth: string;
  expiryYear: string;
  cvv: string;
  phone: string;
  postalCode: string;
  addressNumber: string;
  addressComplement: string;
};

type CardFormErrors = Partial<Record<keyof CardFormState, string>>;

const initialCardFormState: CardFormState = {
  holderName: "",
  holderEmail: "",
  document: "",
  number: "",
  expiryMonth: "",
  expiryYear: "",
  cvv: "",
  phone: "",
  postalCode: "",
  addressNumber: "",
  addressComplement: "",
};

const flowStatusLabels: Record<Flow["status"], string> = {
  pendente: "Pendente",
  pago: "Pago",
  estornado: "Estornado",
};

const formatDateLabel = (value: string | null | undefined): string => {
  if (!value) {
    return "—";
  }

  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return value;
  }

  return dateFormatter.format(new Date(timestamp));
};

const isValidCardNumber = (digits: string): boolean => {
  let sum = 0;
  let shouldDouble = false;

  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let value = Number.parseInt(digits.charAt(index), 10);
    if (Number.isNaN(value)) {
      return false;
    }

    if (shouldDouble) {
      value *= 2;
      if (value > 9) {
        value -= 9;
      }
    }

    sum += value;
    shouldDouble = !shouldDouble;
  }

  return sum % 10 === 0;
};

const parseExpiryYear = (value: string): number | null => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (/^\d{2}$/.test(trimmed)) {
    return 2000 + Number.parseInt(trimmed, 10);
  }

  if (/^\d{4}$/.test(trimmed)) {
    return Number.parseInt(trimmed, 10);
  }

  return null;
};

const validateCardForm = (form: CardFormState): CardFormErrors => {
  const errors: CardFormErrors = {};

  if (!form.holderName.trim()) {
    errors.holderName = "Informe o nome impresso no cartão.";
  }

  if (!form.holderEmail.trim() || !form.holderEmail.includes("@")) {
    errors.holderEmail = "Informe um e-mail válido.";
  }

  if (sanitizeDigits(form.document).length < 11) {
    errors.document = "Informe um CPF ou CNPJ válido.";
  }

  const cardDigits = sanitizeDigits(form.number);
  if (cardDigits.length < 13 || !isValidCardNumber(cardDigits)) {
    errors.number = "Informe um número de cartão válido.";
  }

  const month = Number.parseInt(form.expiryMonth, 10);
  if (!Number.isFinite(month) || month < 1 || month > 12) {
    errors.expiryMonth = "Mês inválido.";
  }

  const parsedYear = parseExpiryYear(form.expiryYear);
  if (parsedYear === null) {
    errors.expiryYear = "Ano inválido.";
  }

  if (!errors.expiryMonth && !errors.expiryYear && Number.isFinite(month) && parsedYear !== null) {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    if (parsedYear < currentYear || (parsedYear === currentYear && month < currentMonth)) {
      errors.expiryMonth = "Validade expirada.";
      errors.expiryYear = "Validade expirada.";
    }
  }

  const cvvLength = sanitizeDigits(form.cvv).length;
  if (cvvLength < 3 || cvvLength > 4) {
    errors.cvv = "Código de segurança inválido.";
  }

  if (sanitizeDigits(form.phone).length < 8) {
    errors.phone = "Informe um telefone válido.";
  }

  if (sanitizeDigits(form.postalCode).length < 8) {
    errors.postalCode = "Informe um CEP válido.";
  }

  if (!form.addressNumber.trim()) {
    errors.addressNumber = "Informe o número do endereço.";
  }

  return errors;
};

const extractCompanyRecord = (input: unknown): Record<string, unknown> | null => {
  if (Array.isArray(input)) {
    const candidate = input.find((item) => item && typeof item === "object");
    return (candidate as Record<string, unknown> | undefined) ?? null;
  }

  if (input && typeof input === "object") {
    const record = input as Record<string, unknown>;
    const rows = (record as { rows?: unknown }).rows;
    if (Array.isArray(rows)) {
      const candidate = rows.find((item) => item && typeof item === "object");
      if (candidate) {
        return candidate as Record<string, unknown>;
      }
    }

    const data = (record as { data?: unknown }).data;
    if (Array.isArray(data)) {
      const candidate = data.find((item) => item && typeof item === "object");
      if (candidate) {
        return candidate as Record<string, unknown>;
      }
    }

    if (data && typeof data === "object") {
      const nestedRows = (data as { rows?: unknown }).rows;
      if (Array.isArray(nestedRows)) {
        const candidate = nestedRows.find((item) => item && typeof item === "object");
        if (candidate) {
          return candidate as Record<string, unknown>;
        }
      }
    }

    return record;
  }

  return null;
};

const normalizeString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const getFirstString = (record: Record<string, unknown>, keys: string[]): string | null => {
  for (const key of keys) {
    const value = normalizeString(record[key]);
    if (value) {
      return value;
    }
  }

  return null;
};

const PAYMENT_METHOD_LABELS: Record<"PIX" | "BOLETO" | "CREDIT_CARD" | "DEBIT_CARD", string> = {
  PIX: "PIX empresarial",
  BOLETO: "Boleto bancário",
  CREDIT_CARD: "Cartão corporativo",
  DEBIT_CARD: "Cartão corporativo (débito)",
};

const ManagePlanPayment = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const selectionFromLocation = (location.state ?? {}) as ManagePlanSelection;
  const [cachedSelection, setCachedSelection] = useState<ManagePlanSelection>(() =>
    getPersistedManagePlanSelection(),
  );
  const lastPersistedRef = useRef<{ planId: number | null; pricingMode?: PricingMode }>({
    planId: null,
    pricingMode: undefined,
  });
  const locationPlanId = selectionFromLocation.plan?.id ?? null;
  const locationPricingMode = selectionFromLocation.pricingMode;

  useEffect(() => {
    if (!selectionFromLocation.plan) {
      return;
    }

    const hasChanged =
      lastPersistedRef.current.planId !== locationPlanId ||
      lastPersistedRef.current.pricingMode !== locationPricingMode;

    if (!hasChanged) {
      return;
    }

    const nextSelection: ManagePlanSelection = {
      plan: selectionFromLocation.plan,
      pricingMode: selectionFromLocation.pricingMode,
    };

    lastPersistedRef.current = {
      planId: locationPlanId,
      pricingMode: locationPricingMode,
    };

    setCachedSelection(nextSelection);
    persistManagePlanSelection(nextSelection);
  }, [locationPlanId, locationPricingMode, selectionFromLocation.plan]);

  const selection = selectionFromLocation.plan ? selectionFromLocation : cachedSelection;
  const selectedPlan = selection.plan ?? null;
  const selectedPlanId = selectedPlan?.id ?? null;
  const pricingMode: PricingMode = selection.pricingMode ?? "mensal";
  const { toast } = useToast();
  const { user, refreshUser } = useAuth();
  const [paymentMethod, setPaymentMethod] = useState<PlanPaymentMethod>("pix");
  const [companyName, setCompanyName] = useState("");
  const [companyDocument, setCompanyDocument] = useState("");
  const [billingEmail, setBillingEmail] = useState("");
  const [billingNotes, setBillingNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTokenizingCard, setIsTokenizingCard] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentResult, setPaymentResult] = useState<PlanPaymentResult | null>(null);
  const [cardForm, setCardForm] = useState<CardFormState>(() => ({ ...initialCardFormState }));
  const [cardErrors, setCardErrors] = useState<CardFormErrors>({});
  const [autoChargeConfirmed, setAutoChargeConfirmed] = useState(false);
  const [history, setHistory] = useState<Flow[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  useEffect(() => {
    if (paymentResult || !selectedPlanId) {
      return;
    }

    const controller = new AbortController();
    let isMounted = true;

    const loadCurrentPayment = async () => {
      try {
        const response = await fetch(getApiUrl("plan-payments/current"), {
          headers: { Accept: "application/json" },
          credentials: "include",
          signal: controller.signal,
        });

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as unknown;

        if (!isMounted) {
          return;
        }

        if (!payload || typeof payload !== "object") {
          return;
        }

        const data = payload as PlanPaymentResult;
        const planData = data.plan ?? null;
        if (planData && planData.id !== null && planData.id !== selectedPlanId) {
          return;
        }

        setPaymentResult(data);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
      }
    };

    loadCurrentPayment();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [paymentResult, selectedPlanId]);

  useEffect(() => {
    if (!user?.empresa_id) {
      return;
    }

    const controller = new AbortController();
    let isMounted = true;

    const loadBillingData = async () => {
      try {
        const response = await fetch(getApiUrl(`empresas/${user.empresa_id}`), {
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Falha ao carregar empresa (HTTP ${response.status})`);
        }

        const payload = await response.json();
        if (!isMounted) {
          return;
        }

        const record = extractCompanyRecord(payload);
        if (!record) {
          return;
        }

        const resolvedName = getFirstString(record, [
          "razao_social",
          "razaoSocial",
          "nome_empresa",
          "nomeEmpresa",
          "nome",
        ]);
        if (resolvedName) {
          setCompanyName((previous) => (previous.trim().length > 0 ? previous : resolvedName));
        }

        const resolvedDocument = getFirstString(record, [
          "cnpj",
          "documento",
          "document",
          "cnpj_cpf",
          "cpf_cnpj",
        ]);
        if (resolvedDocument) {
          setCompanyDocument((previous) =>
            previous.trim().length > 0 ? previous : formatCpfCnpj(resolvedDocument),
          );
        }

        const resolvedEmail = getFirstString(record, [
          "email_cobranca",
          "emailCobranca",
          "billingEmail",
          "email_billing",
          "email_financeiro",
          "emailFinanceiro",
          "email",
        ]);
        if (resolvedEmail) {
          setBillingEmail((previous) => (previous.trim().length > 0 ? previous : resolvedEmail));
        }
      } catch (loadError) {
        if (controller.signal.aborted) {
          return;
        }

        console.error("Erro ao carregar dados de faturamento da empresa", loadError);
        toast({
          title: "Não foi possível carregar os dados da empresa",
          description: "Preencha manualmente os campos de faturamento para continuar.",
          variant: "destructive",
        });
      }
    };

    void loadBillingData();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [toast, user?.empresa_id]);

  useEffect(() => {
    if (!selectedPlan) {
      setHistory([]);
      setHistoryError(null);
      setIsHistoryLoading(false);
      return;
    }

    let isActive = true;

    const loadHistory = async () => {
      setIsHistoryLoading(true);
      setHistoryError(null);
      try {
        const flows = await fetchFlows();
        if (!isActive) {
          return;
        }

        const planFlows = flows.filter((flow) =>
          flow.descricao.toLowerCase().includes("assinatura"),
        );
        setHistory(planFlows);
      } catch (historyLoadError) {
        if (!isActive) {
          return;
        }

        console.error("Erro ao carregar histórico de pagamentos do plano", historyLoadError);
        setHistoryError("Não foi possível carregar o histórico de pagamentos.");
      } finally {
        if (isActive) {
          setIsHistoryLoading(false);
        }
      }
    };

    void loadHistory();

    return () => {
      isActive = false;
    };
  }, [selectedPlan]);

  useEffect(() => {
    if (paymentMethod !== "cartao") {
      setAutoChargeConfirmed(false);
    }
  }, [paymentMethod]);

  const formattedPrice = useMemo(() => {
    if (!selectedPlan) {
      return null;
    }

    return pricingMode === "anual"
      ? getFormattedPrice(selectedPlan.precoAnual, selectedPlan.valorAnual)
      : getFormattedPrice(selectedPlan.precoMensal, selectedPlan.valorMensal);
  }, [pricingMode, selectedPlan]);

  const alternatePrice = useMemo(() => {
    if (!selectedPlan) {
      return null;
    }

    return pricingMode === "anual"
      ? getFormattedPrice(selectedPlan.precoMensal, selectedPlan.valorMensal)
      : getFormattedPrice(selectedPlan.precoAnual, selectedPlan.valorAnual);
  }, [pricingMode, selectedPlan]);

  const planPaymentHistory = useMemo(() => {
    const sorted = [...history].sort((a, b) => {
      const timeA = Date.parse(a.vencimento);
      const timeB = Date.parse(b.vencimento);

      if (Number.isNaN(timeA) && Number.isNaN(timeB)) {
        return 0;
      }

      if (Number.isNaN(timeA)) {
        return 1;
      }

      if (Number.isNaN(timeB)) {
        return -1;
      }

      return timeB - timeA;
    });

    return sorted.slice(0, 5);
  }, [history]);

  const cadenceLabel = pricingMode === "anual" ? "ano" : "mês";
  const alternateCadence = pricingMode === "anual" ? "mês" : "ano";
  const features = selectedPlan?.recursos ?? [];

  const handleResetCardForm = useCallback(() => {
    setCardForm({ ...initialCardFormState });
    setCardErrors({});
    setAutoChargeConfirmed(false);
  }, []);

  const handlePaymentMethodChange = useCallback((value: string) => {
    if (value === "pix" || value === "boleto" || value === "cartao" || value === "debito") {
      setPaymentMethod(value as PlanPaymentMethod);
      setError(null);
      setCardErrors({});
    }
  }, []);

  const handleCardFormChange = useCallback((field: keyof CardFormState, transform?: (value: string) => string) => {
    return (event: ChangeEvent<HTMLInputElement>) => {
      const rawValue = event.target.value;
      const nextValue = transform ? transform(rawValue) : rawValue;
      setCardForm((previous) => ({ ...previous, [field]: nextValue }));
      setCardErrors((previous) => {
        if (!previous[field]) {
          return previous;
        }
        const { [field]: _removed, ...rest } = previous;
        return rest;
      });
    };
  }, []);

  const handleEditCard = useCallback(() => {
    setPaymentMethod("cartao");
    handleResetCardForm();
    setPaymentResult(null);
    setError(null);
  }, [handleResetCardForm]);

  const pixPayload = paymentResult?.charge.pixPayload ?? null;
  const pixQrCodeRaw = paymentResult?.charge.pixQrCode ?? null;
  const boletoLink = paymentResult?.charge.boletoUrl ?? paymentResult?.charge.invoiceUrl ?? null;

  const pixImageSrc = useMemo(() => {
    if (!pixQrCodeRaw) {
      return null;
    }
    return pixQrCodeRaw.startsWith("data:image") ? pixQrCodeRaw : `data:image/png;base64,${pixQrCodeRaw}`;
  }, [pixQrCodeRaw]);

  const chargeAmountLabel = useMemo(() => {
    if (paymentResult?.charge.amount && Number.isFinite(paymentResult.charge.amount)) {
      return currencyFormatter.format(paymentResult.charge.amount);
    }
    return formattedPrice;
  }, [formattedPrice, paymentResult?.charge.amount]);

  const dueDateLabel = useMemo(() => {
    if (!paymentResult?.charge.dueDate) {
      return null;
    }
    const parsed = new Date(paymentResult.charge.dueDate);
    if (Number.isNaN(parsed.getTime())) {
      return paymentResult.charge.dueDate;
    }
    return new Intl.DateTimeFormat("pt-BR").format(parsed);
  }, [paymentResult?.charge.dueDate]);

  const handleCopy = useCallback(
    async (value: string | null) => {
      if (!value) {
        toast({
          title: "Conteúdo indisponível",
          description: "O Asaas ainda não retornou o código para copiar.",
          variant: "destructive",
        });
        return;
      }

      if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
        toast({
          title: "Copiar não suportado",
          description: "Seu navegador não permite copiar automaticamente.",
          variant: "destructive",
        });
        return;
      }

      try {
        await navigator.clipboard.writeText(value);
        toast({
          title: "Conteúdo copiado",
          description: "Cole o código no aplicativo do seu banco para pagar.",
        });
      } catch (copyError) {
        toast({
          title: "Erro ao copiar",
          description:
            copyError instanceof Error ? copyError.message : "Não foi possível copiar o conteúdo para a área de transferência.",
          variant: "destructive",
        });
      }
    },
    [toast],
  );

  const handleOpenBoleto = useCallback(() => {
    if (!boletoLink) {
      toast({
        title: "Boleto indisponível",
        description: "O Asaas ainda não disponibilizou o boleto para download.",
        variant: "destructive",
      });
      return;
    }

    if (typeof window !== "undefined") {
      window.open(boletoLink, "_blank", "noopener,noreferrer");
    }
  }, [boletoLink, toast]);

  const handleSubmit = useCallback(async () => {
    if (!selectedPlan) {
      return;
    }

    if (!companyName.trim() || !companyDocument.trim() || !billingEmail.trim()) {
      const message = "Preencha razão social, documento e e-mail para gerar a cobrança.";
      setError(message);
      toast({
        title: "Dados obrigatórios",
        description: message,
        variant: "destructive",
      });
      return;
    }

    if (paymentMethod === "cartao" && !autoChargeConfirmed) {
      const message = "Confirme a cobrança automática no cartão para continuar.";
      setError(message);
      toast({
        title: "Confirmação obrigatória",
        description: message,
        variant: "destructive",
      });
      return;
    }

    let cardTokenDetails: { token: string; metadata: Record<string, unknown> } | null = null;

    if (paymentMethod === "cartao") {
      const validation = validateCardForm(cardForm);
      setCardErrors(validation);
      if (Object.values(validation).some(Boolean)) {
        const message = "Verifique os dados do cartão para continuar.";
        toast({
          title: "Dados do cartão incompletos",
          description: message,
          variant: "destructive",
        });
        return;
      }

      const payload: CardTokenPayload = {
        holderName: cardForm.holderName.trim(),
        number: sanitizeDigits(cardForm.number),
        expiryMonth: cardForm.expiryMonth.trim(),
        expiryYear: cardForm.expiryYear.trim(),
        cvv: sanitizeDigits(cardForm.cvv),
        document: sanitizeDigits(cardForm.document),
        email: cardForm.holderEmail.trim(),
        phone: sanitizeDigits(cardForm.phone),
        postalCode: sanitizeDigits(cardForm.postalCode),
        addressNumber: cardForm.addressNumber.trim(),
        addressComplement: cardForm.addressComplement.trim() || undefined,
      };

      try {
        setIsTokenizingCard(true);
        const tokenized = await tokenizeCard(payload);
        cardTokenDetails = {
          token: tokenized.token,
          metadata: {
            brand: tokenized.brand ?? undefined,
            last4Digits: tokenized.last4Digits ?? undefined,
            holderName: payload.holderName,
            holderEmail: payload.email,
            document: payload.document,
            phone: payload.phone,
            postalCode: payload.postalCode,
            addressNumber: payload.addressNumber,
            addressComplement: payload.addressComplement,
          },
        };
      } catch (tokenError) {
        const message =
          tokenError instanceof Error
            ? tokenError.message
            : "Não foi possível validar o cartão informado.";
        setError(message);
        toast({
          title: "Falha ao processar cartão",
          description: message,
          variant: "destructive",
        });
        return;
      } finally {
        setIsTokenizingCard(false);
      }
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const payload = {
        planId: selectedPlan.id,
        pricingMode,
        paymentMethod,
        billing: {
          companyName: companyName.trim(),
          document: sanitizeDigits(companyDocument),
          email: billingEmail.trim(),
          notes: billingNotes.trim() ? billingNotes.trim() : undefined,
        },
        cardToken: cardTokenDetails?.token,
        cardMetadata: cardTokenDetails?.metadata,
      } as const;

      const result = await createPlanPayment(payload);

      setPaymentResult(result);
      toast({
        title: "Cobrança gerada com sucesso",
        description: "Utilize as informações abaixo para concluir o pagamento do plano.",
      });

      await refreshUser();
      navigate(routes.meuPlano, { replace: true });
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : "Não foi possível criar a cobrança no Asaas.";
      setError(message);
      toast({
        title: "Falha ao gerar cobrança",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [
    billingEmail,
    billingNotes,
    cardForm,
    companyDocument,
    companyName,
    autoChargeConfirmed,
    paymentMethod,
    pricingMode,
    selectedPlan,
    navigate,
    refreshUser,
    toast,
  ]);

  const isCardMethod = paymentMethod === "cartao";
  const isCardFormComplete = !isCardMethod
    ? true
    : Boolean(
        cardForm.holderName.trim() &&
          cardForm.holderEmail.trim() &&
          sanitizeDigits(cardForm.document).length >= 11 &&
          sanitizeDigits(cardForm.number).length >= 13 &&
          cardForm.expiryMonth.trim() &&
          cardForm.expiryYear.trim() &&
          sanitizeDigits(cardForm.cvv).length >= 3 &&
          sanitizeDigits(cardForm.phone).length >= 8 &&
          sanitizeDigits(cardForm.postalCode).length >= 8 &&
          cardForm.addressNumber.trim(),
      );

  const isConfirmDisabled =
    isSubmitting ||
    isTokenizingCard ||
    !companyName.trim() ||
    !companyDocument.trim() ||
    !billingEmail.trim() ||
    !isCardFormComplete ||
    (paymentMethod === "cartao" && !autoChargeConfirmed);

  const handleReturnToPlanSelection = useCallback(() => {
    clearPersistedManagePlanSelection();
    navigate(routes.meuPlano);
  }, [navigate]);

  if (!selectedPlan) {
    return (
      <div className="p-4 sm:p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={handleReturnToPlanSelection}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para planos
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Gerenciar pagamento</h1>
            <p className="text-muted-foreground">
              Escolha um plano primeiro para avançar para a etapa de pagamento.
            </p>
          </div>
        </div>

        <Alert className="border-destructive/40 bg-destructive/10">
          <AlertTitle>Nenhum plano selecionado</AlertTitle>
          <AlertDescription>
            Acesse a tela de planos e selecione a opção desejada para revisar os detalhes de pagamento.
          </AlertDescription>
        </Alert>

        <Button className="rounded-full" onClick={handleReturnToPlanSelection}>
          Escolher um plano
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="ghost" className="w-fit rounded-full" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
        </Button>
      <div className="space-y-1 text-left sm:text-right">
        <h1 className="text-3xl font-bold">Gerenciar pagamento do plano</h1>
        <p className="text-muted-foreground">
          Revise os detalhes do plano escolhido e informe os dados de cobrança para concluir a troca.
        </p>
      </div>
    </div>

    {error && (
      <Alert variant="destructive">
        <AlertTitle>Não foi possível gerar a cobrança</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )}

    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="space-y-6">


          <Card className="rounded-3xl border border-border/60">
            <CardHeader>
              <CardTitle>Forma de pagamento</CardTitle>
              <CardDescription>Escolha o método que será utilizado para efetivar a troca de plano.</CardDescription>
            </CardHeader>
            <CardContent>
              <RadioGroup
                value={paymentMethod}
                onValueChange={handlePaymentMethodChange}
                className="space-y-3"
              >
                <div
                  className={`flex items-center justify-between gap-3 rounded-2xl border p-4 transition ${
                    paymentMethod === "cartao"
                      ? "border-primary/60 bg-primary/5"
                      : "border-border/60 bg-background/80"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <RadioGroupItem id="payment-cartao" value="cartao" />
                    <div>
                      <Label htmlFor="payment-cartao" className="font-medium">
                        Cartão de Crédito
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Pagamento imediato e renovação automática com cobrança recorrente.
                      </p>
                    </div>
                  </div>
                  <CreditCard className="h-5 w-5 text-muted-foreground" />
                </div>

                <div
                  className={`flex items-center justify-between gap-3 rounded-2xl border p-4 transition ${
                    paymentMethod === "boleto"
                      ? "border-primary/60 bg-primary/5"
                      : "border-border/60 bg-background/80"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <RadioGroupItem id="payment-boleto" value="boleto" />
                    <div>
                      <Label htmlFor="payment-boleto" className="font-medium">
                        Boleto Bancário
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Receba o boleto por e-mail após a confirmação.
                      </p>
                    </div>
                  </div>
                  <Receipt className="h-5 w-5 text-muted-foreground" />
                </div>

                <div
                  className={`flex items-center justify-between gap-3 rounded-2xl border p-4 transition ${
                    paymentMethod === "pix"
                      ? "border-primary/60 bg-primary/5"
                      : "border-border/60 bg-background/80"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <RadioGroupItem id="payment-pix" value="pix" />
                    <div>
                      <Label htmlFor="payment-pix" className="font-medium">
                                              PIX QR Code/Copia e Cola
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Chave disponibilizada imediatamente para pagamento.
                      </p>
                    </div>
                  </div>
                  <QrCode className="h-5 w-5 text-muted-foreground" />
                </div>
              </RadioGroup>
            </CardContent>
          </Card>

          {isCardMethod && (
            <Card className="rounded-3xl border border-border/60">
              <CardHeader>
                <CardTitle>Dados do cartão</CardTitle>
                <CardDescription>
                  Informe os dados do cartão corporativo para gerar o token de autorização de cobrança.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="card-holder-name">Nome impresso no cartão</Label>
                    <Input
                      id="card-holder-name"
                      placeholder="Nome completo"
                      value={cardForm.holderName}
                      onChange={handleCardFormChange("holderName")}
                    />
                    {cardErrors.holderName && (
                      <p className="text-xs text-destructive">{cardErrors.holderName}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="card-holder-email">E-mail do portador</Label>
                    <Input
                      id="card-holder-email"
                      type="email"
                      placeholder="nome@empresa.com"
                      value={cardForm.holderEmail}
                      onChange={handleCardFormChange("holderEmail")}
                    />
                    {cardErrors.holderEmail && (
                      <p className="text-xs text-destructive">{cardErrors.holderEmail}</p>
                    )}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="card-document">CPF ou CNPJ do portador</Label>
                    <Input
                      id="card-document"
                      placeholder="000.000.000-00"
                      value={cardForm.document}
                      onChange={handleCardFormChange("document")}
                    />
                    {cardErrors.document && (
                      <p className="text-xs text-destructive">{cardErrors.document}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="card-phone">Telefone de contato</Label>
                    <Input
                      id="card-phone"
                      placeholder="(11) 99999-9999"
                      value={cardForm.phone}
                      onChange={handleCardFormChange("phone")}
                    />
                    {cardErrors.phone && <p className="text-xs text-destructive">{cardErrors.phone}</p>}
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="card-number">Número do cartão</Label>
                    <Input
                      id="card-number"
                      placeholder="0000 0000 0000 0000"
                      value={cardForm.number}
                      onChange={handleCardFormChange("number")}
                    />
                    {cardErrors.number && <p className="text-xs text-destructive">{cardErrors.number}</p>}
                  </div>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="card-expiry-month">Mês</Label>
                      <Input
                        id="card-expiry-month"
                        placeholder="MM"
                        maxLength={2}
                        value={cardForm.expiryMonth}
                        onChange={handleCardFormChange("expiryMonth")}
                      />
                      {cardErrors.expiryMonth && (
                        <p className="text-xs text-destructive">{cardErrors.expiryMonth}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="card-expiry-year">Ano</Label>
                      <Input
                        id="card-expiry-year"
                        placeholder="AA"
                        maxLength={4}
                        value={cardForm.expiryYear}
                        onChange={handleCardFormChange("expiryYear")}
                      />
                      {cardErrors.expiryYear && (
                        <p className="text-xs text-destructive">{cardErrors.expiryYear}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="card-cvv">CVV</Label>
                      <Input
                        id="card-cvv"
                        placeholder="123"
                        maxLength={4}
                        value={cardForm.cvv}
                        onChange={handleCardFormChange("cvv")}
                      />
                      {cardErrors.cvv && <p className="text-xs text-destructive">{cardErrors.cvv}</p>}
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="card-postal-code">CEP de cobrança</Label>
                    <Input
                      id="card-postal-code"
                      placeholder="00000-000"
                      value={cardForm.postalCode}
                      onChange={handleCardFormChange("postalCode")}
                    />
                    {cardErrors.postalCode && (
                      <p className="text-xs text-destructive">{cardErrors.postalCode}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="card-address-number">Número do endereço</Label>
                    <Input
                      id="card-address-number"
                      placeholder="123"
                      value={cardForm.addressNumber}
                      onChange={handleCardFormChange("addressNumber")}
                    />
                    {cardErrors.addressNumber && (
                      <p className="text-xs text-destructive">{cardErrors.addressNumber}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="card-address-complement">Complemento</Label>
                  <Input
                    id="card-address-complement"
                    placeholder="Sala, bloco, referência"
                    value={cardForm.addressComplement}
                    onChange={handleCardFormChange("addressComplement")}
                  />
                </div>

                <p className="text-xs text-muted-foreground">
                  Os dados informados são utilizados apenas para gerar um token seguro junto ao Asaas. O número do cartão não é
                  armazenado pela Jus Connect.
                </p>

                <div className="rounded-2xl border border-border/60 bg-background/80 p-4">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="auto-charge-confirmation"
                      checked={autoChargeConfirmed}
                      onCheckedChange={(checked) => setAutoChargeConfirmed(checked === true)}
                      disabled={isSubmitting || isTokenizingCard}
                    />
                    <div className="space-y-1">
                      <Label htmlFor="auto-charge-confirmation" className="text-sm font-medium">
                        Confirmar cobrança automática
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Autorizo a renovação automática do plano no cartão informado.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="rounded-3xl border border-border/60">
            <CardHeader>
              <CardTitle>Dados de faturamento</CardTitle>
              <CardDescription>Informe as informações que constarão na cobrança emitida.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="company-name">Razão social</Label>
                  <Input
                    id="company-name"
                    placeholder="Nome jurídico da empresa"
                    value={companyName}
                    onChange={(event) => setCompanyName(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company-doc">CPF ou CNPJ</Label>
                  <Input
                    id="company-doc"
                    placeholder="000.000.000-00 ou 00.000.000/0000-00"
                    value={companyDocument}
                    onChange={(event) => setCompanyDocument(formatCpfCnpj(event.target.value))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="billing-email">E-mail para cobrança</Label>
                <Input
                  id="billing-email"
                  type="email"
                  placeholder="financeiro@suaempresa.com"
                  value={billingEmail}
                  onChange={(event) => setBillingEmail(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="billing-notes">Observações adicionais</Label>
                <Textarea
                  id="billing-notes"
                  placeholder="Informe instruções de faturamento ou referências internas."
                  rows={4}
                  value={billingNotes}
                  onChange={(event) => setBillingNotes(event.target.value)}
                />
              </div>
            </CardContent>
                  </Card>

                  <Card className="rounded-3xl border border-border/60">
                      <CardHeader>
                          <CardTitle>Resumo da cobrança</CardTitle>
                          <CardDescription>Confirme os valores antes de concluir a alteração do plano.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-5">
                          <div className="rounded-2xl border border-border/60 bg-background/80 p-4">
                              <div className="flex items-center justify-between text-sm text-muted-foreground">
                                  <span>Plano</span>
                                  <span className="font-semibold text-foreground">{selectedPlan.nome}</span>
                              </div>
                              <Separator className="my-4" />
                              <div className="space-y-3 text-sm">
                                  <div className="flex items-center justify-between">
                                      <span>Assinatura {pricingMode === "anual" ? "anual" : "mensal"}</span>
                                      <span className="font-semibold text-foreground">{formattedPrice ?? "—"}</span>
                                  </div>
                                  {alternatePrice && (
                                      <div className="flex items-center justify-between text-muted-foreground">
                                          <span>Equivalente {alternateCadence}</span>
                                          <span>{alternatePrice}</span>
                                      </div>
                                  )}
                              </div>
                          </div>

                          {pricingMode === "anual" && selectedPlan.economiaAnualFormatada && (
                              <div className="flex items-center justify-between rounded-2xl border border-emerald-200/60 bg-emerald-50 p-4 text-sm text-emerald-700">
                                  <span>Economia estimada no ano</span>
                                  <span className="font-semibold">{selectedPlan.economiaAnualFormatada}</span>
                              </div>
                          )}

                          <div className="rounded-2xl border border-border/60 bg-background/80 p-4 text-sm text-muted-foreground">
                              <p>
                                  Após a confirmação, o novo plano será ativado automaticamente e um comprovante será enviado ao e-mail
                                  cadastrado.
                              </p>
                              <p className="mt-3 flex items-center gap-2 text-emerald-600">
                                  <ShieldCheck className="h-4 w-4" />
                                  Transação protegida com segurança bancária.
                              </p>
                          </div>
                      </CardContent>
                      <CardFooter className="flex flex-col gap-2">
                          <Button
                              size="lg"
                              className="w-full rounded-full"
                              onClick={handleSubmit}
                              disabled={isConfirmDisabled}
                          >
                              {isSubmitting || isTokenizingCard ? (
                                  <span className="flex items-center justify-center gap-2">
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                      {isTokenizingCard ? "Validando cartão…" : "Processando…"}
                                  </span>
                              ) : (
                                  "Confirmar alteração de plano"
                              )}
                          </Button>
                          <Button
                              variant="outline"
                              className="w-full rounded-full"
                              onClick={handleReturnToPlanSelection}
                              disabled={isSubmitting}
                          >
                              Cancelar e voltar
                          </Button>
                      </CardFooter>
                  </Card>
        </div>

        <div className="space-y-6">

                  <Card className="rounded-3xl border border-primary/20 bg-primary/5">
                      <CardHeader className="flex flex-col gap-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                              <div>
                                  <Badge className="rounded-full bg-primary/20 text-primary">Plano selecionado</Badge>
                                  <CardTitle className="mt-2 text-2xl">{selectedPlan.nome}</CardTitle>
                                  <CardDescription>
                                      Revise os benefícios incluídos antes de confirmar a alteração do plano.
                                  </CardDescription>
                              </div>
                              {formattedPrice && (
                                  <div className="rounded-2xl bg-white/70 px-5 py-3 text-center shadow-sm">
                                      <p className="text-xs font-medium uppercase tracking-wider text-primary/70">
                                          {pricingMode === "anual" ? "Cobrança anual" : "Cobrança mensal"}
                                      </p>
                                      <p className="text-3xl font-semibold text-primary">{formattedPrice}</p>
                                      <p className="text-xs text-muted-foreground">por {cadenceLabel}</p>
                                      {alternatePrice && (
                                          <p className="mt-1 text-[11px] text-muted-foreground">
                                              equivalente a {alternatePrice} por {alternateCadence}
                                          </p>
                                      )}
                                  </div>
                              )}
                          </div>
                      </CardHeader>
                      <CardContent className="space-y-6">
                          {selectedPlan.descricao && (
                              <div className="rounded-2xl bg-white/70 p-4 text-sm text-slate-700 shadow-sm">
                                  {selectedPlan.descricao}
                              </div>
                          )}
                          <div className="space-y-3">
                              <p className="text-sm font-semibold uppercase tracking-wide text-primary/80">
                                  Principais recursos inclusos
                              </p>
                              <div className="grid gap-3 md:grid-cols-2">
                                  {features.length > 0 ? (
                                      features.slice(0, 6).map((feature) => (
                                          <div
                                              key={feature}
                                              className="flex items-start gap-3 rounded-2xl border border-primary/20 bg-white/80 p-3 text-sm text-slate-700"
                                          >
                                              <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                                              <span>{feature}</span>
                                          </div>
                                      ))
                                  ) : (
                                      <div className="rounded-2xl border border-dashed border-primary/30 bg-white/50 p-4 text-sm text-muted-foreground">
                                          Nenhum recurso foi listado para este plano ainda.
                                      </div>
                                  )}
                              </div>
                          </div>
                      </CardContent>
                  </Card>






                  

          {paymentResult && (
            <Card className="rounded-3xl border border-primary/30 bg-primary/5">
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <CardTitle>Instruções de pagamento</CardTitle>
                  {paymentResult.charge.status && (
                    <Badge className="rounded-full border border-primary/40 bg-white/90 text-primary">
                      {paymentResult.charge.status}
                    </Badge>
                  )}
                </div>
                <CardDescription>
                  Utilize as informações abaixo para concluir o pagamento via {PAYMENT_METHOD_LABELS[paymentResult.paymentMethod]}.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2 rounded-2xl border border-primary/20 bg-white/80 p-4 text-sm text-slate-700">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Método selecionado</span>
                    <span className="font-semibold text-primary">
                      {PAYMENT_METHOD_LABELS[paymentResult.paymentMethod]}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Valor da cobrança</span>
                    <span className="font-semibold text-primary">{chargeAmountLabel ?? "—"}</span>
                  </div>
                  {dueDateLabel && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Vencimento</span>
                      <span className="font-medium text-foreground">{dueDateLabel}</span>
                    </div>
                  )}
                </div>

                {paymentResult.paymentMethod === "PIX" ? (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h3 className="text-sm font-semibold text-primary">Código PIX copia e cola</h3>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => handleCopy(pixPayload)}
                      >
                        <Copy className="h-4 w-4" /> Copiar código
                      </Button>
                    </div>
                    <div className="rounded-2xl border border-primary/20 bg-white/90 p-3 text-sm text-muted-foreground break-all">
                      {pixPayload ?? "O Asaas ainda está gerando o código PIX."}
                    </div>
                    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-primary/30 bg-white/80 p-4">
                      {pixImageSrc ? (
                        <img src={pixImageSrc} alt="QR Code PIX" className="h-40 w-40" />
                      ) : (
                        <p className="text-sm text-muted-foreground">QR Code ainda não disponível.</p>
                      )}
                      <p className="text-xs text-muted-foreground text-center">
                        Escaneie o código ou utilize o copiar e colar para realizar o pagamento.
                      </p>
                    </div>
                  </div>
                ) : paymentResult.paymentMethod === "BOLETO" ? (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Enviamos o boleto para {billingEmail || "o e-mail cadastrado"}. Você também pode abrir o documento abaixo.
                    </p>
                    <Button type="button" className="w-full rounded-full" onClick={handleOpenBoleto}>
                      <Receipt className="mr-2 h-4 w-4" /> Abrir boleto
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-start gap-3 rounded-2xl border border-primary/20 bg-white/90 p-4">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-primary">Cobrança automática confirmada</p>
                        <p className="text-sm text-muted-foreground">
                          As próximas renovações serão debitadas automaticamente no cartão confirmado abaixo.
                        </p>
                      </div>
                    </div>

                    {(paymentResult.charge.cardBrand || paymentResult.charge.cardLast4) && (
                      <div className="rounded-2xl border border-primary/20 bg-white/80 p-4 text-sm text-slate-700">
                        <p className="font-medium text-primary">
                          {paymentResult.charge.cardBrand ?? "Cartão"}
                          {paymentResult.charge.cardLast4 ? ` •••• ${paymentResult.charge.cardLast4}` : ""}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          A renovação ocorrerá automaticamente até que um novo cartão seja cadastrado.
                        </p>
                      </div>
                    )}

                    <Button type="button" variant="outline" className="w-full rounded-full" onClick={handleEditCard}>
                      Trocar dados do cartão
                    </Button>
                  </div>
                )}

                <Alert className="border-primary/30 bg-primary/5 text-primary">
                  <AlertTitle>Após o pagamento</AlertTitle>
                  <AlertDescription>
                    Assim que o Asaas confirmar o recebimento nós atualizaremos automaticamente o seu plano e enviaremos o comprovante para {billingEmail || "o e-mail cadastrado"}.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          )}

          <Card className="rounded-3xl border border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle>Próximos passos</CardTitle>
              <CardDescription>Acompanhe o status da troca de plano na área de assinaturas.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-slate-700">
              <div className="flex items-start gap-3">
                <Wallet className="mt-0.5 h-4 w-4 text-primary" />
                <div>
                  <p className="font-semibold">Confirmação do pagamento</p>
                  <p>Assim que o pagamento for aprovado, atualizaremos automaticamente o seu plano.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-4 w-4 text-primary" />
                <div>
                  <p className="font-semibold">Recibos e notas</p>
                  <p>Os documentos fiscais serão enviados por e-mail e ficarão disponíveis para download.</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border border-border/60">
            <CardHeader>
              <CardTitle>Histórico de pagamentos</CardTitle>
              <CardDescription>Consulte as últimas cobranças registradas para o plano.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {historyError ? (
                <Alert variant="destructive">
                  <AlertTitle>Não foi possível carregar o histórico</AlertTitle>
                  <AlertDescription>{historyError}</AlertDescription>
                </Alert>
              ) : isHistoryLoading ? (
                <p className="text-sm text-muted-foreground">Carregando histórico…</p>
              ) : planPaymentHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhuma cobrança de plano foi encontrada nos registros recentes.
                </p>
              ) : (
                <div className="space-y-3">
                  {planPaymentHistory.map((flow) => (
                    <div
                      key={flow.id}
                      className="rounded-2xl border border-border/60 bg-white/80 p-4 shadow-sm"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-foreground">{flow.descricao}</p>
                          <p className="text-xs text-muted-foreground">
                            Vencimento {formatDateLabel(flow.vencimento)} • {currencyFormatter.format(flow.valor)}
                          </p>
                        </div>
                        <Badge variant="outline" className="rounded-full border-primary/30 text-primary">
                          {flowStatusLabels[flow.status]}
                        </Badge>
                      </div>
                      {flow.pagamento && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          Pago em {formatDateLabel(flow.pagamento)}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ManagePlanPayment;
