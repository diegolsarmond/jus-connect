import { getApiUrl } from "@/lib/api";

export type NotificationType = "info" | "success" | "warning" | "error";

export interface Notification {
  id: string;
  title: string;
  message: string;
  category: string;
  type: NotificationType;
  read: boolean;
  createdAt: string;
  readAt?: string | null;
  actionUrl?: string | null;
  metadata?: Record<string, unknown> | undefined;
}

export interface NotificationPreferences {
  email: {
    newMessages: boolean;
    appointments: boolean;
    deadlines: boolean;
    systemUpdates: boolean;
    securityAlerts: boolean;
    teamActivity: boolean;
  };
  push: {
    newMessages: boolean;
    appointments: boolean;
    deadlines: boolean;
    securityAlerts: boolean;
  };
  sms: {
    appointments: boolean;
    securityAlerts: boolean;
    emergencyOnly: boolean;
  };
  frequency: {
    emailDigest: string;
    reminderTiming: string;
  };
}

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends Record<string, unknown> ? DeepPartial<T[K]> : T[K];
};

export type NotificationPreferenceUpdates = DeepPartial<NotificationPreferences>;

export class NotificationsApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "NotificationsApiError";
    this.status = status;
  }
}

const JSON_HEADERS = { Accept: "application/json" } as const;
const DEFAULT_USER_ID = "default";

const DEFAULT_PREFERENCES: NotificationPreferences = {
  email: {
    newMessages: true,
    appointments: true,
    deadlines: true,
    systemUpdates: false,
    securityAlerts: true,
    teamActivity: true,
  },
  push: {
    newMessages: true,
    appointments: true,
    deadlines: true,
    securityAlerts: true,
  },
  sms: {
    appointments: false,
    securityAlerts: true,
    emergencyOnly: true,
  },
  frequency: {
    emailDigest: "daily",
    reminderTiming: "1hour",
  },
};

interface RequestOptions {
  signal?: AbortSignal;
  userId?: string;
}

interface FetchNotificationsOptions extends RequestOptions {
  onlyUnread?: boolean;
  category?: string;
  limit?: number;
}

interface UnreadCountResponse {
  unread?: unknown;
}

interface MarkAllNotificationsResponse {
  updated?: unknown;
  notifications?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value.toString();
  }
  return undefined;
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  return fallback;
}

function readStringFromKeys(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = readString(record[key]);
    if (value !== undefined) {
      return value;
    }
  }
  return undefined;
}

function parseMetadata(value: unknown): Record<string, unknown> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  return { ...value };
}

async function parseErrorMessage(response: Response): Promise<string> {
  try {
    const contentType = response.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      const body = (await response.json()) as { error?: unknown; message?: unknown };
      const message = readString(body.error) ?? readString(body.message);
      if (message) {
        return message;
      }
    } else {
      const text = await response.text();
      const trimmed = text.trim();
      if (trimmed) {
        return trimmed;
      }
    }
  } catch (error) {
    console.warn("Failed to parse notifications API error response", error);
  }

  if (response.status === 401) {
    return "Sua sessão expirou. Faça login novamente.";
  }

  if (response.status === 403) {
    return "Você não tem permissão para acessar esta funcionalidade.";
  }

  return "Não foi possível completar a requisição. Tente novamente.";
}

