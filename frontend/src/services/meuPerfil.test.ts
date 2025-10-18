import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  approveMeuPerfilDevice,
  confirmMeuPerfilTwoFactor,
  disableMeuPerfilTwoFactor,
  fetchMeuPerfil,
  fetchMeuPerfilAuditLogs,
  fetchMeuPerfilSessions,
  initiateMeuPerfilTwoFactor,
  revokeMeuPerfilDeviceApproval,
  revokeMeuPerfilSession,
  revokeTodasMeuPerfilSessions,
  updateMeuPerfil,
  MeuPerfilApiError,
  type TwoFactorConfirmationPayload,
  type TwoFactorInitiationPayload,
} from "./meuPerfil";
import type { UserSession } from "@/types/user";

describe("meuPerfil service", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("carrega e normaliza o perfil do usuário", async () => {
    const mockResponse = {
      id: 1,
      name: "Dr. Jane Doe",
      cpf: "12345678901",
      email: "jane@example.com",
      specialties: ["Direito Civil", "Compliance"],
      hourlyRate: "350",
      notifications: { securityAlerts: false, agendaReminders: true, newsletter: true },
      security: { twoFactor: true, loginAlerts: false, deviceApproval: true },
      lastLogin: "2024-01-10T10:00:00Z",
      memberSince: "2022-05-01T12:00:00Z",
      address: { city: "São Paulo" },
    };

    (fetch as unknown as vi.Mock).mockResolvedValue(
      new Response(JSON.stringify(mockResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const profile = await fetchMeuPerfil();
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("me/profile"), expect.any(Object));
    expect(profile.name).toBe("Dr. Jane Doe");
    expect(profile.cpf).toBe("12345678901");
    expect(profile.specialties).toEqual(["Direito Civil", "Compliance"]);
    expect(profile.notifications.newsletter).toBe(true);
    expect(profile.security.twoFactor).toBe(true);
    expect(profile.lastLogin).toBeInstanceOf(Date);
    expect(profile.address.city).toBe("São Paulo");
  });

  it("lança erro com mensagem amigável quando a API falha", async () => {
    (fetch as unknown as vi.Mock).mockResolvedValue(
      new Response(JSON.stringify({ error: "Falha" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(fetchMeuPerfil()).rejects.toBeInstanceOf(MeuPerfilApiError);
  });

  it("carrega logs de auditoria normalizados", async () => {
    const logs = [
      {
        id: 10,
        userId: 2,
        action: "PROFILE_UPDATE",
        description: "Perfil atualizado",
        createdAt: "2024-01-01T00:00:00Z",
        performedByName: "Sistema",
      },
    ];

    (fetch as unknown as vi.Mock).mockResolvedValue(
      new Response(JSON.stringify(logs), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await fetchMeuPerfilAuditLogs({ limit: 5 });
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("audit-logs?limit=5"), expect.any(Object));
    expect(result).toHaveLength(1);
    expect(result[0].performedBy).toBe("Sistema");
    expect(result[0].timestamp).toBeInstanceOf(Date);
  });

  it("carrega sessões e converte datas", async () => {
    const sessions = [
      {
        id: 5,
        userId: 1,
        device: "Chrome",
        location: "São Paulo",
        lastActivity: "2024-01-15T12:00:00Z",
        isActive: true,
      },
    ];

    (fetch as unknown as vi.Mock).mockResolvedValue(
      new Response(JSON.stringify(sessions), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await fetchMeuPerfilSessions();
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("sessions"), expect.any(Object));
    expect(result[0].lastActivity).toBeInstanceOf(Date);
    expect(result[0].isActive).toBe(true);
  });

  it("revoga uma sessão específica", async () => {
    const session = {
      id: 123,
      userId: 1,
      device: "Chrome",
      location: "São Paulo",
      lastActivity: "2024-01-15T12:00:00Z",
      isActive: false,
    };

    (fetch as unknown as vi.Mock).mockResolvedValue(
      new Response(JSON.stringify(session), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await revokeMeuPerfilSession("123");
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("sessions/123/revoke"), expect.any(Object));
    expect(result.isActive).toBe(false);
  });

  it("revoga todas as sessões", async () => {
    (fetch as unknown as vi.Mock).mockResolvedValue(
      new Response(JSON.stringify({ revokedCount: 3 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await revokeTodasMeuPerfilSessions();
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("revoke-all"), expect.any(Object));
    expect(result.revokedCount).toBe(3);
  });

  it("atualiza o perfil enviando apenas campos informados", async () => {
    const mockProfile = {
      id: 1,
      name: "Jane",
      email: "jane@example.com",
      notifications: { securityAlerts: true, agendaReminders: true, newsletter: false },
      security: { twoFactor: false, loginAlerts: true, deviceApproval: false },
    };

    (fetch as unknown as vi.Mock).mockResolvedValue(
      new Response(JSON.stringify(mockProfile), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await updateMeuPerfil({ name: "Jane" });
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("me/profile"), {
      method: "PATCH",
      headers: expect.objectContaining({ "Content-Type": "application/json" }),
      body: JSON.stringify({ name: "Jane" }),
      signal: undefined,
    });
    expect(result.name).toBe("Jane");
  });
});

describe("meuPerfil service two-factor", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("inicia o fluxo de 2FA retornando segredo e QR code", async () => {
    const payload: TwoFactorInitiationPayload = {
      secret: "SECRET123",
      otpauthUrl: "otpauth://totp/JusConnect?secret=SECRET123",
      qrCode: "data:image/png;base64,qr",
    };

    (fetch as unknown as vi.Mock).mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await initiateMeuPerfilTwoFactor();

    expect(result).toEqual(payload);
    const [url, init] = (fetch as unknown as vi.Mock).mock.calls[0] as [string, RequestInit];
    expect(url).toContain("me/profile/security/2fa/initiate");
    const headers = new Headers(init?.headers);
    expect(headers.get("Accept")).toBe("application/json");
  });

  it("confirma o 2FA enviando código e recebe códigos de backup", async () => {
    const responseBody: TwoFactorConfirmationPayload = {
      backupCodes: ["111111", "222222"],
    };

    (fetch as unknown as vi.Mock).mockResolvedValue(
      new Response(JSON.stringify(responseBody), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await confirmMeuPerfilTwoFactor("123456");

    expect(result).toEqual(responseBody);
    const [url, init] = (fetch as unknown as vi.Mock).mock.calls[0] as [string, RequestInit];
    expect(url).toContain("me/profile/security/2fa/confirm");
    const headers = new Headers(init?.headers);
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(init?.body).toBe(JSON.stringify({ code: "123456" }));
  });

  it("impede confirmação de 2FA sem código válido", async () => {
    await expect(confirmMeuPerfilTwoFactor(" "))
      .rejects.toMatchObject({ message: "Informe o código de verificação.", status: 400 });
  });

  it("desativa o 2FA com código informado", async () => {
    (fetch as unknown as vi.Mock).mockResolvedValue(
      new Response(null, {
        status: 204,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await disableMeuPerfilTwoFactor("654321");

    const [url, init] = (fetch as unknown as vi.Mock).mock.calls[0] as [string, RequestInit];
    expect(url).toContain("me/profile/security/2fa/disable");
    const headers = new Headers(init?.headers);
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(init?.body).toBe(JSON.stringify({ code: "654321" }));
  });

  it("recusa desativação de 2FA sem código", async () => {
    await expect(disableMeuPerfilTwoFactor(""))
      .rejects.toMatchObject({ message: "Informe o código para desativar o 2FA.", status: 400 });
  });
});

describe("meuPerfil service device approval", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("aprova dispositivo e normaliza resposta da sessão", async () => {
    const rawResponse = {
      id: 42,
      userId: 5,
      device: "Chrome no Windows",
      location: "São Paulo - BR",
      lastActivity: "2025-02-10T12:00:00Z",
      isActive: true,
      isApproved: true,
      approvedAt: "2025-02-10T12:05:00Z",
      createdAt: "2025-02-01T10:00:00Z",
      revokedAt: null,
    } satisfies Record<string, unknown>;

    (fetch as unknown as vi.Mock).mockResolvedValue(
      new Response(JSON.stringify(rawResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await approveMeuPerfilDevice("42");

    const [url] = (fetch as unknown as vi.Mock).mock.calls[0] as [string, RequestInit];
    expect(url).toContain("me/profile/sessions/42/approve");
    expect(result).toMatchObject<UserSession>({
      id: "42",
      userId: "5",
      device: "Chrome no Windows",
      location: "São Paulo - BR",
      isActive: true,
      isApproved: true,
    });
    expect(result.approvedAt).toBeInstanceOf(Date);
  });

  it("recusa aprovação de dispositivo para id inválido", async () => {
    await expect(approveMeuPerfilDevice("abc"))
      .rejects.toMatchObject({ message: "Sessão inválida.", status: 400 });
  });

  it("revoga aprovação de dispositivo atualizando a sessão", async () => {
    const rawResponse = {
      id: 7,
      userId: 3,
      device: "Mozilla/5.0",
      isActive: true,
      isApproved: false,
      lastActivity: "2025-02-11T09:00:00Z",
    };

    (fetch as unknown as vi.Mock).mockResolvedValue(
      new Response(JSON.stringify(rawResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await revokeMeuPerfilDeviceApproval("7");

    const [url] = (fetch as unknown as vi.Mock).mock.calls[0] as [string, RequestInit];
    expect(url).toContain("me/profile/sessions/7/revoke-approval");
    expect(result).toMatchObject<UserSession>({
      id: "7",
      userId: "3",
      device: "Mozilla/5.0",
      isApproved: false,
    });
  });

  it("recusa revogação de aprovação para id inválido", async () => {
    await expect(revokeMeuPerfilDeviceApproval("-1"))
      .rejects.toMatchObject({ message: "Sessão inválida.", status: 400 });
  });
});
