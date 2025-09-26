import { describe, expect, it } from "vitest";

import { filtrarPartesInteressadas, isParteInteressada } from "./partes";

describe("isParteInteressada", () => {
  it("identifica valores textuais com indicador de parte interessada", () => {
    expect(
      isParteInteressada({
        role: "Parte Interessada",
      }),
    ).toBe(true);
  });

  it("reconhece diferentes campos e variações de escrita", () => {
    expect(
      isParteInteressada({
        tipo: "Interessado",
        side: "Autor",
      }),
    ).toBe(true);

    expect(
      isParteInteressada({
        side: "INTERESTED",
      }),
    ).toBe(true);
  });

  it("detecta identificadores booleanos em campos sinalizados", () => {
    expect(
      isParteInteressada({
        is_interested: true,
      }),
    ).toBe(true);

    expect(
      isParteInteressada({
        interested_flag: "Sim",
      }),
    ).toBe(true);
  });

  it("analisa estruturas aninhadas", () => {
    expect(
      isParteInteressada({
        metadata: {
          participation: "Parte interessada",
        },
      }),
    ).toBe(true);

    expect(
      isParteInteressada({
        labels: ["autor", "parte interessada"],
      }),
    ).toBe(true);
  });

  it("retorna falso quando nenhum identificador é encontrado", () => {
    expect(
      isParteInteressada({
        role: "Autor",
        tipo: "Requerido",
      }),
    ).toBe(false);
  });
});

describe("filtrarPartesInteressadas", () => {
  it("filtra arrays heterogêneos retornando apenas partes interessadas", () => {
    const partes = [
      { role: "Autor" },
      { role: "Parte interessada" },
      null,
      undefined,
      { side: "INTERESTED" },
      { tipo: "Requerido" },
    ];

    expect(filtrarPartesInteressadas(partes)).toEqual([
      { role: "Parte interessada" },
      { side: "INTERESTED" },
    ]);
  });

  it("aceita respostas no formato de objeto com arrays aninhados", () => {
    const partes = {
      principal: { role: "Autor" },
      interessados: [
        { tipo: "Interessado" },
        { dados: { categoria: "Parte interessada" } },
      ],
      outros: {
        semInteresse: { role: "Réu" },
      },
    };

    const resultado = filtrarPartesInteressadas(partes);

    expect(resultado).toHaveLength(2);
    expect(resultado).toEqual([
      { tipo: "Interessado" },
      { dados: { categoria: "Parte interessada" } },
    ]);
  });

  it("retorna array vazio quando nenhum dado é fornecido", () => {
    expect(filtrarPartesInteressadas(undefined)).toEqual([]);
    expect(filtrarPartesInteressadas(null)).toEqual([]);
  });
});
