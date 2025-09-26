import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { format, parseISO, isValid } from 'date-fns';
import {
  AsaasCharge,
  AsaasChargeStatus,
  AsaasPaymentMethod,
  CreateAsaasChargePayload,
  CardTokenPayload,
  CardTokenResponse,
  Flow,
  createAsaasCharge,
  fetchChargeDetails,
  listChargeStatus,
  tokenizeCard,
  fetchCustomerSyncStatus,
  syncCustomerNow,
} from '@/lib/flows';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, RefreshCcw, Clipboard, Send, CreditCard, QrCode } from 'lucide-react';

export type CustomerOption = {
  id: string;
  label: string;
  email?: string;
  document?: string;
  raw: unknown;
};

type CardTokenDetails = {
  token: string;
  brand?: string;
  last4Digits?: string;
  holderName: string;
  holderEmail: string;
  document: string;
  phone: string;
  postalCode: string;
  addressNumber: string;
  addressComplement?: string;
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

const DEFAULT_INSTALLMENT_OPTIONS = [1, 2, 3, 6, 12];
const DIGIT_ONLY_REGEX = /\D+/g;

function sanitizeDigits(value: string): string {
  return value.replace(DIGIT_ONLY_REGEX, '');
}

function isCardPayment(method: AsaasPaymentMethod): boolean {
  return method === 'CREDIT_CARD' || method === 'DEBIT_CARD';
}

function validateCardForm(form: CardFormState): CardFormErrors {
  const errors: CardFormErrors = {};

  if (!form.holderName.trim()) {
    errors.holderName = 'Informe o nome impresso no cartão.';
  }

  if (!form.holderEmail.trim() || !form.holderEmail.includes('@')) {
    errors.holderEmail = 'Informe um e-mail válido.';
  }

  const documentDigits = sanitizeDigits(form.document);
  if (documentDigits.length < 11) {
    errors.document = 'Informe um CPF/CNPJ válido.';
  }

  const cardDigits = sanitizeDigits(form.number);
  if (cardDigits.length < 13) {
    errors.number = 'Número do cartão inválido.';
  }

  if (!form.expiryMonth || Number(form.expiryMonth) < 1 || Number(form.expiryMonth) > 12) {
    errors.expiryMonth = 'Mês inválido.';
  }

  if (!form.expiryYear || form.expiryYear.length < 2) {
    errors.expiryYear = 'Ano inválido.';
  }

  const cvvDigits = sanitizeDigits(form.cvv);
  if (cvvDigits.length < 3 || cvvDigits.length > 4) {
    errors.cvv = 'Código de segurança inválido.';
  }

  const phoneDigits = sanitizeDigits(form.phone);
  if (phoneDigits.length < 8) {
    errors.phone = 'Informe um telefone válido.';
  }

  const postalCodeDigits = sanitizeDigits(form.postalCode);
  if (postalCodeDigits.length < 8) {
    errors.postalCode = 'Informe um CEP válido.';
  }

  if (!form.addressNumber.trim()) {
    errors.addressNumber = 'Informe o número do endereço.';
  }

  return errors;
}

function resolveSyncStatusInfo(status?: string | null): { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' } {
  if (!status) {
    return { label: 'Nunca sincronizado', variant: 'outline' };
  }

  const normalized = status.toLowerCase();

  if (normalized.includes('error') || normalized.includes('erro') || normalized.includes('fail')) {
    return { label: 'Com erro', variant: 'destructive' };
  }

  if (normalized.includes('pending') || normalized.includes('aguard') || normalized.includes('processing')) {
    return { label: 'Pendente', variant: 'outline' };
  }

  if (normalized.includes('sync') || normalized.includes('atualiz') || normalized.includes('ok')) {
    return { label: 'Sincronizado', variant: 'secondary' };
  }

  return { label: status, variant: 'default' };
}

type AsaasChargeDialogProps = {
  flow: Flow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customers: CustomerOption[];
  customersLoading: boolean;
  onChargeCreated: (flowId: number, charge: AsaasCharge) => void;
  onStatusUpdated: (flowId: number, statuses: AsaasChargeStatus[]) => void;
  persistedCharge?: AsaasCharge | null;
  persistedStatuses?: AsaasChargeStatus[];
};

type CardModalState = {
  flow: Flow;
  payload: CreateAsaasChargePayload;
};

export const AsaasChargeDialog = ({
  flow,
  open,
  onOpenChange,
  customers,
  customersLoading,
  onChargeCreated,
  onStatusUpdated,
  persistedCharge = null,
  persistedStatuses = [],
}: AsaasChargeDialogProps) => {
  const { toast } = useToast();
  const currencyFormatter = useMemo(
    () => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }),
    [],
  );
  const formatCurrency = useCallback(
    (value: number | string | null | undefined) =>
      currencyFormatter.format(Number.parseFloat(value ? value.toString() : '0') || 0),
    [currencyFormatter],
  );
  const [customerId, setCustomerId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<AsaasPaymentMethod>('PIX');
  const [installments, setInstallments] = useState<number>(1);
  const [dueDate, setDueDate] = useState('');
  const [lastCharge, setLastCharge] = useState<AsaasCharge | null>(persistedCharge ?? null);
  const [statuses, setStatuses] = useState<AsaasChargeStatus[]>(persistedStatuses ?? []);
  const [cardModalState, setCardModalState] = useState<CardModalState | null>(null);
  const [lastCardDetails, setLastCardDetails] = useState<CardTokenDetails | null>(null);

  useEffect(() => {
    if (open) {
      setLastCharge(persistedCharge ?? null);
      setStatuses(persistedStatuses ?? []);
    }
  }, [open, persistedCharge, persistedStatuses]);

  useEffect(() => {
    if (!open) {
      setCustomerId('');
      setPaymentMethod('PIX');
      setInstallments(1);
      setDueDate('');
      setCardModalState(null);
      setLastCardDetails(null);
    }
  }, [open]);

  useEffect(() => {
    if (paymentMethod === 'PIX' || paymentMethod === 'DEBIT_CARD') {
      setInstallments(1);
    }
  }, [paymentMethod]);

  useEffect(() => {
    if (paymentMethod !== 'BOLETO') {
      setDueDate('');
    }
  }, [paymentMethod]);

  useEffect(() => {
    if (!isCardPayment(paymentMethod)) {
      setLastCardDetails(null);
    }
  }, [paymentMethod]);

  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer.id === customerId),
    [customers, customerId],
  );

  const formatStatusDate = useCallback((value?: string) => {
    if (!value) {
      return null;
    }
    try {
      const parsed = parseISO(value);
      if (!isValid(parsed)) {
        return value;
      }
      return format(parsed, 'dd/MM/yyyy HH:mm');
    } catch (error) {
      return value;
    }
  }, []);

  const formatShortDate = useCallback((value?: string | null) => {
    if (!value) {
      return null;
    }
    try {
      const parsed = parseISO(value);
      if (!isValid(parsed)) {
        return value;
      }
      return format(parsed, 'dd/MM/yyyy');
    } catch (error) {
      return value;
    }
  }, []);

  const chargeDetailsQuery = useQuery({
    queryKey: ['asaas-charge-details', flow?.id],
    queryFn: () => (flow ? fetchChargeDetails(flow.id) : Promise.resolve(null)),
    enabled: Boolean(flow?.id && open),
    onSuccess: (charge) => {
      if (charge && flow) {
        setLastCharge(charge);
        onChargeCreated(flow.id, charge);
      }
    },
    onError: (error: unknown) => {
      toast({
        title: 'Erro ao carregar cobrança',
        description:
          error instanceof Error ? error.message : 'Não foi possível carregar os dados da cobrança.',
        variant: 'destructive',
      });
    },
  });

  const statusQuery = useQuery({
    queryKey: ['asaas-charge-status', flow?.id],
    queryFn: () => (flow ? listChargeStatus(flow.id) : Promise.resolve([])),
    enabled: Boolean(flow?.id && open),
    onSuccess: (data) => {
      if (flow) {
        setStatuses(data);
        onStatusUpdated(flow.id, data);
      }
    },
    onError: (error: unknown) => {
      toast({
        title: 'Erro ao carregar status',
        description:
          error instanceof Error ? error.message : 'Não foi possível carregar o status da cobrança.',
        variant: 'destructive',
      });
    },
  });

  const {
    data: customerSyncStatus,
    refetch: refetchCustomerSyncStatus,
    isFetching: isFetchingCustomerSyncStatus,
  } = useQuery({
    queryKey: ['asaas-customer-status', customerId],
    queryFn: () => (customerId && open ? fetchCustomerSyncStatus(customerId) : Promise.resolve(null)),
    enabled: Boolean(customerId && open),
    staleTime: 1000 * 30,
    onError: (error: unknown) => {
      toast({
        title: 'Erro ao carregar status do cliente',
        description:
          error instanceof Error ? error.message : 'Não foi possível verificar o status do cliente.',
        variant: 'destructive',
      });
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      if (!customerId) {
        throw new Error('Selecione um cliente para sincronizar.');
      }
      return syncCustomerNow(customerId);
    },
    onSuccess: () => {
      toast({
        title: 'Sincronização iniciada',
        description: 'A sincronização com o Asaas foi solicitada.',
      });
      refetchCustomerSyncStatus();
    },
    onError: (error: unknown) => {
      toast({
        title: 'Erro ao sincronizar cliente',
        description: error instanceof Error ? error.message : 'Não foi possível iniciar a sincronização.',
        variant: 'destructive',
      });
    },
  });

  const chargeMutation = useMutation({
    mutationFn: async (payload: CreateAsaasChargePayload) => {
      if (!flow) {
        throw new Error('Fluxo não selecionado.');
      }
      return createAsaasCharge(flow.id, payload);
    },
    onSuccess: (charge) => {
      if (!flow) {
        return;
      }
      setLastCharge(charge);
      onChargeCreated(flow.id, charge);
      toast({
        title: 'Cobrança criada com sucesso',
        description: 'Os dados foram enviados para o Asaas.',
      });
      statusQuery.refetch();
    },
    onError: (error: unknown) => {
      toast({
        title: 'Erro ao criar cobrança',
        description: error instanceof Error ? error.message : 'Não foi possível criar a cobrança.',
        variant: 'destructive',
      });
    },
  });
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!flow) {
      return;
    }

    if (!customerId) {
      toast({
        title: 'Selecione um cliente',
        description: 'É necessário escolher um cliente para gerar a cobrança.',
        variant: 'destructive',
      });
      return;
    }

    const basePayload: CreateAsaasChargePayload = {
      customerId,
      paymentMethod,
      installmentCount:
        paymentMethod === 'PIX' || paymentMethod === 'DEBIT_CARD' ? undefined : installments,
      dueDate: paymentMethod === 'BOLETO' && dueDate ? dueDate : undefined,
    };

    if (isCardPayment(paymentMethod)) {
      setCardModalState({ flow, payload: basePayload });
      return;
    }

    setLastCardDetails(null);
    await chargeMutation.mutateAsync(basePayload);
  };

