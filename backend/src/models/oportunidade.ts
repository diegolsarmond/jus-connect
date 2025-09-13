import { OportunidadeEnvolvido } from './oportunidadeEnvolvido';

export interface Oportunidade {
  id: number;
  tipo_processo_id: number;
  area_atuacao_id: number | null;
  responsavel_id: number | null;
  numero_processo_cnj: string | null;
  numero_protocolo: string | null;
  vara_ou_orgao: string | null;
  comarca: string | null;
  fase_id: number | null;
  etapa_id: number | null;
  prazo_proximo: string | null;
  status_id: number | null;
  solicitante_id: number | null;
  valor_causa: number | null;
  valor_honorarios: number | null;
  percentual_honorarios: number | null;
  forma_pagamento: string | null;
  parcelas: number | null;
  contingenciamento: string | null;
  detalhes: string | null;
  documentos_anexados: number | null;
  criado_por: number | null;
  data_criacao: string;
  ultima_atualizacao: string;
  envolvidos?: OportunidadeEnvolvido[];
}
