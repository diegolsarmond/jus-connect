import assert from 'node:assert/strict';
import test from 'node:test';

import { CronJobsService } from '../src/services/cronJobs';

const createService = () =>
  new CronJobsService(
    { hasValidConfiguration: () => true } as any,
    { hasValidConfiguration: () => true } as any,
  );

const setUpsertFailure = (service: CronJobsService, error: NodeJS.ErrnoException) => {
  (service as unknown as { upsertSyncJobConfigurationFn: () => Promise<void> }).upsertSyncJobConfigurationFn =
    async () => {
      throw error;
    };
};

const warningMessageMatchers = {
  projudi: /Ignorando a configuração do job de sincronização do Projudi: falha ao conectar ao banco de dados\./,
  asaas: /Ignorando a configuração do job de sincronização do Asaas: falha ao conectar ao banco de dados\./,
};

test('startProjudiSyncJob ignora erros de conexão ENOTFOUND', async (t) => {
  const service = createService();
  const error = Object.assign(new Error('ENOTFOUND'), { code: 'ENOTFOUND' as const });
  setUpsertFailure(service, error);
  const warnMock = t.mock.method(console, 'warn');

  await service.startProjudiSyncJob();

  assert.equal(warnMock.mock.callCount(), 1);
  assert.match(String(warnMock.mock.calls[0]?.arguments?.[0] ?? ''), warningMessageMatchers.projudi);

  warnMock.mock.restore();
});

test('stopProjudiSyncJob ignora erros de conexão ECONNREFUSED', async (t) => {
  const service = createService();
  const error = Object.assign(new Error('ECONNREFUSED'), { code: 'ECONNREFUSED' as const });
  setUpsertFailure(service, error);
  const warnMock = t.mock.method(console, 'warn');

  await service.stopProjudiSyncJob();

  assert.equal(warnMock.mock.callCount(), 1);
  assert.match(String(warnMock.mock.calls[0]?.arguments?.[0] ?? ''), warningMessageMatchers.projudi);

  warnMock.mock.restore();
});

test('startAsaasChargeSyncJob ignora erros de conexão EAI_AGAIN', async (t) => {
  const service = createService();
  const error = Object.assign(new Error('EAI_AGAIN'), { code: 'EAI_AGAIN' as const });
  setUpsertFailure(service, error);
  const warnMock = t.mock.method(console, 'warn');

  await service.startAsaasChargeSyncJob();

  assert.equal(warnMock.mock.callCount(), 1);
  assert.match(String(warnMock.mock.calls[0]?.arguments?.[0] ?? ''), warningMessageMatchers.asaas);

  warnMock.mock.restore();
});

test('stopAsaasChargeSyncJob ignora erros de conexão ENOTFOUND', async (t) => {
  const service = createService();
  const error = Object.assign(new Error('ENOTFOUND'), { code: 'ENOTFOUND' as const });
  setUpsertFailure(service, error);
  const warnMock = t.mock.method(console, 'warn');

  await service.stopAsaasChargeSyncJob();

  assert.equal(warnMock.mock.callCount(), 1);
  assert.match(String(warnMock.mock.calls[0]?.arguments?.[0] ?? ''), warningMessageMatchers.asaas);

  warnMock.mock.restore();
});

test('startProjudiSyncJob relança erros genéricos', async () => {
  const service = createService();
  const error = new Error('generic failure');
  (service as unknown as { upsertSyncJobConfigurationFn: () => Promise<void> }).upsertSyncJobConfigurationFn = async () => {
    throw error;
  };

  await assert.rejects(() => service.startProjudiSyncJob(), error);
});
