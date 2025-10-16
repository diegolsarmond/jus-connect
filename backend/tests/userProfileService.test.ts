import assert from 'node:assert/strict';
import test from 'node:test';
import UserProfileService, {
  NotFoundError,
  UpdateProfileInput,
  ValidationError,
} from '../src/services/userProfileService';

type QueryCall = { text: string; values?: unknown[] };
type QueryResponse = { rows: any[]; rowCount: number };

class FakePool {
  public readonly calls: QueryCall[] = [];

  constructor(private readonly responses: QueryResponse[]) {}

  async query(text: string, values?: unknown[]) {
    this.calls.push({ text, values });
    if (this.responses.length === 0) {
      throw new Error('No response configured for query');
    }
    return this.responses.shift()!;
  }
}

test('getProfile mapeia dados retornando valores padrão', async () => {
  const row = {
    user_id: 10,
    nome_completo: 'Dra. Maria Silva',
    cpf: '12345678901',
    email: 'maria@jusconnect.com',
    telefone: '(11) 90000-0000',
    ultimo_login: '2024-02-10T10:00:00.000Z',
    datacriacao: '2022-01-01T12:00:00.000Z',
    title: 'Advogada Sênior',
    bio: null,
    office: 'Matriz',
    oab_number: '123456',
    oab_uf: 'SP',
    specialties: ['Direito Civil', 'Direito civil', ''],
    hourly_rate: '250.00',
    timezone: 'America/Sao_Paulo',
    language: 'Português',
    linkedin_url: null,
    website_url: null,
    address_street: 'Av. Paulista, 100',
    address_city: 'São Paulo',
    address_state: 'SP',
    address_zip: '01310-100',
    notifications_security_alerts: null,
    notifications_agenda_reminders: true,
    notifications_newsletter: null,
    security_two_factor: null,
    security_login_alerts: true,
    security_device_approval: false,
    avatar_url: null,
    member_since: null,
  };

  const pool = new FakePool([{ rows: [row], rowCount: 1 }]);
  const service = new UserProfileService(pool as any);

  const profile = await service.getProfile(10);

  assert.equal(profile.id, 10);
  assert.equal(profile.name, 'Dra. Maria Silva');
  assert.equal(profile.cpf, '12345678901');
  assert.equal(profile.email, 'maria@jusconnect.com');
  assert.deepEqual(profile.specialties, ['Direito Civil']);
  assert.equal(profile.notifications.securityAlerts, true, 'valor padrão para alertas de segurança');
  assert.equal(profile.notifications.agendaReminders, true);
  assert.equal(profile.notifications.newsletter, false);
  assert.equal(profile.security.loginAlerts, true);
  assert.equal(profile.security.twoFactor, false);
  assert.equal(profile.memberSince, '2022-01-01T12:00:00.000Z');

  assert.equal(pool.calls.length, 1);
  assert.match(pool.calls[0]?.text ?? '', /FROM public\.usuarios/);
});

