import { getApiUrl, joinUrl } from './api';

export interface Flow {
  id: number;
  tipo: 'receita' | 'despesa';
  descricao: string;
  vencimento: string;
  pagamento?: string | null;
  valor: number;
  status: 'pendente' | 'pago';
}

const FLOWS_ENDPOINT = getApiUrl('financial/flows');

export async function fetchFlows(): Promise<Flow[]> {
  const res = await fetch(FLOWS_ENDPOINT);
  const data = await res.json();
  return data.items || data;
}

export async function createFlow(flow: Partial<Flow>): Promise<Flow> {
  const res = await fetch(FLOWS_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(flow),
  });
  const data = await res.json();
  return data.flow;
}

export async function settleFlow(id: number, pagamentoData: string): Promise<Flow> {
  const res = await fetch(joinUrl(FLOWS_ENDPOINT, `${id}/settle`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pagamentoData }),
  });
  const data = await res.json();
  return data.flow;
}
