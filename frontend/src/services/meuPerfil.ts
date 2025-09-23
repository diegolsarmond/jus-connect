import { getApiUrl } from '@/lib/api';
import type { AuditLog, UserSession } from '@/types/user';

const generateId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
};

const toIsoDate = (value: unknown): Date | null => {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
};

const toStringOrNull = (value: unknown): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value : null;

const toStringOrUndefined = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim().length > 0 ? value : undefined;

const toBoolean = (value: unknown, fallback = false): boolean =>
  typeof value === 'boolean' ? value : fallback;

const toNumberOrNull = (value: unknown): number | null => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const parseSpecialties = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
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

const parseErrorResponse = async (response: Response): Promise<string> => {
  try {
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const body = (await response.json()) as { error?: unknown; message?: unknown };
      const messageCandidate = toStringOrUndefined(body?.error) ?? toStringOrUndefined(body?.message);
      if (messageCandidate) {
        return messageCandidate;
      }
    } else {
      const text = await response.text();
      if (text.trim().length > 0) {
        return text.trim();
      }
    }
  } catch (error) {
    console.warn('Falha ao interpretar resposta de erro do serviço Meu Perfil', error);
  }

  if (response.status === 401) {
    return 'Sua sessão expirou. Faça login novamente para continuar.';
  }

  if (response.status === 403) {
    return 'Você não tem permissão para executar esta ação.';
  }

  return 'Não foi possível completar a solicitação. Tente novamente.';
};

export class MeuPerfilApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'MeuPerfilApiError';
    this.status = status;
  }
}

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const headers = new Headers(init?.headers);
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }

  const response = await fetch(getApiUrl(path), {
    ...init,
    headers,
  });

  if (!response.ok) {
    throw new MeuPerfilApiError(await parseErrorResponse(response), response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    throw new MeuPerfilApiError('Resposta inesperada do servidor.', response.status);
  }

  return (await response.json()) as T;
};

interface RawProfileResponse {
  id?: number;
  name?: unknown;
  title?: unknown;
  email?: unknown;
  phone?: unknown;
  bio?: unknown;
  office?: unknown;
  oabNumber?: unknown;
  oabUf?: unknown;
  specialties?: unknown;
  hourlyRate?: unknown;
  timezone?: unknown;
  language?: unknown;
  linkedin?: unknown;
  website?: unknown;
  address?: {
    street?: unknown;
    city?: unknown;
    state?: unknown;
    zip?: unknown;
  } | null;
  notifications?: {
    securityAlerts?: unknown;
    agendaReminders?: unknown;
    newsletter?: unknown;
  } | null;
  security?: {
    twoFactor?: unknown;
    loginAlerts?: unknown;
    deviceApproval?: unknown;
  } | null;
  lastLogin?: unknown;
  memberSince?: unknown;
  avatarUrl?: unknown;
}

export interface MeuPerfilProfile {
  id: string;
  name: string;
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
  };
  lastLogin: Date | null;
  memberSince: Date | null;
  avatarUrl: string | null;
}

const mapProfileResponse = (payload: RawProfileResponse): MeuPerfilProfile => {
  const nameCandidate = toStringOrUndefined(payload.name) ?? toStringOrUndefined(payload.email) ?? 'Usuário';

  const address = payload.address ?? undefined;
  const notifications = payload.notifications ?? undefined;
  const security = payload.security ?? undefined;

  return {
    id: payload.id ? String(payload.id) : '0',
    name: nameCandidate,
    title: toStringOrNull(payload.title),
    email: toStringOrUndefined(payload.email) ?? '',
    phone: toStringOrNull(payload.phone),
    bio: toStringOrNull(payload.bio),
    office: toStringOrNull(payload.office),
    oabNumber: toStringOrNull(payload.oabNumber),
    oabUf: toStringOrNull(payload.oabUf),
    specialties: parseSpecialties(payload.specialties),
    hourlyRate: toNumberOrNull(payload.hourlyRate),
    timezone: toStringOrNull(payload.timezone),
    language: toStringOrNull(payload.language),
    linkedin: toStringOrNull(payload.linkedin),
    website: toStringOrNull(payload.website),
    address: {
      street: toStringOrNull(address?.street),
      city: toStringOrNull(address?.city),
      state: toStringOrNull(address?.state),
      zip: toStringOrNull(address?.zip),
    },
    notifications: {
      securityAlerts: toBoolean(notifications?.securityAlerts, true),
      agendaReminders: toBoolean(notifications?.agendaReminders, true),
      newsletter: toBoolean(notifications?.newsletter, false),
    },
    security: {
      twoFactor: toBoolean(security?.twoFactor, false),
      loginAlerts: toBoolean(security?.loginAlerts, false),
      deviceApproval: toBoolean(security?.deviceApproval, false),
    },
    lastLogin: toIsoDate(payload.lastLogin),
    memberSince: toIsoDate(payload.memberSince),
    avatarUrl: toStringOrNull(payload.avatarUrl),
  } satisfies MeuPerfilProfile;
};

interface RawAuditLogResponse {
  id?: unknown;
  userId?: unknown;
  action?: unknown;
  description?: unknown;
  performedByName?: unknown;
  performedBy?: unknown;
  createdAt?: unknown;
}

