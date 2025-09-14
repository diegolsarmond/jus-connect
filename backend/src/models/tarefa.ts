export interface TarefaResponsavel {
  id_tarefa: number;
  id_usuario: number;
  nome_responsavel: string;
}

export interface Tarefa {
  id: number;
  id_oportunidades: number;
  titulo: string;
  descricao: string | null;
  data: string;
  hora: string;
  dia_inteiro: boolean;
  prioridade: number | null;
  mostrar_na_agenda: boolean;
  privada: boolean;
  recorrente: boolean;
  repetir_quantas_vezes: number;
  repetir_cada_unidade: 'Minutos' | 'Horas' | 'Dias' | 'Semanas' | 'Meses' | null;
  repetir_intervalo: number;
  criado_em: string;
  atualizado_em: string;
  concluido: boolean;
  responsaveis?: TarefaResponsavel[];
}
