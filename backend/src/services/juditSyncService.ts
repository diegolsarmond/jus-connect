import pool from './db';
import IntegrationApiKeyService, {
  type IntegrationApiKey,
} from './integrationApiKeyService';

type QueryResultRow = { [key: string]: unknown };

export interface JuditProcessSyncParams {
  processId: number;
  empresaId: number;
  numeroCnj: string;
  instanciaAtual: string | null;
  requestedByUserId: number | null;
  withAttachments: boolean;
  onDemand: boolean;
}

export interface JuditProcessSyncResult {
  requestId: string | null;
  summary: {
    parties: number;
    attachments: number;
    movements: number;
    subjects: number;
  };
}

interface JuditDataset {
  requestId: string | null;
  responseId: string | null;
  origin: string | null;
  originId: string | null;
  normalizedCode: string | null;
  processData: {
    idRequisicao: string | null;
    idResposta: string | null;
    idOrigem: string | null;
    numeroCnj: string;
    instancia: number | null;
    nome: string | null;
    area: string | null;
    estado: string | null;
    cidade: string | null;
    assunto: string | null;
    situacao: string | null;
    siglaTribunal: string | null;
    orgaoJulgador: string | null;
    dataDistribuicao: string | null;
    justicaGratuita: boolean | null;
    nivelSigilo: number | null;
    justica: string | null;
    descricaoJustica: string | null;
    valor: number | null;
    idUltimoAndamento: string | null;
    classificacaoPrincipalCodigo: string | null;
    classificacaoPrincipalNome: string | null;
  };
  subjects: Array<{
    numeroCnj: string;
    codigo: string | null;
    assunto: string | null;
  }>;
  attachments: Array<{
    numeroCnj: string;
    instancia: number | null;
    andamentoId: string | null;
    anexoId: string | null;
    nome: string | null;
    tipo: string | null;
    criadoEm: string | null;
    crawlId: string | null;
    situacao: string | null;
    origem: string;
  }>;
  movements: Array<{
    id: string;
    numeroCnj: string;
    instancia: number | null;
    tipo: string | null;
    conteudo: string | null;
    dataAndamento: string | null;
    criadoEm: string | null;
    atualizadoEm: string | null;
    sigiloso: boolean;
    crawlId: string | null;
  }>;
  parties: Array<{
    numeroCnj: string;
    nome: string | null;
    polo: string | null;
    tipoPessoa: string | null;
    documentoPrincipal: string | null;
    tipoDocumentoPrincipal: string | null;
    possuiAdvogados: boolean;
  }>;
}

const integrationService = new IntegrationApiKeyService();

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

const sanitizeText = (value: unknown): string | null => {
  if (value === null || value === undefined) {
    return null;
  }
  const cleaned = String(value)
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\r?\n/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\\/g, '')
    .replace(/\*\*/g, '*')
    .trim();
  return cleaned.length > 0 ? cleaned : null;
};

const toOptionalString = (value: unknown): string | null => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  return null;
};

const toOptionalNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const toOptionalBoolean = (value: unknown): boolean | null => {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return null;
    }
    return value !== 0;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      return null;
    }
    if (['true', '1', 'sim', 'yes'].includes(normalized)) {
      return true;
    }
    if (['false', '0', 'nao', 'não', 'no'].includes(normalized)) {
      return false;
    }
  }
  return null;
};

const normalizeProcessNumberDigits = (value: string | null): string | null => {
  if (!value) {
    return null;
  }
  const digits = value.replace(/\D+/g, '');
  return digits || null;
};

const resolveBaseUrl = (integration: IntegrationApiKey | null): string => {
  const envBase =
    typeof process.env.JUDIT_BASE_URL === 'string' && process.env.JUDIT_BASE_URL.trim()
      ? process.env.JUDIT_BASE_URL.trim()
      : typeof process.env.JUDIT_API_URL === 'string' && process.env.JUDIT_API_URL.trim()
      ? process.env.JUDIT_API_URL.trim()
      : null;
  const rawBase = integration?.apiUrl?.trim() || envBase || 'https://requests.prod.judit.io';
  return rawBase.replace(/\/+$/, '');
};

