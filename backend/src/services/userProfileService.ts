import { createHash, createHmac, randomBytes } from 'crypto';
import { QueryResultRow } from 'pg';
import pool from './db';
import { sanitizeDigits } from '../utils/sanitizeDigits';

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

type Queryable = {
  query: (
    text: string,
    params?: unknown[]
  ) => Promise<{ rows: QueryResultRow[]; rowCount: number }>;
};

interface UserProfileQueryRow extends QueryResultRow {
  user_id: number;
  nome_completo: string | null;
  cpf: string | null;
  email: string | null;
  telefone: string | null;
  ultimo_login: string | Date | null;
  datacriacao: string | Date | null;
  title: string | null;
  bio: string | null;
  office: string | null;
  oab_number: string | null;
  oab_uf: string | null;
  specialties: string[] | null;
  hourly_rate: string | number | null;
  timezone: string | null;
  language: string | null;
  linkedin_url: string | null;
  website_url: string | null;
  address_street: string | null;
  address_city: string | null;
  address_state: string | null;
  address_zip: string | null;
  notifications_security_alerts: boolean | null;
  notifications_agenda_reminders: boolean | null;
  notifications_newsletter: boolean | null;
  security_two_factor: boolean | null;
  security_login_alerts: boolean | null;
  security_device_approval: boolean | null;
  security_two_factor_secret: string | null;
  security_two_factor_activated_at: string | Date | null;
  security_two_factor_backup_codes: string[] | null;
  avatar_url: string | null;
  member_since: string | Date | null;
}

export interface UserProfile {
  id: number;
  name: string;
  cpf: string | null;
  title: string | null;
  email: string;
  phone: string | null;
  bio: string | null;
  office: string | null;
  oabNumber: string | null;
  oabUf: string | null;
  specialties: string[];
  hourlyRate: number | null;
  timezone: string | null;
  language: string | null;
  linkedin: string | null;
  website: string | null;
  address: {
    street: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
  };
  notifications: {
    securityAlerts: boolean;
    agendaReminders: boolean;
    newsletter: boolean;
  };
  security: {
    twoFactor: boolean;
    loginAlerts: boolean;
    deviceApproval: boolean;
    twoFactorActivatedAt: string | null;
  };
  lastLogin: string | null;
  memberSince: string | null;
  avatarUrl: string | null;
}

export interface UserProfileAuditLog {
  id: number;
  userId: number;
  action: string;
  description: string;
  performedBy: number | null;
  performedByName: string | null;
  createdAt: string;
}

export interface UserProfileSession {
  id: number;
  userId: number;
  device: string;
  location: string | null;
  lastActivity: string;
  isActive: boolean;
  isApproved: boolean;
  approvedAt: string | null;
  createdAt: string;
  revokedAt: string | null;
}

export interface UpdateProfileInput {
  name?: string | null;
  cpf?: string | null;
  title?: string | null;
  email?: string | null;
  phone?: string | null;
  bio?: string | null;
  office?: string | null;
  oabNumber?: string | null;
  oabUf?: string | null;
  specialties?: string[] | null;
  hourlyRate?: number | string | null;
  timezone?: string | null;
  language?: string | null;
  linkedin?: string | null;
  website?: string | null;
  address?: {
    street?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
  };
  notifications?: {
    securityAlerts?: boolean;
    agendaReminders?: boolean;
    newsletter?: boolean;
  };
  security?: {
    twoFactor?: boolean;
    loginAlerts?: boolean;
    deviceApproval?: boolean;
  };
  avatarUrl?: string | null;
  memberSince?: string | Date | null;
}

interface ProfileStorageRow {
  title: string | null;
  bio: string | null;
  office: string | null;
  oab_number: string | null;
  oab_uf: string | null;
  specialties: string[];
  hourly_rate: number | null;
  timezone: string | null;
  language: string | null;
  linkedin_url: string | null;
  website_url: string | null;
  address_street: string | null;
  address_city: string | null;
  address_state: string | null;
  address_zip: string | null;
  notifications_security_alerts: boolean;
  notifications_agenda_reminders: boolean;
  notifications_newsletter: boolean;
  security_two_factor: boolean;
  security_login_alerts: boolean;
  security_device_approval: boolean;
  avatar_url: string | null;
  member_since: Date | string | null;
}

interface AuditLogPayload {
  action: string;
  description: string;
}

export interface TwoFactorInitiationResult {
  secret: string;
  otpauthUrl: string;
  qrCode: string;
}

export interface TwoFactorConfirmationResult {
  backupCodes: string[];
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const DEFAULT_TOTP_STEP_SECONDS = 30;
const DEFAULT_TOTP_WINDOW = 1;
const TOTP_DIGITS = 6;
const BACKUP_CODES_COUNT = 10;
const BACKUP_CODE_BYTES = 5;
const DEFAULT_TOTP_ISSUER = 'JusConnect';
const QR_CODE_ENDPOINT = 'https://quickchart.io/qr';
const QR_CODE_SIZE = 240;

const normalizeUserId = (value: number): number => {
  if (!Number.isInteger(value) || value <= 0) {
    throw new ValidationError('Identificador de usuário inválido.');
  }
  return value;
};

const toIsoString = (value: string | Date | null | undefined): string | null => {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
};

const normalizeOptionalString = (
  value: unknown,
  { uppercase = false }: { uppercase?: boolean } = {}
): string | null | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new ValidationError('Valor inválido para campo textual.');
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return uppercase ? trimmed.toUpperCase() : trimmed;
};

