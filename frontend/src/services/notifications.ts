import { getApiUrl } from "@/lib/api";

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
