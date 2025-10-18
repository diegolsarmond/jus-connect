import assert from 'node:assert/strict';
import { createHash, createHmac } from 'node:crypto';
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

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

const decodeBase32 = (secret: string): Buffer => {
  const sanitized = secret.replace(/[^A-Z2-7]/gi, '').toUpperCase();
  let bits = '';

  for (const char of sanitized) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) {
      continue;
    }
    bits += index.toString(2).padStart(5, '0');
  }

  const byteLength = Math.floor(bits.length / 8);
  const buffer = Buffer.alloc(byteLength);

  for (let i = 0; i < byteLength; i += 1) {
    buffer[i] = Number.parseInt(bits.slice(i * 8, i * 8 + 8), 2);
  }

  return buffer;
};

const generateTotpCode = (secret: string, timestamp: number): string => {
  const key = decodeBase32(secret);
  const counter = Math.floor(timestamp / 1000 / 30);
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));

  const digest = createHmac('sha1', key).update(buffer).digest();
  const offset = digest[digest.length - 1] & 0xf;

  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);

  return (binary % 10 ** 6).toString().padStart(6, '0');
};

const hashBackupCode = (code: string): string =>
  createHash('sha256').update(code.toUpperCase()).digest('hex');

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

test('initiateTwoFactor gera segredo, URL otpauth e registra auditoria', async () => {
  const userRow = {
    user_id: 5,
    nome_completo: 'Maria',
    email: 'maria@example.com',
    security_two_factor: false,
  };

  const pool = new FakePool([
    { rows: [userRow], rowCount: 1 },
    { rows: [], rowCount: 1 },
    { rows: [], rowCount: 1 },
  ]);

  const service = new UserProfileService(pool as any);
  const result = await service.initiateTwoFactor(5, { id: 5, name: 'Maria' });

  assert.match(result.secret, /^[A-Z2-7]+$/);
  assert.ok(result.secret.length >= 16, 'segredo deve conter ao menos 16 caracteres');
  assert.match(result.otpauthUrl, /^otpauth:\/\/totp\//);
  assert.match(result.qrCode, /^https:\/\/quickchart\.io\/qr/);

  assert.equal(pool.calls.length, 3);
  assert.match(pool.calls[1]?.text ?? '', /INSERT INTO public\.user_profiles/);
  assert.equal(pool.calls[1]?.values?.[0], 5);
  assert.equal(pool.calls[1]?.values?.[1], result.secret);
  assert.match(pool.calls[2]?.text ?? '', /user_profile_audit_logs/);
});

test('confirmTwoFactor valida TOTP e salva códigos de backup', async () => {
  const secret = 'JBSWY3DPEHPK3PXP';
  const fixedTimestamp = 1_700_000_000_000;
  const code = generateTotpCode(secret, fixedTimestamp);

  const pool = new FakePool([
    {
      rows: [
        {
          user_id: 7,
          security_two_factor_secret: secret,
          security_two_factor: false,
          security_two_factor_backup_codes: [],
        },
      ],
      rowCount: 1,
    },
    { rows: [], rowCount: 1 },
    { rows: [], rowCount: 1 },
  ]);

  const service = new UserProfileService(pool as any);
  const originalNow = Date.now;
  (Date as any).now = () => fixedTimestamp;

  try {
    const result = await service.confirmTwoFactor(7, code, { id: 7, name: 'Maria' });
    assert.equal(result.backupCodes.length, 10);
    assert.ok(result.backupCodes.every((item) => /^[A-F0-9]{10}$/i.test(item)));

    const updateCall = pool.calls[1];
    assert.ok(Array.isArray(updateCall?.values?.[1]));
    const hashedCodes = updateCall?.values?.[1] as string[];
    assert.equal(hashedCodes.length, 10);
    assert.ok(hashedCodes.every((item) => typeof item === 'string' && item.length === 64));
  } finally {
    Date.now = originalNow;
  }
});

test('disableTwoFactor aceita códigos de backup e remove configuração', async () => {
  const backupCode = 'A1B2C3D4E5';
  const hashed = hashBackupCode(backupCode);
  const pool = new FakePool([
    {
      rows: [
        {
          user_id: 9,
          security_two_factor_secret: 'JBSWY3DPEHPK3PXP',
          security_two_factor: true,
          security_two_factor_backup_codes: [hashed],
        },
      ],
      rowCount: 1,
    },
    { rows: [], rowCount: 1 },
    { rows: [], rowCount: 1 },
  ]);

  const service = new UserProfileService(pool as any);
  await service.disableTwoFactor(9, backupCode, { id: 9, name: 'Maria' });

  assert.match(pool.calls[1]?.text ?? '', /UPDATE public\.user_profiles/);
  assert.equal(pool.calls.length, 3);
});

test('approveSession marca dispositivo como aprovado e registra auditoria', async () => {
  const sessionRow = {
    id: 12,
    user_id: 4,
    device: 'Chrome 120',
    location: 'São Paulo',
    last_activity: new Date().toISOString(),
    is_active: true,
    is_approved: true,
    approved_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    revoked_at: null,
  };

  const pool = new FakePool([
    { rows: [sessionRow], rowCount: 1 },
    { rows: [], rowCount: 1 },
  ]);

  const service = new UserProfileService(pool as any);
  const session = await service.approveSession(4, 12, { id: 4, name: 'Maria' });

  assert.ok(session);
  assert.equal(session?.id, 12);
  assert.equal(session?.isApproved, true);
  assert.equal(pool.calls.length, 2);
  assert.match(pool.calls[0]?.text ?? '', /UPDATE public\.user_profile_sessions/);
  assert.match(pool.calls[1]?.text ?? '', /user_profile_audit_logs/);
});

test('revokeSessionApproval remove aprovação e registra auditoria', async () => {
  const sessionRow = {
    id: 15,
    user_id: 6,
    device: 'Firefox 120',
    location: 'Rio de Janeiro',
    last_activity: new Date().toISOString(),
    is_active: true,
    is_approved: false,
    approved_at: null,
    created_at: new Date().toISOString(),
    revoked_at: null,
  };

  const pool = new FakePool([
    { rows: [sessionRow], rowCount: 1 },
    { rows: [], rowCount: 1 },
  ]);

  const service = new UserProfileService(pool as any);
  const session = await service.revokeSessionApproval(6, 15, { id: 6, name: 'Maria' });

  assert.ok(session);
  assert.equal(session?.isApproved, false);
  assert.equal(pool.calls.length, 2);
  assert.match(pool.calls[0]?.text ?? '', /UPDATE public\.user_profile_sessions/);
  assert.match(pool.calls[1]?.text ?? '', /user_profile_audit_logs/);
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
