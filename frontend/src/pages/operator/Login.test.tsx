import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import Login from "./Login";
import { useAuth } from "@/features/auth/AuthProvider";
import { ApiError } from "@/features/auth/api";

vi.mock("@/features/auth/AuthProvider", () => ({
  useAuth: vi.fn(),
}));

describe("Login page", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("displays a confirmation warning when the API rejects with 403", async () => {
    const loginMock = vi
      .fn()
      .mockRejectedValue(new ApiError("Confirme seu e-mail antes de acessar.", 403));

    vi.mocked(useAuth).mockReturnValue({
      login: loginMock,
      isAuthenticated: false,
      isLoading: false,
      user: null,
    } as unknown as ReturnType<typeof useAuth>);

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "alice@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/senha/i), {
      target: { value: "SenhaSegura123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /entrar/i }));

    expect(
      await screen.findByText(/confirme seu e-mail antes de acessar\. verifique sua caixa de entrada\./i),
    ).toBeInTheDocument();
    expect(loginMock).toHaveBeenCalledWith({ email: "alice@example.com", senha: "SenhaSegura123" });
  });
});
