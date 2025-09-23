import { describe, expect, it, vi } from "vitest";
import { fetchChatResponsibles } from "./chatApi";

vi.mock("@/lib/api", () => ({
  getApiUrl: (path: string) => `https://example.test/${path}`,
}));

describe("fetchChatResponsibles", () => {
  it("maps nested usuarios payload from the get_api endpoint", async () => {
    const responseBody = {
      usuarios: {
        rows: [
          {
            id_usuario: 7,
            nome_usuario_completo: "Ana Costa",
            perfil_descricao: "Coordenadora",
          },
          {
            idusuario: "12 ",
            nomeUsuario: "Bruno Lima",
            papel: "Suporte",
          },
          {
            id: null,
            nome_completo: "Ignorado",
          },
        ],
      },
    };

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify(responseBody), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

    const result = await fetchChatResponsibles();

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://example.test/get_api_usuarios_empresa",
      { headers: { Accept: "application/json" } },
    );

    expect(result).toEqual([
      { id: "7", name: "Ana Costa", role: "Coordenadora" },
      { id: "12", name: "Bruno Lima", role: "Suporte" },
    ]);

    fetchSpy.mockRestore();
  });
});