const normalizeRequiredString = (value: unknown, field: string): string => {
  if (typeof value !== 'string') {
    throw new ValidationError(`O campo ${field} é obrigatório.`);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw new ValidationError(`O campo ${field} é obrigatório.`);
  }

  return trimmed;
};

const normalizeOptionalEmail = (value: unknown): string | null | undefined => {
  const normalized = normalizeOptionalString(value);
  if (normalized === undefined || normalized === null) {
    return normalized;
  }

  if (!EMAIL_REGEX.test(normalized)) {
    throw new ValidationError('Informe um e-mail válido.');
  }

  return normalized.toLowerCase();
};

const normalizeOptionalCpf = (value: unknown): string | null | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new ValidationError('Informe um CPF válido.');
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const digits = sanitizeDigits(trimmed);
  if (!digits) {
    return null;
  }

  if (digits.length !== 11) {
    throw new ValidationError('Informe um CPF válido.');
  }

  return digits;
};

const normalizeOptionalPhone = (value: unknown): string | null | undefined => {
  const normalized = normalizeOptionalString(value);
  if (normalized === undefined) {
    return undefined;
  }

  return normalized ?? null;
};

const normalizeOptionalUrl = (value: unknown): string | null | undefined => {
  const normalized = normalizeOptionalString(value);
  if (normalized === undefined || normalized === null) {
    return normalized;
  }

  try {
    const url = new URL(normalized);
    if (!url.protocol.startsWith('http')) {
      throw new ValidationError('Utilize uma URL iniciando com http ou https.');
    }
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new ValidationError('URL inválida.');
  }

  return normalized;
};

const normalizeOptionalBoolean = (value: unknown): boolean | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'boolean') {
    throw new ValidationError('Valor inválido para campo booleano.');
  }

  return value;
};

const normalizeSpecialties = (value: unknown): string[] | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new ValidationError('Especialidades devem ser informadas como lista.');
  }

  const seen = new Set<string>();
  const specialties: string[] = [];

  for (const item of value) {
    if (typeof item !== 'string') {
      continue;
    }

    const trimmed = item.trim();
    if (!trimmed) {
      continue;
    }

    const key = trimmed.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    specialties.push(trimmed);
  }

  return specialties;
};

const normalizeHourlyRate = (value: unknown): number | null | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === '') {
    return null;
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) {
      throw new ValidationError('Informe um valor numérico válido.');
    }
    return Math.round(value * 100) / 100;
  }

  if (typeof value === 'string') {
    const normalized = value.replace(/\./g, '').replace(',', '.').trim();
    if (!normalized) {
      return null;
    }
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new ValidationError('Informe um valor numérico válido.');
    }
    return Math.round(parsed * 100) / 100;
  }

  throw new ValidationError('Informe um valor numérico válido.');
};

const mapSpecialtiesFromRow = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const result: string[] = [];
  const seen = new Set<string>();

  for (const item of value) {
    if (typeof item !== 'string') {
      continue;
    }

    const trimmed = item.trim();
    if (!trimmed) {
      continue;
    }

    const key = trimmed.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(trimmed);
  }

  return result;
};

const mapNumber = (value: string | number | null | undefined): number | null => {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.round(parsed * 100) / 100;
};

const buildProfileStorage = (row?: UserProfileQueryRow | null): ProfileStorageRow => ({
  title: row?.title ?? null,
  bio: row?.bio ?? null,
  office: row?.office ?? null,
  oab_number: row?.oab_number ?? null,
  oab_uf: row?.oab_uf ?? null,
  specialties: mapSpecialtiesFromRow(row?.specialties ?? []),
  hourly_rate: mapNumber(row?.hourly_rate),
  timezone: row?.timezone ?? null,
  language: row?.language ?? null,
  linkedin_url: row?.linkedin_url ?? null,
  website_url: row?.website_url ?? null,
  address_street: row?.address_street ?? null,
  address_city: row?.address_city ?? null,
  address_state: row?.address_state ?? null,
  address_zip: row?.address_zip ?? null,
  notifications_security_alerts:
    row?.notifications_security_alerts ?? true,
  notifications_agenda_reminders:
    row?.notifications_agenda_reminders ?? true,
  notifications_newsletter: row?.notifications_newsletter ?? false,
  security_two_factor: row?.security_two_factor ?? false,
  security_login_alerts: row?.security_login_alerts ?? false,
  security_device_approval: row?.security_device_approval ?? false,
  avatar_url: row?.avatar_url ?? null,
  member_since: row?.member_since ?? null,
});

const mapAuditLogRow = (row: QueryResultRow): UserProfileAuditLog => ({
  id: Number(row.id),
  userId: Number(row.user_id),
  action: typeof row.action === 'string' ? row.action : '',
  description: typeof row.description === 'string' ? row.description : '',
  performedBy:
    row.performed_by === null || row.performed_by === undefined
      ? null
      : Number(row.performed_by),
  performedByName:
    typeof row.performed_by_name === 'string' ? row.performed_by_name : null,
  createdAt: toIsoString(row.created_at) ?? new Date().toISOString(),
});