const resolveApiKey = (integration: IntegrationApiKey | null): string | null => {
  if (integration && typeof integration.key === 'string' && integration.key.trim()) {
    return integration.key.trim();
  }
  if (typeof process.env.JUDIT_API_KEY === 'string' && process.env.JUDIT_API_KEY.trim()) {
    return process.env.JUDIT_API_KEY.trim();
  }
  return null;
};

const buildUrl = (base: string, path: string, params?: Record<string, string>) => {
  const normalizedBase = base.endsWith('/') ? base.slice(0, -1) : base;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(normalizedPath, `${normalizedBase}/`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, value);
      }
    }
  }
  return url.toString();
};

const parseJson = (text: string): any => {
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const performRequest = async (
  input: string,
  init: RequestInit,
): Promise<{ ok: boolean; status: number; data: any; text: string }> => {
  const response = await fetch(input, init);
  const text = await response.text();
  const data = parseJson(text);
  return { ok: response.ok, status: response.status, data, text };
};

const createRemoteRequest = async (
  baseUrl: string,
  apiKey: string,
  payload: Record<string, unknown>,
) => {
  const requestUrl = buildUrl(baseUrl, '/requests');
  const result = await performRequest(requestUrl, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'api-key': apiKey,
    },
    body: JSON.stringify(payload),
  });
  if (!result.ok) {
    const message =
      typeof result.data?.error === 'string' && result.data.error.trim()
        ? result.data.error.trim()
        : `Falha ao criar solicitação na Judit (HTTP ${result.status})`;
    throw new Error(message);
  }
  return result.data ?? {};
};

const fetchRemoteRequest = async (baseUrl: string, apiKey: string, requestId: string) => {
  const requestUrl = buildUrl(baseUrl, `/requests/${encodeURIComponent(requestId)}`);
  const result = await performRequest(requestUrl, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'api-key': apiKey,
    },
  });
  if (!result.ok) {
    const message =
      typeof result.data?.error === 'string' && result.data.error.trim()
        ? result.data.error.trim()
        : `Falha ao consultar status da solicitação (HTTP ${result.status})`;
    throw new Error(message);
  }
  return result.data ?? {};
};

const pollRemoteRequest = async (baseUrl: string, apiKey: string, requestId: string) => {
  const maxAttempts = 20;
  const intervalMs = 3000;
  let lastPayload: any = null;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const payload = await fetchRemoteRequest(baseUrl, apiKey, requestId);
    lastPayload = payload;
    const statusRaw =
      typeof payload?.status === 'string'
        ? payload.status.trim().toLowerCase()
        : typeof payload?.request?.status === 'string'
        ? payload.request.status.trim().toLowerCase()
        : '';
    if (['completed', 'failed', 'cancelled'].includes(statusRaw)) {
      return { status: statusRaw, payload };
    }
    await wait(intervalMs);
  }
  throw new Error('Tempo limite excedido ao aguardar conclusão da Judit');
};

const fetchResponsePages = async (baseUrl: string, apiKey: string, requestId: string) => {
  const pages: any[] = [];
  let page = 1;
  const pageSize = 100;
  for (;;) {
    const responseUrl = buildUrl(baseUrl, '/responses', {
      request_id: requestId,
      page: String(page),
      page_size: String(pageSize),
    });
    const result = await performRequest(responseUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'api-key': apiKey,
      },
    });
    if (!result.ok) {
      const message =
        typeof result.data?.error === 'string' && result.data.error.trim()
          ? result.data.error.trim()
          : `Falha ao obter respostas da Judit (HTTP ${result.status})`;
      throw new Error(message);
    }
    const payload = result.data ?? {};
    pages.push(payload);
    const pageCountCandidate = toOptionalNumber(payload?.page_count);
    const pageCount =
      pageCountCandidate && pageCountCandidate > 0 ? Math.trunc(pageCountCandidate) : 1;
    if (page >= pageCount) {
      break;
    }
    page += 1;
  }
  return pages;
};

