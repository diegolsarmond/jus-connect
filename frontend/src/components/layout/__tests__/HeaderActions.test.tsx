import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react-dom/test-utils";
import { MemoryRouter } from "react-router-dom";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { HeaderActions } from "../HeaderActions";
import { useAuth } from "@/features/auth/AuthProvider";
import { usePlan } from "@/features/plans/PlanProvider";
import { fetchMeuPerfil } from "@/services/meuPerfil";

vi.mock("@/features/auth/AuthProvider", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/features/plans/PlanProvider", () => ({
  usePlan: vi.fn(),
}));

vi.mock("@/services/meuPerfil", () => ({
  fetchMeuPerfil: vi.fn(),
}));

vi.mock("@/components/ui/mode-toggle", () => ({
  ModeToggle: () => <div data-testid="mode-toggle" />,
}));

vi.mock("@/components/notifications/IntimacaoMenu", () => ({
  IntimacaoMenu: () => <div data-testid="intimacao-menu" />,
}));

describe("HeaderActions", () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;

  const renderHeaderActions = async () => {
    act(() => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={["/"]}>
            <HeaderActions />
          </MemoryRouter>
        </QueryClientProvider>,
      );
    });

    await act(async () => {
      await Promise.resolve();
    });
  };

  const mockPlanState = (override: Partial<ReturnType<typeof usePlan>>) => {
    vi.mocked(usePlan).mockReturnValue({
      plan: null,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      ...override,
    } as ReturnType<typeof usePlan>);
  };

  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    queryClient = new QueryClient();

    vi.mocked(useAuth).mockReturnValue({
      user: {
        id: 1,
        nome_completo: "Usuário Teste",
        email: "teste@example.com",
        modulos: [],
        cpf: null,
      },
      logout: vi.fn(),
    } as unknown as ReturnType<typeof useAuth>);

    vi.mocked(fetchMeuPerfil).mockResolvedValue({
      name: "Usuário Teste",
      email: "teste@example.com",
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    queryClient.clear();
  });

  it("renders the current plan name with crowns and shows the upgrade CTA when allowed", async () => {
    mockPlanState({
      plan: { id: 2, nome: "Essencial", modules: [] },
      isLoading: false,
      error: null,
    });

    await renderHeaderActions();

    const badgeLabel = container.querySelector('[data-testid="plan-badge-label"]');
    const crowns = container.querySelectorAll('[data-testid="plan-crown"]');
    const upgradeButton = container.querySelector('[data-testid="plan-upgrade-button"]');

    expect(badgeLabel?.textContent ?? "").toContain("Essencial");
    expect(crowns.length).toBeGreaterThan(0);
    expect(upgradeButton).not.toBeNull();
  });

  it("hides the upgrade CTA when the plan is already at the maximum tier", async () => {
    mockPlanState({
      plan: { id: 5, nome: "Premium", modules: [] },
      isLoading: false,
      error: null,
    });

    await renderHeaderActions();

    const upgradeButton = container.querySelector('[data-testid="plan-upgrade-button"]');
    expect(upgradeButton).toBeNull();
  });

  it("shows a loading message while the plan is being resolved", async () => {
    mockPlanState({
      plan: null,
      isLoading: true,
      error: null,
    });

    await renderHeaderActions();

    const badgeLabel = container.querySelector('[data-testid="plan-badge-label"]');
    expect(badgeLabel?.textContent ?? "").toContain("Carregando plano...");
  });

  it("displays an error message when the plan fails to load", async () => {
    mockPlanState({
      plan: null,
      isLoading: false,
      error: "Falhou",
    });

    await renderHeaderActions();

    const badgeLabel = container.querySelector('[data-testid="plan-badge-label"]');
    const upgradeButton = container.querySelector('[data-testid="plan-upgrade-button"]');

    expect(badgeLabel?.textContent ?? "").toContain("Não foi possível carregar o plano");
    expect(upgradeButton).toBeNull();
  });
});
