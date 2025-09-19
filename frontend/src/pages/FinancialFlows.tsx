import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, isBefore, isValid, parseISO, startOfDay, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { fetchFlows, createFlow, settleFlow, Flow } from '@/lib/flows';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

const FinancialFlows = () => {
  const queryClient = useQueryClient();
  const { data: flows = [] } = useQuery({ queryKey: ['flows'], queryFn: fetchFlows });

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

  const deriveMonthLabel = (date: Date) => {
    const label = format(date, "MMMM 'de' yyyy", { locale: ptBR });
    return label.charAt(0).toUpperCase() + label.slice(1);
  };

  const formatDayDate = (date: Date | null, fallback?: string) => {
    if (!date || !isValid(date)) return fallback ?? '-';
    return format(date, 'dd/MM/yyyy');
  };

  const periods = useMemo<PeriodGroup[]>(() => {
    const today = startOfDay(new Date());
    const accumulator = new Map<string, { key: string; label: string; sortValue: number; flows: FlowWithDetails[] }>();

    flows.forEach((flow) => {
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

      const key = dueDate ? format(dueDate, 'yyyy-MM') : 'sem-data';
      const sortValue = dueDate ? startOfMonth(dueDate).getTime() : Number.NEGATIVE_INFINITY;
      const label = dueDate ? deriveMonthLabel(dueDate) : 'Sem vencimento';

      if (!accumulator.has(key)) {
        accumulator.set(key, { key, label, sortValue, flows: [] });
      }

      accumulator.get(key)!.flows.push({
        ...flow,
        computedStatus,
        dueDate,
        pagamentoDate,
      });
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
  }, [flows]);

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
    mutationFn: (flowId: number) =>
      settleFlow(flowId, format(startOfDay(new Date()), 'yyyy-MM-dd')),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flows'] });
    },
  });

  const handleSettleFlow = (id: number) => {
    if (!settleMutation.isPending) {
      settleMutation.mutate(id);
    }
  };

  const statusOrder: DerivedStatus[] = ['pendente', 'vencido', 'pago'];

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">Lançamentos Financeiros</h1>

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
                        <td className="p-3 text-right">
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
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
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
          Nenhum lançamento financeiro cadastrado até o momento.
        </Card>
      )}
    </div>
  );
};

export default FinancialFlows;