const extractLawsuitEntries = (pages: any[]): Array<Record<string, unknown>> => {
  const entries: Array<Record<string, unknown>> = [];
  for (const page of pages) {
    if (page && typeof page === 'object') {
      const dataList = Array.isArray(page.page_data) ? page.page_data : [];
      for (const item of dataList) {
        if (item && typeof item === 'object') {
          const entry = item as Record<string, unknown>;
          const responseType = toOptionalString(entry.response_type ?? entry.type);
          if (responseType && responseType.toLowerCase() === 'lawsuit') {
            entries.push(entry);
          }
        }
      }
    }
  }
  return entries;
};

const buildDatasetFromEntry = (
  entry: Record<string, unknown>,
  numeroCnj: string,
): JuditDataset => {
  const responseDataRaw =
    entry.response_data ?? entry.result ?? entry.lawsuit ?? entry.data ?? entry;
  if (!responseDataRaw || typeof responseDataRaw !== 'object') {
    throw new Error('Resposta da Judit não contém dados do processo');
  }
  const responseData = responseDataRaw as Record<string, unknown>;
  const requestId = toOptionalString(entry.request_id ?? entry.requestId ?? entry.request);
  const responseId = toOptionalString(entry.response_id ?? entry.responseId);
  const origin = toOptionalString(entry.origin);
  const originId = toOptionalString(entry.origin_id ?? entry.originId);
  const code = toOptionalString(responseData.code) ?? numeroCnj;
  const normalizedCode = normalizeProcessNumberDigits(code) ?? normalizeProcessNumberDigits(numeroCnj);
  const instanciaNumber = toOptionalNumber(responseData.instance);
  const instanciaString = toOptionalString(responseData.instance);

  const subjects: JuditDataset['subjects'] = [];
  const appendSubject = (codigo: string | null, assunto: string | null) => {
    if (codigo === null && assunto === null) {
      return;
    }
    subjects.push({ numeroCnj: code ?? numeroCnj, codigo, assunto });
  };
  if (Array.isArray(responseData.subjects)) {
    for (const subject of responseData.subjects) {
      if (typeof subject === 'string') {
        const sanitized = sanitizeText(subject);
        if (sanitized) {
          appendSubject(null, sanitized);
        }
      } else if (subject && typeof subject === 'object') {
        const record = subject as Record<string, unknown>;
        const codigo = sanitizeText(record.code ?? record.id);
        const assunto = sanitizeText(record.name ?? record.subject);
        if (codigo || assunto) {
          appendSubject(codigo, assunto);
        }
      }
    }
  } else if (typeof responseData.subject === 'string') {
    const tokens = responseData.subject
      .split(/[;|,]/)
      .map((token) => sanitizeText(token))
      .filter((token): token is string => Boolean(token));
    if (tokens.length === 0) {
      appendSubject(null, sanitizeText(responseData.subject));
    } else {
      for (const token of tokens) {
        appendSubject(null, token);
      }
    }
  }

  const attachments: JuditDataset['attachments'] = [];
  const appendAttachment = (
    source: Record<string, unknown> | string | number,
    origem: string,
    stepId: string | null,
    fallbackDate: string | null,
  ) => {
    if (source === null || source === undefined) {
      return;
    }
    if (typeof source === 'string' || typeof source === 'number') {
      attachments.push({
        numeroCnj: code ?? numeroCnj,
        instancia: instanciaNumber ?? (instanciaString ? Number(instanciaString) : null),
        andamentoId: stepId,
        anexoId: String(source),
        nome: null,
        tipo: null,
        criadoEm: fallbackDate,
        crawlId: null,
        situacao: null,
        origem,
      });
      return;
    }
    const record = source as Record<string, unknown>;
    const anexoId =
      toOptionalString(record.attachment_id ?? record.id ?? record.file_id) ??
      (typeof record === 'number' ? String(record) : null);
    attachments.push({
      numeroCnj: code ?? numeroCnj,
      instancia: instanciaNumber ?? (instanciaString ? Number(instanciaString) : null),
      andamentoId: stepId ?? toOptionalString(record.step_id),
      anexoId,
      nome:
        sanitizeText(
          record.attachment_name ?? record.name ?? record.filename ?? record.description,
        ) ?? null,
      tipo:
        sanitizeText(record.extension ?? record.type ?? record.mime ?? record.content_type) ?? null,
      criadoEm:
        toOptionalString(
          record.attachment_date ?? record.created_at ?? record.uploaded_at ?? fallbackDate,
        ) ?? fallbackDate,
      crawlId: sanitizeText((record.tags as Record<string, unknown> | undefined)?.crawl_id),
      situacao: sanitizeText(record.status),
      origem,
    });
  };

  if (Array.isArray(responseData.documents)) {
    for (const doc of responseData.documents) {
      appendAttachment(doc as Record<string, unknown>, 'process', null, null);
    }
  }
  if (Array.isArray(responseData.attachments)) {
    for (const doc of responseData.attachments) {
      appendAttachment(doc as Record<string, unknown>, 'process', null, null);
    }
  }
  if (Array.isArray(responseData.files)) {
    for (const doc of responseData.files) {
      appendAttachment(doc as Record<string, unknown>, 'process', null, null);
    }
  }

  const movements: JuditDataset['movements'] = [];
  const seenMovements = new Set<string>();
  const appendMovement = (step: Record<string, unknown>) => {
    const stepId = toOptionalString(step.step_id ?? step.id);
    if (!stepId) {
      return;
    }
    if (seenMovements.has(stepId)) {
      return;
    }
    seenMovements.add(stepId);
    movements.push({
      id: stepId,
      numeroCnj: code ?? numeroCnj,
      instancia: instanciaNumber ?? (instanciaString ? Number(instanciaString) : null),
      tipo: sanitizeText(step.step_type ?? step.type ?? step.category),
      conteudo: sanitizeText(step.content),
      dataAndamento: toOptionalString(step.step_date ?? step.date),
      criadoEm: toOptionalString(step.created_at ?? step.createdAt),
      atualizadoEm: toOptionalString(step.updated_at ?? step.updatedAt),
      sigiloso: Boolean(toOptionalBoolean(step.private)),
      crawlId: sanitizeText((step.tags as Record<string, unknown> | undefined)?.crawl_id),
    });
    if (Array.isArray(step.documents)) {
      for (const doc of step.documents) {
        appendAttachment(
          doc as Record<string, unknown>,
          'step',
          stepId,
          toOptionalString(step.step_date ?? step.date),
        );
      }
    }
    if (Array.isArray(step.attachments)) {
      for (const doc of step.attachments) {
        appendAttachment(
          doc as Record<string, unknown>,
          'step',
          stepId,
          toOptionalString(step.step_date ?? step.date),
        );
      }
    }
    if (Array.isArray(step.files)) {
      for (const doc of step.files) {
        appendAttachment(
          doc as Record<string, unknown>,
          'step',
          stepId,
          toOptionalString(step.step_date ?? step.date),
        );
      }
    }
  };

  if (Array.isArray(responseData.steps)) {
    for (const step of responseData.steps) {
      if (step && typeof step === 'object') {
        appendMovement(step as Record<string, unknown>);
      }
    }
  }
  const lastStepRaw = responseData.last_step;
  if (lastStepRaw && typeof lastStepRaw === 'object') {
    appendMovement(lastStepRaw as Record<string, unknown>);
  }

  const parties: JuditDataset['parties'] = [];
  if (Array.isArray(responseData.parties)) {
    for (const party of responseData.parties) {
      if (!party || typeof party !== 'object') {
        continue;
      }
      const record = party as Record<string, unknown>;
      const documents = Array.isArray(record.documents) ? record.documents : [];
      const firstDocument =
        documents.length > 0 && documents[0] && typeof documents[0] === 'object'
          ? (documents[0] as Record<string, unknown>)
          : null;
      parties.push({
        numeroCnj: code ?? numeroCnj,
        nome:
          sanitizeText(record.name) ??
          sanitizeText(record.nome) ??
          sanitizeText(record.party_name),
        polo: sanitizeText(record.side ?? record.polo ?? record.position),
        tipoPessoa: sanitizeText(record.person_type ?? record.type),
        documentoPrincipal:
          sanitizeText(record.main_document) ??
          sanitizeText(firstDocument?.document) ??
          sanitizeText(firstDocument?.number),
        tipoDocumentoPrincipal:
          sanitizeText(firstDocument?.document_type) ?? sanitizeText(firstDocument?.type),
        possuiAdvogados:
          Array.isArray(record.lawyers) && record.lawyers.filter(Boolean).length > 0,
      });
    }
  }

  return {
    requestId,
    responseId,
    origin,
    originId,
    normalizedCode,
    processData: {
      idRequisicao: requestId,
      idResposta: responseId,
      idOrigem: originId,
      numeroCnj: code ?? numeroCnj,
      instancia: instanciaNumber ?? (instanciaString ? Number(instanciaString) : null),
      nome: sanitizeText(responseData.name),
      area: sanitizeText(responseData.area),
      estado: sanitizeText(responseData.state),
      cidade: sanitizeText(responseData.city),
      assunto: (() => {
        if (typeof responseData.subject === 'string') {
          return sanitizeText(responseData.subject);
        }
        if (Array.isArray(responseData.subjects)) {
          const collected = responseData.subjects
            .map((subject: unknown) => {
              if (typeof subject === 'string') {
                return sanitizeText(subject);
              }
              if (subject && typeof subject === 'object') {
                const record = subject as Record<string, unknown>;
                return (
                  sanitizeText(record.name) ??
                  sanitizeText(record.subject) ??
                  sanitizeText(record.code)
                );
              }
              return null;
            })
            .filter((value): value is string => Boolean(value));
          return collected.length > 0 ? collected.join(' | ') : null;
        }
        return null;
      })(),
      situacao: sanitizeText(responseData.status),
      siglaTribunal: sanitizeText(responseData.tribunal_acronym),
      orgaoJulgador:
        sanitizeText(responseData.court) ??
        sanitizeText(responseData.county) ??
        sanitizeText(responseData.judging_body),
      dataDistribuicao: toOptionalString(responseData.distribution_date),
      justicaGratuita: toOptionalBoolean(responseData.free_justice) ?? false,
      nivelSigilo: toOptionalNumber(responseData.secrecy_level),
      justica: sanitizeText(responseData.justice),
      descricaoJustica: sanitizeText(responseData.justice_description),
      valor: toOptionalNumber(responseData.amount),
      idUltimoAndamento: toOptionalString(
        (responseData.last_step as Record<string, unknown> | null | undefined)?.step_id,
      ),
      classificacaoPrincipalCodigo: (() => {
        if (Array.isArray(responseData.classifications) && responseData.classifications.length > 0) {
          const first = responseData.classifications[0] as Record<string, unknown>;
          return sanitizeText(first.code);
        }
        return null;
      })(),
      classificacaoPrincipalNome: (() => {
        if (Array.isArray(responseData.classifications) && responseData.classifications.length > 0) {
          const first = responseData.classifications[0] as Record<string, unknown>;
          return sanitizeText(first.name);
        }
        return null;
      })(),
    },
    subjects,
    attachments,
    movements,
    parties,
  };
};

