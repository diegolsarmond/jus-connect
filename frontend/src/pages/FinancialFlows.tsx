import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, isBefore, isValid, parseISO, startOfDay, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { fetchFlows, createFlow, settleFlow, Flow, AsaasCharge, AsaasChargeStatus } from '@/lib/flows';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { getApiUrl } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Info, AlertCircle, ChevronLeft, ChevronRight, ChevronsUpDown, Check } from 'lucide-react';
import { AsaasChargeDialog } from '@/components/financial/AsaasChargeDialog';
import type { CustomerOption } from '@/components/financial/AsaasChargeDialog';

import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';

const CHART_COLORS = {
  receitas: '#16a34a',
  despesas: '#dc2626',
  aberto: '#f59e0b',
} as const;

const CHART_SERIES_LABELS = {
  receitas: 'Receitas',
  despesas: 'Despesas',
  aberto: 'Cobranças em aberto',
} as const;

type FlowFormState = {
  tipo: Flow['tipo'];
  descricao: string;
  valor: string;
  vencimento: string;
  clienteId: string;
  fornecedorId: string;
};

const INITIAL_FORM_STATE: FlowFormState = {
  tipo: 'receita',
  descricao: '',
  valor: '',
  vencimento: '',
  clienteId: '',
  fornecedorId: '',
};

type SupplierOption = CustomerOption & { phone?: string };

const formatDateForInput = (date: Date) => format(date, 'yyyy-MM-dd');
const getDefaultPaymentDate = () => formatDateForInput(startOfDay(new Date()));

const parseDateValue = (value: string | null | undefined): Date | null => {
  if (!value) {
    return null;
  }

  const parsed = parseISO(value);
  return parsed && isValid(parsed) ? parsed : null;
};

const normalizeDateInputValue = (value: string | null | undefined): string | null => {
  const parsed = parseDateValue(value);
  return parsed ? formatDateForInput(parsed) : null;
};

function normalizeCustomerOption(entry: unknown): CustomerOption | null {
  if (!entry || typeof entry !== 'object') {
    return null;
  }

  const record = entry as Record<string, unknown>;
  const idCandidate =
    record.id ??
    record.clienteId ??
    record.cliente_id ??
    record.customerId ??
    record.customer_id ??
    record.externalId ??
    record.external_id;

  if (idCandidate === undefined || idCandidate === null) {
    return null;
  }

  const id = String(idCandidate);
  const nameCandidate =
    record.nome ??
    record.name ??
    record.razaoSocial ??
    record['razao_social'] ??
    record.companyName ??
    record.fantasia ??
    record.legalName;

  const emailCandidate = record.email ?? record.emailPrincipal ?? record.primaryEmail ?? record.contatoEmail;
  const documentCandidate = record.cpfCnpj ?? record.documento ?? record.document ?? record.cnpj ?? record.cpf;

  return {
    id,
    label: typeof nameCandidate === 'string' && nameCandidate.length > 0 ? nameCandidate : `Cliente ${id}`,
    email: typeof emailCandidate === 'string' ? emailCandidate : undefined,
    document: typeof documentCandidate === 'string' ? documentCandidate : undefined,
    raw: entry,
  };
}

function normalizeSupplierOption(entry: unknown): SupplierOption | null {
  if (!entry || typeof entry !== 'object') {
    return null;
  }

  const record = entry as Record<string, unknown>;
  const idCandidate =
    record.id ??
    record.fornecedorId ??
    record.fornecedor_id ??
    record.supplierId ??
    record.supplier_id ??
    record.externalId ??
    record.external_id;

  if (idCandidate === undefined || idCandidate === null) {
    return null;
  }

  const id = String(idCandidate);
  const nameCandidate =
    record.nome ??
    record.razaoSocial ??
    record['razao_social'] ??
    record.fantasia ??
    record.companyName ??
    record.name;

  const emailCandidate =
    record.email ??
    record.emailPrincipal ??
    record.primaryEmail ??
    record.contatoEmail ??
    record['contato_email'];
  const documentCandidate =
    record.documento ??
    record.document ??
    record.cnpj ??
    record.cpf ??
    record.cpfCnpj ??
    record['numero_documento'];
  const phoneCandidate = record.telefone ?? record.phone ?? record['telefone_principal'];

  const labelCandidate = typeof nameCandidate === 'string' ? nameCandidate.trim() : '';
  const emailValue = typeof emailCandidate === 'string' ? emailCandidate : undefined;
  const documentValue = typeof documentCandidate === 'string' ? documentCandidate : undefined;
  const phoneValue = typeof phoneCandidate === 'string' ? phoneCandidate.trim() : undefined;

  const label = labelCandidate.length > 0 ? labelCandidate : `Fornecedor ${id}`;

  return {
    id,
    label,
    email: emailValue,
    document: documentValue,
    phone: phoneValue && phoneValue.length > 0 ? phoneValue : undefined,
    raw: entry,
  };
}

