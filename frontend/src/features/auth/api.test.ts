import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, resendEmailConfirmationRequest } from "./api";

vi.mock("@/lib/api", () => ({
  getApiUrl: (path: string) => `https://example.test/${path}`,
}));

describe("resendEmailConfirmationRequest", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the API message when the request succeeds", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ message: "Novo envio realizado." }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

    const message = await resendEmailConfirmationRequest("alice@example.com");

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://example.test/auth/resend-email-confirmation",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ email: "alice@example.com" }),
      },
    );

    expect(message).toBe("Novo envio realizado.");

    fetchSpy.mockRestore();
  });

  it("throws an ApiError when the backend responds with an error", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ error: "Usuário não encontrado." }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }),
      );

    const promise = resendEmailConfirmationRequest("alice@example.com");

    await expect(promise).rejects.toBeInstanceOf(ApiError);
    await promise.catch((error) => {
      expect(error).toMatchObject({
        message: "Usuário não encontrado.",
        status: 404,
      });
    });

    fetchSpy.mockRestore();
  });
});
