import assert from 'node:assert/strict';
import test from 'node:test';
import type { Request, Response } from 'express';
import pool from '../src/services/db';
import * as juditProcessServiceModule from '../src/services/juditProcessService';

const getJuditServiceInstance = (): any =>
  (juditProcessServiceModule.default as { default?: unknown }).default ??
  juditProcessServiceModule.default;

type QueryResponse = { rows: any[]; rowCount: number };

type ProcessResponseShape = { [key: string]: unknown };

const createMockResponse = () => {
  const response: Partial<Response> & { statusCode: number; body: unknown } = {
    statusCode: 200,
    body: undefined,
    status(code: number) {
      this.statusCode = code;
      return this as Response;
    },
    json(payload: unknown) {
      this.body = payload;
      return this as Response;
    },
  };

  return response as Response & { statusCode: number; body: unknown };
};

let getProcessoById: typeof import('../src/controllers/processoController')['getProcessoById'];

test.before(async () => {
  ({ getProcessoById } = await import('../src/controllers/processoController'));
});

test('getProcessoById does not trigger Judit when local history exists', async () => {
  const processoRow: ProcessResponseShape = {
    id: 101,
    cliente_id: null,
    idempresa: 77,
    numero: '0000000-00.0000.0.00.0000',
    uf: null,
    municipio: null,
    orgao_julgador: null,
    tipo: null,
    status: null,
    classe_judicial: null,
    assunto: null,
    jurisdicao: null,
    oportunidade_id: null,
    oportunidade_sequencial_empresa: null,
    oportunidade_data_criacao: null,
    oportunidade_numero_processo_cnj: null,
    oportunidade_numero_protocolo: null,
    oportunidade_solicitante_id: null,
    oportunidade_solicitante_nome: null,
    advogado_responsavel: null,
    data_distribuicao: null,
    criado_em: '2024-01-01T10:00:00.000Z',
    atualizado_em: '2024-01-02T10:00:00.000Z',
    ultima_sincronizacao: null,
    consultas_api_count: 3,
    judit_tracking_id: null,
    judit_tracking_hour_range: null,
    cliente_nome: null,
    cliente_documento: null,
    cliente_tipo: null,
    advogados: '[]',
    movimentacoes: '[]',
    movimentacoes_count: 0,
    judit_last_request: {
      request_id: 'req-123',
      status: 'completed',
      source: 'manual',
      result: { foo: 'bar' },
      criado_em: '2024-01-01T10:00:00.000Z',
      atualizado_em: '2024-01-01T11:00:00.000Z',
    },
  };

  const poolResponses: QueryResponse[] = [
    { rows: [{ empresa: processoRow.idempresa }], rowCount: 1 },
    { rows: [processoRow], rowCount: 1 },
    { rows: [], rowCount: 0 },
    {
      rows: [
        {
          id: 301,
          processo_id: processoRow.id,
          integration_api_key_id: null,
          remote_request_id: 'remote-1',
          request_type: 'manual',
          requested_by: null,
          requested_at: '2024-01-01T10:00:00.000Z',
          request_payload: null,
          request_headers: null,
          status: 'completed',
          status_reason: null,
          completed_at: '2024-01-01T11:00:00.000Z',
          metadata: { result: { success: true } },
          created_at: '2024-01-01T10:00:01.000Z',
          updated_at: '2024-01-01T10:00:02.000Z',
          provider: null,
          environment: null,
          url_api: null,
          active: true,
        },
      ],
      rowCount: 1,
    },
    {
      rows: [
        {
          id: 401,
          processo_id: processoRow.id,
          process_sync_id: 301,
          integration_api_key_id: null,
          delivery_id: 'delivery-1',
          source: 'webhook',
          status_code: 200,
          received_at: '2024-01-01T12:00:00.000Z',
          payload: { ok: true },
          headers: null,
          error_message: null,
          created_at: '2024-01-01T12:00:01.000Z',
          provider: null,
          environment: null,
          url_api: null,
          active: true,
        },
      ],
      rowCount: 1,
    },
    { rows: [], rowCount: 0 },
  ];

  const req = {
    params: { id: String(processoRow.id) },
    auth: { userId: 55 },
  } as unknown as Request;

  const res = createMockResponse();

  const poolMock = test.mock.method(pool, 'query', async (text: string) => {
    if (poolResponses.length === 0) {
      throw new Error(`Unexpected pool query: ${text}`);
    }
    return poolResponses.shift()!;
  });

  const originalListSyncs = juditProcessServiceModule.listProcessSyncs;
  const originalListResponses = juditProcessServiceModule.listProcessResponses;
  const originalListAudits = juditProcessServiceModule.listSyncAudits;

  juditProcessServiceModule.listProcessSyncs = async () => [{ id: 1 } as any];
  juditProcessServiceModule.listProcessResponses = async () => [{ id: 2 } as any];
  juditProcessServiceModule.listSyncAudits = async () => [];

  const juditService = getJuditServiceInstance();
  const originalIsEnabled = juditService.isEnabled;
  const originalEnsure = juditService.ensureTrackingForProcess;
  const originalTrigger = juditService.triggerRequestForProcess;

  const ensureCalls: unknown[][] = [];
  const triggerCalls: unknown[][] = [];

  juditService.isEnabled = async () => true;
  juditService.ensureTrackingForProcess = async (...args: unknown[]) => {
    ensureCalls.push(args);
    return null;
  };
  juditService.triggerRequestForProcess = async (...args: unknown[]) => {
    triggerCalls.push(args);
    return null;
  };

  try {
    await getProcessoById(req, res);

    assert.equal(res.statusCode, 200);
    const body = res.body as Record<string, unknown>;
    assert.ok(body);
    assert.equal(ensureCalls.length, 0);
    assert.equal(triggerCalls.length, 0);
  } finally {
    juditService.triggerRequestForProcess = originalTrigger;
    juditService.ensureTrackingForProcess = originalEnsure;
    juditService.isEnabled = originalIsEnabled;
    juditProcessServiceModule.listSyncAudits = originalListAudits;
    juditProcessServiceModule.listProcessResponses = originalListResponses;
    juditProcessServiceModule.listProcessSyncs = originalListSyncs;
    poolMock.mock.restore();
  }
});

