import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react-dom/test-utils";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";

import { RequireModule } from "./RequireModule";
import { useAuth } from "./AuthProvider";

vi.mock("./AuthProvider", () => ({
  useAuth: vi.fn(),
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

  it("renders the plan upgrade prompt when the user lacks access", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { modulos: [] },
      isLoading: false,
    } as unknown as ReturnType<typeof useAuth>);

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
});
