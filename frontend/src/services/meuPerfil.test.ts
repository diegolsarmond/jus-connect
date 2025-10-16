import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchMeuPerfil,
  fetchMeuPerfilAuditLogs,
  fetchMeuPerfilSessions,
  revokeMeuPerfilSession,
  revokeTodasMeuPerfilSessions,
  updateMeuPerfil,
  MeuPerfilApiError,
} from "./meuPerfil";

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
