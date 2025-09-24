import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react-dom/test-utils";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";

import { RequireModule } from "./RequireModule";
import { useAuth } from "./AuthProvider";
import { usePlan } from "@/features/plans/PlanProvider";

vi.mock("./AuthProvider", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/features/plans/PlanProvider", () => ({
  usePlan: vi.fn(),
}));

describe("RequireModule", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.clearAllMocks();
  });

  it("renders the plan upgrade prompt when the module is not in the plan but the user has permission", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { modulos: ["conversas"] },
      isLoading: false,
    } as unknown as ReturnType<typeof useAuth>);

    vi.mocked(usePlan).mockReturnValue({
      plan: {
        id: 1,
        nome: "Plano Básico",
        sincronizacaoProcessosHabilitada: true,
        sincronizacaoProcessosLimite: null,
        modules: ["clientes"],
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof usePlan>);

    act(() => {
      root.render(
        <MemoryRouter>
          <RequireModule module="conversas">
            <div>Conteúdo restrito</div>
          </RequireModule>
        </MemoryRouter>,
      );
    });

    const content = container.textContent ?? "";
    expect(content).toContain("Centralize conversas com clientes");

    const plansLink = container.querySelector('a[href="/meu-plano"]');
    expect(plansLink).not.toBeNull();
    expect(plansLink?.textContent ?? "").toContain("Conhecer planos");
  });

  it("does not render the upgrade prompt when the user lacks permission", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { modulos: [] },
      isLoading: false,
    } as unknown as ReturnType<typeof useAuth>);

    vi.mocked(usePlan).mockReturnValue({
      plan: {
        id: 1,
        nome: "Plano Básico",
        sincronizacaoProcessosHabilitada: true,
        sincronizacaoProcessosLimite: null,
        modules: ["clientes"],
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof usePlan>);

    act(() => {
      root.render(
        <MemoryRouter>
          <RequireModule module="conversas">
            <div>Conteúdo restrito</div>
          </RequireModule>
        </MemoryRouter>,
      );
    });

    expect(container.textContent ?? "").toBe("");
    expect(container.querySelector('a[href="/meu-plano"]')).toBeNull();
  });

  it("renders children when both the user and the plan include the module", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { modulos: ["conversas"] },
      isLoading: false,
    } as unknown as ReturnType<typeof useAuth>);

    vi.mocked(usePlan).mockReturnValue({
      plan: {
        id: 1,
        nome: "Plano Completo",
        sincronizacaoProcessosHabilitada: true,
        sincronizacaoProcessosLimite: null,
        modules: ["conversas", "clientes"],
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof usePlan>);

    act(() => {
      root.render(
        <MemoryRouter>
          <RequireModule module="conversas">
            <div>Conteúdo restrito</div>
          </RequireModule>
        </MemoryRouter>,
      );
    });

    expect(container.textContent ?? "").toContain("Conteúdo restrito");
  });
});
