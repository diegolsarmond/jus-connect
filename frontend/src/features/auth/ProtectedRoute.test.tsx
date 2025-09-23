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
    vi.useFakeTimers();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.useRealTimers();
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

  it("allows access when the subscription is within the grace period", () => {
    const now = new Date("2024-06-15T12:00:00.000Z");
    vi.setSystemTime(now);

    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: {
        subscription: {
          status: "grace_period",
          planId: 1,
          startedAt: null,
          trialEndsAt: null,
          currentPeriodEnd: new Date("2024-06-10T12:00:00.000Z").toISOString(),
          graceEndsAt: null,
        },
      },
    } as unknown as ReturnType<typeof useAuth>);

    act(() => {
      root.render(
        <MemoryRouter initialEntries={["/dashboard"]}>
          <Routes>
            <Route
              path="/dashboard"
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

    expect(container.textContent).toContain("Área restrita");
  });

  it("redirects once the grace deadline has passed", () => {
    const now = new Date("2024-06-25T12:00:00.000Z");
    vi.setSystemTime(now);

    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: {
        subscription: {
          status: "past_due",
          planId: 1,
          startedAt: null,
          trialEndsAt: null,
          currentPeriodEnd: new Date("2024-06-10T12:00:00.000Z").toISOString(),
          graceEndsAt: null,
        },
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