async function fetchCustomersForFlows(): Promise<CustomerOption[]> {
  const response = await fetch(getApiUrl('clientes'));
  if (!response.ok) {
    throw new Error(`Falha ao carregar clientes (HTTP ${response.status})`);
  }

  const payload = await response.json();
  const listCandidates = Array.isArray(payload)
    ? payload
    : (payload?.items as unknown[]) ?? (payload?.data as unknown[]) ?? (payload?.results as unknown[]) ?? [];

  return listCandidates
    .map((entry) => normalizeCustomerOption(entry))
    .filter((customer): customer is CustomerOption => Boolean(customer));
}

async function fetchSuppliersForFlows(): Promise<SupplierOption[]> {
  const response = await fetch(getApiUrl('fornecedores'));
  if (!response.ok) {
    throw new Error(`Falha ao carregar fornecedores (HTTP ${response.status})`);
  }

  const payload = await response.json();
  const listCandidates = Array.isArray(payload)
    ? payload
    : (payload?.items as unknown[]) ?? (payload?.data as unknown[]) ?? (payload?.results as unknown[]) ?? [];

  return listCandidates
    .map((entry) => normalizeSupplierOption(entry))
    .filter((supplier): supplier is SupplierOption => Boolean(supplier));
}

const DIGIT_ONLY_REGEX = /\D+/g;

const BRAZILIAN_CURRENCY_FORMATTER = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const extractCurrencyDigits = (value: string): string => value.replace(DIGIT_ONLY_REGEX, '');

const formatCurrencyInputValue = (digits: string): string => {
  if (!digits) {
    return '';
  }
  const parsed = Number.parseInt(digits, 10);
  if (Number.isNaN(parsed)) {
    return '';
  }
  return BRAZILIAN_CURRENCY_FORMATTER.format(parsed / 100);
};

const parseCurrencyDigits = (digits: string): number | null => {
  if (!digits) {
    return null;
  }
  const parsed = Number.parseInt(digits, 10);
  if (Number.isNaN(parsed)) {
    return null;
  }
  return parsed / 100;
};

const buildOptionDetails = (option: CustomerOption | SupplierOption): string | null => {
  const details: string[] = [];
  if (typeof option.document === 'string' && option.document.trim().length > 0) {
    details.push(option.document.trim());
  }
  if (typeof option.email === 'string' && option.email.trim().length > 0) {
    details.push(option.email.trim());
  }
  if ('phone' in option && typeof option.phone === 'string' && option.phone.trim().length > 0) {
    details.push(option.phone.trim());
  }
  return details.length > 0 ? details.join(' • ') : null;
};