const mapSessionRow = (row: QueryResultRow): UserProfileSession => ({
  id: Number(row.id),
  userId: Number(row.user_id),
  device: typeof row.device === 'string' ? row.device : '',
  location: typeof row.location === 'string' ? row.location : null,
  lastActivity: toIsoString(row.last_activity) ?? new Date().toISOString(),
  isActive: Boolean(row.is_active),
  isApproved: Boolean(row.is_approved),
  approvedAt: toIsoString(row.approved_at),
  createdAt: toIsoString(row.created_at) ?? new Date().toISOString(),
  revokedAt: toIsoString(row.revoked_at),
});

const arraysEqual = (a: string[], b: string[]): boolean => {
  if (a.length !== b.length) {
    return false;
  }

  return a.every((value, index) => value === b[index]);
};

const generateBase32Secret = (length = 32): string => {
  const bytes = randomBytes(length);
  let secret = '';

  for (const byte of bytes) {
    secret += BASE32_ALPHABET.charAt(byte & 31);
  }

  return secret;
};

const base32ToBuffer = (secret: string): Buffer => {
  const sanitized = secret.replace(/[^A-Z2-7]/gi, '').toUpperCase();

  if (!sanitized) {
    return Buffer.alloc(0);
  }

  let bits = '';
  for (const char of sanitized) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) {
      continue;
    }
    bits += index.toString(2).padStart(5, '0');
  }

  const byteCount = Math.floor(bits.length / 8);
  const buffer = Buffer.alloc(byteCount);

  for (let i = 0; i < byteCount; i += 1) {
    buffer[i] = Number.parseInt(bits.slice(i * 8, i * 8 + 8), 2);
  }

  return buffer;
};

const buildCounterBuffer = (timestamp: number): Buffer => {
  const counter = Math.floor(timestamp / 1000 / DEFAULT_TOTP_STEP_SECONDS);
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  return buffer;
};

const generateTotpToken = (secret: string, timestamp: number): string | null => {
  const key = base32ToBuffer(secret);

  if (key.length === 0) {
    return null;
  }

  const digest = createHmac('sha1', key).update(buildCounterBuffer(timestamp)).digest();
  const offset = digest[digest.length - 1] & 0xf;

  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);

  return (binary % 10 ** TOTP_DIGITS).toString().padStart(TOTP_DIGITS, '0');
};

const verifyTotpToken = (secret: string, token: string): boolean => {
  const normalized = token.replace(/\s+/g, '');

  if (!/^\d{6}$/.test(normalized)) {
    return false;
  }

  const now = Date.now();

  for (let offset = -DEFAULT_TOTP_WINDOW; offset <= DEFAULT_TOTP_WINDOW; offset += 1) {
    const timestamp = now + offset * DEFAULT_TOTP_STEP_SECONDS * 1000;
    const expected = generateTotpToken(secret, timestamp);

    if (expected && expected === normalized) {
      return true;
    }
  }

  return false;
};

const normalizeBackupCode = (value: string): string =>
  value.replace(/[^A-Z0-9]/gi, '').toUpperCase();

const generateBackupCodes = (): string[] => {
  const codes = new Set<string>();

  while (codes.size < BACKUP_CODES_COUNT) {
    codes.add(randomBytes(BACKUP_CODE_BYTES).toString('hex').toUpperCase());
  }

  return Array.from(codes);
};

const hashBackupCode = (code: string): string => createHash('sha256').update(code).digest('hex');

const consumeBackupCode = (code: string, hashedCodes: string[]): string[] | null => {
  if (!Array.isArray(hashedCodes) || hashedCodes.length === 0) {
    return null;
  }

  const normalized = normalizeBackupCode(code);
  if (!normalized) {
    return null;
  }

  const hashed = hashBackupCode(normalized);
  const index = hashedCodes.findIndex((value) => value === hashed);

  if (index === -1) {
    return null;
  }

  const remaining = hashedCodes.slice();
  remaining.splice(index, 1);
  return remaining;
};

const buildOtpAuthUrl = (label: string, secret: string, issuer: string): string => {
  const encodedLabel = encodeURIComponent(label);
  const encodedIssuer = encodeURIComponent(issuer);
  return `otpauth://totp/${encodedLabel}?secret=${secret}&issuer=${encodedIssuer}`;
};

const buildQrCodeUrl = (data: string): string =>
  `${QR_CODE_ENDPOINT}?text=${encodeURIComponent(data)}&size=${QR_CODE_SIZE}&margin=2`;

class UserProfileService {
  constructor(private readonly db: Queryable = pool) {}

  private async fetchUserProfileRow(
    userId: number
  ): Promise<UserProfileQueryRow | null> {
    const result = await this.db.query(
      `
        SELECT
          u.id AS user_id,
          u.nome_completo,
          u.cpf,
          u.email,
          u.telefone,
          u.ultimo_login,
          u.datacriacao,
          p.title,
          p.bio,
          p.office,
          p.oab_number,
          p.oab_uf,
          p.specialties,
          p.hourly_rate,
          p.timezone,
          p.language,
          p.linkedin_url,
          p.website_url,
          p.address_street,
          p.address_city,
          p.address_state,
          p.address_zip,
          p.notifications_security_alerts,
          p.notifications_agenda_reminders,
          p.notifications_newsletter,
          p.security_two_factor,
          p.security_login_alerts,
          p.security_device_approval,
          p.security_two_factor_secret,
          p.security_two_factor_activated_at,
          p.security_two_factor_backup_codes,
          p.avatar_url,
          p.member_since
        FROM public.usuarios u
        LEFT JOIN public.user_profiles p ON p.user_id = u.id
        WHERE u.id = $1
        LIMIT 1
      `,
      [userId]
    );

    if (result.rowCount === 0) {
      return null;
    }

    return result.rows[0] as UserProfileQueryRow;
  }

