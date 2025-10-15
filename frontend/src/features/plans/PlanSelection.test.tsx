import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react-dom/test-utils";
import { createRoot, type Root } from "react-dom/client";

import { PlanSelection } from "./PlanSelection";
import { useAuth } from "@/features/auth/AuthProvider";

const navigateMock = vi.fn();

vi.mock("@/features/auth/AuthProvider", () => ({
  useAuth: vi.fn(),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

const originalFetch = global.fetch;

describe("PlanSelection", () => {
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
    global.fetch = originalFetch;
  });

  it("creates a trial subscription when a plan is selected", async () => {
    const refreshUser = vi.fn().mockResolvedValue(undefined);

    vi.mocked(useAuth).mockReturnValue({
      user: {
        cpf: null,
        empresa_id: 99,
        subscription: null,
      },
      refreshUser,
    } as unknown as ReturnType<typeof useAuth>);

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { id: 1, nome: "Essencial", valor_mensal: 120 },
          { id: 2, nome: "Premium", valor_anual: 2400 },
        ],
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) });

    global.fetch = fetchMock as unknown as typeof global.fetch;

    act(() => {
      root.render(<PlanSelection />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    const button = container.querySelector('[data-testid="select-plan-1"]') as HTMLButtonElement;
    expect(button).not.toBeNull();

    await act(async () => {
      button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [, requestInit] = fetchMock.mock.calls[1] ?? [];
    const requestBody = JSON.parse(String((requestInit as RequestInit | undefined)?.body ?? "{}"));
    expect(requestBody).toMatchObject({
      companyId: 99,
      planId: 1,
      status: "trialing",
    });
    expect(typeof requestBody.startDate).toBe("string");

    expect(refreshUser).toHaveBeenCalledTimes(1);
    expect(navigateMock).toHaveBeenCalledWith("/", { replace: true });
  });

  it("surfaces regularization messaging when the subscription expired", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: {
        cpf: null,
        empresa_id: 42,
        subscription: {
          status: "expired",
          planId: null,
          startedAt: null,
          trialEndsAt: null,
          currentPeriodEnd: null,
          graceEndsAt: null,
        },
      },
      refreshUser: vi.fn(),
    } as unknown as ReturnType<typeof useAuth>);

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: 1, nome: "Essencial", valor_mensal: 120 }],
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) });

    global.fetch = fetchMock as unknown as typeof global.fetch;

    act(() => {
      root.render(<PlanSelection />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    const header = container.querySelector("h1");
    expect(header?.textContent ?? "").toContain("Atualize seu plano para continuar");
    expect(container.textContent ?? "").toContain("Regularize sua assinatura");
  });
});
