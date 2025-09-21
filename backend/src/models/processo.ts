export interface ProcessoClienteResumo {
  id: number;
  nome: string | null;
  documento: string | null;
  tipo: string | null;
}

export interface ProcessoAdvogado {
  id: number;
  nome: string | null;
}

export interface ProcessoMovimentacao {
  id: string;
  data: string | null;
  tipo: string | null;
  tipo_publicacao: string | null;
  classificacao_predita: Record<string, unknown> | null;
  conteudo: string | null;
  texto_categoria: string | null;
  fonte: Record<string, unknown> | null;
  criado_em?: string | null;
  atualizado_em?: string | null;
}

export interface Processo {
  id: number;
  cliente_id: number;
  idempresa: number | null;
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
  ultima_sincronizacao: string | null;
  consultas_api_count: number;
  movimentacoes_count: number;
  cliente?: ProcessoClienteResumo | null;
  advogados: ProcessoAdvogado[];
  movimentacoes?: ProcessoMovimentacao[];
}
