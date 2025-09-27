import assert from 'node:assert/strict';
import test from 'node:test';
import { CronJobsService } from '../src/services/cronJobs';
import juditProcessService from '../src/services/juditProcessService';
import pool from '../src/services/db';

const waitForAsyncTasks = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

let sequence: boolean[] = [];
let fallbackState = false;

const isEnabledMock = test.mock.method(juditProcessService, 'isEnabled', async () => {
  if (sequence.length > 0) {
    return sequence.shift()!;
  }
  return fallbackState;
});

test.after(() => {
  isEnabledMock.mock.restore();
});

const createCronJobs = (states: boolean[], fallback = false) => {
  sequence = [...states];
  fallbackState = fallback;

  const projudiStub = {
    hasValidConfiguration: () => false,
  };

  const asaasStub = {
    hasValidConfiguration: () => false,
  };

  return new CronJobsService(projudiStub as any, asaasStub as any);
};

test('refreshJuditIntegration schedules timers when integration is enabled', async () => {
  const cron = createCronJobs([false, true, true, true, true], false);

  await waitForAsyncTasks();
  await cron.refreshJuditIntegration();
  await waitForAsyncTasks();

  const schedules = (cron as any).juditSchedules as Array<{
    timer: ReturnType<typeof setTimeout> | null;
    nextRunAt: Date | null;
  }>;

  assert.equal(schedules.length, 3);

  for (const schedule of schedules) {
    assert.notEqual(schedule.timer, null, 'Expected Judit timer to be armed');
    assert.ok(schedule.nextRunAt instanceof Date, 'Expected Judit schedule to have next run');
  }

  sequence = [false];
  await cron.refreshJuditIntegration();
  await waitForAsyncTasks();
});

test('refreshJuditIntegration re-arms timers after being disabled', async () => {
  const cron = createCronJobs([true, true, true, true], false);

  await waitForAsyncTasks();

  const schedules = (cron as any).juditSchedules as Array<{
    timer: ReturnType<typeof setTimeout> | null;
    nextRunAt: Date | null;
  }>;

  for (const schedule of schedules) {
    assert.notEqual(schedule.timer, null, 'Expected Judit timer to start armed');
  }

  sequence = [false];
  await cron.refreshJuditIntegration();
  await waitForAsyncTasks();

  for (const schedule of schedules) {
    assert.equal(schedule.timer, null, 'Expected Judit timer to be cleared when disabled');
  }

  sequence = [true, true, true, true];
  await cron.refreshJuditIntegration();
  await waitForAsyncTasks();

  for (const schedule of schedules) {
    assert.notEqual(schedule.timer, null, 'Expected Judit timer to be re-armed when enabled again');
  }

  sequence = [false];
  await cron.refreshJuditIntegration();
  await waitForAsyncTasks();
});

test('refreshJuditIntegration clears timers when integration is disabled', async () => {
  const cron = createCronJobs([true, true, true, true], false);

  await waitForAsyncTasks();

  const schedules = (cron as any).juditSchedules as Array<{
    timer: ReturnType<typeof setTimeout> | null;
    nextRunAt: Date | null;
  }>;

  assert.equal(schedules.length, 3);

  for (const schedule of schedules) {
    assert.notEqual(schedule.timer, null, 'Expected Judit timer to be armed before disabling');
    assert.ok(schedule.nextRunAt instanceof Date, 'Expected Judit schedule to have next run before disabling');
  }

  sequence = [false];
  await cron.refreshJuditIntegration();
  await waitForAsyncTasks();

  for (const schedule of schedules) {
    assert.equal(schedule.timer, null, 'Expected Judit timer to be cleared when disabled');
    assert.equal(schedule.nextRunAt, null, 'Expected Judit schedule to lose next run when disabled');
  }
});

test('runJuditSync skips companies without available quota', async () => {
  const cron = createCronJobs([true], true);

  const processosRows = [
    {
      id: 1,
      numero: '0000000-00.0000.0.00.0000',
      judit_tracking_id: null,
      judit_tracking_hour_range: null,
      idempresa: 10,
    },
    {
      id: 2,
      numero: '1111111-11.1111.1.11.1111',
      judit_tracking_id: null,
      judit_tracking_hour_range: null,
      idempresa: 10,
    },
    {
      id: 3,
      numero: '2222222-22.2222.2.22.2222',
      judit_tracking_id: null,
      judit_tracking_hour_range: null,
      idempresa: 20,
    },
  ];

  const poolMock = test.mock.method(pool, 'query', async (text: string, params: unknown[]) => {
    if (/FROM public\.processos/.test(text) && /JOIN public\.empresas/.test(text)) {
      return { rows: processosRows, rowCount: processosRows.length };
    }

    if (/FROM public\.empresas/.test(text)) {
      const companyId = Array.isArray(params) ? Number(params[0]) : null;
      if (companyId === 10) {
        return {
          rows: [
            {
              limite_usuarios: null,
              limite_processos: null,
              limite_propostas: null,
              sincronizacao_processos_habilitada: true,
              sincronizacao_processos_cota: 1,
            },
          ],
          rowCount: 1,
        };
      }

      if (companyId === 20) {
        return {
          rows: [
            {
              limite_usuarios: null,
              limite_processos: null,
              limite_propostas: null,
              sincronizacao_processos_habilitada: true,
              sincronizacao_processos_cota: 0,
            },
          ],
          rowCount: 1,
        };
      }

      return { rows: [], rowCount: 0 };
    }

    if (/FROM public\.process_sync/.test(text)) {
      const companyId = Array.isArray(params) ? Number(params[0]) : null;
      if (companyId === 10) {
        return { rows: [{ total: '0' }], rowCount: 1 };
      }
      if (companyId === 20) {
        return { rows: [{ total: '0' }], rowCount: 1 };
      }
      return { rows: [{ total: '0' }], rowCount: 1 };
    }

    if (/FROM public\.processo_consultas_api/.test(text)) {
      const companyId = Array.isArray(params) ? Number(params[0]) : null;
      if (companyId === 10) {
        return { rows: [{ total: '0' }], rowCount: 1 };
      }
      if (companyId === 20) {
        return { rows: [{ total: '0' }], rowCount: 1 };
      }
      return { rows: [{ total: '0' }], rowCount: 1 };
    }

    throw new Error(`Unexpected query: ${text}`);
  });

  const juditService = (juditProcessService as unknown as {
    ensureTrackingForProcess: typeof juditProcessService.ensureTrackingForProcess;
    triggerRequestForProcess: typeof juditProcessService.triggerRequestForProcess;
  });

  const ensureCalls: unknown[][] = [];
  const triggerCalls: unknown[][] = [];

  const ensureMock = test.mock.method(juditService, 'ensureTrackingForProcess', async (...args: unknown[]) => {
    ensureCalls.push(args);
    return { tracking_id: 'tracking', hour_range: '00-06' };
  });

  const triggerMock = test.mock.method(juditService, 'triggerRequestForProcess', async (...args: unknown[]) => {
    triggerCalls.push(args);
    return {
      requestId: 'req-1',
      status: 'pending',
      source: 'cron',
      result: null,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    } as any;
  });

  try {
    await (cron as any).runJuditSync('manual');

    assert.equal(ensureCalls.length, 1);
    assert.equal(triggerCalls.length, 1);
    assert.equal(ensureCalls[0]?.[0], 1);
    assert.equal(triggerCalls[0]?.[0], 1);
  } finally {
    triggerMock.mock.restore();
    ensureMock.mock.restore();
    poolMock.mock.restore();
  }
});
