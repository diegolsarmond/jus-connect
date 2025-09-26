import assert from 'node:assert/strict';
import test from 'node:test';
import { CronJobsService } from '../src/services/cronJobs';
import juditProcessService from '../src/services/juditProcessService';

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
