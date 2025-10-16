import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ConfiguracaoSeguranca from "./ConfiguracaoSeguranca";
import type {
  MeuPerfilProfile,
  TwoFactorInitiationPayload,
  TwoFactorConfirmationPayload,
} from "@/services/meuPerfil";
import type { UserSession } from "@/types/user";

const toastMock = vi.fn();

const fetchMeuPerfilMock = vi.fn<[], Promise<MeuPerfilProfile>>();
const fetchMeuPerfilSessionsMock = vi.fn<[], Promise<UserSession[]>>();
const initiateMeuPerfilTwoFactorMock = vi.fn<[], Promise<TwoFactorInitiationPayload>>();
const confirmMeuPerfilTwoFactorMock = vi.fn<[string], Promise<TwoFactorConfirmationPayload>>();
const disableMeuPerfilTwoFactorMock = vi.fn<[string], Promise<void>>();
const approveMeuPerfilDeviceMock = vi.fn<[string], Promise<UserSession>>();
const revokeMeuPerfilDeviceApprovalMock = vi.fn<[string], Promise<UserSession>>();
const revokeMeuPerfilSessionMock = vi.fn<[string], Promise<UserSession>>();
const revokeTodasMeuPerfilSessionsMock = vi.fn<[], Promise<{ revokedCount: number }>>();

vi.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock("@/services/meuPerfil", () => ({
  fetchMeuPerfil: () => fetchMeuPerfilMock(),
  fetchMeuPerfilSessions: () => fetchMeuPerfilSessionsMock(),
  initiateMeuPerfilTwoFactor: () => initiateMeuPerfilTwoFactorMock(),
  confirmMeuPerfilTwoFactor: (code: string) => confirmMeuPerfilTwoFactorMock(code),
  disableMeuPerfilTwoFactor: (code: string) => disableMeuPerfilTwoFactorMock(code),
  approveMeuPerfilDevice: (sessionId: string) => approveMeuPerfilDeviceMock(sessionId),
  revokeMeuPerfilDeviceApproval: (sessionId: string) => revokeMeuPerfilDeviceApprovalMock(sessionId),
  revokeMeuPerfilSession: (sessionId: string) => revokeMeuPerfilSessionMock(sessionId),
  revokeTodasMeuPerfilSessions: () => revokeTodasMeuPerfilSessionsMock(),
}));