test('updateProfile atualiza dados, persiste alterações e gera auditoria', async () => {
  const existingRow = {
    user_id: 42,
    nome_completo: 'Maria Silva',
    cpf: '98765432100',
    email: 'maria@jusconnect.com',
    telefone: '(11) 90000-0000',
    ultimo_login: '2024-02-10T10:00:00.000Z',
    datacriacao: '2023-01-01T12:00:00.000Z',
    title: 'Advogada Plena',
    bio: 'Atuação em direito digital.',
    office: 'Matriz',
    oab_number: '123456',
    oab_uf: 'SP',
    specialties: ['Direito Digital'],
    hourly_rate: '250.00',
    timezone: 'America/Sao_Paulo',
    language: 'Português',
    linkedin_url: 'https://www.linkedin.com/in/maria',
    website_url: 'https://maria.com.br',
    address_street: 'Av. Paulista, 100',
    address_city: 'São Paulo',
    address_state: 'SP',
    address_zip: '01310-100',
    notifications_security_alerts: true,
    notifications_agenda_reminders: true,
    notifications_newsletter: false,
    security_two_factor: false,
    security_login_alerts: false,
    security_device_approval: false,
    avatar_url: null,
    member_since: '2023-01-01T12:00:00.000Z',
  };

  const updatedRow = {
    ...existingRow,
    nome_completo: 'Maria Souza',
    email: 'maria.souza@jusconnect.com',
    telefone: '(11) 98888-7777',
    cpf: '98765432100',
    title: 'Advogada Sênior',
    specialties: ['Direito Digital', 'Direito Empresarial'],
    hourly_rate: '300.00',
    notifications_security_alerts: false,
    security_two_factor: true,
  };

  const pool = new FakePool([
    { rows: [existingRow], rowCount: 1 },
    { rows: [], rowCount: 1 },
    { rows: [], rowCount: 1 },
    { rows: [], rowCount: 1 },
    { rows: [], rowCount: 1 },
    { rows: [], rowCount: 1 },
    { rows: [updatedRow], rowCount: 1 },
  ]);

  const service = new UserProfileService(pool as any);

  const payload: UpdateProfileInput = {
    name: 'Maria Souza',
    email: 'maria.souza@jusconnect.com',
    phone: '(11) 98888-7777',
    title: 'Advogada Sênior',
    specialties: ['Direito Digital', 'Direito Empresarial'],
    hourlyRate: 300,
    notifications: { securityAlerts: false },
    security: { twoFactor: true },
  };

  const profile = await service.updateProfile(42, payload, {
    id: 42,
    name: 'Maria Souza',
  });

  assert.equal(profile.name, 'Maria Souza');
  assert.equal(profile.email, 'maria.souza@jusconnect.com');
  assert.equal(profile.notifications.securityAlerts, false);
  assert.equal(profile.security.twoFactor, true);
  assert.deepEqual(profile.specialties, ['Direito Digital', 'Direito Empresarial']);

  assert.equal(pool.calls.length, 7);
  assert.match(pool.calls[0]?.text ?? '', /FROM public\.usuarios/);
  assert.match(pool.calls[1]?.text ?? '', /UPDATE public\.usuarios/);
  assert.deepEqual(pool.calls[1]?.values, [
    'Maria Souza',
    'maria.souza@jusconnect.com',
    '(11) 98888-7777',
    42,
  ]);
  assert.match(pool.calls[2]?.text ?? '', /INSERT INTO public\.user_profiles/);
  assert.match(pool.calls[3]?.text ?? '', /user_profile_audit_logs/);
  assert.match(pool.calls[3]?.values?.[1] as string, /PROFILE_UPDATE/);
  assert.match(pool.calls[4]?.values?.[1] as string, /EMAIL_CHANGE/);
  assert.match(pool.calls[5]?.values?.[1] as string, /TWO_FACTOR_ENABLED/);
  assert.match(pool.calls[6]?.text ?? '', /FROM public\.usuarios/);
});

test('updateProfile valida formato do e-mail', async () => {
  const row = {
    user_id: 10,
    nome_completo: 'Maria',
    cpf: '11122233344',
    email: 'maria@jusconnect.com',
    telefone: null,
    ultimo_login: null,
    datacriacao: '2024-01-01T00:00:00.000Z',
    title: null,
    bio: null,
    office: null,
    oab_number: null,
    oab_uf: null,
    specialties: [],
    hourly_rate: null,
    timezone: null,
    language: null,
    linkedin_url: null,
    website_url: null,
    address_street: null,
    address_city: null,
    address_state: null,
    address_zip: null,
    notifications_security_alerts: true,
    notifications_agenda_reminders: true,
    notifications_newsletter: false,
    security_two_factor: false,
    security_login_alerts: false,
    security_device_approval: false,
    avatar_url: null,
    member_since: null,
  };

  const pool = new FakePool([{ rows: [row], rowCount: 1 }]);
  const service = new UserProfileService(pool as any);

  await assert.rejects(
    () => service.updateProfile(10, { email: 'email-invalido' }),
    ValidationError
  );

  assert.equal(pool.calls.length, 1);
});

test('updateProfile lança erro quando usuário não existe', async () => {
  const pool = new FakePool([{ rows: [], rowCount: 0 }]);
  const service = new UserProfileService(pool as any);

  await assert.rejects(
    () => service.updateProfile(999, {}),
    NotFoundError
  );
});

test('revokeSession desativa sessão ativa e registra auditoria', async () => {
  const sessionRow = {
    id: 7,
    user_id: 5,
    device: 'Chrome 120 - macOS',
    location: 'São Paulo',
    last_activity: '2024-02-10T10:00:00.000Z',
    is_active: false,
    created_at: '2024-02-09T10:00:00.000Z',
    revoked_at: '2024-02-10T11:00:00.000Z',
  };

  const pool = new FakePool([
    { rows: [sessionRow], rowCount: 1 },
    { rows: [], rowCount: 1 },
  ]);

  const service = new UserProfileService(pool as any);

  const session = await service.revokeSession(5, 7, { id: 5, name: 'Maria' });

  assert.ok(session);
  assert.equal(session?.id, 7);
  assert.equal(pool.calls.length, 2);
  assert.match(pool.calls[0]?.text ?? '', /UPDATE public\.user_profile_sessions/);
  assert.match(pool.calls[1]?.text ?? '', /user_profile_audit_logs/);
});
