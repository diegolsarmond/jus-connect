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
      user: { modulos: ["conversas"], cpf: null },
      isLoading: false,
    } as unknown as ReturnType<typeof useAuth>);

    vi.mocked(usePlan).mockReturnValue({
      plan: {
        id: 1,
        nome: "Plano Básico",
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
    expect(content).toContain("Consulte processos públicos com agilidade");

    const plansLink = container.querySelector('a[href="/meu-plano"]');
    expect(plansLink).not.toBeNull();
    expect(plansLink?.textContent ?? "").toContain("Conhecer planos");
  });

  it("does not render the upgrade prompt when the user lacks permission", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { modulos: [], cpf: null },
      isLoading: false,
    } as unknown as ReturnType<typeof useAuth>);

    vi.mocked(usePlan).mockReturnValue({
      plan: {
        id: 1,
        nome: "Plano Básico",
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
      user: { modulos: ["conversas"], cpf: null },
      isLoading: false,
    } as unknown as ReturnType<typeof useAuth>);

    vi.mocked(usePlan).mockReturnValue({
      plan: {
        id: 1,
        nome: "Plano Completo",
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

  it("allows access when only the fallback module is granted to the user but the plan includes the required module", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { modulos: ["processos"], cpf: null },
      isLoading: false,
    } as unknown as ReturnType<typeof useAuth>);

    vi.mocked(usePlan).mockReturnValue({
      plan: {
        id: 1,
        nome: "Plano Completo",
        modules: ["consulta-publica"],
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof usePlan>);

    act(() => {
      root.render(
        <MemoryRouter>
          <RequireModule module="consulta-publica" userFallbackModules="processos">
            <div>Conteúdo restrito</div>
          </RequireModule>
        </MemoryRouter>,
      );
    });

    expect(container.textContent ?? "").toContain("Conteúdo restrito");
  });

  it("shows the upgrade prompt when only the fallback module is in the plan", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { modulos: ["processos"], cpf: null },
      isLoading: false,
    } as unknown as ReturnType<typeof useAuth>);

    vi.mocked(usePlan).mockReturnValue({
      plan: {
        id: 1,
        nome: "Plano Básico",
        modules: ["processos"],
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof usePlan>);

    act(() => {
      root.render(
        <MemoryRouter>
          <RequireModule module="consulta-publica" userFallbackModules="processos">
            <div>Conteúdo restrito</div>
          </RequireModule>
        </MemoryRouter>,
      );
    });

    const content = container.textContent ?? "";
    expect(content).toContain("Centralize conversas com clientes");
    expect(content).not.toContain("Conteúdo restrito");
  });
});