  private mapRowToProfile(row: UserProfileQueryRow): UserProfile {
    const specialties = mapSpecialtiesFromRow(row.specialties ?? []);

    const notifications = {
      securityAlerts: row.notifications_security_alerts ?? true,
      agendaReminders: row.notifications_agenda_reminders ?? true,
      newsletter: row.notifications_newsletter ?? false,
    };

    const security = {
      twoFactor: row.security_two_factor ?? false,
      loginAlerts: row.security_login_alerts ?? false,
      deviceApproval: row.security_device_approval ?? false,
      twoFactorActivatedAt: toIsoString(row.security_two_factor_activated_at),
    };

    return {
      id: row.user_id,
      name: row.nome_completo ?? '',
      cpf: row.cpf ?? null,
      title: row.title ?? null,
      email: row.email ?? '',
      phone: row.telefone ?? null,
      bio: row.bio ?? null,
      office: row.office ?? null,
      oabNumber: row.oab_number ?? null,
      oabUf: row.oab_uf ?? null,
      specialties,
      hourlyRate: mapNumber(row.hourly_rate),
      timezone: row.timezone ?? null,
      language: row.language ?? null,
      linkedin: row.linkedin_url ?? null,
      website: row.website_url ?? null,
      address: {
        street: row.address_street ?? null,
        city: row.address_city ?? null,
        state: row.address_state ?? null,
        zip: row.address_zip ?? null,
      },
      notifications,
      security,
      lastLogin: toIsoString(row.ultimo_login),
      memberSince: toIsoString(row.member_since ?? row.datacriacao),
      avatarUrl: row.avatar_url ?? null,
    };
  }

  public async getProfile(userId: number): Promise<UserProfile> {
    const normalizedId = normalizeUserId(userId);
    const row = await this.fetchUserProfileRow(normalizedId);

    if (!row) {
      throw new NotFoundError('Usuário não encontrado.');
    }

    return this.mapRowToProfile(row);
  }

