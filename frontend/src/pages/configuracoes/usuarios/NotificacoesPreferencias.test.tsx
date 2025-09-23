import { describe, expect, it, afterEach, vi } from "vitest";
import { act } from "react-dom/test-utils";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import NotificacoesPreferencias from "./NotificacoesPreferencias";

const createJsonResponse = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

interface RenderResult {
  container: HTMLElement;
  unmount: () => void;
}

function renderPage(): RenderResult {
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
    root.render(
      <QueryClientProvider client={queryClient}>
        <NotificacoesPreferencias />
      </QueryClientProvider>,
    );
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

describe("NotificacoesPreferencias", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
    document.body.innerHTML = "";
  });

  it("carrega preferências existentes e salva alterações", async () => {
    let preferences = {
      email: {
        newMessages: false,
        appointments: true,
        deadlines: true,
        systemUpdates: false,
        securityAlerts: true,
        teamActivity: false,
      },
      push: {
        newMessages: true,
        appointments: false,
        deadlines: false,
        securityAlerts: true,
      },
      sms: {
        appointments: false,
        securityAlerts: true,
        emergencyOnly: false,
      },
      frequency: {
        emailDigest: "weekly",
        reminderTiming: "2hours",
      },
    };

    const fetchMock = vi.fn(async (input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      const method = (init?.method ?? "GET").toUpperCase();

      if (url.includes("/notifications/preferences")) {
        if (method === "PUT") {
          const body = typeof init?.body === "string" ? JSON.parse(init.body) : {};
          const updates = body as Record<string, unknown>;
          const email = (updates.email as Record<string, boolean>) ?? {};
          const push = (updates.push as Record<string, boolean>) ?? {};
          const sms = (updates.sms as Record<string, boolean>) ?? {};
          const frequency = (updates.frequency as Record<string, string>) ?? {};

          preferences = {
            email: { ...preferences.email, ...email },
            push: { ...preferences.push, ...push },
            sms: { ...preferences.sms, ...sms },
            frequency: { ...preferences.frequency, ...frequency },
          };

          return createJsonResponse(preferences);
        }

        return createJsonResponse(preferences);
      }

      throw new Error(`Unexpected request: ${url}`);
    });

    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { unmount } = renderPage();

    try {
      await act(async () => {
        await Promise.resolve();
      });

      const summaryText = document.body.textContent ?? "";
      expect(summaryText).toContain("Email ativo 3/6");
      expect(summaryText).toContain("Push ativo 2/4");
      expect(summaryText).toContain("SMS ativo 1/3");

      const labels = Array.from(document.body.querySelectorAll("label"));
      const systemUpdatesLabel = labels.find((label) =>
        label.textContent?.includes("Atualizações do sistema"),
      );
      expect(systemUpdatesLabel).not.toBeUndefined();

      const switchElement = systemUpdatesLabel
        ?.closest("div")
        ?.parentElement?.parentElement?.querySelector('[role="switch"]') as
        | HTMLButtonElement
        | null;
      expect(switchElement).not.toBeNull();
      expect(switchElement?.getAttribute("data-state")).toBe("unchecked");

      await act(async () => {
        switchElement?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        await Promise.resolve();
      });

      expect(switchElement?.getAttribute("data-state")).toBe("checked");

      const saveButton = Array.from(document.body.querySelectorAll("button")).find((button) =>
        button.textContent?.includes("Salvar Alterações"),
      ) as HTMLButtonElement | null;
      expect(saveButton).not.toBeNull();
      expect(saveButton?.disabled).toBe(false);

      await act(async () => {
        saveButton?.click();
        await Promise.resolve();
      });

      const putCall = fetchMock.mock.calls.find(([, init]) => init?.method === "PUT");
      expect(putCall).toBeDefined();
      const body = JSON.parse((putCall?.[1]?.body as string) ?? "{}") as Record<string, unknown>;
      expect(body.email?.systemUpdates).toBe(true);

      expect(saveButton?.disabled).toBe(true);

      const updatedSummary = document.body.textContent ?? "";
      expect(updatedSummary).toContain("Email ativo 4/6");
    } finally {
      unmount();
    }
  });
});

