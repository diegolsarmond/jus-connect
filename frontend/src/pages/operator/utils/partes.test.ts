import { describe, expect, it } from "vitest";

import { isParteInteressada, filtrarPartesInteressadas } from "./partes";

describe("isParteInteressada", () => {
  it("identifica partes interessadas com base no campo role", () => {
    const parte = { nome: "Maria", role: "Parte Interessada" };

    expect(isParteInteressada(parte)).toBe(true);
  });

  it("identifica partes interessadas com base em campos aninhados", () => {
    const parte = {
      nome: "Empresa X",
      detalhes: {
        participacao: "Interessada Principal",
      },
    };

    expect(isParteInteressada(parte)).toBe(true);
  });

  it("reconhece indicadores booleanos fornecidos pelo backend", () => {
    const parte = { nome: "Carlos", is_interested: true };

    expect(isParteInteressada(parte)).toBe(true);
  });

  it("considera arrays com descrições de interesse", () => {
    const parte = {
      nome: "Fulano",
      labels: ["Testemunha", "Parte Interessada"],
    };

    expect(isParteInteressada(parte)).toBe(true);
  });

  it("retorna falso quando nenhum indicador é encontrado", () => {
    const parte = { nome: "Beltrano", role: "Autor" };

    expect(isParteInteressada(parte)).toBe(false);
  });
});

describe("filtrarPartesInteressadas", () => {
  it("filtra apenas as partes interessadas", () => {
    const partes = [
      { nome: "Maria", role: "Parte Interessada" },
      { nome: "João", role: "Réu" },
      { nome: "Empresa X", detalhes: { participacao: "Interessada" } },
    ];

    expect(filtrarPartesInteressadas(partes)).toEqual([
      { nome: "Maria", role: "Parte Interessada" },
      { nome: "Empresa X", detalhes: { participacao: "Interessada" } },
    ]);
  });
});