  public async updateProfile(
    userId: number,
    input: UpdateProfileInput,
    performedBy?: { id?: number; name?: string }
  ): Promise<UserProfile> {
    const normalizedId = normalizeUserId(userId);
    const currentRow = await this.fetchUserProfileRow(normalizedId);

    if (!currentRow) {
      throw new NotFoundError('Usuário não encontrado.');
    }

    const currentProfile = this.mapRowToProfile(currentRow);
    const storage = buildProfileStorage(currentRow);

    const updatesUsuarios: string[] = [];
    const valuesUsuarios: unknown[] = [];

    const addUsuarioUpdate = (column: string, value: unknown) => {
      const placeholderIndex = valuesUsuarios.length + 1;
      updatesUsuarios.push(`${column} = $${placeholderIndex}`);
      valuesUsuarios.push(value);
    };

    const nameValue = normalizeOptionalString(input.name);
    if (nameValue !== undefined) {
      if (nameValue === null) {
        throw new ValidationError('O nome não pode ficar vazio.');
      }
      addUsuarioUpdate('nome_completo', nameValue);
    }

    const emailValue = normalizeOptionalEmail(input.email);
    if (emailValue !== undefined) {
      if (emailValue === null) {
        throw new ValidationError('Informe um e-mail válido.');
      }
      addUsuarioUpdate('email', emailValue);
    }

    const phoneValue = normalizeOptionalPhone(input.phone);
    if (phoneValue !== undefined) {
      addUsuarioUpdate('telefone', phoneValue);
    }

    const cpfValue = normalizeOptionalCpf(input.cpf);
    if (cpfValue !== undefined) {
      addUsuarioUpdate('cpf', cpfValue);
    }

    const specialtiesValue = normalizeSpecialties(input.specialties);
    if (specialtiesValue !== undefined) {
      storage.specialties = specialtiesValue;
    }

    const titleValue = normalizeOptionalString(input.title);
    if (titleValue !== undefined) {
      storage.title = titleValue;
    }

    const bioValue = normalizeOptionalString(input.bio);
    if (bioValue !== undefined) {
      storage.bio = bioValue;
    }

    const officeValue = normalizeOptionalString(input.office);
    if (officeValue !== undefined) {
      storage.office = officeValue;
    }

    const oabNumberValue = normalizeOptionalString(input.oabNumber);
    if (oabNumberValue !== undefined) {
      storage.oab_number = oabNumberValue;
    }

    const oabUfValue = normalizeOptionalString(input.oabUf, { uppercase: true });
    if (oabUfValue !== undefined) {
      if (oabUfValue && oabUfValue.length !== 2) {
        throw new ValidationError('Informe a UF da OAB com duas letras.');
      }
      storage.oab_uf = oabUfValue;
    }

    const hourlyRateValue = normalizeHourlyRate(input.hourlyRate);
    if (hourlyRateValue !== undefined) {
      storage.hourly_rate = hourlyRateValue;
    }

    const timezoneValue = normalizeOptionalString(input.timezone);
    if (timezoneValue !== undefined) {
      storage.timezone = timezoneValue;
    }

    const languageValue = normalizeOptionalString(input.language);
    if (languageValue !== undefined) {
      storage.language = languageValue;
    }

    const linkedinValue = normalizeOptionalUrl(input.linkedin);
    if (linkedinValue !== undefined) {
      storage.linkedin_url = linkedinValue;
    }

    const websiteValue = normalizeOptionalUrl(input.website);
    if (websiteValue !== undefined) {
      storage.website_url = websiteValue;
    }

    const avatarValue = normalizeOptionalString(input.avatarUrl);
    if (avatarValue !== undefined) {
      storage.avatar_url = avatarValue;
    }

    if (input.address) {
      const { street, city, state, zip } = input.address;
      const streetValue = normalizeOptionalString(street);
      if (streetValue !== undefined) {
        storage.address_street = streetValue;
      }

      const cityValue = normalizeOptionalString(city);
      if (cityValue !== undefined) {
        storage.address_city = cityValue;
      }

      const stateValue = normalizeOptionalString(state, { uppercase: true });
      if (stateValue !== undefined) {
        storage.address_state = stateValue;
      }

      const zipValue = normalizeOptionalString(zip);
      if (zipValue !== undefined) {
        storage.address_zip = zipValue;
      }
    }

    if (input.notifications) {
      const notifications = input.notifications;

      const securityAlerts = normalizeOptionalBoolean(
        notifications.securityAlerts
      );
      if (securityAlerts !== undefined) {
        storage.notifications_security_alerts = securityAlerts;
      }

      const agendaReminders = normalizeOptionalBoolean(
        notifications.agendaReminders
      );
      if (agendaReminders !== undefined) {
        storage.notifications_agenda_reminders = agendaReminders;
      }

      const newsletter = normalizeOptionalBoolean(notifications.newsletter);
      if (newsletter !== undefined) {
        storage.notifications_newsletter = newsletter;
      }
    }

    if (input.security) {
      const security = input.security;

      const twoFactor = normalizeOptionalBoolean(security.twoFactor);
      if (twoFactor !== undefined) {
        storage.security_two_factor = twoFactor;
      }

      const loginAlerts = normalizeOptionalBoolean(security.loginAlerts);
      if (loginAlerts !== undefined) {
        storage.security_login_alerts = loginAlerts;
      }

      const deviceApproval = normalizeOptionalBoolean(
        security.deviceApproval
      );
      if (deviceApproval !== undefined) {
        storage.security_device_approval = deviceApproval;
      }
    }

    const memberSinceValue = input.memberSince;
    if (memberSinceValue !== undefined) {
      if (memberSinceValue === null) {
        storage.member_since = null;
      } else if (memberSinceValue instanceof Date) {
        storage.member_since = memberSinceValue;
      } else if (typeof memberSinceValue === 'string') {
        const parsed = new Date(memberSinceValue);
        if (Number.isNaN(parsed.getTime())) {
          throw new ValidationError('Data inválida para "memberSince".');
        }
        storage.member_since = parsed;
      } else {
        throw new ValidationError('Data inválida para "memberSince".');
      }
    }

    if (updatesUsuarios.length > 0) {
      const setClause = updatesUsuarios.join(', ');
      valuesUsuarios.push(normalizedId);
      await this.db.query(
        `UPDATE public.usuarios SET ${setClause} WHERE id = $${valuesUsuarios.length}`,
        valuesUsuarios
      );
    }

    const profileValues: unknown[] = [
      normalizedId,
      storage.title,
      storage.bio,
      storage.office,
      storage.oab_number,
      storage.oab_uf,
      storage.specialties,
      storage.hourly_rate,
      storage.timezone,
      storage.language,
      storage.linkedin_url,
      storage.website_url,
      storage.address_street,
      storage.address_city,
      storage.address_state,
      storage.address_zip,
      storage.notifications_security_alerts,
      storage.notifications_agenda_reminders,
      storage.notifications_newsletter,
      storage.security_two_factor,
      storage.security_login_alerts,
      storage.security_device_approval,
      storage.avatar_url,
      storage.member_since,
    ];

    await this.db.query(
      `
        INSERT INTO public.user_profiles (
          user_id,
          title,
          bio,
          office,
          oab_number,
          oab_uf,
          specialties,
          hourly_rate,
          timezone,
          language,
          linkedin_url,
          website_url,
          address_street,
          address_city,
          address_state,
          address_zip,
          notifications_security_alerts,
          notifications_agenda_reminders,
          notifications_newsletter,
          security_two_factor,
          security_login_alerts,
          security_device_approval,
          avatar_url,
          member_since
        )
        VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24
        )
        ON CONFLICT (user_id) DO UPDATE SET
          title = EXCLUDED.title,
          bio = EXCLUDED.bio,
          office = EXCLUDED.office,
          oab_number = EXCLUDED.oab_number,
          oab_uf = EXCLUDED.oab_uf,
          specialties = EXCLUDED.specialties,
          hourly_rate = EXCLUDED.hourly_rate,
          timezone = EXCLUDED.timezone,
          language = EXCLUDED.language,
          linkedin_url = EXCLUDED.linkedin_url,
          website_url = EXCLUDED.website_url,
          address_street = EXCLUDED.address_street,
          address_city = EXCLUDED.address_city,
          address_state = EXCLUDED.address_state,
          address_zip = EXCLUDED.address_zip,
          notifications_security_alerts = EXCLUDED.notifications_security_alerts,
          notifications_agenda_reminders = EXCLUDED.notifications_agenda_reminders,
          notifications_newsletter = EXCLUDED.notifications_newsletter,
          security_two_factor = EXCLUDED.security_two_factor,
          security_login_alerts = EXCLUDED.security_login_alerts,
          security_device_approval = EXCLUDED.security_device_approval,
          avatar_url = EXCLUDED.avatar_url,
          member_since = EXCLUDED.member_since,
          updated_at = NOW()
      `,
      profileValues
    );

    const changedFieldLabels = new Set<string>();
    const auditEntries: AuditLogPayload[] = [];

    if (nameValue !== undefined && nameValue !== currentProfile.name) {
      changedFieldLabels.add('Nome completo');
    }

    if (cpfValue !== undefined && cpfValue !== currentProfile.cpf) {
      changedFieldLabels.add('CPF');
    }

    if (emailValue !== undefined && emailValue !== currentProfile.email) {
      changedFieldLabels.add('E-mail');
      auditEntries.push({ action: 'EMAIL_CHANGE', description: 'E-mail atualizado.' });
    }

    if (phoneValue !== undefined && phoneValue !== currentProfile.phone) {
      changedFieldLabels.add('Telefone');
    }

    if (titleValue !== undefined && titleValue !== currentProfile.title) {
      changedFieldLabels.add('Título profissional');
    }

    if (bioValue !== undefined && bioValue !== currentProfile.bio) {
      changedFieldLabels.add('Biografia');
    }

    if (officeValue !== undefined && officeValue !== currentProfile.office) {
      changedFieldLabels.add('Escritório');
    }

    if (
      specialtiesValue !== undefined &&
      !arraysEqual(specialtiesValue, currentProfile.specialties)
    ) {
      changedFieldLabels.add('Especialidades');
    }

    if (
      hourlyRateValue !== undefined &&
      hourlyRateValue !== currentProfile.hourlyRate
    ) {
      changedFieldLabels.add('Tarifa por hora');
    }

    if (linkedinValue !== undefined && linkedinValue !== currentProfile.linkedin) {
      changedFieldLabels.add('LinkedIn');
    }

    if (websiteValue !== undefined && websiteValue !== currentProfile.website) {
      changedFieldLabels.add('Website');
    }

    if (
      avatarValue !== undefined &&
      avatarValue !== currentProfile.avatarUrl
    ) {
      changedFieldLabels.add('Avatar');
    }

    if (input.address) {
      const { street, city, state, zip } = input.address;
      const streetValue = normalizeOptionalString(street);
      if (street !== undefined && streetValue !== currentProfile.address.street) {
        changedFieldLabels.add('Endereço');
      }
      const cityValue = normalizeOptionalString(city);
      if (city !== undefined && cityValue !== currentProfile.address.city) {
        changedFieldLabels.add('Cidade');
      }
      const stateValue = normalizeOptionalString(state, { uppercase: true });
      if (state !== undefined && stateValue !== currentProfile.address.state) {
        changedFieldLabels.add('Estado');
      }
      const zipValue = normalizeOptionalString(zip);
      if (zip !== undefined && zipValue !== currentProfile.address.zip) {
        changedFieldLabels.add('CEP');
      }
    }

    if (input.notifications) {
      const notifications = input.notifications;
      if (
        notifications.securityAlerts !== undefined &&
        notifications.securityAlerts !== currentProfile.notifications.securityAlerts
      ) {
        changedFieldLabels.add('Alertas de segurança');
      }
      if (
        notifications.agendaReminders !== undefined &&
        notifications.agendaReminders !== currentProfile.notifications.agendaReminders
      ) {
        changedFieldLabels.add('Lembretes da agenda');
      }
      if (
        notifications.newsletter !== undefined &&
        notifications.newsletter !== currentProfile.notifications.newsletter
      ) {
        changedFieldLabels.add('Newsletter');
      }
    }

    if (input.security) {
      const security = input.security;
      if (
        security.twoFactor !== undefined &&
        security.twoFactor !== currentProfile.security.twoFactor
      ) {
        auditEntries.push({
          action: security.twoFactor ? 'TWO_FACTOR_ENABLED' : 'TWO_FACTOR_DISABLED',
          description: `Autenticação de dois fatores ${security.twoFactor ? 'ativada' : 'desativada'}.`,
        });
      }
      if (
        security.loginAlerts !== undefined &&
        security.loginAlerts !== currentProfile.security.loginAlerts
      ) {
        auditEntries.push({
          action: 'PERMISSION_CHANGE',
          description: `Alertas de login ${security.loginAlerts ? 'ativados' : 'desativados'}.`,
        });
      }
      if (
        security.deviceApproval !== undefined &&
        security.deviceApproval !== currentProfile.security.deviceApproval
      ) {
        auditEntries.push({
          action: 'PERMISSION_CHANGE',
          description: `Aprovação de novos dispositivos ${security.deviceApproval ? 'ativada' : 'desativada'}.`,
        });
      }
    }

    if (changedFieldLabels.size > 0) {
      auditEntries.unshift({
        action: 'PROFILE_UPDATE',
        description: `Campos atualizados: ${Array.from(changedFieldLabels).join(', ')}.`,
      });
    }

    const performerId =
      performedBy?.id && Number.isInteger(performedBy.id)
        ? Number(performedBy.id)
        : normalizedId;
    const performerName =
      typeof performedBy?.name === 'string' && performedBy.name.trim()
        ? performedBy.name.trim()
        : nameValue ?? currentProfile.name;

    for (const entry of auditEntries) {
      await this.createAuditLog(normalizedId, entry.action, entry.description, {
        id: performerId,
        name: performerName,
      });
    }

    const updatedRow = await this.fetchUserProfileRow(normalizedId);
    if (!updatedRow) {
      throw new NotFoundError('Usuário não encontrado após atualização.');
    }

    return this.mapRowToProfile(updatedRow);
  }