const persistDataset = async (
  dataset: JuditDataset,
  options: {
    processId: number;
    numeroCnj: string;
    instanciaAtual: string | null;
    withAttachments: boolean;
  },
) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM public.trigger_envolvidos_processo WHERE numero_cnj = $1', [
      options.numeroCnj,
    ]);
    await client.query('DELETE FROM public.trigger_assuntos_processo WHERE numero_cnj = $1', [
      options.numeroCnj,
    ]);
    const shouldPersistAttachments = options.withAttachments;
    if (shouldPersistAttachments) {
      await client.query('DELETE FROM public.trigger_anexos_processo WHERE numero_cnj = $1', [
        options.numeroCnj,
      ]);
    }
    await client.query(
      'DELETE FROM public.trigger_movimentacao_processo WHERE numero_cnj = $1',
      [options.numeroCnj],
    );
    await client.query('DELETE FROM public.trigger_dados_processo WHERE numero_cnj = $1', [
      options.numeroCnj,
    ]);

    const data = dataset.processData;
    await client.query(
      `INSERT INTO public.trigger_dados_processo (
         id_requisicao,
         id_resposta,
         id_origem,
         numero_cnj,
         instancia,
         nome,
         area,
         estado,
         cidade,
         assunto,
         situacao,
         sigla_tribunal,
         orgao_julgador,
         data_distribuicao,
         justica_gratuita,
         nivel_sigilo,
         justica,
         descricao_justica,
         valor,
         id_ultimo_andamento,
         data_cadastro,
         classificacao_principal_codigo,
         classificacao_principal_nome
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, NOW(), $21, $22)`,
      [
        data.idRequisicao,
        data.idResposta,
        data.idOrigem,
        data.numeroCnj,
        data.instancia,
        data.nome,
        data.area,
        data.estado,
        data.cidade,
        data.assunto,
        data.situacao,
        data.siglaTribunal,
        data.orgaoJulgador,
        data.dataDistribuicao,
        data.justicaGratuita,
        data.nivelSigilo,
        data.justica,
        data.descricaoJustica,
        data.valor,
        data.idUltimoAndamento,
        data.classificacaoPrincipalCodigo,
        data.classificacaoPrincipalNome,
      ],
    );

    for (const party of dataset.parties) {
      await client.query(
        `INSERT INTO public.trigger_envolvidos_processo (
           numero_cnj,
           nome,
           polo,
           tipo_pessoa,
           documento_principal,
           tipo_documento_principal,
           possui_advogados,
           data_cadastro
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [
          party.numeroCnj,
          party.nome,
          party.polo,
          party.tipoPessoa,
          party.documentoPrincipal,
          party.tipoDocumentoPrincipal,
          party.possuiAdvogados,
        ],
      );
    }

    for (const subject of dataset.subjects) {
      await client.query(
        `INSERT INTO public.trigger_assuntos_processo (
           numero_cnj,
           codigo_assunto,
           assunto
         ) VALUES ($1, $2, $3)`,
        [subject.numeroCnj, subject.codigo, subject.assunto],
      );
    }

    const movementIdentifierMap = new Map<string, string>();

    for (const movement of dataset.movements) {
      const insertResult = await client.query(
        `INSERT INTO public.trigger_movimentacao_processo (
           numero_cnj,
           instancia_processo,
           tipo_andamento,
           conteudo,
           sigiloso,
           data_movimentacao
         )
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [
          movement.numeroCnj,
          movement.instancia,
          movement.tipo,
          movement.conteudo,
          movement.sigiloso,
          movement.dataAndamento,
        ],
      );

      const insertedId = insertResult.rows?.[0]?.id;
      if (insertedId !== null && insertedId !== undefined) {
        movementIdentifierMap.set(movement.id, String(insertedId));
      }
    }

    if (shouldPersistAttachments) {
      for (const attachment of dataset.attachments) {
        await client.query(
          `INSERT INTO public.trigger_anexos_processo (
             numero_cnj,
             instancia_processo,
             id_andamento,
             id_anexo,
             nome,
             tipo,
             criado_em,
             crawl_id,
             situacao,
             origem
           )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            attachment.numeroCnj,
            attachment.instancia,
            (() => {
              if (!attachment.andamentoId) {
                return null;
              }

              const mapped = movementIdentifierMap.get(attachment.andamentoId);
              const resolved = mapped ?? attachment.andamentoId;
              const normalized = String(resolved).trim();
              return normalized ? normalized : null;
            })(),
            attachment.anexoId,
            attachment.nome,
            attachment.tipo,
            attachment.criadoEm,
            attachment.crawlId,
            attachment.situacao,
            attachment.origem,
          ],
        );
      }
    }

    await client.query(
      `UPDATE public.processos
         SET ultima_sincronizacao = NOW(),
             atualizado_em = NOW(),
             instancia = COALESCE(instancia, $2)
       WHERE id = $1`,
      [
        options.processId,
        dataset.processData.instancia !== null
          ? String(dataset.processData.instancia)
          : options.instanciaAtual,
      ],
    );

    let attachmentsCount = dataset.attachments.length;
    if (!shouldPersistAttachments) {
      const attachmentsCountResult = await client.query(
        'SELECT COUNT(*)::int AS count FROM public.trigger_anexos_processo WHERE numero_cnj = $1',
        [options.numeroCnj],
      );
      const countRow = attachmentsCountResult.rows[0] as QueryResultRow | undefined;
      const parsedCount = countRow?.count;
      attachmentsCount =
        typeof parsedCount === 'number'
          ? parsedCount
          : Number.parseInt(String(parsedCount ?? '0'), 10);
    }

    await client.query('COMMIT');

    return {
      parties: dataset.parties.length,
      movements: dataset.movements.length,
      attachments: attachmentsCount,
      subjects: dataset.subjects.length,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

const insertProcessoConsulta = async (
  processId: number,
  sucesso: boolean,
  detalhes: string,
) => {
  try {
    await pool.query(
      `INSERT INTO public.processo_consultas_api (processo_id, sucesso, detalhes)
       VALUES ($1, $2, $3)`,
      [processId, sucesso, detalhes],
    );
  } catch (error) {
    console.error(error);
  }
};

const upsertJuditRequest = async (
  processId: number,
  requestId: string | null,
  status: string,
  result: Record<string, unknown>,
) => {
  if (!requestId) {
    return;
  }
  try {
    await pool.query(
      `INSERT INTO public.processo_judit_requests (processo_id, request_id, status, source, result)
       VALUES ($1, $2, $3, 'manual', $4::jsonb)
       ON CONFLICT (request_id) DO UPDATE
         SET processo_id = EXCLUDED.processo_id,
             status = EXCLUDED.status,
             result = EXCLUDED.result,
             atualizado_em = NOW()`,
      [processId, requestId, status, result],
    );
  } catch (error) {
    console.error(error);
  }
};

export const executeJuditProcessSync = async (
  params: JuditProcessSyncParams,
): Promise<JuditProcessSyncResult> => {
  const integrations = await integrationService.list({ empresaId: params.empresaId });
  const integration =
    integrations.find((item) => item.provider === 'judit' && item.active) ??
    integrations.find((item) => item.provider === 'judit') ??
    null;
  const apiKey = resolveApiKey(integration);
  if (!apiKey) {
    throw new Error('Integração com a Judit não configurada');
  }
  const baseUrl = resolveBaseUrl(integration);

  const requestPayload = {
    search: {
      search_key: params.numeroCnj,
      search_type: 'lawsuit_cnj',
    },
    on_demand: params.onDemand,
    with_attachments: params.withAttachments,
  };

  const syncInsert = await pool.query(
    `INSERT INTO public.process_sync (
       processo_id,
       integration_api_key_id,
       request_type,
       requested_by,
       request_payload,
       status,
       metadata
     )
     VALUES ($1, $2, 'manual', $3, $4::jsonb, 'pending', $5::jsonb)
     RETURNING id`,
    [
      params.processId,
      integration?.id ?? null,
      params.requestedByUserId,
      JSON.stringify(requestPayload),
      JSON.stringify({ numeroCnj: params.numeroCnj }),
    ],
  );

  const syncRow = syncInsert.rowCount > 0 ? (syncInsert.rows[0] as QueryResultRow) : null;
  const syncId = syncRow
    ? typeof syncRow.id === 'number'
      ? syncRow.id
      : typeof syncRow.id === 'string' && syncRow.id.trim()
      ? Number.parseInt(syncRow.id.trim(), 10)
      : null
    : null;
  let remoteRequestId: string | null = null;
  let initialPayload: Record<string, unknown> | null = null;

  try {
    initialPayload = (await createRemoteRequest(baseUrl, apiKey, requestPayload)) ?? {};
    remoteRequestId =
      toOptionalString(initialPayload?.request_id ?? initialPayload?.id ?? initialPayload?.requestId) ??
      null;
    const initialStatus = toOptionalString(initialPayload?.status) ?? 'processing';

    if (syncId) {
      await pool.query(
        `UPDATE public.process_sync
           SET remote_request_id = COALESCE($1, remote_request_id),
               status = $2,
               metadata = $3::jsonb
         WHERE id = $4`,
        [
          remoteRequestId,
          initialStatus,
          JSON.stringify({
            numeroCnj: params.numeroCnj,
            request: initialPayload,
            flags: requestPayload,
          }),
          syncId,
        ],
      );
    }

    if (!remoteRequestId) {
      throw new Error('Judit não retornou o identificador da solicitação');
    }

    const completion = await pollRemoteRequest(baseUrl, apiKey, remoteRequestId);
    if (syncId) {
      await pool.query(
        `UPDATE public.process_sync
           SET status = $1,
               metadata = $2::jsonb
         WHERE id = $3`,
        [
          completion.status,
          JSON.stringify({
            numeroCnj: params.numeroCnj,
            request: initialPayload,
            statusPayload: completion.payload ?? null,
            flags: requestPayload,
          }),
          syncId,
        ],
      );
    }

    if (completion.status !== 'completed') {
      const message =
        typeof completion.payload?.message === 'string' && completion.payload.message.trim()
          ? completion.payload.message.trim()
          : 'A Judit não concluiu a sincronização do processo';
      throw new Error(message);
    }

    const responsePages = await fetchResponsePages(baseUrl, apiKey, remoteRequestId);
    const lawsuits = extractLawsuitEntries(responsePages);
    if (lawsuits.length === 0) {
      throw new Error('Nenhum processo retornado pela Judit');
    }

    const normalizedNumero = normalizeProcessNumberDigits(params.numeroCnj);
    let dataset = buildDatasetFromEntry(lawsuits[0], params.numeroCnj);
    if (normalizedNumero) {
      for (const entry of lawsuits) {
        const candidate = buildDatasetFromEntry(entry, params.numeroCnj);
        if (candidate.normalizedCode && candidate.normalizedCode === normalizedNumero) {
          dataset = candidate;
          break;
        }
      }
    }

    const summary = await persistDataset(dataset, {
      processId: params.processId,
      numeroCnj: params.numeroCnj,
      instanciaAtual: params.instanciaAtual,
      withAttachments: params.withAttachments,
    });

    if (syncId) {
      await pool.query(
        `UPDATE public.process_sync
           SET status = 'completed',
               status_reason = NULL,
               completed_at = NOW(),
               remote_request_id = COALESCE($1, remote_request_id),
               metadata = $2::jsonb
         WHERE id = $3`,
        [
          remoteRequestId,
          JSON.stringify({
            numeroCnj: params.numeroCnj,
            request: initialPayload,
            summary,
            flags: requestPayload,
          }),
          syncId,
        ],
      );
    }

    await upsertJuditRequest(params.processId, remoteRequestId, 'completed', {
      request: initialPayload ?? null,
      responses: responsePages,
    });

    await insertProcessoConsulta(
      params.processId,
      true,
      'Sincronização manual com a Judit concluída',
    );

    return {
      requestId: remoteRequestId,
      summary,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao sincronizar processo';
    if (syncId) {
      try {
        await pool.query(
          `UPDATE public.process_sync
             SET status = 'failed',
                 status_reason = $1,
                 completed_at = NOW(),
                 metadata = $2::jsonb
           WHERE id = $3`,
          [
            message,
            JSON.stringify({
              numeroCnj: params.numeroCnj,
              request: initialPayload,
              remoteRequestId,
            }),
            syncId,
          ],
        );
      } catch (updateError) {
        console.error(updateError);
      }
    }

    await insertProcessoConsulta(params.processId, false, message);
    await upsertJuditRequest(params.processId, remoteRequestId, 'failed', {
      request: initialPayload ?? null,
      error: message,
    });

    throw error;
  }
};

export default executeJuditProcessSync;
