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
  oportunidade_id: number | null;
  advogado_responsavel: string | null;
  data_distribuicao: string | null;
  criado_em: string;
  atualizado_em: string;
  ultima_sincronizacao: string | null;
  consultas_api_count: number;
  movimentacoes_count: number;
  cliente?: ProcessoClienteResumo | null;
  oportunidade?: ProcessoOportunidadeResumo | null;
  advogados: ProcessoAdvogado[];
  movimentacoes?: ProcessoMovimentacao[];
  juditSyncs?: ProcessoSync[];
  juditResponses?: ProcessoSyncResponse[];
  juditAuditTrail?: ProcessoSyncAudit[];
}
