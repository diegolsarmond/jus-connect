export interface Flow {
  id: number | string;
  tipo: 'receita' | 'despesa';
  conta_id: number | null;
  categoria_id: number | null;
  descricao: string;
  vencimento: string;
  pagamento: string | null;
  valor: number;
  status: 'pendente' | 'pago';
}
