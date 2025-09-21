import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, isBefore, isValid, parseISO, startOfDay, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { fetchFlows, createFlow, settleFlow, Flow, AsaasCharge, AsaasChargeStatus } from '@/lib/flows';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { getApiUrl } from '@/lib/api';
import { Info, AlertCircle } from 'lucide-react';
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

  const [chargeDialogFlow, setChargeDialogFlow] = useState<Flow | null>(null);
  const [chargeSummaries, setChargeSummaries] = useState<Record<number, AsaasCharge | null>>({});
  const [chargeStatusHistory, setChargeStatusHistory] = useState<Record<number, AsaasChargeStatus[]>>({});

  useEffect(() => {
    if (customersError instanceof Error) {
      toast({
        title: 'Erro ao carregar clientes',
        description: customersError.message,
        variant: 'destructive',
      });
    }
  }, [customersError, toast]);

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

  const [activePeriod, setActivePeriod] = useState<string | null>(null);
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
      .sort((a, b) => b.sortValue - a.sortValue);
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

  const safePeriodKey =
    activePeriod && periods.some((period) => period.key === activePeriod)
      ? activePeriod
      : periods[0]?.key ?? '';

  const [form, setForm] = useState({
    tipo: 'receita' as Flow['tipo'],
    descricao: '',
    valor: '',
    vencimento: '',
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createFlow({
        tipo: form.tipo,
        descricao: form.descricao,
        valor: parseFloat(form.valor),
        vencimento: form.vencimento,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flows'] });
      setForm({ tipo: 'receita', descricao: '', valor: '', vencimento: '' });
    },
  });

  const settleMutation = useMutation({
    mutationFn: (flowId: number | string) =>
      settleFlow(flowId, format(startOfDay(new Date()), 'yyyy-MM-dd')),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flows'] });
    },
  });

  const handleSettleFlow = (id: number | string) => {
    if (!settleMutation.isPending) {
      settleMutation.mutate(id);
    }
  };

  const statusOrder: DerivedStatus[] = ['pendente', 'vencido', 'pago'];

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

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!form.valor || Number.isNaN(parseFloat(form.valor))) {
            return;
          }
          createMutation.mutate();
        }}
        className="flex flex-col gap-2 md:flex-row md:items-end"
      >
        <div>
          <label className="block text-sm mb-1">Tipo</label>
          <select
            value={form.tipo}
            onChange={(e) => setForm({ ...form, tipo: e.target.value as Flow['tipo'] })}
            className="border rounded p-2"
          >
            <option value="receita">Receita</option>
            <option value="despesa">Despesa</option>
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-sm mb-1">Descrição</label>
          <Input
            value={form.descricao}
            onChange={(e) => setForm({ ...form, descricao: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Valor</label>
          <Input
            type="number"
            value={form.valor}
            onChange={(e) => setForm({ ...form, valor: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Vencimento</label>
          <Input
            type="date"
            value={form.vencimento}
            onChange={(e) => setForm({ ...form, vencimento: e.target.value })}
          />
        </div>
        <Button type="submit" disabled={createMutation.isPending}>
          {createMutation.isPending ? 'Salvando...' : 'Salvar'}
        </Button>
      </form>

      {periods.length > 0 ? (
        <Tabs value={safePeriodKey} onValueChange={setActivePeriod} className="w-full">
          <TabsList className="w-full flex flex-wrap gap-2">
            {periods.map((period) => (
              <TabsTrigger key={period.key} value={period.key} className="data-[state=active]:bg-primary/10">
                <span className="flex items-center gap-2">
                  {period.label}
                  <Badge variant="outline">{period.flows.length}</Badge>
                </span>
              </TabsTrigger>
            ))}
          </TabsList>

          {periods.map((period) => (
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
                                  onClick={() => handleSettleFlow(flow.id)}
                                  disabled={settleMutation.isPending}
                                >
                                  {settleMutation.isPending ? 'Atualizando...' : 'Marcar como pago'}
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
      ) : (
        <Card className="p-6 text-center text-muted-foreground">
          {hasAnyFlow
            ? 'Nenhum lançamento atende aos filtros selecionados. Ajuste os filtros para visualizar outras cobranças.'
            : 'Nenhum lançamento financeiro cadastrado até o momento.'}
        </Card>
      )}

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
