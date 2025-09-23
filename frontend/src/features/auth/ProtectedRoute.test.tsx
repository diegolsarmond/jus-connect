import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react-dom/test-utils";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { ProtectedRoute } from "./ProtectedRoute";
import { useAuth } from "./AuthProvider";

vi.mock("./AuthProvider", () => ({
  useAuth: vi.fn(),
}));

describe("ProtectedRoute", () => {
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

  it("redirects users without an active or trial subscription to the plan selection", () => {
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: {
        subscription: { status: "inactive" },
      },
    } as unknown as ReturnType<typeof useAuth>);

    act(() => {
      root.render(
        <MemoryRouter initialEntries={["/clientes"]}>
          <Routes>
            <Route
              path="/clientes"
              element={
                <ProtectedRoute>
                  <div>Área restrita</div>
                </ProtectedRoute>
              }
            />
            <Route path="/meu-plano" element={<div>Seleção de plano</div>} />
          </Routes>
        </MemoryRouter>,
      );
    });

    expect(container.textContent).toContain("Seleção de plano");
  });
});
