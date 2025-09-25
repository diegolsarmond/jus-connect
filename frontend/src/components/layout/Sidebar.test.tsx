import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { vi, describe, beforeEach, afterEach, it, expect } from "vitest";

import { Sidebar } from "./Sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { useAuth } from "@/features/auth/AuthProvider";
import { useSidebarCounters, type SidebarCountersMap } from "@/hooks/useSidebarCounters";
import { usePlan } from "@/features/plans/PlanProvider";

vi.mock("@/features/auth/AuthProvider", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/hooks/useSidebarCounters", () => ({
  useSidebarCounters: vi.fn(),
}));

vi.mock("@/features/plans/PlanProvider", () => ({
  usePlan: vi.fn(),
}));

describe("Sidebar", () => {
  let container: HTMLDivElement;
  let root: Root;

  const renderSidebar = () => {
    const queryClient = new QueryClient();

    act(() => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <SidebarProvider>
            <MemoryRouter initialEntries={["/"]}>
              <Sidebar />
            </MemoryRouter>
          </SidebarProvider>
        </QueryClientProvider>,
      );
    });
  };

  const mockCounters = (counters: SidebarCountersMap) => {
    vi.mocked(useSidebarCounters).mockReturnValue({ counters, refetchAll: vi.fn() });
  };

  const mockPlanContext = (modules: string[] = []) => {
    vi.mocked(usePlan).mockReturnValue({
      plan: { id: 1, nome: "Teste", modules },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof usePlan>);
  };

  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    mockPlanContext();
    vi.mocked(useAuth).mockReturnValue({
      user: {
        modulos: ["dashboard", "conversas", "agenda", "tarefas"],
      },
      logout: vi.fn(),
    } as unknown as ReturnType<typeof useAuth>);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("renders counter badges with the provided values", () => {
    mockCounters({
      messages: { count: 5, isError: false, isLoading: false, isFetching: false },
      agenda: { count: 2, isError: false, isLoading: false, isFetching: false },
      tasks: { count: 0, isError: false, isLoading: false, isFetching: false },
    });

    renderSidebar();

    const messagesBadge = container.querySelector('[aria-label="Contador de Conversas: 5"]');
    const agendaBadge = container.querySelector('[aria-label="Contador de Agenda: 2"]');
    const tasksBadge = container.querySelector('[aria-label="Contador de Tarefas: 0"]');
    const conversationsLink = container.querySelector('a[href="/conversas"]');

    expect(messagesBadge).not.toBeNull();
    expect(messagesBadge?.textContent).toContain("5");
    expect(agendaBadge).not.toBeNull();
    expect(agendaBadge?.textContent).toContain("2");
    expect(tasksBadge).not.toBeNull();
    expect(tasksBadge?.textContent).toContain("0");
    expect(conversationsLink?.textContent ?? "").toContain("5");
  });

  it("shows an empty badge while counters are loading", () => {
    mockCounters({
      messages: { count: undefined, isError: false, isLoading: true, isFetching: true },
      agenda: { count: undefined, isError: false, isLoading: true, isFetching: true },
      tasks: { count: undefined, isError: false, isLoading: true, isFetching: true },
    });

    renderSidebar();

    const badge = container.querySelector('[aria-label="Contador de Conversas: carregando"]');
    expect(badge).not.toBeNull();
    expect((badge as HTMLElement).textContent?.trim()).toBe("");
  });

  it("hides the badge when the counter fails", () => {
    mockCounters({
      messages: { count: undefined, isError: true, isLoading: false, isFetching: false },
      agenda: { count: undefined, isError: true, isLoading: false, isFetching: false },
      tasks: { count: undefined, isError: true, isLoading: false, isFetching: false },
    });

    renderSidebar();

    expect(container.querySelector('[aria-label^="Contador de Conversas"]')).toBeNull();
    expect(container.querySelector('[aria-label^="Contador de Agenda"]')).toBeNull();
    expect(container.querySelector('[aria-label^="Contador de Tarefas"]')).toBeNull();
  });

  it("hides menu items that are not allowed for the user's profile", () => {
    mockCounters({
      messages: { count: 0, isError: false, isLoading: false, isFetching: false },
      agenda: { count: 0, isError: false, isLoading: false, isFetching: false },
      tasks: { count: 0, isError: false, isLoading: false, isFetching: false },
    });

    renderSidebar();

    expect(container.querySelector('a[href="/clientes"]')).toBeNull();
    expect(container.querySelector('a[href="/financeiro/lancamentos"]')).toBeNull();
  });

  it("shows a lock indicator when access is restricted by the current plan", () => {
    mockPlanContext(["dashboard", "agenda"]);
    mockCounters({
      messages: { count: 0, isError: false, isLoading: false, isFetching: false },
      agenda: { count: 0, isError: false, isLoading: false, isFetching: false },
      tasks: { count: 0, isError: false, isLoading: false, isFetching: false },
    });

    renderSidebar();

    const tasksLink = container.querySelector('a[href="/tarefas"]');

    expect(tasksLink).not.toBeNull();
    expect(tasksLink?.getAttribute("title")).toBe("Disponível em planos superiores");
  });
});