test('getProcessoById triggers Judit when history is missing', async () => {
  const processoRow: ProcessResponseShape = {
    id: 202,
    cliente_id: null,
    idempresa: 88,
    numero: '1111111-11.1111.1.11.1111',
    uf: null,
    municipio: null,
    orgao_julgador: null,
    tipo: null,
    status: null,
    classe_judicial: null,
    assunto: null,
    jurisdicao: null,
    oportunidade_id: null,
    oportunidade_sequencial_empresa: null,
    oportunidade_data_criacao: null,
    oportunidade_numero_processo_cnj: null,
    oportunidade_numero_protocolo: null,
    oportunidade_solicitante_id: null,
    oportunidade_solicitante_nome: null,
    advogado_responsavel: null,
    data_distribuicao: null,
    criado_em: '2024-02-01T10:00:00.000Z',
    atualizado_em: '2024-02-02T10:00:00.000Z',
    ultima_sincronizacao: null,
    consultas_api_count: 0,
    judit_tracking_id: null,
    judit_tracking_hour_range: null,
    cliente_nome: null,
    cliente_documento: null,
    cliente_tipo: null,
    advogados: '[]',
    movimentacoes: '[]',
    movimentacoes_count: 0,
    judit_last_request: null,
  };

  const req = {
    params: { id: String(processoRow.id) },
    auth: { userId: 44 },
  } as unknown as Request;

  const res = createMockResponse();

  const poolMock = test.mock.method(pool, 'query', async (text: string) => {
    if (/FROM public\.usuarios/.test(text)) {
      return { rows: [{ empresa: processoRow.idempresa }], rowCount: 1 };
    }

    if (/FROM public\.processos\b/.test(text) && /WHERE p\.id = \$1/.test(text)) {
      return { rows: [processoRow], rowCount: 1 };
    }

    if (/FROM public\.processo_movimentacoes/.test(text)) {
      return { rows: [], rowCount: 0 };
    }

    if (/FROM public\.process_response/.test(text)) {
      return { rows: [], rowCount: 0 };
    }

    if (/FROM public\.sync_audit/.test(text)) {
      return { rows: [], rowCount: 0 };
    }

    if (/FROM public\.empresas/.test(text)) {
      return {
        rows: [
          {
            limite_usuarios: null,
            limite_processos: null,
            limite_propostas: null,
            sincronizacao_processos_habilitada: true,
            sincronizacao_processos_cota: null,
          },
        ],
        rowCount: 1,
      };
    }

    if (/FROM public\.process_sync/.test(text)) {
      if (/COUNT\(\*\)/i.test(text)) {
        return { rows: [{ total: '0' }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    if (/FROM public\.processo_consultas_api/.test(text)) {
      return { rows: [{ total: '0' }], rowCount: 1 };
    }

    throw new Error(`Unexpected pool query: ${text}`);
  });

  const originalListSyncs = juditProcessServiceModule.listProcessSyncs;
  const originalListResponses = juditProcessServiceModule.listProcessResponses;
  const originalListAudits = juditProcessServiceModule.listSyncAudits;

  juditProcessServiceModule.listProcessSyncs = async () => [];
  juditProcessServiceModule.listProcessResponses = async () => [];
  juditProcessServiceModule.listSyncAudits = async () => [];

  const juditService = getJuditServiceInstance();
  const originalIsEnabled = juditService.isEnabled;
  const originalEnsure = juditService.ensureTrackingForProcess;
  const originalTrigger = juditService.triggerRequestForProcess;

  const ensureCalls: unknown[][] = [];
  const triggerCalls: unknown[][] = [];

  juditService.isEnabled = async () => true;
  juditService.ensureTrackingForProcess = async (...args: unknown[]) => {
    ensureCalls.push(args);
    return { tracking_id: 'tracking-xyz', hour_range: '00-06' };
  };
  juditService.triggerRequestForProcess = async (...args: unknown[]) => {
    triggerCalls.push(args);
    return {
      requestId: 'req-999',
      status: 'pending',
      source: 'details',
      result: null,
      createdAt: '2024-02-02T10:00:00.000Z',
      updatedAt: '2024-02-02T10:00:00.000Z',
    };
  };

  try {
    await getProcessoById(req, res);

    assert.equal(res.statusCode, 200);
    const body = res.body as Record<string, unknown>;
    assert.ok(body);
    assert.equal(ensureCalls.length, 1);
    assert.equal(triggerCalls.length, 1);
    assert.deepEqual(body.judit_last_request, {
      request_id: 'req-999',
      status: 'pending',
      source: 'details',
      result: null,
      criado_em: '2024-02-02T10:00:00.000Z',
      atualizado_em: '2024-02-02T10:00:00.000Z',
    });
  } finally {
    juditService.triggerRequestForProcess = originalTrigger;
    juditService.ensureTrackingForProcess = originalEnsure;
    juditService.isEnabled = originalIsEnabled;
    juditProcessServiceModule.listSyncAudits = originalListAudits;
    juditProcessServiceModule.listProcessResponses = originalListResponses;
    juditProcessServiceModule.listProcessSyncs = originalListSyncs;
    poolMock.mock.restore();
  }
});

test('getProcessoById does not trigger Judit when audit trail is present', async () => {
  const processoRow: ProcessResponseShape = {
    id: 303,
    cliente_id: null,
    idempresa: 88,
    numero: '1111111-11.1111.1.11.1111',
    uf: null,
    municipio: null,
    orgao_julgador: null,
    tipo: null,
    status: null,
    classe_judicial: null,
    assunto: null,
    jurisdicao: null,
    oportunidade_id: null,
    oportunidade_sequencial_empresa: null,
    oportunidade_data_criacao: null,
    oportunidade_numero_processo_cnj: null,
    oportunidade_numero_protocolo: null,
    oportunidade_solicitante_id: null,
    oportunidade_solicitante_nome: null,
    advogado_responsavel: null,
    data_distribuicao: null,
    criado_em: '2024-01-01T10:00:00.000Z',
    atualizado_em: '2024-01-02T10:00:00.000Z',
    ultima_sincronizacao: null,
    consultas_api_count: 0,
    judit_tracking_id: 'tracking-xyz',
    judit_tracking_hour_range: '10-18',
    cliente_nome: null,
    cliente_documento: null,
    cliente_tipo: null,
    advogados: '[]',
    movimentacoes: '[]',
    movimentacoes_count: 0,
    judit_last_request: null,
  };

  const poolResponses: QueryResponse[] = [
    { rows: [{ empresa: processoRow.idempresa }], rowCount: 1 },
    { rows: [processoRow], rowCount: 1 },
    { rows: [], rowCount: 0 },
    { rows: [], rowCount: 0 },
    { rows: [], rowCount: 0 },
    {
      rows: [
        {
          id: 902,
          processo_id: processoRow.id,
          process_sync_id: null,
          process_response_id: null,
          integration_api_key_id: null,
          event_type: 'request.created',
          event_details: { status: 'completed' },
          observed_at: '2024-01-03T12:00:00.000Z',
          created_at: '2024-01-03T12:00:01.000Z',
          provider: null,
          environment: null,
          url_api: null,
          active: true,
        },
      ],
      rowCount: 1,
    },
  ];

  const req = {
    params: { id: String(processoRow.id) },
    auth: { userId: 66 },
  } as unknown as Request;

  const res = createMockResponse();

  const poolMock = test.mock.method(pool, 'query', async (text: string) => {
    if (poolResponses.length === 0) {
      throw new Error(`Unexpected pool query: ${text}`);
    }
    return poolResponses.shift()!;
  });

  const juditService = getJuditServiceInstance();
  const originalIsEnabled = juditService.isEnabled;
  const originalEnsure = juditService.ensureTrackingForProcess;
  const originalTrigger = juditService.triggerRequestForProcess;

  const ensureCalls: unknown[][] = [];
  const triggerCalls: unknown[][] = [];

  juditService.isEnabled = async () => true;
  juditService.ensureTrackingForProcess = async (...args: unknown[]) => {
    ensureCalls.push(args);
    return null;
  };
  juditService.triggerRequestForProcess = async (...args: unknown[]) => {
    triggerCalls.push(args);
    return null;
  };

  try {
    await getProcessoById(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(ensureCalls.length, 0);
    assert.equal(triggerCalls.length, 0);
  } finally {
    juditService.triggerRequestForProcess = originalTrigger;
    juditService.ensureTrackingForProcess = originalEnsure;
    juditService.isEnabled = originalIsEnabled;
    poolMock.mock.restore();
  }
});

test('getProcessoById does not trigger Judit when plan blocks synchronization', async () => {
  const processoRow: ProcessResponseShape = {
    id: 404,
    cliente_id: null,
    idempresa: 99,
    numero: '2222222-22.2222.2.22.2222',
    uf: null,
    municipio: null,
    orgao_julgador: null,
    tipo: null,
    status: null,
    classe_judicial: null,
    assunto: null,
    jurisdicao: null,
    oportunidade_id: null,
    oportunidade_sequencial_empresa: null,
    oportunidade_data_criacao: null,
    oportunidade_numero_processo_cnj: null,
    oportunidade_numero_protocolo: null,
    oportunidade_solicitante_id: null,
    oportunidade_solicitante_nome: null,
    advogado_responsavel: null,
    data_distribuicao: null,
    criado_em: '2024-03-01T10:00:00.000Z',
    atualizado_em: '2024-03-01T11:00:00.000Z',
    ultima_sincronizacao: null,
    consultas_api_count: 0,
    judit_tracking_id: null,
    judit_tracking_hour_range: null,
    cliente_nome: null,
    cliente_documento: null,
    cliente_tipo: null,
    advogados: '[]',
    movimentacoes: '[]',
    movimentacoes_count: 0,
    judit_last_request: null,
  };

  const req = {
    params: { id: String(processoRow.id) },
    auth: { userId: 101 },
  } as unknown as Request;

  const res = createMockResponse();

  const poolMock = test.mock.method(pool, 'query', async (text: string) => {
    if (/FROM public\.usuarios/.test(text)) {
      return { rows: [{ empresa: processoRow.idempresa }], rowCount: 1 };
    }

    if (/FROM public\.processos\b/.test(text) && /WHERE p\.id = \$1/.test(text)) {
      return { rows: [processoRow], rowCount: 1 };
    }

    if (/FROM public\.processo_movimentacoes/.test(text)) {
      return { rows: [], rowCount: 0 };
    }

    if (/FROM public\.process_response/.test(text)) {
      return { rows: [], rowCount: 0 };
    }

    if (/FROM public\.sync_audit/.test(text)) {
      return { rows: [], rowCount: 0 };
    }

    if (/FROM public\.empresas/.test(text)) {
      return {
        rows: [
          {
            limite_usuarios: null,
            limite_processos: null,
            limite_propostas: null,
            sincronizacao_processos_habilitada: true,
            sincronizacao_processos_cota: 5,
          },
        ],
        rowCount: 1,
      };
    }

    if (/FROM public\.process_sync/.test(text)) {
      if (/COUNT\(\*\)/i.test(text)) {
        return { rows: [{ total: '5' }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    if (/FROM public\.processo_consultas_api/.test(text)) {
      return { rows: [{ total: '0' }], rowCount: 1 };
    }

    throw new Error(`Unexpected pool query: ${text}`);
  });

  const originalListSyncs = juditProcessServiceModule.listProcessSyncs;
  const originalListResponses = juditProcessServiceModule.listProcessResponses;
  const originalListAudits = juditProcessServiceModule.listSyncAudits;

  juditProcessServiceModule.listProcessSyncs = async () => [];
  juditProcessServiceModule.listProcessResponses = async () => [];
  juditProcessServiceModule.listSyncAudits = async () => [];

  const juditService = getJuditServiceInstance();
  const originalIsEnabled = juditService.isEnabled;
  const originalEnsure = juditService.ensureTrackingForProcess;
  const originalTrigger = juditService.triggerRequestForProcess;

  const ensureCalls: unknown[][] = [];
  const triggerCalls: unknown[][] = [];

  juditService.isEnabled = async () => true;
  juditService.ensureTrackingForProcess = async (...args: unknown[]) => {
    ensureCalls.push(args);
    return { tracking_id: 'tracking-abc', hour_range: '04-08' };
  };
  juditService.triggerRequestForProcess = async (...args: unknown[]) => {
    triggerCalls.push(args);
    return {
      requestId: 'req-777',
      status: 'pending',
      source: 'details',
      result: null,
      createdAt: '2024-03-01T12:00:00.000Z',
      updatedAt: '2024-03-01T12:00:00.000Z',
    };
  };

  try {
    await getProcessoById(req, res);

    assert.equal(res.statusCode, 200);
    const body = res.body as Record<string, unknown>;
    assert.ok(body);
    assert.equal(ensureCalls.length, 0);
    assert.equal(triggerCalls.length, 0);
  } finally {
    juditService.triggerRequestForProcess = originalTrigger;
    juditService.ensureTrackingForProcess = originalEnsure;
    juditService.isEnabled = originalIsEnabled;
    juditProcessServiceModule.listSyncAudits = originalListAudits;
    juditProcessServiceModule.listProcessResponses = originalListResponses;
    juditProcessServiceModule.listProcessSyncs = originalListSyncs;
    poolMock.mock.restore();
  }
});

