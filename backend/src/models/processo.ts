export interface ProcessoClienteResumo {
  id: number;
  nome: string | null;
  documento: string | null;
  tipo: string | null;
}

export interface Processo {
  id: number;
  cliente_id: number;
  numero: string;
  uf: string | null;
  municipio: string | null;
  orgao_julgador: string | null;
  tipo: string | null;
  status: string | null;
  classe_judicial: string | null;
  assunto: string | null;
  jurisdicao: string | null;
  advogado_responsavel: string | null;
  data_distribuicao: string | null;
  criado_em: string;
  atualizado_em: string;
  cliente?: ProcessoClienteResumo | null;
}
