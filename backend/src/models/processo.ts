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

export interface ProcessoParticipantLawyer {
  name: string | null;
  document: string | null;
}

export interface ProcessoParticipantRepresentative {
  name: string | null;
  document: string | null;
}

export interface ProcessoParticipant {
  id?: number | string | null;
  name: string | null;
  document: string | null;
  document_type?: string | null;
  side: 'ativo' | 'passivo' | null;
  type: string | null;
  person_type: string | null;
  role: string | null;
  party_role: string | null;
  lawyers?: ProcessoParticipantLawyer[] | null;
  representatives?: ProcessoParticipantRepresentative[] | null;
  registered_at?: string | null;
  source?: string | null;
}

export interface ProcessoMovimentacao {
  id: string;
  data: string | null;
  tipo: string | null;
  tipo_andamento: string | null;
  tipo_publicacao: string | null;
  classificacao_predita: Record<string, unknown> | null;
  conteudo: string | null;
  texto_categoria: string | null;
  fonte: Record<string, unknown> | null;
  criado_em?: string | null;
  atualizado_em?: string | null;
  numero_cnj?: string | null;
  instancia_processo?: string | null;
  sigiloso?: boolean | null;
  crawl_id?: string | null;
  data_cadastro?: string | null;
}

export interface ProcessoAttachment {
  id: string;
  id_andamento: string | null;
  id_anexo: string | null;
  nome: string | null;
  tipo: string | null;
  data_cadastro: string | null;
  instancia_processo: string | null;
  crawl_id: string | null;
}

export interface ProcessoSyncIntegrationInfo {
  id: number;
  provider: string;
  environment: string;
  apiUrl: string | null;
  active: boolean;
}

export interface ProcessoSync {
  id: number;
  processoId: number | null;
  integrationApiKeyId: number | null;
  integration?: ProcessoSyncIntegrationInfo | null;
  remoteRequestId: string | null;
  requestType: string;
  requestedBy: number | null;
  requestedAt: string;
  requestPayload: unknown;
  requestHeaders: unknown;
  status: string;
  statusReason: string | null;
  completedAt: string | null;
  metadata: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface ProcessoSyncResponse {
  id: number;
  processoId: number | null;
  processSyncId: number | null;
  integrationApiKeyId: number | null;
  integration?: ProcessoSyncIntegrationInfo | null;
  deliveryId: string | null;
  source: string;
  statusCode: number | null;
  receivedAt: string;
  payload: unknown;
  headers: unknown;
  errorMessage: string | null;
  createdAt: string;
}

export interface ProcessoSyncAudit {
  id: number;
  processoId: number | null;
  processSyncId: number | null;
  processResponseId: number | null;
  integrationApiKeyId: number | null;
  integration?: ProcessoSyncIntegrationInfo | null;
  eventType: string;
  eventDetails: unknown;
  observedAt: string;
  createdAt: string;
}

export interface ProcessoOportunidadeResumo {
  id: number;
  sequencial_empresa: number | null;
  data_criacao: string | null;
  numero_processo_cnj: string | null;
  numero_protocolo: string | null;
  solicitante_id: number | null;
  solicitante_nome: string | null;
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
  tribunal_acronym?: string | null;
  tribunal?: string | null;
  tribunal_name?: string | null;
  justice_description?: string | null;
  county?: string | Record<string, unknown> | null;
  amount?: string | number | null;
  distribution_date?: string | null;
  subjects?: Array<string | Record<string, unknown> | null> | null;
  classifications?: Array<string | Record<string, unknown> | null> | null;
  tags?: Array<string | null> | Record<string, unknown> | string | null;
  precatory?: boolean | string | null;
  free_justice?: boolean | string | null;
  secrecy_level?: string | null;
  oportunidade_id: number | null;
  advogado_responsavel: string | null;
  data_distribuicao: string | null;
  criado_em: string;
  atualizado_em: string;
  ultima_sincronizacao: string | null;
  ultima_movimentacao?: string | null;
  consultas_api_count: number;
  situacao_processo_id: number | null;
  situacao_processo_nome?: string | null;
  tipo_processo_id: number | null;
  tipo_processo_nome?: string | null;
  area_atuacao_id: number | null;
  area_atuacao_nome?: string | null;
  instancia: string | null;
  sistema_cnj_id: number | null;
  monitorar_processo: boolean;
  envolvidos_id: number | null;
  descricao: string | null;
  setor_id: number | null;
  setor_nome?: string | null;
  data_citacao: string | null;
  data_recebimento: string | null;
  data_arquivamento: string | null;
  data_encerramento: string | null;
  movimentacoes_count: number;
  cliente?: ProcessoClienteResumo | null;
  oportunidade?: ProcessoOportunidadeResumo | null;
  advogados: ProcessoAdvogado[];
  movimentacoes?: ProcessoMovimentacao[];
  attachments?: ProcessoAttachment[];
  participants?: ProcessoParticipant[] | null;
}
