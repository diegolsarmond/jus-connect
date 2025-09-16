import test from 'node:test';
import assert from 'node:assert/strict';
import type { Request } from 'express';
import { PjeNotificationProvider } from '../src/services/notificationProviders/pjeNotificationService';
import { ProjudiNotificationProvider } from '../src/services/notificationProviders/projudiNotificationService';
import { __resetNotificationState, listNotifications } from '../src/services/notificationService';

function mockRequest<T>(body: T): Request {
  return { body } as unknown as Request;
}

test.beforeEach(() => {
  __resetNotificationState();
});

test('PjeNotificationProvider creates notifications for deadline and movement events', async () => {
  const provider = new PjeNotificationProvider();

  const request = mockRequest({
    userId: 'adv-001',
    processNumber: '5001234-89.2024.8.26.0100',
    events: [
      {
        type: 'deadline',
        description: 'Prazo para apresentação de defesa encerra em 5 dias.',
        occurredAt: '2024-05-10T12:00:00Z',
      },
      {
        type: 'movement',
        description: 'Nova movimentação registrada no processo.',
        occurredAt: '2024-05-10T15:45:00Z',
      },
    ],
  });

  const notifications = await provider.handleWebhook(request);

  assert.equal(notifications.length, 2);
  assert.equal(notifications[0].category, 'pje');
  assert.equal(notifications[0].type, 'warning');
  assert.match(notifications[0].title, /prazo/i);
  assert.equal(notifications[0].metadata?.processNumber, '5001234-89.2024.8.26.0100');

  assert.equal(notifications[1].type, 'info');
  assert.match(notifications[1].title, /movimenta/);

  const pending = await provider.fetchUpdates();
  assert.equal(pending.length, 2);
  assert.equal((await provider.fetchUpdates()).length, 0);

  const stored = listNotifications('adv-001');
  assert.equal(stored.length, 2);
});

test('ProjudiNotificationProvider creates notifications for deadline and document alerts', async () => {
  const provider = new ProjudiNotificationProvider();

  const request = mockRequest({
    userId: 'adv-002',
    alerts: [
      {
        kind: 'deadline',
        description: 'Prazo para manifestação vence em 3 dias.',
        processNumber: '8012345-55.2023.8.16.0010',
        dueDate: '2024-06-20',
      },
      {
        kind: 'document',
        description: 'Novo laudo pericial disponível para download.',
        processNumber: '8012345-55.2023.8.16.0010',
      },
    ],
  });

  const notifications = await provider.handleWebhook(request);

  assert.equal(notifications.length, 2);
  assert.equal(notifications[0].category, 'projudi');
  assert.equal(notifications[0].type, 'warning');
  assert.equal(notifications[0].metadata?.dueDate, '2024-06-20');

  assert.equal(notifications[1].type, 'info');
  assert.match(notifications[1].title, /documento/i);

  const pending = await provider.fetchUpdates();
  assert.equal(pending.length, 2);
  assert.equal((await provider.fetchUpdates()).length, 0);

  const stored = listNotifications('adv-002');
  assert.equal(stored.length, 2);
});
