import { describe, expect, it, afterEach, vi } from "vitest";
import { act } from "react-dom/test-utils";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { IntimacaoMenu } from "./IntimacaoMenu";

const createJsonResponse = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

interface RenderResult {
  container: HTMLElement;
  unmount: () => void;
}

function renderWithQueryClient(element: React.ReactElement): RenderResult {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  act(() => {
    root.render(<QueryClientProvider client={queryClient}>{element}</QueryClientProvider>);
  });

  return {
    container,
    unmount: () => {
      act(() => {
        root.unmount();
      });
      queryClient.clear();
      container.remove();
    },
  };
}

describe("IntimacaoMenu", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
    document.body.innerHTML = "";
  });

  it("exibe notificações carregadas da API e permite marcar como lida", async () => {
    let notifications = [
      {
        id: "ntf-1",
        title: "Projudi: novo prazo no processo 0001234-56.2024.8.26.0100",
        message:
          "Prazo para contestação — Processo 0001234-56.2024.8.26.0100 — Prazo em 2024-06-20",
        category: "projudi",
        type: "warning",
        read: false,
        createdAt: "2024-06-15T12:00:00Z",
        metadata: {
          provider: "projudi",
          alertType: "deadline",
          processNumber: "0001234-56.2024.8.26.0100",
          dueDate: "2024-06-20",
          status: "Em andamento",
        },
      },
      {
        id: "ntf-2",
        title: "Projudi: audiência atualizada no processo 0009999-00.2024.8.26.0001",
        message: "Audiência reagendada — Processo 0009999-00.2024.8.26.0001",
        category: "projudi",
        type: "info",
        read: true,
        createdAt: "2024-06-14T10:00:00Z",
        metadata: {
          provider: "projudi",
          alertType: "hearing",
          processNumber: "0009999-00.2024.8.26.0001",
          status: "Concluída",
        },
      },
    ];

    const fetchMock = vi.fn(async (input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      const method = (init?.method ?? "GET").toUpperCase();

      if (url.includes("/notifications/unread-count")) {
        const unread = notifications.reduce((total, notification) => total + (notification.read ? 0 : 1), 0);
        return createJsonResponse({ unread });
      }

      if (url.match(/\/notifications\/[^/]+\/read$/) && method === "POST") {
        const match = url.match(/\/notifications\/(.+)\/read$/);
        const id = match?.[1];
        notifications = notifications.map((notification) =>
          notification.id === id ? { ...notification, read: true } : notification,
        );
        const updated = notifications.find((notification) => notification.id === id);
        return createJsonResponse(updated ?? null);
      }

      if (url.includes("/notifications?")) {
        return createJsonResponse(notifications);
      }

      throw new Error(`Unexpected request: ${url}`);
    });

    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { container, unmount } = renderWithQueryClient(<IntimacaoMenu />);

    try {
      await act(async () => {
        await Promise.resolve();
      });

      const trigger = container.querySelector(
        'button[aria-label="Abrir notificações de intimações"]',
      ) as HTMLButtonElement | null;
      expect(trigger).not.toBeNull();
      expect(trigger?.querySelector("span")?.textContent).toBe("1");

      await act(async () => {
        trigger?.click();
        await Promise.resolve();
      });

      expect(document.body.textContent).toContain("Prazos 1");
      expect(document.body.textContent).toContain("Projudi: novo prazo");

      const toggleButton = document.body.querySelector(
        '[data-testid="notification-ntf-1-toggle-read"]',
      ) as HTMLButtonElement | null;
      expect(toggleButton).not.toBeNull();
      expect(toggleButton?.textContent).toContain("Marcar como lida");

      await act(async () => {
        toggleButton?.click();
        await Promise.resolve();
      });

      const toggleCall = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
      expect(toggleCall?.[0]).toContain("/notifications/ntf-1/read");

      expect(trigger?.querySelector("span")).toBeNull();
      expect(toggleButton?.textContent).toContain("Marcar como não lida");
    } finally {
      unmount();
    }
  });

  it("marca todas as notificações como lidas", async () => {
    let notifications = [
      {
        id: "ntf-10",
        title: "Projudi: novo prazo",
        message: "Prazo para manifestação",
        category: "projudi",
        type: "warning",
        read: false,
        createdAt: "2024-06-15T09:00:00Z",
        metadata: { alertType: "deadline", processNumber: "0001111-22.2024.8.26.0001" },
      },
      {
        id: "ntf-11",
        title: "Projudi: documento disponível",
        message: "Novo documento anexado",
        category: "projudi",
        type: "info",
        read: false,
        createdAt: "2024-06-14T10:00:00Z",
        metadata: { alertType: "document", processNumber: "0002222-33.2024.8.26.0001" },
      },
    ];

    const fetchMock = vi.fn(async (input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      const method = (init?.method ?? "GET").toUpperCase();

      if (url.includes("/notifications/read-all") && method === "POST") {
        notifications = notifications.map((notification) => ({ ...notification, read: true }));
        return createJsonResponse({ updated: 2, notifications });
      }

      if (url.includes("/notifications/unread-count")) {
        return createJsonResponse({ unread: notifications.length });
      }

      if (url.includes("/notifications?")) {
        return createJsonResponse(notifications);
      }

      throw new Error(`Unexpected request: ${url}`);
    });

    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { container, unmount } = renderWithQueryClient(<IntimacaoMenu />);

    try {
      await act(async () => {
        await Promise.resolve();
      });

      const trigger = container.querySelector(
        'button[aria-label="Abrir notificações de intimações"]',
      ) as HTMLButtonElement | null;
      expect(trigger).not.toBeNull();

      await act(async () => {
        trigger?.click();
        await Promise.resolve();
      });

      const markAllButton = document.body.querySelector(
        '[data-testid="mark-all-notifications"]',
      ) as HTMLButtonElement | null;
      expect(markAllButton).not.toBeNull();

      await act(async () => {
        markAllButton?.click();
        await Promise.resolve();
      });

      const markAllCall = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
      expect(markAllCall?.[0]).toContain("/notifications/read-all");

      expect(trigger?.querySelector("span")).toBeNull();
      expect(document.body.textContent).toContain("Nenhuma intimação pendente");
    } finally {
      unmount();
    }
  });
});

