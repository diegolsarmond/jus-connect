import { describe, expect, it } from "vitest";
import { Descendant } from "slate";
import { serializeEditorValue } from "../src/pages/EditorPage";

describe("serializeEditorValue", () => {
  it("deve transformar variáveis em placeholders com chaves", () => {
    const value: Descendant[] = [
      {
        type: "paragraph",
        children: [
          { text: "Prezado " },
          {
            type: "variable",
            value: "cliente.primeiro_nome",
            label: "Nome do cliente",
            children: [{ text: "" }],
          } as any,
          { text: "," },
        ],
      },
    ];

    const html = serializeEditorValue(value);
    expect(html).toContain("{{cliente.primeiro_nome}}");
  });

  it("deve aplicar as tags de formatação para negrito", () => {
    const value: Descendant[] = [
      {
        type: "paragraph",
        children: [
          { text: "Importante: ", bold: true },
          { text: "conteúdo" },
        ],
      },
    ];

    const html = serializeEditorValue(value);
    expect(html).toContain("<strong>Importante: </strong>");
  });
});