const mapAuditLogResponse = (payload: RawAuditLogResponse): AuditLog => ({
  id: payload.id ? String(payload.id) : generateId(),
  userId: payload.userId ? String(payload.userId) : '0',
  action: toStringOrUndefined(payload.action) ?? 'UNKNOWN',
  description: toStringOrUndefined(payload.description) ?? 'Sem descrição disponível.',
  performedBy: toStringOrUndefined(payload.performedByName) ?? 'Sistema',
  performedById: payload.performedBy ? String(payload.performedBy) : null,
  timestamp: toIsoDate(payload.createdAt) ?? new Date(),
});

interface RawSessionResponse {
  id?: unknown;
  userId?: unknown;
  device?: unknown;
  location?: unknown;
  lastActivity?: unknown;
  isActive?: unknown;
  createdAt?: unknown;
  revokedAt?: unknown;
}

const mapSessionResponse = (payload: RawSessionResponse): UserSession => ({
  id: payload.id ? String(payload.id) : generateId(),
  userId: payload.userId ? String(payload.userId) : '0',
  device: toStringOrUndefined(payload.device) ?? 'Dispositivo desconhecido',
  location: toStringOrNull(payload.location),
  lastActivity: toIsoDate(payload.lastActivity) ?? new Date(),
  isActive: toBoolean(payload.isActive, false),
  createdAt: toIsoDate(payload.createdAt) ?? undefined,
  revokedAt: toIsoDate(payload.revokedAt) ?? null,
  isCurrent: false,
});

export interface FetchOptions {
  signal?: AbortSignal;
}

export const fetchMeuPerfil = async (options?: FetchOptions): Promise<MeuPerfilProfile> => {
  const data = await request<RawProfileResponse>('me/profile', {
    signal: options?.signal,
  });
  return mapProfileResponse(data);
};

export interface AuditLogsFilters extends FetchOptions {
  limit?: number;
  offset?: number;
}

export const fetchMeuPerfilAuditLogs = async (
  filters?: AuditLogsFilters,
): Promise<AuditLog[]> => {
  const params = new URLSearchParams();
  if (typeof filters?.limit === 'number') {
    params.set('limit', String(filters.limit));
  }
  if (typeof filters?.offset === 'number') {
    params.set('offset', String(filters.offset));
  }

  const path = params.toString()
    ? `me/profile/audit-logs?${params.toString()}`
    : 'me/profile/audit-logs';

  const data = await request<RawAuditLogResponse[]>(path, {
    signal: filters?.signal,
  });

  return data.map(mapAuditLogResponse);
};

export const fetchMeuPerfilSessions = async (
  options?: FetchOptions,
): Promise<UserSession[]> => {
  const data = await request<RawSessionResponse[]>('me/profile/sessions', {
    signal: options?.signal,
  });
  return data.map(mapSessionResponse);
};

export const revokeMeuPerfilSession = async (
  sessionId: string,
  options?: FetchOptions,
): Promise<UserSession> => {
  const numericId = Number.parseInt(sessionId, 10);
  if (!Number.isFinite(numericId) || numericId <= 0) {
    throw new MeuPerfilApiError('Sessão inválida.', 400);
  }

  const data = await request<RawSessionResponse>(`me/profile/sessions/${numericId}/revoke`, {
    method: 'POST',
    signal: options?.signal,
  });

  return mapSessionResponse(data);
};

export const revokeTodasMeuPerfilSessions = async (
  options?: FetchOptions,
): Promise<{ revokedCount: number }> => {
  const data = await request<{ revokedCount?: unknown }>('me/profile/sessions/revoke-all', {
    method: 'POST',
    signal: options?.signal,
  });

  const revokedCount =
    typeof data?.revokedCount === 'number' && Number.isFinite(data.revokedCount)
      ? data.revokedCount
      : typeof data?.revokedCount === 'string'
        ? Number(data.revokedCount) || 0
        : 0;

  return { revokedCount };
};

export interface UpdateMeuPerfilPayload {
  name?: string | null;
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
  } | null;
  notifications?: {
    securityAlerts?: boolean;
    agendaReminders?: boolean;
    newsletter?: boolean;
  } | null;
  security?: {
    twoFactor?: boolean;
    loginAlerts?: boolean;
    deviceApproval?: boolean;
  } | null;
  avatarUrl?: string | null;
  memberSince?: string | Date | null;
}

const buildUpdateBody = (payload: UpdateMeuPerfilPayload): Record<string, unknown> => {
  const body: Record<string, unknown> = {};

  const assign = <T extends string>(key: T, value: UpdateMeuPerfilPayload[T]) => {
    if (value !== undefined) {
      body[key] = value;
    }
  };

  assign('name', payload.name);
  assign('title', payload.title);
  assign('email', payload.email);
  assign('phone', payload.phone);
  assign('bio', payload.bio);
  assign('office', payload.office);
  assign('oabNumber', payload.oabNumber);
  assign('oabUf', payload.oabUf);
  assign('specialties', payload.specialties);
  assign('hourlyRate', payload.hourlyRate);
  assign('timezone', payload.timezone);
  assign('language', payload.language);
  assign('linkedin', payload.linkedin);
  assign('website', payload.website);
  assign('address', payload.address);
  assign('notifications', payload.notifications);
  assign('security', payload.security);
  assign('avatarUrl', payload.avatarUrl);
  assign('memberSince', payload.memberSince);

  return body;
};

export const updateMeuPerfil = async (
  payload: UpdateMeuPerfilPayload,
  options?: FetchOptions,
): Promise<MeuPerfilProfile> => {
  const body = buildUpdateBody(payload);
  const data = await request<RawProfileResponse>('me/profile', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: options?.signal,
  });

  return mapProfileResponse(data);
};

