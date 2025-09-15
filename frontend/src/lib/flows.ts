export interface Flow {
  id: number;
  tipo: 'receita' | 'despesa';
  descricao: string;
  vencimento: string;
  pagamento?: string | null;
  valor: number;
  status: 'pendente' | 'pago';
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export async function fetchFlows(): Promise<Flow[]> {
  const res = await fetch(`${API_URL}/financial/flows`);
  const data = await res.json();
  return data.items || data;
}

export async function createFlow(flow: Partial<Flow>): Promise<Flow> {
  const res = await fetch(`${API_URL}/financial/flows`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(flow),
  });
  const data = await res.json();
  return data.flow;
}

export async function settleFlow(id: number, pagamentoData: string): Promise<Flow> {
  const res = await fetch(`${API_URL}/financial/flows/${id}/settle`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pagamentoData }),
  });
  const data = await res.json();
  return data.flow;
}