const FinancialFlows = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const {
    data: flows = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({ queryKey: ['flows'], queryFn: fetchFlows });
  const {
    data: customers = [],
    isLoading: customersLoading,
    error: customersError,
  } = useQuery({ queryKey: ['flows-customers'], queryFn: fetchCustomersForFlows, staleTime: 1000 * 60 * 5 });
  const {
    data: suppliers = [],
    isLoading: suppliersLoading,
    error: suppliersError,
  } = useQuery({ queryKey: ['flows-suppliers'], queryFn: fetchSuppliersForFlows, staleTime: 1000 * 60 * 5 });

  const [chargeDialogFlow, setChargeDialogFlow] = useState<Flow | null>(null);
  const [chargeSummaries, setChargeSummaries] = useState<Record<number, AsaasCharge | null>>({});
  const [chargeStatusHistory, setChargeStatusHistory] = useState<Record<number, AsaasChargeStatus[]>>({});
  const [settleDialogFlow, setSettleDialogFlow] = useState<Flow | null>(null);
  const [settleDate, setSettleDate] = useState(() => getDefaultPaymentDate());

  useEffect(() => {
    if (customersError instanceof Error) {
      toast({
        title: 'Erro ao carregar clientes',
        description: customersError.message,
        variant: 'destructive',
      });
    }
  }, [customersError, toast]);

  useEffect(() => {
    if (suppliersError instanceof Error) {
      toast({
        title: 'Erro ao carregar fornecedores',
        description: suppliersError.message,
        variant: 'destructive',
      });
    }
  }, [suppliersError, toast]);

  const handleChargeSaved = useCallback((flowId: number, charge: AsaasCharge) => {
    setChargeSummaries((prev) => ({ ...prev, [flowId]: charge }));
  }, []);

  const handleStatusUpdated = useCallback((flowId: number, statuses: AsaasChargeStatus[]) => {
    setChargeStatusHistory((prev) => ({ ...prev, [flowId]: statuses }));
  }, []);


  type DerivedStatus = 'pendente' | 'pago' | 'vencido';

  type FlowWithDetails = Flow & {
    computedStatus: DerivedStatus;
    dueDate: Date | null;
    pagamentoDate: Date | null;
  };

  type PeriodTotals = {
    receitas: number;
    despesas: number;
    saldo: number;
    status: Record<DerivedStatus, { count: number; value: number }>;
  };

  type PeriodGroup = {
    key: string;
    label: string;
    sortValue: number;
    flows: FlowWithDetails[];
    totals: PeriodTotals;
  };

  const [activeYear, setActiveYear] = useState<number | null>(null);
  const [activePeriodKey, setActivePeriodKey] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | DerivedStatus>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | Flow['tipo']>('all');
  const [onlyOpenCharges, setOnlyOpenCharges] = useState(false);

  const currencyFormatter = useMemo(
    () => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }),
    [],
  );

  const formatCurrency = (value: number) => currencyFormatter.format(value);

  const statusLabels: Record<DerivedStatus, string> = {
    pendente: 'Pendentes',
    pago: 'Pagos',
    vencido: 'Vencidos',
  };

  const statusSingleLabels: Record<DerivedStatus, string> = {
    pendente: 'Pendente',
    pago: 'Pago',
    vencido: 'Vencido',
  };

  const statusBadgeVariants: Record<DerivedStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    pendente: 'outline',
    pago: 'secondary',
    vencido: 'destructive',
  };

  const deriveMonthLabel = useCallback((date: Date) => {
    const label = format(date, "MMMM 'de' yyyy", { locale: ptBR });
    return label.charAt(0).toUpperCase() + label.slice(1);
  }, []);

  const formatDayDate = (date: Date | null, fallback?: string) => {
    if (!date || !isValid(date)) return fallback ?? '-';
    return format(date, 'dd/MM/yyyy');
  };

  const detailedFlows = useMemo<FlowWithDetails[]>(() => {
    const today = startOfDay(new Date());
    return flows.map((flow) => {
      const parsedDueDate = flow.vencimento ? parseISO(flow.vencimento) : null;
      const dueDate = parsedDueDate && isValid(parsedDueDate) ? parsedDueDate : null;
      const parsedPaymentDate = flow.pagamento ? parseISO(flow.pagamento) : null;
      const pagamentoDate = parsedPaymentDate && isValid(parsedPaymentDate) ? parsedPaymentDate : null;

      const computedStatus: DerivedStatus =
        flow.status === 'pago' || pagamentoDate
          ? 'pago'
          : dueDate && isBefore(dueDate, today)
            ? 'vencido'
            : 'pendente';
      return {
        ...flow,
        computedStatus,
        dueDate,
        pagamentoDate,
      };
    });
  }, [flows]);

  const filteredFlows = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return detailedFlows.filter((flow) => {
      const matchesSearch =
        term.length === 0 ||
        flow.descricao.toLowerCase().includes(term);
      const matchesStatus =
        statusFilter === 'all' ||
        flow.computedStatus === statusFilter;
      const matchesType = typeFilter === 'all' || flow.tipo === typeFilter;
      const matchesOnlyOpen =
        !onlyOpenCharges ||
        (flow.computedStatus === 'pendente' || flow.computedStatus === 'vencido');

      return matchesSearch && matchesStatus && matchesType && matchesOnlyOpen;
    });
  }, [detailedFlows, onlyOpenCharges, searchTerm, statusFilter, typeFilter]);

  const periods = useMemo<PeriodGroup[]>(() => {
    const accumulator = new Map<string, { key: string; label: string; sortValue: number; flows: FlowWithDetails[] }>();

    filteredFlows.forEach((flow) => {
      const key = flow.dueDate ? format(flow.dueDate, 'yyyy-MM') : 'sem-data';
      const sortValue = flow.dueDate ? startOfMonth(flow.dueDate).getTime() : Number.NEGATIVE_INFINITY;
      const label = flow.dueDate ? deriveMonthLabel(flow.dueDate) : 'Sem vencimento';

      if (!accumulator.has(key)) {
        accumulator.set(key, { key, label, sortValue, flows: [] });
      }

      accumulator.get(key)!.flows.push(flow);
    });

    return Array.from(accumulator.values())
      .map<PeriodGroup>((group) => {
        const totals = group.flows.reduce<PeriodTotals>(
          (acc, flow) => {
            if (flow.tipo === 'receita') {
              acc.receitas += flow.valor;
            } else {
              acc.despesas += flow.valor;
            }
            acc.status[flow.computedStatus].count += 1;
            acc.status[flow.computedStatus].value += flow.valor;
            return acc;
          },
          {
            receitas: 0,
            despesas: 0,
            saldo: 0,
            status: {
              pendente: { count: 0, value: 0 },
              pago: { count: 0, value: 0 },
              vencido: { count: 0, value: 0 },
            },
          },
        );
        totals.saldo = totals.receitas - totals.despesas;

        return {
          ...group,
          totals,
        };
      })
      .sort((a, b) => a.sortValue - b.sortValue);
  }, [filteredFlows, deriveMonthLabel]);

  const globalTotals = useMemo(() => {
    const totals = filteredFlows.reduce<PeriodTotals>(
      (acc, flow) => {
        if (flow.tipo === 'receita') {
          acc.receitas += flow.valor;
        } else {
          acc.despesas += flow.valor;
        }
        acc.status[flow.computedStatus].count += 1;
        acc.status[flow.computedStatus].value += flow.valor;
        return acc;
      },
      {
        receitas: 0,
        despesas: 0,
        saldo: 0,
        status: {
          pendente: { count: 0, value: 0 },
          pago: { count: 0, value: 0 },
          vencido: { count: 0, value: 0 },
        },
      },
    );
    totals.saldo = totals.receitas - totals.despesas;
    return totals;
  }, [filteredFlows]);

  const hasAnyFlow = detailedFlows.length > 0;

  const datedPeriods = useMemo(() => periods.filter((period) => period.key !== 'sem-data'), [periods]);
  const undatedPeriod = useMemo(
    () => periods.find((period) => period.key === 'sem-data') ?? null,
    [periods],
  );

  const yearGroups = useMemo(
    () => {
      const accumulator = new Map<number, PeriodGroup[]>();

      datedPeriods.forEach((period) => {
        const [yearPart] = period.key.split('-');
        const year = Number.parseInt(yearPart, 10);
        if (!Number.isFinite(year)) {
          return;
        }
        if (!accumulator.has(year)) {
          accumulator.set(year, []);
        }
        accumulator.get(year)!.push(period);
      });

      return Array.from(accumulator.entries())
        .map(([year, yearPeriods]) => ({
          year,
          periods: yearPeriods.sort((a, b) => a.sortValue - b.sortValue),
        }))
        .sort((a, b) => b.year - a.year);
    },
    [datedPeriods],
  );

  const availableYears = useMemo(() => yearGroups.map((group) => group.year), [yearGroups]);

  useEffect(() => {
    if (availableYears.length === 0) {
      if (activeYear !== null) {
        setActiveYear(null);
      }
      return;
    }

    const currentYear = new Date().getFullYear();
    const fallbackYear = availableYears[0];
    const preferredYear = availableYears.includes(currentYear) ? currentYear : fallbackYear;

    if (activeYear === null || !availableYears.includes(activeYear)) {
      setActiveYear(preferredYear);
    }
  }, [activeYear, availableYears]);

  const periodsForActiveYear = useMemo(() => {
    if (activeYear === null) {
      return [];
    }

    return yearGroups.find((group) => group.year === activeYear)?.periods ?? [];
  }, [activeYear, yearGroups]);

  const visiblePeriods = useMemo(() => {
    const periodsWithYear = periodsForActiveYear;
    return undatedPeriod ? [...periodsWithYear, undatedPeriod] : periodsWithYear;
  }, [periodsForActiveYear, undatedPeriod]);

  const chartData = useMemo(
    () =>
      periodsForActiveYear.map((period) => {
        const monthDate = new Date(period.sortValue);
        const monthLabel = format(monthDate, 'MMM', { locale: ptBR });
        const normalizedLabel = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);
        const openChargesValue = period.totals.status.pendente.value + period.totals.status.vencido.value;

        return {
          key: period.key,
          month: normalizedLabel,
          receitas: period.totals.receitas,
          despesas: period.totals.despesas,
          aberto: openChargesValue,
        };
      }),
    [periodsForActiveYear],
  );

  useEffect(() => {
    const visibleKeys = visiblePeriods.map((period) => period.key);
    if (visibleKeys.length === 0) {
      if (activePeriodKey !== null) {
        setActivePeriodKey(null);
      }
      return;
    }

    const now = new Date();
    const currentPeriodKey = format(now, 'yyyy-MM');
    const shouldPrioritizeCurrentMonth = activeYear !== null && activeYear === now.getFullYear();
    const preferredKey =
      shouldPrioritizeCurrentMonth && visibleKeys.includes(currentPeriodKey)
        ? currentPeriodKey
        : visibleKeys[0];

    if (!activePeriodKey || !visibleKeys.includes(activePeriodKey)) {
      setActivePeriodKey(preferredKey);
    }
  }, [activePeriodKey, activeYear, visiblePeriods]);

  const safePeriodKey =
    visiblePeriods.length > 0
      ? activePeriodKey && visiblePeriods.some((period) => period.key === activePeriodKey)
        ? activePeriodKey
        : visiblePeriods[0].key
      : undefined;

  const currentYearIndex = activeYear !== null ? availableYears.indexOf(activeYear) : -1;
  const hasPreviousYear = currentYearIndex >= 0 && currentYearIndex < availableYears.length - 1;
  const hasNextYear = currentYearIndex > 0;

  const handleGoToPreviousYear = () => {
    if (!hasPreviousYear) return;
    const targetYear = availableYears[currentYearIndex + 1];
    setActiveYear(targetYear);
  };

  const handleGoToNextYear = () => {
    if (!hasNextYear) return;
    const targetYear = availableYears[currentYearIndex - 1];
    setActiveYear(targetYear);
  };

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [form, setForm] = useState<FlowFormState>(INITIAL_FORM_STATE);
  const [isCustomerPopoverOpen, setIsCustomerPopoverOpen] = useState(false);
  const [isSupplierPopoverOpen, setIsSupplierPopoverOpen] = useState(false);
  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer.id === form.clienteId) ?? null,
    [customers, form.clienteId],
  );
  const selectedSupplier = useMemo(
    () => suppliers.find((supplier) => supplier.id === form.fornecedorId) ?? null,
    [suppliers, form.fornecedorId],
  );
  const isFormValid = useMemo(() => {
    const parsedValue = parseCurrencyDigits(form.valor);
    return Boolean(form.descricao.trim()) && parsedValue !== null;
  }, [form.descricao, form.valor]);

  const createMutation = useMutation({
    mutationFn: () => {
      const parsedValue = parseCurrencyDigits(form.valor) ?? 0;
      return createFlow({
        tipo: form.tipo,
        descricao: form.descricao,
        valor: parsedValue,
        vencimento: form.vencimento,
        clienteId: form.tipo === 'receita' && form.clienteId ? form.clienteId : undefined,
        fornecedorId: form.tipo === 'despesa' && form.fornecedorId ? form.fornecedorId : undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flows'] });
      setForm(INITIAL_FORM_STATE);
      setIsCustomerPopoverOpen(false);
      setIsSupplierPopoverOpen(false);
      setIsCreateDialogOpen(false);
    },
  });

  const settleMutation = useMutation({
    mutationFn: ({ flowId, date }: { flowId: number | string; date: string }) => settleFlow(flowId, date),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flows'] });
      toast({
        title: 'Lançamento atualizado',
        description: 'O lançamento foi marcado como pago.',
      });
      setSettleDialogFlow(null);
      setSettleDate(getDefaultPaymentDate());
    },
    onError: (error: unknown) => {
      const description =
        error instanceof Error ? error.message : 'Não foi possível marcar o lançamento como pago.';
      toast({
        title: 'Erro ao marcar como pago',
        description,
        variant: 'destructive',
      });
    },
  });

  const handleOpenSettleDialog = (flow: Flow) => {
    setSettleDialogFlow(flow);

    const normalizedPaymentDate = normalizeDateInputValue(flow.pagamento ?? undefined);
    if (normalizedPaymentDate) {
      setSettleDate(normalizedPaymentDate);
      return;
    }

    const normalizedDueDate = normalizeDateInputValue(flow.vencimento);
    setSettleDate(normalizedDueDate ?? getDefaultPaymentDate());
  };

  const handleCloseSettleDialog = () => {
    if (settleMutation.isPending) {
      return;
    }

    setSettleDialogFlow(null);
    setSettleDate(getDefaultPaymentDate());
  };

  const handleConfirmSettle = () => {
    if (!settleDialogFlow || !settleDate || settleMutation.isPending) {
      return;
    }

    settleMutation.mutate({ flowId: settleDialogFlow.id, date: settleDate });
  };

  const statusOrder: DerivedStatus[] = ['pendente', 'vencido', 'pago'];
  const settleDialogDueDate = settleDialogFlow ? parseDateValue(settleDialogFlow.vencimento) : null;

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <Skeleton className="h-9 w-64" />
          <Skeleton className="mt-2 h-5 w-80" />
        </div>
        <Card className="p-6 space-y-4">
          <Skeleton className="h-6 w-48" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-24 w-full" />
            ))}
          </div>
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-64 w-full" />
        </Card>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-destructive">
          <AlertCircle className="h-6 w-6" />
          <div className="space-y-1">
            <h1 className="text-xl font-semibold">Não foi possível carregar os lançamentos financeiros</h1>
            <p className="text-sm text-destructive/80">
              {(error as Error)?.message || 'Ocorreu um erro inesperado ao comunicar com o servidor.'}
            </p>
          </div>
          <Button variant="outline" onClick={() => refetch()}>
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Lançamentos Financeiros</h1>
        <p className="mt-2 text-muted-foreground">
          Visualize todas as cobranças emitidas para os clientes, acompanhe a situação de pagamento e mantenha o controle do
          fluxo de caixa da empresa.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Saldo filtrado</p>
          <p className="text-2xl font-bold">{formatCurrency(globalTotals.saldo)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Receitas</p>
          <p className="text-2xl font-bold">{formatCurrency(globalTotals.receitas)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Despesas</p>
          <p className="text-2xl font-bold">{formatCurrency(globalTotals.despesas)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Cobranças em aberto</p>
          <p className="text-2xl font-bold">
            {formatCurrency(globalTotals.status.pendente.value + globalTotals.status.vencido.value)}
          </p>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statusOrder.map((status) => (
          <Card key={status} className="p-4 space-y-1">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{statusLabels[status]}</span>
              <Badge variant="outline">{globalTotals.status[status].count}</Badge>
            </div>
            <p className="text-lg font-semibold">{formatCurrency(globalTotals.status[status].value)}</p>
          </Card>
        ))}
      </div>

      <Dialog
        open={isCreateDialogOpen}
        onOpenChange={(open) => {
          setIsCreateDialogOpen(open);
          if (!open) {
            setForm(INITIAL_FORM_STATE);
            setIsCustomerPopoverOpen(false);
            setIsSupplierPopoverOpen(false);
          }
        }}
      >
        <Card className="space-y-6 p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Resumo mensal do ano selecionado</h2>
              <p className="text-sm text-muted-foreground">
                Compare receitas, despesas e cobranças em aberto.
              </p>
            </div>
            <DialogTrigger asChild>
              <Button type="button">Nova movimentação</Button>
            </DialogTrigger>
          </div>
          <div className="h-[320px]">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} barSize={24}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis tickFormatter={(value) => formatCurrency(Number(value))} />
                  <RechartsTooltip
                    formatter={(value, name) => {
                      const numericValue = typeof value === 'number' ? value : Number(value);
                      const label =
                        CHART_SERIES_LABELS[name as keyof typeof CHART_SERIES_LABELS] ?? String(name);
                      return [formatCurrency(numericValue), label];
                    }}
                  />
                  <Legend />
                  <Bar
                    dataKey="receitas"
                    name={CHART_SERIES_LABELS.receitas}
                    fill={CHART_COLORS.receitas}
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="despesas"
                    name={CHART_SERIES_LABELS.despesas}
                    fill={CHART_COLORS.despesas}
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="aberto"
                    name={CHART_SERIES_LABELS.aberto}
                    fill={CHART_COLORS.aberto}
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center rounded-md border border-dashed border-border/60 text-sm text-muted-foreground">
                Nenhum lançamento com vencimento no ano selecionado.
              </div>
            )}
          </div>
        </Card>

        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo lançamento financeiro</DialogTitle>
            <DialogDescription>
              Cadastre uma nova receita ou despesa para controlar o fluxo de caixa.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (!isFormValid || createMutation.isPending) {
                return;
              }
              createMutation.mutate();
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="flow-type">Tipo</Label>
              <Select
                value={form.tipo}
                onValueChange={(value) => {
                  const nextType = value as Flow['tipo'];
                  setForm((prev) => ({
                    ...prev,
                    tipo: nextType,
                    clienteId: nextType === 'receita' ? prev.clienteId : '',
                    fornecedorId: nextType === 'despesa' ? prev.fornecedorId : '',
                  }));
                  setIsCustomerPopoverOpen(false);
                  setIsSupplierPopoverOpen(false);
                }}
              >
                <SelectTrigger id="flow-type">
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="receita">Receita</SelectItem>
                  <SelectItem value="despesa">Despesa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.tipo === 'receita' ? (
              <div className="space-y-2">
                <Label htmlFor="flow-customer">Cliente (opcional)</Label>
                <Popover open={isCustomerPopoverOpen} onOpenChange={setIsCustomerPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      id="flow-customer"
                      type="button"
                      variant="outline"
                      role="combobox"
                      aria-expanded={isCustomerPopoverOpen}
                      className="w-full justify-between"
                    >
                      {customersLoading
                        ? 'Carregando clientes...'
                        : selectedCustomer
                          ? selectedCustomer.label
                          : 'Selecione um cliente (opcional)'}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                    <Command>
                      <CommandInput placeholder="Buscar cliente..." />
                      <CommandList>
                        {customersLoading ? (
                          <div className="p-2 text-sm text-muted-foreground">Carregando clientes...</div>
                        ) : customersError instanceof Error ? (
                          <div className="p-2 text-sm text-destructive">Não foi possível carregar os clientes.</div>
                        ) : (
                          <>
                            <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                            <CommandGroup>
                              <CommandItem
                                value="__none"
                                onSelect={() => {
                                  setForm((prev) => ({ ...prev, clienteId: '' }));
                                  setIsCustomerPopoverOpen(false);
                                }}
                              >
                                <span>Sem cliente</span>
                                <Check className={cn('ml-auto h-4 w-4', form.clienteId === '' ? 'opacity-100' : 'opacity-0')} />
                              </CommandItem>
                              {customers.map((customer) => {
                                const details = buildOptionDetails(customer);
                                const isSelected = form.clienteId === customer.id;
                                const searchableText = [
                                  customer.label,
                                  customer.document,
                                  customer.email,
                                ]
                                  .filter(Boolean)
                                  .join(' ');
                                return (
                                  <CommandItem
                                    key={customer.id}
                                    value={searchableText}
                                    onSelect={() => {
                                      setForm((prev) => ({ ...prev, clienteId: customer.id }));
                                      setIsCustomerPopoverOpen(false);
                                    }}
                                  >
                                    <div className="flex flex-col">
                                      <span className="font-medium leading-snug">{customer.label}</span>
                                      {details ? (
                                        <span className="text-xs text-muted-foreground">{details}</span>
                                      ) : null}
                                    </div>
                                    <Check className={cn('ml-auto h-4 w-4', isSelected ? 'opacity-100' : 'opacity-0')} />
                                  </CommandItem>
                                );
                              })}
                            </CommandGroup>
                          </>
                        )}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="flow-supplier">Fornecedor (opcional)</Label>
                <Popover open={isSupplierPopoverOpen} onOpenChange={setIsSupplierPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      id="flow-supplier"
                      type="button"
                      variant="outline"
                      role="combobox"
                      aria-expanded={isSupplierPopoverOpen}
                      className="w-full justify-between"
                    >
                      {suppliersLoading
                        ? 'Carregando fornecedores...'
                        : selectedSupplier
                          ? selectedSupplier.label
                          : 'Selecione um fornecedor (opcional)'}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                    <Command>
                      <CommandInput placeholder="Buscar fornecedor..." />
                      <CommandList>
                        {suppliersLoading ? (
                          <div className="p-2 text-sm text-muted-foreground">Carregando fornecedores...</div>
                        ) : suppliersError instanceof Error ? (
                          <div className="p-2 text-sm text-destructive">Não foi possível carregar os fornecedores.</div>
                        ) : (
                          <>
                            <CommandEmpty>Nenhum fornecedor encontrado.</CommandEmpty>
                            <CommandGroup>
                              <CommandItem
                                value="__none"
                                onSelect={() => {
                                  setForm((prev) => ({ ...prev, fornecedorId: '' }));
                                  setIsSupplierPopoverOpen(false);
                                }}
                              >
                                <span>Sem fornecedor</span>
                                <Check className={cn('ml-auto h-4 w-4', form.fornecedorId === '' ? 'opacity-100' : 'opacity-0')} />
                              </CommandItem>
                              {suppliers.map((supplier) => {
                                const details = buildOptionDetails(supplier);
                                const isSelected = form.fornecedorId === supplier.id;
                                const searchableText = [
                                  supplier.label,
                                  supplier.document,
                                  supplier.email,
                                  supplier.phone,
                                ]
                                  .filter(Boolean)
                                  .join(' ');
                                return (
                                  <CommandItem
                                    key={supplier.id}
                                    value={searchableText}
                                    onSelect={() => {
                                      setForm((prev) => ({ ...prev, fornecedorId: supplier.id }));
                                      setIsSupplierPopoverOpen(false);
                                    }}
                                  >
                                    <div className="flex flex-col">
                                      <span className="font-medium leading-snug">{supplier.label}</span>
                                      {details ? (
                                        <span className="text-xs text-muted-foreground">{details}</span>
                                      ) : null}
                                    </div>
                                    <Check className={cn('ml-auto h-4 w-4', isSelected ? 'opacity-100' : 'opacity-0')} />
                                  </CommandItem>
                                );
                              })}
                            </CommandGroup>
                          </>
                        )}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="flow-description">Descrição</Label>
              <Input
                id="flow-description"
                value={form.descricao}
                onChange={(event) => setForm((prev) => ({ ...prev, descricao: event.target.value }))}
                placeholder="Ex.: Mensalidade do cliente ACME"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="flow-value">Valor</Label>
              <Input
                id="flow-value"
                type="text"
                inputMode="decimal"
                placeholder="R$ 0,00"
                value={formatCurrencyInputValue(form.valor)}
                onChange={(event) => {
                  const digits = extractCurrencyDigits(event.target.value);
                  setForm((prev) => ({ ...prev, valor: digits }));
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="flow-due-date">Vencimento</Label>
              <Input
                id="flow-due-date"
                type="date"
                value={form.vencimento}
                onChange={(event) => setForm((prev) => ({ ...prev, vencimento: event.target.value }))}
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={!isFormValid || createMutation.isPending}>
                {createMutation.isPending ? 'Salvando...' : 'Salvar lançamento'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Card className="p-4">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Buscar cobranças</label>
            <Input
              placeholder="Busque por descrição ou palavra-chave"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Situação</label>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as 'all' | DerivedStatus)}>
              <SelectTrigger>
                <SelectValue placeholder="Todas as situações" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="pendente">Pendentes</SelectItem>
                <SelectItem value="vencido">Vencidos</SelectItem>
                <SelectItem value="pago">Pagos</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Tipo de lançamento</label>
            <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as 'all' | Flow['tipo'])}>
              <SelectTrigger>
                <SelectValue placeholder="Todos os tipos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="receita">Receitas</SelectItem>
                <SelectItem value="despesa">Despesas</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Apenas cobranças em aberto</label>
            <div className="flex h-10 items-center gap-3 rounded-md border border-input px-3">
              <Checkbox
                id="only-open"
                checked={onlyOpenCharges}
                onCheckedChange={(checked) => setOnlyOpenCharges(Boolean(checked))}
              />

              <label htmlFor="only-open" className="text-sm text-muted-foreground">
                Mostrar pendentes e vencidas
              </label>
            </div>
          </div>
        </div>
      </Card>

      {periods.length > 0 ? (
        <div className="space-y-4">
          {availableYears.length > 0 ? (
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Relatórios mensais</h2>
                <p className="text-sm text-muted-foreground">
                  Navegue entre os anos e selecione um mês para analisar os lançamentos do período.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleGoToPreviousYear}
                  disabled={!hasPreviousYear}
                  aria-label="Ano anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Select
                  value={activeYear !== null ? String(activeYear) : undefined}
                  onValueChange={(value) => {
                    const parsedYear = Number.parseInt(value, 10);
                    if (Number.isFinite(parsedYear)) {
                      setActiveYear(parsedYear);
                    }
                  }}
                >
                  <SelectTrigger className="w-[140px]" aria-label="Selecionar ano">
                    <SelectValue placeholder="Selecionar ano" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableYears.map((year) => (
                      <SelectItem key={year} value={String(year)}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleGoToNextYear}
                  disabled={!hasNextYear}
                  aria-label="Próximo ano"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : null}

          <Tabs value={safePeriodKey} onValueChange={setActivePeriodKey} className="w-full">
            <TabsList className="w-full flex flex-wrap gap-2">
              {visiblePeriods.map((period) => (
                <TabsTrigger key={period.key} value={period.key} className="data-[state=active]:bg-primary/10">
                  <span className="flex items-center gap-2">
                    {period.label}
                    <Badge variant="outline">{period.flows.length}</Badge>
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>

            {visiblePeriods.map((period) => (
              <TabsContent key={period.key} value={period.key} className="space-y-6">
                <div className="grid gap-4 md:grid-cols-3">
                  <Card className="p-4">
                    <p className="text-sm text-muted-foreground">Saldo do período</p>
                    <p className="text-2xl font-bold">{formatCurrency(period.totals.saldo)}</p>
                </Card>
                <Card className="p-4">
                  <p className="text-sm text-muted-foreground">Receitas</p>
                  <p className="text-2xl font-bold">{formatCurrency(period.totals.receitas)}</p>
                </Card>
                <Card className="p-4">
                  <p className="text-sm text-muted-foreground">Despesas</p>
                  <p className="text-2xl font-bold">{formatCurrency(period.totals.despesas)}</p>
                </Card>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                {statusOrder.map((status) => (
                  <Card key={status} className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">{statusLabels[status]}</p>
                      <Badge variant="outline">{period.totals.status[status].count}</Badge>
                    </div>
                    <p className="text-lg font-semibold">
                      {formatCurrency(period.totals.status[status].value)}
                    </p>
                  </Card>
                ))}
              </div>

              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted text-left">
                      <th className="p-3">Vencimento</th>
                      <th className="p-3">Descrição</th>
                      <th className="p-3 text-right">Valor</th>
                      <th className="p-3">Tipo</th>
                      <th className="p-3">Pagamento</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {period.flows.map((flow) => (
                      <tr key={flow.id} className="border-t">
                        <td className="p-3">{formatDayDate(flow.dueDate, flow.vencimento)}</td>
                        <td className="p-3">{flow.descricao}</td>
                        <td className="p-3 text-right">{formatCurrency(flow.valor)}</td>
                        <td className="p-3 capitalize">{flow.tipo}</td>
                        <td className="p-3">{formatDayDate(flow.pagamentoDate, flow.pagamento ?? undefined)}</td>
                        <td className="p-3">
                          <Badge variant={statusBadgeVariants[flow.computedStatus]}>
                            {statusSingleLabels[flow.computedStatus]}
                          </Badge>
                        </td>
                        <td className="p-3">
                          <div className="flex flex-col items-end gap-2">
                            <div className="flex flex-wrap justify-end gap-2">
                              {flow.computedStatus !== 'pago' ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleOpenSettleDialog(flow)}
                                  disabled={settleMutation.isPending}
                                >
                                  Marcar como pago
                                </Button>
                              ) : (
                                <span className="self-center text-xs text-muted-foreground">Pago</span>
                              )}
                              <Button
                                size="sm"
                                variant={chargeSummaries[flow.id] ? 'default' : 'secondary'}
                                onClick={() => setChargeDialogFlow(flow)}
                              >
                                {chargeSummaries[flow.id] ? 'Gerenciar cobrança' : 'Gerar cobrança'}
                              </Button>
                            </div>
                            {chargeSummaries[flow.id] ? (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Info className="h-3 w-3" aria-hidden="true" />
                                {chargeSummaries[flow.id]?.status
                                  ? `Último status: ${chargeSummaries[flow.id]?.status}`
                                  : 'Cobrança gerada'}
                              </span>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>
          ))}
          </Tabs>
        </div>
      ) : (
        <Card className="p-6 text-center text-muted-foreground">
          {hasAnyFlow
            ? 'Nenhum lançamento atende aos filtros selecionados. Ajuste os filtros para visualizar outras cobranças.'
            : 'Nenhum lançamento financeiro cadastrado até o momento.'}
        </Card>
      )}

      <Dialog
        open={Boolean(settleDialogFlow)}
        onOpenChange={(open) => {
          if (!open) {
            handleCloseSettleDialog();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marcar como pago</DialogTitle>
            <DialogDescription>
              Informe a data em que o lançamento foi pago para manter o histórico atualizado.
            </DialogDescription>
          </DialogHeader>
          {settleDialogFlow ? (
            <div className="space-y-4">
              <div className="rounded-md border border-border/50 bg-muted/40 p-3 text-sm">
                <p className="font-medium leading-snug">{settleDialogFlow.descricao}</p>
                <p className="text-muted-foreground">
                  {formatCurrency(settleDialogFlow.valor)}
                  {settleDialogDueDate
                    ? ` • vencimento ${formatDayDate(settleDialogDueDate, settleDialogFlow.vencimento ?? undefined)}`
                    : null}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="settle-date">Data do pagamento</Label>
                <Input
                  id="settle-date"
                  type="date"
                  value={settleDate}
                  onChange={(event) => setSettleDate(event.target.value)}
                  disabled={settleMutation.isPending}
                />
              </div>
            </div>
          ) : null}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={handleCloseSettleDialog}
              disabled={settleMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleConfirmSettle}
              disabled={!settleDate || settleMutation.isPending}
            >
              {settleMutation.isPending ? 'Salvando...' : 'Confirmar pagamento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AsaasChargeDialog
        flow={chargeDialogFlow}
        open={Boolean(chargeDialogFlow)}
        onOpenChange={(open) => {
          if (!open) {
            setChargeDialogFlow(null);
          }
        }}
        customers={customers}
        customersLoading={customersLoading}
        onChargeCreated={handleChargeSaved}
        onStatusUpdated={handleStatusUpdated}
        persistedCharge={chargeDialogFlow ? chargeSummaries[chargeDialogFlow.id] ?? null : null}
        persistedStatuses={chargeDialogFlow ? chargeStatusHistory[chargeDialogFlow.id] ?? [] : []}
      />
    </div>
  );
};

export default FinancialFlows;