async function requestJson<T>(input: RequestInfo, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers ?? JSON_HEADERS);
  if (!headers.has("Accept")) {
    headers.set("Accept", JSON_HEADERS.Accept);
  }

  const hasBody = init.body !== undefined && init.body !== null;
  if (hasBody && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(input, { ...init, headers });

  if (!response.ok) {
    throw new NotificationsApiError(await parseErrorMessage(response), response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type");
  if (!contentType || !contentType.includes("application/json")) {
    throw new NotificationsApiError("Resposta inválida do servidor de notificações.", response.status);
  }

  return (await response.json()) as T;
}

function normalizeNotification(entry: unknown): Notification | null {
  if (!isRecord(entry)) {
    return null;
  }

  const id = readStringFromKeys(entry, ["id", "notificationId", "notification_id"]);
  const createdAt = readStringFromKeys(entry, ["createdAt", "created_at"]);

  if (!id || !createdAt) {
    return null;
  }

  const title = readStringFromKeys(entry, ["title"]) ?? "Notificação";
  const message = readStringFromKeys(entry, ["message"]) ?? "";
  const category = readStringFromKeys(entry, ["category"]) ?? "general";
  const typeCandidate = readStringFromKeys(entry, ["type"])?.toLowerCase();
  const type: NotificationType =
    typeCandidate === "success" ||
    typeCandidate === "warning" ||
    typeCandidate === "error"
      ? (typeCandidate as NotificationType)
      : "info";

  const readRaw = entry.read;
  const read = typeof readRaw === "boolean" ? readRaw : Boolean(readStringFromKeys(entry, ["readAt", "read_at"]));
  const readAt = readStringFromKeys(entry, ["readAt", "read_at"]) ?? null;
  const actionUrl = readStringFromKeys(entry, ["actionUrl", "action_url"]) ?? null;
  const metadata = parseMetadata(entry.metadata);

  return {
    id,
    title,
    message,
    category,
    type,
    read,
    createdAt,
    readAt,
    actionUrl,
    metadata,
  };
}

function normalizeNotifications(payload: unknown): Notification[] {
  if (!Array.isArray(payload)) {
    return [];
  }

  return payload
    .map((entry) => normalizeNotification(entry))
    .filter((notification): notification is Notification => Boolean(notification))
    .sort((a, b) => (a.createdAt > b.createdAt ? -1 : a.createdAt < b.createdAt ? 1 : 0));
}

function normalizePreferences(payload: unknown): NotificationPreferences {
  if (!isRecord(payload)) {
    return { ...DEFAULT_PREFERENCES };
  }

  const email = isRecord(payload.email) ? payload.email : {};
  const push = isRecord(payload.push) ? payload.push : {};
  const sms = isRecord(payload.sms) ? payload.sms : {};
  const frequency = isRecord(payload.frequency) ? payload.frequency : {};

  return {
    email: {
      newMessages: readBoolean(email.newMessages, DEFAULT_PREFERENCES.email.newMessages),
      appointments: readBoolean(email.appointments, DEFAULT_PREFERENCES.email.appointments),
      deadlines: readBoolean(email.deadlines, DEFAULT_PREFERENCES.email.deadlines),
      systemUpdates: readBoolean(email.systemUpdates, DEFAULT_PREFERENCES.email.systemUpdates),
      securityAlerts: readBoolean(email.securityAlerts, DEFAULT_PREFERENCES.email.securityAlerts),
      teamActivity: readBoolean(email.teamActivity, DEFAULT_PREFERENCES.email.teamActivity),
    },
    push: {
      newMessages: readBoolean(push.newMessages, DEFAULT_PREFERENCES.push.newMessages),
      appointments: readBoolean(push.appointments, DEFAULT_PREFERENCES.push.appointments),
      deadlines: readBoolean(push.deadlines, DEFAULT_PREFERENCES.push.deadlines),
      securityAlerts: readBoolean(push.securityAlerts, DEFAULT_PREFERENCES.push.securityAlerts),
    },
    sms: {
      appointments: readBoolean(sms.appointments, DEFAULT_PREFERENCES.sms.appointments),
      securityAlerts: readBoolean(sms.securityAlerts, DEFAULT_PREFERENCES.sms.securityAlerts),
      emergencyOnly: readBoolean(sms.emergencyOnly, DEFAULT_PREFERENCES.sms.emergencyOnly),
    },
    frequency: {
      emailDigest: readString(frequency.emailDigest) ?? DEFAULT_PREFERENCES.frequency.emailDigest,
      reminderTiming: readString(frequency.reminderTiming) ?? DEFAULT_PREFERENCES.frequency.reminderTiming,
    },
  };
}

function resolveUserId({ userId }: RequestOptions = {}): string {
  const value = typeof userId === "string" ? userId.trim() : "";
  return value.length > 0 ? value : DEFAULT_USER_ID;
}

export async function fetchNotifications({
  category,
  limit,
  onlyUnread,
  signal,
  userId,
}: FetchNotificationsOptions = {}): Promise<Notification[]> {
  const url = new URL(getApiUrl("notifications"));

  if (category) {
    url.searchParams.set("category", category);
  }

  if (typeof limit === "number" && Number.isFinite(limit)) {
    url.searchParams.set("limit", String(Math.max(Math.floor(limit), 1)));
  }

  if (typeof onlyUnread === "boolean") {
    url.searchParams.set("onlyUnread", String(onlyUnread));
  }

  if (userId) {
    url.searchParams.set("userId", userId);
  }

  const payload = await requestJson<unknown>(url.toString(), { signal });
  return normalizeNotifications(payload);
}

export async function fetchUnreadNotificationCount({ signal, userId }: RequestOptions = {}): Promise<number> {
  const url = new URL(getApiUrl("notifications/unread-count"));
  if (userId) {
    url.searchParams.set("userId", userId);
  }

  const payload = await requestJson<UnreadCountResponse>(url.toString(), { signal });
  const count = Number(payload.unread);
  return Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : 0;
}

export async function fetchNotificationPreferences(options: RequestOptions = {}): Promise<NotificationPreferences> {
  const url = new URL(getApiUrl("notifications/preferences"));
  if (options.userId) {
    url.searchParams.set("userId", options.userId);
  }

  const payload = await requestJson<unknown>(url.toString(), { signal: options.signal });
  return normalizePreferences(payload);
}

export async function updateNotificationPreferences(
  updates: NotificationPreferenceUpdates,
  options: RequestOptions = {},
): Promise<NotificationPreferences> {
  const payload = await requestJson<unknown>(getApiUrl("notifications/preferences"), {
    method: "PUT",
    signal: options.signal,
    body: JSON.stringify({
      userId: resolveUserId(options),
      ...updates,
    }),
  });

  return normalizePreferences(payload);
}

export async function markNotificationAsRead(id: string, options: RequestOptions = {}): Promise<Notification> {
  const payload = await requestJson<unknown>(getApiUrl(`notifications/${encodeURIComponent(id)}/read`), {
    method: "POST",
    signal: options.signal,
  });

  const notification = normalizeNotification(payload);
  if (!notification) {
    throw new NotificationsApiError("Resposta inválida ao marcar notificação como lida.", 500);
  }
  return notification;
}

export async function markNotificationAsUnread(id: string, options: RequestOptions = {}): Promise<Notification> {
  const payload = await requestJson<unknown>(getApiUrl(`notifications/${encodeURIComponent(id)}/unread`), {
    method: "POST",
    signal: options.signal,
  });

  const notification = normalizeNotification(payload);
  if (!notification) {
    throw new NotificationsApiError("Resposta inválida ao marcar notificação como não lida.", 500);
  }
  return notification;
}

export interface MarkAllNotificationsResult {
  updated: number;
  notifications: Notification[];
}

export async function markAllNotificationsAsRead(options: RequestOptions = {}): Promise<MarkAllNotificationsResult> {
  const payload = await requestJson<MarkAllNotificationsResponse>(getApiUrl("notifications/read-all"), {
    method: "POST",
    signal: options.signal,
    body: JSON.stringify({ userId: resolveUserId(options) }),
  });

  const updatedRaw = Number(payload.updated);
  const updated = Number.isFinite(updatedRaw) ? Math.max(0, Math.trunc(updatedRaw)) : 0;
  const notifications = normalizeNotifications(payload.notifications);

  return { updated, notifications };
}

export type NotificationCategory = "agenda" | "tasks";

interface NotificationsUnreadResponse {
  unread?: number | null;
  unreadCount?: number | null;
  total?: number | null;
  count?: number | null;
}

const JSON_HEADERS: HeadersInit = {
  Accept: "application/json",
};

const NUMBER_KEYS: Array<keyof NotificationsUnreadResponse> = [
  "unread",
  "unreadCount",
  "total",
  "count",
];

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const parseUnreadCount = (payload: unknown): number => {
  if (isFiniteNumber(payload)) {
    return payload;
  }

  if (payload && typeof payload === "object") {
    for (const key of NUMBER_KEYS) {
      const candidate = (payload as NotificationsUnreadResponse)[key];
      if (isFiniteNumber(candidate)) {
        return candidate;
      }
    }
  }

  return 0;
};

export async function fetchUnreadNotificationsCount(category: NotificationCategory): Promise<number> {
  const url = new URL(getApiUrl("notifications/unread-count"));
  url.searchParams.set("category", category);

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: JSON_HEADERS,
  });

  if (!response.ok) {
    throw new Error(`Falha ao carregar contador de notificações (${response.status})`);
  }

  const payload = (await response.json()) as unknown;
  return parseUnreadCount(payload);
}