  public async createAuditLog(
    userId: number,
    action: string,
    description: string,
    performer?: { id?: number; name?: string }
  ): Promise<void> {
    const normalizedId = normalizeUserId(userId);
    const normalizedAction = typeof action === 'string'
      ? action.trim().toUpperCase()
      : '';

    if (!normalizedAction) {
      throw new ValidationError('Ação inválida para auditoria.');
    }

    if (typeof description !== 'string' || !description.trim()) {
      throw new ValidationError('Descrição inválida para auditoria.');
    }

    const performerId =
      performer?.id !== undefined && performer.id !== null
        ? Number(performer.id)
        : null;

    const performerName =
      typeof performer?.name === 'string' && performer.name.trim()
        ? performer.name.trim()
        : null;

    await this.db.query(
      `
        INSERT INTO public.user_profile_audit_logs (
          user_id,
          action,
          description,
          performed_by,
          performed_by_name
        )
        VALUES ($1, $2, $3, $4, $5)
      `,
      [normalizedId, normalizedAction, description.trim(), performerId, performerName]
    );
  }

  public async listAuditLogs(
    userId: number,
    options: { limit?: number; offset?: number } = {}
  ): Promise<UserProfileAuditLog[]> {
    const normalizedId = normalizeUserId(userId);
    const limit = options.limit && options.limit > 0 ? options.limit : 20;
    const offset = options.offset && options.offset > 0 ? options.offset : 0;

    const result = await this.db.query(
      `
        SELECT id, user_id, action, description, performed_by, performed_by_name, created_at
        FROM public.user_profile_audit_logs
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
      `,
      [normalizedId, limit, offset]
    );

    return result.rows.map(mapAuditLogRow);
  }

