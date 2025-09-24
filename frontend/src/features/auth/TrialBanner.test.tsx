import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react-dom/test-utils";
import { createRoot, type Root } from "react-dom/client";

import { TrialBanner } from "./TrialBanner";
import { useAuth } from "./AuthProvider";

vi.mock("./AuthProvider", () => ({
  useAuth: vi.fn(),
}));

const STORAGE_KEY = "jus-connect:trial-banner:dismissed";

describe("TrialBanner", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    const now = new Date("2024-01-01T12:00:00.000Z");
    vi.setSystemTime(now);

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    window.sessionStorage.clear();
    window.localStorage.clear();
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.useRealTimers();
    vi.clearAllMocks();
    window.sessionStorage.clear();
    window.localStorage.clear();
  });

  it("renders the countdown when the user is trialing", () => {
    const trialEndsAt = new Date("2024-01-03T12:00:00.000Z").toISOString();
    vi.mocked(useAuth).mockReturnValue({
      user: {
        subscription: {
          status: "trialing",
          trialEndsAt,
        },
      },
    } as unknown as ReturnType<typeof useAuth>);

    act(() => {
      root.render(<TrialBanner />);
    });

    const countdown = container.querySelector('[data-testid="trial-banner-countdown"]');
    expect(countdown).not.toBeNull();
    expect(countdown?.textContent).toContain("2d");
    expect(countdown?.textContent).toContain("00h");
    expect(countdown?.textContent).toContain("00min");
  });

  it("hides the banner after dismissal", () => {
    const trialEndsAt = new Date("2024-01-02T12:00:00.000Z").toISOString();
    vi.mocked(useAuth).mockReturnValue({
      user: {
        subscription: {
          status: "trialing",
          trialEndsAt,
        },
      },
    } as unknown as ReturnType<typeof useAuth>);

    act(() => {
      root.render(<TrialBanner />);
    });

    const dismissButton = container.querySelector('[data-testid="trial-banner-dismiss"]') as HTMLButtonElement | null;
    expect(dismissButton).not.toBeNull();

    act(() => {
      dismissButton?.click();
    });

    expect(container.textContent).toBe("");
    expect(window.sessionStorage.getItem(STORAGE_KEY)).toBe("true");
  });
});
