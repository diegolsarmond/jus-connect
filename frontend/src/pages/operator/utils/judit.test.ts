import { describe, expect, it } from "vitest";

import { formatResponseValue, isMetadataEntryList } from "./judit";

describe("formatResponseValue", () => {
  it("converte objetos aninhados em entradas navegáveis", () => {
    const formatted = formatResponseValue({
      processo: {
        numero: "123456",
        status: "Ativo",
      },
      origem: {
        tribunal: "TJSP",
        unidade: {
          nome: "Vara Cível",
          grau: "1º Grau",
        },
      },
    });

    expect(isMetadataEntryList(formatted)).toBe(true);

    if (isMetadataEntryList(formatted)) {
      const processoEntry = formatted.find((entry) => entry.key === "processo");
      expect(processoEntry).toBeDefined();
      expect(processoEntry && isMetadataEntryList(processoEntry.value)).toBe(true);

      if (processoEntry && isMetadataEntryList(processoEntry.value)) {
        const numeroEntry = processoEntry.value.find((entry) => entry.key === "numero");
        expect(numeroEntry?.value).toBe("123456");
      }
    }
  });

  it("mantém arrays de primitivos legíveis", () => {
    const formatted = formatResponseValue(["Autor", "Réu", "Testemunha"]);
    expect(formatted).toBe("Autor, Réu, Testemunha");
  });

  it("transforma arrays com objetos em grupos estruturados", () => {
    const formatted = formatResponseValue([
      { tipo: "Audiência", data: "2024-02-10" },
      { tipo: "Julgamento", data: "2024-03-05" },
    ]);

    expect(isMetadataEntryList(formatted)).toBe(true);

    if (isMetadataEntryList(formatted)) {
      expect(formatted).toHaveLength(2);
      expect(formatted[0].label).toBe("Item 1");
      expect(isMetadataEntryList(formatted[0].value)).toBe(true);
    }
  });
});