const handleCardTokenized = async (details: CardTokenDetails) => {
  if (!cardModalState) {
    return;
  }

  await chargeMutation.mutateAsync({
    ...cardModalState.payload,
    cardToken: details.token,
    cardMetadata: {
      brand: details.brand,
      last4Digits: details.last4Digits,
      holderName: details.holderName,
    },
    additionalData: {
      email: details.holderEmail,
      document: details.document,
      phone: details.phone,
      postalCode: details.postalCode,
      addressNumber: details.addressNumber,
      addressComplement: details.addressComplement,
    },
  });
  setLastCardDetails(details);
  setCardModalState(null);
};

  const handleSyncNow = () => {
    if (!customerId) {
      toast({
        title: 'Selecione um cliente',
        description: 'Escolha um cliente para sincronizar com o Asaas.',
        variant: 'destructive',
      });
      return;
    }
    syncMutation.mutate();
  };

  const handleCopy = useCallback(
    async (value: string | undefined) => {
      if (!value) {
        toast({
          title: 'Conteúdo indisponível',
          description: 'O Asaas ainda não retornou os dados necessários.',
          variant: 'destructive',
        });
        return;
      }
      if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
        toast({
          title: 'Copiar não suportado',
          description: 'Seu navegador não permite copiar automaticamente.',
          variant: 'destructive',
        });
        return;
      }

      try {
        await navigator.clipboard.writeText(value);
        toast({
          title: 'Conteúdo copiado',
          description: 'Cole a informação onde desejar.',
        });
      } catch (error) {
        toast({
          title: 'Erro ao copiar',
          description: error instanceof Error ? error.message : 'Não foi possível copiar o conteúdo.',
          variant: 'destructive',
        });
      }
    },
    [toast],
  );

  const handleSendEmail = useCallback(
    (value: string | undefined) => {
      if (!value) {
        toast({
          title: 'Conteúdo indisponível',
          description: 'O Asaas ainda não retornou os dados necessários.',
          variant: 'destructive',
        });
        return;
      }
      if (!selectedCustomer?.email) {
        toast({
          title: 'E-mail não cadastrado',
          description: 'Cadastre um e-mail para o cliente antes de enviar a cobrança.',
          variant: 'destructive',
        });
        return;
      }

      const subject = encodeURIComponent(`Cobrança ${flow?.descricao ?? ''}`);
      const body = encodeURIComponent(
        [
          `Olá ${selectedCustomer.label},`,
          '',
          `Segue o link/código para pagamento do lançamento "${flow?.descricao ?? ''}" no valor de ${formatCurrency(flow?.valor)}.`,
          '',
          value,
          '',
          'Qualquer dúvida estamos à disposição.',
        ].join('\n'),
      );
      window.open(`mailto:${selectedCustomer.email}?subject=${subject}&body=${body}`, '_blank');
      toast({
        title: 'E-mail preparado',
        description: 'Utilize o seu cliente de e-mail para finalizar o envio.',
      });
    },
    [selectedCustomer, flow, toast, formatCurrency],
  );

  const renderCopyActions = (value: string | undefined, copyLabel: string) => (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => handleCopy(value)}>
        <Clipboard className="h-4 w-4" />
        {copyLabel}
      </Button>
      <Button type="button" variant="ghost" size="sm" className="gap-2" onClick={() => handleSendEmail(value)}>
        <Send className="h-4 w-4" />
        Enviar por e-mail
      </Button>
    </div>
  );

  const renderChargeDetails = () => {
    if (!lastCharge) {
      return <p className="text-sm text-muted-foreground">Nenhuma cobrança gerada ainda.</p>;
    }

    if (lastCharge.paymentMethod === 'PIX') {
      return (
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-md border px-3 py-2">
            <QrCode className="h-5 w-5" />
            <div>
              <p className="text-sm font-medium">Pagamento via PIX</p>
              {lastCharge.dueDate ? (
                <p className="text-xs text-muted-foreground">
                  Expira em: {formatShortDate(lastCharge.dueDate)}
                </p>
              ) : null}
            </div>
          </div>
          {lastCharge.pixPayload ? (
            <div className="space-y-2 rounded-md border px-3 py-2">
              <p className="text-sm font-medium">Código copia e cola</p>
              <p className="break-all text-xs text-muted-foreground">{lastCharge.pixPayload}</p>
              {renderCopyActions(lastCharge.pixPayload, 'Copiar código')}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              O Asaas ainda está gerando o código PIX para este lançamento.
            </p>
          )}
        </div>
      );
    }

    if (lastCharge.paymentMethod === 'BOLETO') {
      return (
        <div className="space-y-3">
          {lastCharge.boletoUrl ? (
            <div className="space-y-1 rounded-md border px-3 py-2">
              <p className="text-sm font-medium">Link do boleto</p>
              <a
                href={lastCharge.boletoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="break-all text-sm text-primary"
              >
                {lastCharge.boletoUrl}
              </a>
              {renderCopyActions(lastCharge.boletoUrl, 'Copiar link')}
            </div>
          ) : null}
          {lastCharge.boletoBarcode ? (
            <div className="space-y-1 rounded-md border px-3 py-2">
              <p className="text-sm font-medium">Linha digitável</p>
              <p className="break-all text-xs text-muted-foreground">{lastCharge.boletoBarcode}</p>
              {renderCopyActions(lastCharge.boletoBarcode, 'Copiar linha digitável')}
            </div>
          ) : null}
          {!lastCharge.boletoUrl && !lastCharge.boletoBarcode ? (
            <p className="text-sm text-muted-foreground">Aguardando geração do boleto.</p>
          ) : null}
        </div>
      );
    }

    return (
      <div className="space-y-2 rounded-md border px-3 py-2 text-sm">
        <p>
          Status da transação:{' '}
          <span className="font-semibold">{lastCharge.status ?? 'Pendente'}</span>
        </p>
        {lastCharge.cardAuthorizationCode ? (
          <p>
            Código de autorização:{' '}
            <span className="font-mono text-xs">{lastCharge.cardAuthorizationCode}</span>
          </p>
        ) : null}
        {lastCardDetails?.last4Digits ? (
          <p>
            Cartão final {lastCardDetails.last4Digits}
            {lastCardDetails.brand ? ` (${lastCardDetails.brand})` : ''}
          </p>
        ) : null}
      </div>
    );
  };

  const syncStatusInfo = isFetchingCustomerSyncStatus
    ? { label: 'Carregando...', variant: 'outline' as const }
    : resolveSyncStatusInfo(customerSyncStatus?.status);

  const methodLabels: Record<AsaasPaymentMethod, string> = {
    PIX: 'PIX',
    BOLETO: 'Boleto',
    CREDIT_CARD: 'Cartão de crédito',
    DEBIT_CARD: 'Cartão de débito',
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl space-y-6">
        <DialogHeader>
          <DialogTitle>Gerar cobrança</DialogTitle>
          <DialogDescription>
            Configure o envio da cobrança para o lançamento financeiro selecionado.
          </DialogDescription>
        </DialogHeader>

        {flow ? (
          <>
            <div className="rounded-md border bg-muted/40 p-4 text-sm">
              <p className="font-medium">{flow.descricao}</p>
              <p className="text-muted-foreground">Valor: {formatCurrency(flow.valor)}</p>
              {flow.vencimento ? (
                <p className="text-muted-foreground">
                  Vencimento: {formatShortDate(flow.vencimento) ?? flow.vencimento}
                </p>
              ) : (
                <p className="text-muted-foreground">Sem vencimento definido.</p>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="asaas-customer-select">
                    Cliente
                  </label>
                  <select
                    id="asaas-customer-select"
                    value={customerId}
                    onChange={(event) => setCustomerId(event.target.value)}
                    className="w-full rounded-md border px-3 py-2 text-sm"
                    disabled={customersLoading}
                  >
                    <option value="">
                      {customersLoading ? 'Carregando clientes...' : 'Selecione um cliente'}
                    </option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.label}
                      </option>
                    ))}
                  </select>
                  {selectedCustomer?.email ? (
                    <p className="text-xs text-muted-foreground">E-mail: {selectedCustomer.email}</p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="asaas-payment-method">
                    Método de pagamento
                  </label>
                  <select
                    id="asaas-payment-method"
                    value={paymentMethod}
                    onChange={(event) => setPaymentMethod(event.target.value as AsaasPaymentMethod)}
                    className="w-full rounded-md border px-3 py-2 text-sm"
                  >
                    <option value="PIX">PIX</option>
                    <option value="BOLETO">Boleto</option>
                    <option value="CREDIT_CARD">Cartão de crédito</option>
                    <option value="DEBIT_CARD">Cartão de débito</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="asaas-installments">
                    Parcelas / opções
                  </label>
                  <select
                    id="asaas-installments"
                    value={installments}
                    onChange={(event) => setInstallments(Number(event.target.value))}
                    className="w-full rounded-md border px-3 py-2 text-sm"
                    disabled={paymentMethod === 'PIX' || paymentMethod === 'DEBIT_CARD'}
                  >
                    {DEFAULT_INSTALLMENT_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}x
                      </option>
                    ))}
                  </select>
                </div>

                {paymentMethod === 'BOLETO' ? (
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="asaas-boleto-due">
                      Vencimento do boleto
                    </label>
                    <Input
                      id="asaas-boleto-due"
                      type="date"
                      value={dueDate}
                      onChange={(event) => setDueDate(event.target.value)}
                    />
                  </div>
                ) : null}
              </div>

              <div className="rounded-md border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">Status do cliente no Asaas</p>
                    {customerSyncStatus?.lastSyncedAt ? (
                      <p className="text-xs text-muted-foreground">
                        Última sincronização: {formatStatusDate(customerSyncStatus.lastSyncedAt)}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">Nenhum histórico de sincronização encontrado.</p>
                    )}
                    {customerSyncStatus?.message ? (
                      <p className="text-xs text-muted-foreground">{customerSyncStatus.message}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge variant={syncStatusInfo.variant}>{syncStatusInfo.label}</Badge>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="gap-2"
                      onClick={handleSyncNow}
                      disabled={!customerId || syncMutation.isPending}
                    >
                      {syncMutation.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RefreshCcw className="h-3.5 w-3.5" />
                      )}
                      {syncMutation.isPending ? 'Sincronizando...' : 'Sincronizar agora'}
                    </Button>
                  </div>
                </div>
              </div>

              <DialogFooter className="gap-2 sm:justify-end">
                <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={chargeMutation.isPending}>
                  Cancelar
                </Button>
                <Button type="submit" className="gap-2" disabled={chargeMutation.isPending || customersLoading}>
                  {paymentMethod === 'CREDIT_CARD' ? (
                    <>
                      <CreditCard className="h-4 w-4" /> Prosseguir para cartão
                    </>
                  ) : chargeMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Gerando...
                    </>
                  ) : (
                    'Gerar cobrança'
                  )}
                </Button>
              </DialogFooter>
            </form>

            <div className="space-y-4 rounded-md border p-4">
              <div className="flex items-center justify-between gap-2">
                <h4 className="font-semibold">Detalhes da cobrança</h4>
                <span className="text-xs text-muted-foreground">
                  Método selecionado: {methodLabels[lastCharge?.paymentMethod ?? paymentMethod]}
                </span>
              </div>
              {chargeDetailsQuery.isFetching && !lastCharge ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Carregando dados da cobrança...
                </p>
              ) : (
                renderChargeDetails()
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">Histórico de status</p>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="gap-2"
                    onClick={() => statusQuery.refetch()}
                    disabled={statusQuery.isFetching}
                  >
                    {statusQuery.isFetching ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCcw className="h-3.5 w-3.5" />
                    )}
                    {statusQuery.isFetching ? 'Atualizando...' : 'Atualizar'}
                  </Button>
                </div>
                {statuses.length > 0 ? (
                  <ul className="space-y-1 text-sm">
                    {statuses.map((status) => {
                      const date = formatStatusDate(status.updatedAt);
                      return (
                        <li
                          key={`${status.status}-${status.updatedAt ?? ''}`}
                          className="flex items-center justify-between gap-2 rounded border px-2 py-1"
                        >
                          <span>{status.status}</span>
                          {date ? <span className="text-xs text-muted-foreground">{date}</span> : null}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhuma atualização registrada até o momento.</p>
                )}
              </div>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Selecione um lançamento para gerar a cobrança.</p>
        )}

        <CardTokenModal
          flow={flow}
          open={Boolean(cardModalState)}
          onOpenChange={(isOpen) => {
            if (!isOpen) {
              setCardModalState(null);
            }
          }}
          onTokenized={handleCardTokenized}
          isSubmitting={chargeMutation.isPending}
          installments={installments}
        />
      </DialogContent>
    </Dialog>
  );
};

type CardTokenModalProps = {
  flow: Flow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTokenized: (details: CardTokenDetails) => Promise<void>;
  isSubmitting: boolean;
  installments: number;
};

const CardTokenModal = ({
  flow,
  open,
  onOpenChange,
  onTokenized,
  isSubmitting,
  installments,
}: CardTokenModalProps) => {
  const { toast } = useToast();
  const [form, setForm] = useState<CardFormState>({
    holderName: '',
    holderEmail: '',
    document: '',
    number: '',
    expiryMonth: '',
    expiryYear: '',
    cvv: '',
    phone: '',
    postalCode: '',
    addressNumber: '',
    addressComplement: '',
  });
  const [errors, setErrors] = useState<CardFormErrors>({});
  const [isTokenizing, setIsTokenizing] = useState(false);

  useEffect(() => {
    if (!open) {
      setForm({
        holderName: '',
        holderEmail: '',
        document: '',
        number: '',
        expiryMonth: '',
        expiryYear: '',
        cvv: '',
        phone: '',
        postalCode: '',
        addressNumber: '',
        addressComplement: '',
      });
      setErrors({});
      setIsTokenizing(false);
    }
  }, [open]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validation = validateCardForm(form);
    setErrors(validation);
    if (Object.values(validation).some(Boolean)) {
      toast({
        title: 'Verifique os dados do cartão',
        description: 'Preencha todos os campos obrigatórios para continuar.',
        variant: 'destructive',
      });
      return;
    }

    const payload: CardTokenPayload = {
      holderName: form.holderName.trim(),
      number: sanitizeDigits(form.number),
      expiryMonth: form.expiryMonth.trim(),
      expiryYear: form.expiryYear.trim(),
      cvv: sanitizeDigits(form.cvv),
      document: sanitizeDigits(form.document),
      email: form.holderEmail.trim(),
      phone: sanitizeDigits(form.phone),
      postalCode: sanitizeDigits(form.postalCode),
      addressNumber: form.addressNumber.trim(),
      addressComplement: form.addressComplement.trim() || undefined,
    };

    try {
      setIsTokenizing(true);
      const tokenData: CardTokenResponse = await tokenizeCard(payload);
      await onTokenized({
        token: tokenData.token,
        brand: tokenData.brand,
        last4Digits: tokenData.last4Digits,
        holderName: payload.holderName,
        holderEmail: payload.email,
        document: payload.document,
        phone: payload.phone,
        postalCode: payload.postalCode,
        addressNumber: payload.addressNumber,
        addressComplement: payload.addressComplement,
      });
      onOpenChange(false);
      toast({
        title: 'Cartão validado com sucesso',
        description: 'O token foi gerado e a cobrança será criada.',
      });
    } catch (error) {
      toast({
        title: 'Erro ao processar cartão',
        description: error instanceof Error ? error.message : 'Não foi possível tokenizar o cartão.',
        variant: 'destructive',
      });
    } finally {
      setIsTokenizing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg space-y-4">
        <DialogHeader>
          <DialogTitle>Dados do cartão</DialogTitle>
          <DialogDescription>
            Informe os dados do titular para concluir a cobrança do lançamento "{flow?.descricao ?? ''}".
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-3">
            <Input
              placeholder="Nome impresso no cartão"
              value={form.holderName}
              onChange={(event) => setForm((prev) => ({ ...prev, holderName: event.target.value }))}
            />
            {errors.holderName ? <p className="text-xs text-destructive">{errors.holderName}</p> : null}

            <Input
              type="email"
              placeholder="E-mail do titular"
              value={form.holderEmail}
              onChange={(event) => setForm((prev) => ({ ...prev, holderEmail: event.target.value }))}
            />
            {errors.holderEmail ? <p className="text-xs text-destructive">{errors.holderEmail}</p> : null}

            <Input
              placeholder="CPF/CNPJ"
              value={form.document}
              onChange={(event) => setForm((prev) => ({ ...prev, document: event.target.value }))}
            />
            {errors.document ? <p className="text-xs text-destructive">{errors.document}</p> : null}

            <Input
              placeholder="Número do cartão"
              value={form.number}
              onChange={(event) => setForm((prev) => ({ ...prev, number: event.target.value }))}
            />
            {errors.number ? <p className="text-xs text-destructive">{errors.number}</p> : null}

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <Input
                  placeholder="Mês"
                  value={form.expiryMonth}
                  onChange={(event) => setForm((prev) => ({ ...prev, expiryMonth: event.target.value }))}
                />
                {errors.expiryMonth ? <p className="text-xs text-destructive">{errors.expiryMonth}</p> : null}
              </div>
              <div className="space-y-1">
                <Input
                  placeholder="Ano"
                  value={form.expiryYear}
                  onChange={(event) => setForm((prev) => ({ ...prev, expiryYear: event.target.value }))}
                />
                {errors.expiryYear ? <p className="text-xs text-destructive">{errors.expiryYear}</p> : null}
              </div>
              <div className="space-y-1">
                <Input
                  placeholder="CVV"
                  value={form.cvv}
                  onChange={(event) => setForm((prev) => ({ ...prev, cvv: event.target.value }))}
                />
                {errors.cvv ? <p className="text-xs text-destructive">{errors.cvv}</p> : null}
              </div>
            </div>

            <Input
              placeholder="Telefone"
              value={form.phone}
              onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
            />
            {errors.phone ? <p className="text-xs text-destructive">{errors.phone}</p> : null}

            <Input
              placeholder="CEP"
              value={form.postalCode}
              onChange={(event) => setForm((prev) => ({ ...prev, postalCode: event.target.value }))}
            />
            {errors.postalCode ? <p className="text-xs text-destructive">{errors.postalCode}</p> : null}

            <Input
              placeholder="Número do endereço"
              value={form.addressNumber}
              onChange={(event) => setForm((prev) => ({ ...prev, addressNumber: event.target.value }))}
            />
            {errors.addressNumber ? <p className="text-xs text-destructive">{errors.addressNumber}</p> : null}

            <Input
              placeholder="Complemento"
              value={form.addressComplement}
              onChange={(event) => setForm((prev) => ({ ...prev, addressComplement: event.target.value }))}
            />
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isTokenizing || isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" className="gap-2" disabled={isTokenizing || isSubmitting}>
              {(isTokenizing || isSubmitting) && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirmar pagamento
            </Button>
          </DialogFooter>
        </form>

        <p className="text-xs text-muted-foreground">
          O valor será cobrado em {installments} parcela(s) para o lançamento "{flow?.descricao ?? ''}".
        </p>
      </DialogContent>
    </Dialog>
  );
};