  public async initiateTwoFactor(
    userId: number,
    performer?: { id?: number; name?: string }
  ): Promise<TwoFactorInitiationResult> {
    const normalizedId = normalizeUserId(userId);
    const row = await this.fetchUserProfileRow(normalizedId);

    if (!row) {
      throw new NotFoundError('Usuário não encontrado.');
    }

    const secret = generateBase32Secret();
    const issuer = DEFAULT_TOTP_ISSUER;
    const identity =
      typeof row.email === 'string' && row.email.trim()
        ? row.email.trim()
        : `usuario-${normalizedId}`;
    const label = `${issuer}:${identity}`;
    const otpauthUrl = buildOtpAuthUrl(label, secret, issuer);
    const qrCode = buildQrCodeUrl(otpauthUrl);

    await this.db.query(
      `
        INSERT INTO public.user_profiles (
          user_id,
          security_two_factor_secret,
          security_two_factor_backup_codes,
          security_two_factor,
          security_two_factor_activated_at
        )
        VALUES ($1, $2, ARRAY[]::text[], FALSE, NULL)
        ON CONFLICT (user_id) DO UPDATE SET
          security_two_factor_secret = EXCLUDED.security_two_factor_secret,
          security_two_factor_backup_codes = ARRAY[]::text[],
          security_two_factor = FALSE,
          security_two_factor_activated_at = NULL,
          updated_at = NOW()
      `,
      [normalizedId, secret]
    );

    await this.createAuditLog(
      normalizedId,
      'TWO_FACTOR_INIT',
      'Configuração de autenticação de dois fatores iniciada.',
      performer
    );

    return { secret, otpauthUrl, qrCode };
  }

  public async confirmTwoFactor(
    userId: number,
    code: string,
    performer?: { id?: number; name?: string }
  ): Promise<TwoFactorConfirmationResult> {
    const normalizedId = normalizeUserId(userId);
    const row = await this.fetchUserProfileRow(normalizedId);

    if (!row || !row.security_two_factor_secret) {
      throw new ValidationError('Inicie a configuração do 2FA antes de confirmar.');
    }

    if (!verifyTotpToken(row.security_two_factor_secret, code)) {
      throw new ValidationError('Código de verificação inválido.');
    }

    const backupCodes = generateBackupCodes();
    const hashedCodes = backupCodes.map((value) => hashBackupCode(value));

    await this.db.query(
      `
        UPDATE public.user_profiles
        SET security_two_factor = TRUE,
            security_two_factor_activated_at = NOW(),
            security_two_factor_backup_codes = $2,
            updated_at = NOW()
        WHERE user_id = $1
      `,
      [normalizedId, hashedCodes]
    );

    await this.createAuditLog(
      normalizedId,
      'TWO_FACTOR_ENABLED',
      'Autenticação de dois fatores ativada.',
      performer
    );

    return { backupCodes };
  }

