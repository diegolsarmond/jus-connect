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

  it("exibe intimações carregadas da API e permite marcar como lida", async () => {
    let intimacoes = [
      {
        id: 1,
        siglaTribunal: "TJSP",
        external_id: "ext-1",
        numero_processo: "0001234-56.2024.8.26.0100",
        nomeOrgao: "3ª Vara Cível",
        tipoComunicacao: "Prazo para contestação",
        texto: "Prazo para contestação — Prazo em 2024-06-20",
        prazo: "2024-06-20",
        data_disponibilizacao: "2024-06-15T12:00:00Z",
        created_at: "2024-06-15T12:00:00Z",
        updated_at: null,
        meio: "Projudi",
        link: "https://projudi.tj/ntf-1",
        tipodocumento: "Prazo",
        nomeclasse: "Cível",
        codigoclasse: null,
        numerocomunicacao: "123",
        ativo: true,
        hash: null,
        status: "Em andamento",
        motivo_cancelamento: null,
        data_cancelamento: null,
        destinatarios: null,
        destinatarios_advogados: null,
        idusuario: 10,
        idempresa: 20,
        nao_lida: true,
        arquivada: false,
      },
      {
        id: 2,
        siglaTribunal: "TJSP",
        external_id: "ext-2",
        numero_processo: "0009999-00.2024.8.26.0001",
        nomeOrgao: "1ª Vara Cível",
        tipoComunicacao: "Audiência",
        texto: "Audiência reagendada",
        prazo: null,
        data_disponibilizacao: "2024-06-14T10:00:00Z",
        created_at: "2024-06-14T10:00:00Z",
        updated_at: "2024-06-14T11:00:00Z",
        meio: "Projudi",
        link: null,
        tipodocumento: "Audiência",
        nomeclasse: "Cível",
        codigoclasse: null,
        numerocomunicacao: "456",
        ativo: true,
        hash: null,
        status: "Concluída",
        motivo_cancelamento: null,
        data_cancelamento: null,
        destinatarios: null,
        destinatarios_advogados: null,
        idusuario: 11,
        idempresa: 20,
        nao_lida: false,
        arquivada: false,
      },
    ];

    const fetchMock = vi.fn(async (input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      const method = (init?.method ?? "GET").toUpperCase();

      if (url.match(/\/intimacoes\/\d+\/read$/) && method === "PATCH") {
        const match = url.match(/\/intimacoes\/(\d+)\/read$/);
        const id = match?.[1];
        intimacoes = intimacoes.map((item) =>
          String(item.id) === id ? { ...item, nao_lida: false, updated_at: "2024-06-15T13:00:00Z" } : item,
        );
        const updated = intimacoes.find((item) => String(item.id) === id);
        return createJsonResponse({ id: updated?.id ?? null, nao_lida: updated?.nao_lida ?? null });
      }

      if (url.endsWith("/intimacoes") && method === "GET") {
        return createJsonResponse(intimacoes);
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
      expect(document.body.textContent).toContain("Prazo para contestação");

      const toggleButton = document.body.querySelector(
        '[data-testid="notification-1-toggle-read"]',
      ) as HTMLButtonElement | null;
      expect(toggleButton).not.toBeNull();
      expect(toggleButton?.textContent).toContain("Marcar como lida");

      await act(async () => {
        toggleButton?.click();
        await Promise.resolve();
      });

      const toggleCall = fetchMock.mock.calls.find(([, init]) => init?.method === "PATCH");
      expect(toggleCall?.[0]).toContain("/intimacoes/1/read");

      expect(trigger?.querySelector("span")).toBeNull();
      expect(toggleButton?.textContent).toContain("Lida");
    } finally {
      unmount();
    }
  });

  it("marca todas as intimações como lidas", async () => {
    let intimacoes = [
      {
        id: 10,
        siglaTribunal: "TJPR",
        external_id: "ext-10",
        numero_processo: "0001111-22.2024.8.26.0001",
        nomeOrgao: "2ª Vara",
        tipoComunicacao: "Prazo",
        texto: "Prazo para manifestação",
        prazo: "2024-06-18",
        data_disponibilizacao: "2024-06-15T09:00:00Z",
        created_at: "2024-06-15T09:00:00Z",
        updated_at: null,
        meio: "Projudi",
        link: null,
        tipodocumento: "Prazo",
        nomeclasse: "Cível",
        codigoclasse: null,
        numerocomunicacao: "111",
        ativo: true,
        hash: null,
        status: "Pendente",
        motivo_cancelamento: null,
        data_cancelamento: null,
        destinatarios: null,
        destinatarios_advogados: null,
        idusuario: 30,
        idempresa: 40,
        nao_lida: true,
        arquivada: false,
      },
      {
        id: 11,
        siglaTribunal: "TJPR",
        external_id: "ext-11",
        numero_processo: "0002222-33.2024.8.26.0001",
        nomeOrgao: "3ª Vara",
        tipoComunicacao: "Documento",
        texto: "Novo documento anexado",
        prazo: null,
        data_disponibilizacao: "2024-06-14T10:00:00Z",
        created_at: "2024-06-14T10:00:00Z",
        updated_at: null,
        meio: "Projudi",
        link: null,
        tipodocumento: "Documento",
        nomeclasse: "Cível",
        codigoclasse: null,
        numerocomunicacao: "222",
        ativo: true,
        hash: null,
        status: "Pendente",
        motivo_cancelamento: null,
        data_cancelamento: null,
        destinatarios: null,
        destinatarios_advogados: null,
        idusuario: 31,
        idempresa: 40,
        nao_lida: true,
        arquivada: false,
      },
    ];

    const fetchMock = vi.fn(async (input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      const method = (init?.method ?? "GET").toUpperCase();

      if (url.match(/\/intimacoes\/\d+\/read$/) && method === "PATCH") {
        const match = url.match(/\/intimacoes\/(\d+)\/read$/);
        const id = match?.[1];
        intimacoes = intimacoes.map((item) =>
          String(item.id) === id ? { ...item, nao_lida: false, updated_at: "2024-06-16T09:00:00Z" } : item,
        );
        const updated = intimacoes.find((item) => String(item.id) === id);
        return createJsonResponse({ id: updated?.id ?? null, nao_lida: updated?.nao_lida ?? null });
      }

      if (url.endsWith("/intimacoes") && method === "GET") {
        return createJsonResponse(intimacoes);
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

      const patchCalls = fetchMock.mock.calls.filter(([, init]) => init?.method === "PATCH");
      expect(patchCalls).toHaveLength(2);
      expect(patchCalls[0]?.[0]).toContain("/intimacoes/10/read");
      expect(patchCalls[1]?.[0]).toContain("/intimacoes/11/read");

      expect(trigger?.querySelector("span")).toBeNull();
      expect(document.body.textContent).toContain("Nenhuma intimação pendente");
    } finally {
      unmount();
    }
  });
});

