import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

declare module "vite" {
  interface ImportMeta {
    env: Record<string, unknown>;
  }
}

describe("supabase client", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    localStorage.clear();
    process.env = { ...originalEnv, VITE_SUPABASE_URL: "https://example.supabase.co", VITE_SUPABASE_ANON_KEY: "anon" };
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...originalEnv };
  });

  it("faz login e persiste a sessão", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          access_token: "token",
          refresh_token: "refresh",
          token_type: "bearer",
          expires_in: 3600,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          user: {
            id: "user-id",
            email: "user@example.com",
            user_metadata: { name: "Usuário" },
            app_metadata: {},
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    vi.stubGlobal("fetch", fetchMock);

    const { supabase } = await import("./client");

    const listener = vi.fn();
    await supabase.auth.onAuthStateChange(listener);

    const result = await supabase.auth.signInWithPassword({ email: "user@example.com", password: "secret" });

    expect(result.error).toBeNull();
    expect(result.data.session?.access_token).toBe("token");
    expect(listener).toHaveBeenCalledWith("SIGNED_IN", expect.objectContaining({ access_token: "token" }));

    const stored = localStorage.getItem("jus-connect:supabase:session");
    expect(stored).toContain("token");

    const sessionResult = await supabase.auth.getSession();
    expect(sessionResult.data.session?.access_token).toBe("token");
  });

  it("realiza logout e limpa os dados", async () => {
    const logoutResponse = new Response(null, { status: 200 });
    const loginResponse = new Response(
      JSON.stringify({
        access_token: "token",
        refresh_token: "refresh",
        token_type: "bearer",
        user: {
          id: "user-id",
          email: "user@example.com",
          user_metadata: {},
          app_metadata: {},
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );

    const fetchMock = vi.fn().mockResolvedValueOnce(loginResponse).mockResolvedValueOnce(logoutResponse);
    vi.stubGlobal("fetch", fetchMock);

    const { supabase } = await import("./client");

    await supabase.auth.signInWithPassword({ email: "user@example.com", password: "secret" });
    const listener = vi.fn();
    await supabase.auth.onAuthStateChange(listener);

    const result = await supabase.auth.signOut();
    expect(result.error).toBeNull();
    expect(listener).toHaveBeenCalledWith("SIGNED_OUT", null);
    expect(localStorage.getItem("jus-connect:supabase:session")).toBeNull();
  });
});