  public async disableTwoFactor(
    userId: number,
    code: string,
    performer?: { id?: number; name?: string }
  ): Promise<void> {
    const normalizedId = normalizeUserId(userId);
    const row = await this.fetchUserProfileRow(normalizedId);

    if (!row || !row.security_two_factor_secret) {
      throw new ValidationError('Autenticação de dois fatores não está configurada.');
    }

    if (!row.security_two_factor) {
      throw new ValidationError('Autenticação de dois fatores não está ativa.');
    }

    const hashedCodes = Array.isArray(row.security_two_factor_backup_codes)
      ? row.security_two_factor_backup_codes
      : [];

    let verified = verifyTotpToken(row.security_two_factor_secret, code);

    if (!verified) {
      verified = consumeBackupCode(code, hashedCodes) !== null;
    }

    if (!verified) {
      throw new ValidationError('Código de verificação inválido.');
    }

    await this.db.query(
      `
        UPDATE public.user_profiles
        SET security_two_factor = FALSE,
            security_two_factor_secret = NULL,
            security_two_factor_backup_codes = ARRAY[]::text[],
            security_two_factor_activated_at = NULL,
            updated_at = NOW()
        WHERE user_id = $1
      `,
      [normalizedId]
    );

    await this.createAuditLog(
      normalizedId,
      'TWO_FACTOR_DISABLED',
      'Autenticação de dois fatores desativada.',
      performer
    );
  }

  public async listSessions(userId: number): Promise<UserProfileSession[]> {
    const normalizedId = normalizeUserId(userId);
    const result = await this.db.query(
      `
        SELECT
          id,
          user_id,
          device,
          location,
          last_activity,
          is_active,
          is_approved,
          approved_at,
          created_at,
          revoked_at
        FROM public.user_profile_sessions
        WHERE user_id = $1
        ORDER BY is_active DESC, last_activity DESC
      `,
      [normalizedId]
    );

    return result.rows.map(mapSessionRow);
  }

  public async approveSession(
    userId: number,
    sessionId: number,
    performer?: { id?: number; name?: string }
  ): Promise<UserProfileSession | null> {
    const normalizedId = normalizeUserId(userId);

    if (!Number.isInteger(sessionId) || sessionId <= 0) {
      throw new ValidationError('Sessão inválida.');
    }

    const result = await this.db.query(
      `
        UPDATE public.user_profile_sessions
        SET is_approved = TRUE,
            approved_at = NOW()
        WHERE user_id = $1 AND id = $2 AND is_approved = FALSE
        RETURNING
          id,
          user_id,
          device,
          location,
          last_activity,
          is_active,
          is_approved,
          approved_at,
          created_at,
          revoked_at
      `,
      [normalizedId, sessionId]
    );

    if (result.rowCount === 0) {
      return null;
    }

    const session = mapSessionRow(result.rows[0]);

    await this.createAuditLog(
      normalizedId,
      'DEVICE_APPROVED',
      `Dispositivo aprovado: ${session.device}.`,
      performer
    );

    return session;
  }

  public async revokeSessionApproval(
    userId: number,
    sessionId: number,
    performer?: { id?: number; name?: string }
  ): Promise<UserProfileSession | null> {
    const normalizedId = normalizeUserId(userId);

    if (!Number.isInteger(sessionId) || sessionId <= 0) {
      throw new ValidationError('Sessão inválida.');
    }

    const result = await this.db.query(
      `
        UPDATE public.user_profile_sessions
        SET is_approved = FALSE,
            approved_at = NULL
        WHERE user_id = $1 AND id = $2 AND is_approved = TRUE
        RETURNING
          id,
          user_id,
          device,
          location,
          last_activity,
          is_active,
          is_approved,
          approved_at,
          created_at,
          revoked_at
      `,
      [normalizedId, sessionId]
    );

    if (result.rowCount === 0) {
      return null;
    }

    const session = mapSessionRow(result.rows[0]);

    await this.createAuditLog(
      normalizedId,
      'DEVICE_REVOKED',
      `Aprovação removida do dispositivo: ${session.device}.`,
      performer
    );

    return session;
  }

  public async revokeSession(
    userId: number,
    sessionId: number,
    performer?: { id?: number; name?: string }
  ): Promise<UserProfileSession | null> {
    const normalizedId = normalizeUserId(userId);

    if (!Number.isInteger(sessionId) || sessionId <= 0) {
      throw new ValidationError('Sessão inválida.');
    }

    const result = await this.db.query(
      `
        UPDATE public.user_profile_sessions
        SET is_active = FALSE,
            revoked_at = NOW(),
            last_activity = NOW()
        WHERE user_id = $1 AND id = $2 AND is_active = TRUE
        RETURNING
          id,
          user_id,
          device,
          location,
          last_activity,
          is_active,
          is_approved,
          approved_at,
          created_at,
          revoked_at
      `,
      [normalizedId, sessionId]
    );

    if (result.rowCount === 0) {
      return null;
    }

    const session = mapSessionRow(result.rows[0]);

    await this.createAuditLog(
      normalizedId,
      'STATUS_CHANGE',
      `Sessão revogada: ${session.device}.`,
      performer
    );

    return session;
  }

  public async revokeAllSessions(
    userId: number,
    performer?: { id?: number; name?: string }
  ): Promise<number> {
    const normalizedId = normalizeUserId(userId);

    const result = await this.db.query(
      `
        UPDATE public.user_profile_sessions
        SET is_active = FALSE,
            revoked_at = NOW(),
            last_activity = NOW()
        WHERE user_id = $1 AND is_active = TRUE
        RETURNING id
      `,
      [normalizedId]
    );

    const revokedCount = result.rowCount;

    if (revokedCount > 0) {
      await this.createAuditLog(
        normalizedId,
        'STATUS_CHANGE',
        'Todas as sessões ativas foram revogadas.',
        performer
      );
    }

    return revokedCount;
  }
}

export default UserProfileService;
