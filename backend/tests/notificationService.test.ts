import test from 'node:test';
import assert from 'node:assert';
import {
  __resetNotificationState,
  createNotification,
  listNotifications,
  getUnreadCount,
  markNotificationAsRead,
  markNotificationAsUnread,
  markAllNotificationsAsRead,
  deleteNotification,
  getNotificationPreferences,
  updateNotificationPreferences,
  NotificationNotFoundError,
} from '../src/services/notificationService';

const USER_ID = 'user-1';

test.beforeEach(() => {
  __resetNotificationState();
});

test('createNotification stores unread notifications and lists newest first', () => {
  const first = createNotification({
    userId: USER_ID,
    title: 'Audiência confirmada',
    message: 'Audiência com o cliente Silva confirmada para amanhã.',
    category: 'agenda',
  });

  const second = createNotification({
    userId: USER_ID,
    title: 'Prazo final do recurso',
    message: 'O prazo final do recurso do processo 2024.000123 vence hoje.',
    category: 'processo',
    type: 'warning',
  });

  const notifications = listNotifications(USER_ID);

  assert.strictEqual(notifications.length, 2);
  assert.strictEqual(notifications[0].id, second.id, 'newest notification should come first');
  assert.strictEqual(notifications[1].id, first.id);
  assert.strictEqual(notifications[0].read, false);
  assert.strictEqual(getUnreadCount(USER_ID), 2);
});

test('markNotificationAsRead and markNotificationAsUnread toggle state correctly', () => {
  const notification = createNotification({
    userId: USER_ID,
    title: 'Documento assinado',
    message: 'O contrato do cliente Lima foi assinado.',
    category: 'documento',
  });

  assert.strictEqual(getUnreadCount(USER_ID), 1);

  const readNotification = markNotificationAsRead(USER_ID, notification.id);
  assert.strictEqual(readNotification.read, true);
  assert.ok(readNotification.readAt, 'readAt should be set when marking as read');
  assert.strictEqual(getUnreadCount(USER_ID), 0);

  const unreadNotification = markNotificationAsUnread(USER_ID, notification.id);
  assert.strictEqual(unreadNotification.read, false);
  assert.strictEqual(unreadNotification.readAt, undefined);
  assert.strictEqual(getUnreadCount(USER_ID), 1);
});

test('markAllNotificationsAsRead marks every notification as read', () => {
  createNotification({
    userId: USER_ID,
    title: 'Alerta de segurança',
    message: 'Novo acesso detectado a partir de um dispositivo desconhecido.',
    category: 'seguranca',
  });

  createNotification({
    userId: USER_ID,
    title: 'Nova tarefa atribuída',
    message: 'Você foi atribuído à tarefa "Revisar contrato".',
    category: 'tarefas',
  });

  const updated = markAllNotificationsAsRead(USER_ID);

  assert.strictEqual(updated.length, 2);
  assert.ok(updated.every((notification) => notification.read));
  assert.strictEqual(getUnreadCount(USER_ID), 0);
});

test('deleteNotification removes an existing notification', () => {
  const first = createNotification({
    userId: USER_ID,
    title: 'Atualização financeira',
    message: 'Um novo boleto foi emitido.',
    category: 'financeiro',
  });

  const second = createNotification({
    userId: USER_ID,
    title: 'Reunião reagendada',
    message: 'A reunião com o cliente Souza foi reagendada para sexta-feira.',
    category: 'agenda',
  });

  deleteNotification(USER_ID, first.id);

  const remaining = listNotifications(USER_ID);
  assert.strictEqual(remaining.length, 1);
  assert.strictEqual(remaining[0].id, second.id);

  assert.throws(() => deleteNotification(USER_ID, first.id), NotificationNotFoundError);
});

test('updateNotificationPreferences merges nested values without losing defaults', () => {
  const initial = getNotificationPreferences(USER_ID);

  const updated = updateNotificationPreferences(USER_ID, {
    email: { newMessages: false },
    frequency: { emailDigest: 'weekly' },
  });

  assert.strictEqual(updated.email.newMessages, false);
  assert.strictEqual(updated.email.appointments, initial.email.appointments);
  assert.strictEqual(updated.frequency.emailDigest, 'weekly');
  assert.strictEqual(updated.frequency.reminderTiming, initial.frequency.reminderTiming);

  const persisted = getNotificationPreferences(USER_ID);
  assert.strictEqual(persisted.email.newMessages, false);
  assert.strictEqual(persisted.frequency.emailDigest, 'weekly');
});

