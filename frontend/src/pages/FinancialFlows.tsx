import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchFlows, createFlow, Flow } from '@/lib/flows';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const FinancialFlows = () => {
  const queryClient = useQueryClient();
  const { data: flows = [] } = useQuery({ queryKey: ['flows'], queryFn: fetchFlows });

  const receitas = flows
    .filter((f) => f.tipo === 'receita')
    .reduce((acc, f) => acc + f.valor, 0);
  const despesas = flows
    .filter((f) => f.tipo === 'despesa')
    .reduce((acc, f) => acc + f.valor, 0);
  const saldo = receitas - despesas;

  const [form, setForm] = useState({
    tipo: 'receita' as Flow['tipo'],
    descricao: '',
    valor: '',
    vencimento: '',
  });

  const mutation = useMutation({
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

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">Lançamentos Financeiros</h1>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Saldo</p>
          <p className="text-2xl font-bold">R$ {saldo.toFixed(2)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Receitas</p>
          <p className="text-2xl font-bold">R$ {receitas.toFixed(2)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Despesas</p>
          <p className="text-2xl font-bold">R$ {despesas.toFixed(2)}</p>
        </Card>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
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
        <Button type="submit">Salvar</Button>
      </form>

      <table className="w-full text-sm border">
        <thead>
          <tr className="bg-muted">
            <th className="p-2 text-left">Vencimento</th>
            <th className="p-2 text-left">Descrição</th>
            <th className="p-2 text-right">Valor</th>
            <th className="p-2 text-left">Tipo</th>
            <th className="p-2 text-left">Status</th>
          </tr>
        </thead>
        <tbody>
          {flows.map((f) => (
            <tr key={f.id} className="border-t">
              <td className="p-2">{f.vencimento}</td>
              <td className="p-2">{f.descricao}</td>
              <td className="p-2 text-right">R$ {f.valor.toFixed(2)}</td>
              <td className="p-2">{f.tipo}</td>
              <td className="p-2">{f.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default FinancialFlows;