describe("ConfiguracaoSeguranca", () => {
  const setupPayload: TwoFactorInitiationPayload = {
    secret: "SECRET123",
    otpauthUrl: "otpauth://totp/JusConnect?secret=SECRET123",
    qrCode: "data:image/png;base64,qr",
  };

  const backupPayload: TwoFactorConfirmationPayload = {
    backupCodes: ["111111", "222222", "333333"],
  };

  let currentProfile: MeuPerfilProfile;
  let currentSessions: UserSession[];

  beforeEach(() => {
    toastMock.mockReset();

    currentProfile = {
      id: "1",
      name: "Usuário Teste",
      cpf: null,
      title: null,
      email: "usuario@example.com",
      phone: null,
      bio: null,
      office: null,
      oabNumber: null,
      oabUf: null,
      specialties: [],
      hourlyRate: null,
      timezone: "America/Sao_Paulo",
      language: "pt-BR",
      linkedin: null,
      website: null,
      address: {
        street: null,
        number: null,
        complement: null,
        neighborhood: null,
        city: null,
        state: null,
        zip: null,
      },
      notifications: {
        securityAlerts: true,
        agendaReminders: true,
        newsletter: false,
      },
      security: {
        twoFactor: false,
        loginAlerts: false,
        deviceApproval: false,
      },
      lastLogin: null,
      memberSince: null,
      avatarUrl: null,
    };

    currentSessions = [
      {
        id: "10",
        userId: "1",
        device: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        location: "São Paulo - BR",
        lastActivity: new Date("2025-02-10T12:00:00Z"),
        isActive: true,
        isApproved: false,
        approvedAt: null,
        createdAt: new Date("2025-02-01T10:00:00Z"),
        revokedAt: null,
        isCurrent: false,
      },
      {
        id: "11",
        userId: "1",
        device: "Mozilla/5.0 (Macintosh; Intel Mac OS X)",
        location: "Rio de Janeiro - BR",
        lastActivity: new Date("2025-02-09T08:00:00Z"),
        isActive: true,
        isApproved: true,
        approvedAt: new Date("2025-02-09T08:05:00Z"),
        createdAt: new Date("2025-01-20T11:00:00Z"),
        revokedAt: null,
        isCurrent: false,
      },
    ];

    fetchMeuPerfilMock.mockImplementation(async () => currentProfile);
    fetchMeuPerfilSessionsMock.mockImplementation(async () => currentSessions);
    initiateMeuPerfilTwoFactorMock.mockResolvedValue(setupPayload);
    confirmMeuPerfilTwoFactorMock.mockImplementation(async () => {
      currentProfile = {
        ...currentProfile,
        security: { ...currentProfile.security, twoFactor: true },
      };
      return backupPayload;
    });
    disableMeuPerfilTwoFactorMock.mockImplementation(async () => {
      currentProfile = {
        ...currentProfile,
        security: { ...currentProfile.security, twoFactor: false },
      };
    });
    approveMeuPerfilDeviceMock.mockImplementation(async (sessionId) => {
      currentSessions = currentSessions.map((session) =>
        session.id === sessionId
          ? {
              ...session,
              isApproved: true,
              approvedAt: new Date("2025-02-10T12:05:00Z"),
            }
          : session,
      );
      return currentSessions.find((session) => session.id === sessionId) as UserSession;
    });
    revokeMeuPerfilDeviceApprovalMock.mockImplementation(async (sessionId) => {
      currentSessions = currentSessions.map((session) =>
        session.id === sessionId
          ? {
              ...session,
              isApproved: false,
              approvedAt: null,
            }
          : session,
      );
      return currentSessions.find((session) => session.id === sessionId) as UserSession;
    });
    revokeMeuPerfilSessionMock.mockResolvedValue(currentSessions[0]);
    revokeTodasMeuPerfilSessionsMock.mockResolvedValue({ revokedCount: 0 });
  });

  it("habilita e desabilita 2FA refletindo estado persistido", async () => {
    render(<ConfiguracaoSeguranca />);

    await waitFor(() => expect(fetchMeuPerfilMock).toHaveBeenCalledTimes(1));

    const twoFactorSwitch = await screen.findByRole("switch");
    fireEvent.click(twoFactorSwitch);

    await waitFor(() => expect(initiateMeuPerfilTwoFactorMock).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("Configurar Autenticação 2FA")).not.toBeNull();

    const verificationInput = screen.getByLabelText("Código de verificação");
    fireEvent.change(verificationInput, { target: { value: "123456" } });

    fireEvent.click(screen.getByRole("button", { name: "Ativar 2FA" }));

    await waitFor(() => expect(confirmMeuPerfilTwoFactorMock).toHaveBeenCalledWith("123456"));
    await waitFor(() => expect(fetchMeuPerfilMock).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("Códigos de Recuperação")).not.toBeNull();
    expect(screen.getByText("Ativo")).not.toBeNull();

    fireEvent.click(screen.getByRole("switch"));

    expect(await screen.findByText("Desativar autenticação 2FA")).not.toBeNull();
    const disableInput = screen.getByLabelText("Código");
    fireEvent.change(disableInput, { target: { value: "654321" } });
    fireEvent.click(screen.getByRole("button", { name: "Desativar 2FA" }));

    await waitFor(() => expect(disableMeuPerfilTwoFactorMock).toHaveBeenCalledWith("654321"));
    await waitFor(() => expect(fetchMeuPerfilMock).toHaveBeenCalledTimes(3));

    await waitFor(() => expect(screen.queryByText("Códigos de Recuperação")).toBeNull());
    expect(screen.getByText("Inativo")).not.toBeNull();
    expect(toastMock).toHaveBeenCalled();
  });

  it("aprova e revoga dispositivos atualizando a lista de sessões", async () => {
    render(<ConfiguracaoSeguranca />);

    await waitFor(() => expect(fetchMeuPerfilSessionsMock).toHaveBeenCalledTimes(1));

    const approveButton = await screen.findByRole("button", { name: "Aprovar dispositivo" });
    fireEvent.click(approveButton);

    await waitFor(() => expect(approveMeuPerfilDeviceMock).toHaveBeenCalledWith("10"));
    await waitFor(() => expect(fetchMeuPerfilSessionsMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getAllByText("Dispositivo aprovado").length).toBe(2));

    const revokeButton = await screen.findByRole("button", { name: "Revogar aprovação" });
    fireEvent.click(revokeButton);

    await waitFor(() => expect(revokeMeuPerfilDeviceApprovalMock).toHaveBeenCalledWith("10"));
    await waitFor(() => expect(fetchMeuPerfilSessionsMock).toHaveBeenCalledTimes(3));
    await waitFor(() => expect(screen.getAllByText("Aprovação pendente").length).toBe(1));
  });
});
