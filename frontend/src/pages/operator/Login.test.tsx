import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import Login from "./Login";
import { useAuth } from "@/features/auth/AuthProvider";
import { ApiError, resendEmailConfirmationRequest } from "@/features/auth/api";
import type { Session, User as SupabaseUser } from "@supabase/supabase-js";

const toastMock = vi.fn();

vi.mock("@/features/auth/AuthProvider", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock("@/features/auth/api", async () => {
  const actual = await vi.importActual<typeof import("@/features/auth/api")>(
    "@/features/auth/api",
  );
  return {
    ...actual,
    resendEmailConfirmationRequest: vi.fn(),
  };
});

describe("Login page", () => {
  afterEach(() => {
    vi.clearAllMocks();
    toastMock.mockReset();
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
      await screen.findByText(/confirme seu e-mail antes de acessar/i),
    ).toBeInTheDocument();
    expect(loginMock).toHaveBeenCalledWith({ email: "alice@example.com", senha: "SenhaSegura123" });
    expect(
      screen.getByRole("button", { name: /reenviar e-mail de confirmação/i }),
    ).toBeInTheDocument();
  });

  it("displays the API message for other 403 responses", async () => {
    const loginMock = vi
      .fn()
      .mockRejectedValue(new ApiError("Usuário inativo.", 403));

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
      target: { value: "bruno@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/senha/i), {
      target: { value: "SenhaSegura123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /entrar/i }));

    expect(await screen.findByText("Usuário inativo.")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /reenviar e-mail de confirmação/i }),
    ).not.toBeInTheDocument();
  });

  it("allows resending the confirmation email", async () => {
    const loginMock = vi
      .fn()
      .mockRejectedValue(new ApiError("Confirme seu e-mail antes de acessar.", 403));

    vi.mocked(useAuth).mockReturnValue({
      login: loginMock,
      isAuthenticated: false,
      isLoading: false,
      user: null,
    } as unknown as ReturnType<typeof useAuth>);

    vi.mocked(resendEmailConfirmationRequest).mockResolvedValue(
      "Um novo e-mail de confirmação foi enviado.",
    );

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

    const resendButton = await screen.findByRole("button", {
      name: /reenviar e-mail de confirmação/i,
    });

    fireEvent.click(resendButton);

    await waitFor(() => {
      expect(resendEmailConfirmationRequest).toHaveBeenCalledWith("alice@example.com");
    });

    expect(toastMock).toHaveBeenCalledWith({
      title: "E-mail reenviado",
      description: "Um novo e-mail de confirmação foi enviado.",
    });
  });

  it("notifies the user when resending fails", async () => {
    const loginMock = vi
      .fn()
      .mockRejectedValue(new ApiError("Confirme seu e-mail antes de acessar.", 403));

    vi.mocked(useAuth).mockReturnValue({
      login: loginMock,
      isAuthenticated: false,
      isLoading: false,
      user: null,
    } as unknown as ReturnType<typeof useAuth>);

    vi.mocked(resendEmailConfirmationRequest).mockRejectedValue(
      new ApiError("Falha", 500),
    );

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

    const resendButton = await screen.findByRole("button", {
      name: /reenviar e-mail de confirmação/i,
    });

    fireEvent.click(resendButton);

    await waitFor(() => {
      expect(resendEmailConfirmationRequest).toHaveBeenCalled();
    });

    expect(toastMock).toHaveBeenCalledWith({
      variant: "destructive",
      title: "Não foi possível reenviar o e-mail de confirmação",
      description: "Entre em contato com o suporte.",
    });
  });

  it("exibe aviso de confirmação quando Supabase indica e-mail não verificado", async () => {
    const supabaseUser = {
      id: "user-123",
      app_metadata: { provider: "email" },
      user_metadata: {},
      aud: "authenticated",
      created_at: new Date().toISOString(),
      email: "alice@example.com",
      email_confirmed_at: null,
      phone: "",
      confirmed_at: null,
      last_sign_in_at: null,
      role: "authenticated",
      identities: [],
      factors: [],
      is_anonymous: false,
    } satisfies SupabaseUser;

    const loginMock = vi.fn().mockResolvedValue({
      session: { user: supabaseUser } as Session,
      user: supabaseUser,
      error: null,
    });

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
      await screen.findByText(/confirme seu e-mail antes de acessar/i),
    ).toBeInTheDocument();
  });

  it("oculta campos de senha e lembrete em modo SSO via query string", () => {
    const loginMock = vi.fn();

    vi.mocked(useAuth).mockReturnValue({
      login: loginMock,
      isAuthenticated: false,
      isLoading: false,
      user: null,
    } as unknown as ReturnType<typeof useAuth>);

    render(
      <MemoryRouter initialEntries={["/login?mode=sso"]}>
        <Login />
      </MemoryRouter>,
    );

    expect(screen.queryByLabelText(/senha/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/lembrar de mim/i)).not.toBeInTheDocument();
  });
});
