import React from "react";
import { Editor, Element as SlateElement, Transforms } from "slate";
import { HistoryEditor } from "slate-history";
import { useSlate } from "slate-react";

interface EditorToolbarProps {
  onOpenInsertMenu: () => void;
}

const LIST_TYPES = ["numbered-list", "bulleted-list"] as const;

type BlockFormat = "paragraph" | "heading-one" | "heading-two" | "bulleted-list" | "numbered-list" | "blockquote";

type MarkFormat = "bold" | "italic" | "underline" | "fontSize" | "align-left" | "align-center" | "align-right";

const EditorToolbar: React.FC<EditorToolbarProps> = ({ onOpenInsertMenu }) => {
  const editor = useSlate();

  const toggleMark = (format: MarkFormat, value?: string) => {
    const isActive = isMarkActive(editor, format);
    if (format === "fontSize" && value) {
      Editor.addMark(editor, "fontSize", value);
      return;
    }
    if (isActive) {
      Editor.removeMark(editor, format);
    } else {
      Editor.addMark(editor, format, true);
    }
  };

  const toggleBlock = (format: BlockFormat) => {
    const isActive = isBlockActive(editor, format);
    const isList = LIST_TYPES.includes(format as typeof LIST_TYPES[number]);

    Transforms.unwrapNodes(editor, {
      match: (node) => !Editor.isEditor(node) && SlateElement.isElement(node) && LIST_TYPES.includes(node.type as any),
      split: true,
    });

    const newProperties: Partial<SlateElement> = {
      type: isActive ? "paragraph" : isList ? "list-item" : format,
    };
    Transforms.setNodes(editor, newProperties);

    if (!isActive && isList) {
      const block = { type: format, children: [] } as SlateElement;
      Transforms.wrapNodes(editor, block);
    }
  };

  const insertImage = () => {
    const url = window.prompt("Informe a URL ou base64 da imagem");
    if (!url) return;
    const image = { type: "image", url, children: [{ text: "" }] } as SlateElement;
    Transforms.insertNodes(editor, image);
  };

  const insertTable = () => {
    const table = {
      type: "table",
      children: [
        {
          type: "table-row",
          children: [
            { type: "table-cell", children: [{ text: "Cabeçalho 1" }] },
            { type: "table-cell", children: [{ text: "Cabeçalho 2" }] },
          ],
        },
        {
          type: "table-row",
          children: [
            { type: "table-cell", children: [{ text: "Linha 1" }] },
            { type: "table-cell", children: [{ text: "Linha 2" }] },
          ],
        },
      ],
    } as SlateElement;
    Transforms.insertNodes(editor, table);
  };

  return (
    <div className="editor-toolbar" role="toolbar" aria-label="Ferramentas do editor">
      <div className="toolbar-group">
        <select
          className="toolbar-select"
          value={getCurrentBlock(editor)}
          onChange={(event) => toggleBlock(event.target.value as BlockFormat)}
          aria-label="Estilo do texto"
        >
          <option value="paragraph">Texto normal</option>
          <option value="heading-one">Título 1</option>
          <option value="heading-two">Título 2</option>
        </select>
        <select
          className="toolbar-select"
          value={getCurrentFontSize(editor)}
          onChange={(event) => toggleMark("fontSize", event.target.value)}
          aria-label="Tamanho da fonte"
        >
          <option value="14px">14</option>
          <option value="16px">16</option>
          <option value="18px">18</option>
          <option value="20px">20</option>
        </select>
      </div>
      <div className="toolbar-group">
        <button
          type="button"
          className="toolbar-button"
          onClick={() => toggleMark("bold")}
          aria-pressed={isMarkActive(editor, "bold")}
        >
          Negrito (Ctrl+B)
        </button>
        <button
          type="button"
          className="toolbar-button"
          onClick={() => toggleMark("italic")}
          aria-pressed={isMarkActive(editor, "italic")}
        >
          Itálico (Ctrl+I)
        </button>
        <button
          type="button"
          className="toolbar-button"
          onClick={() => toggleMark("underline")}
          aria-pressed={isMarkActive(editor, "underline")}
        >
          Sublinhado (Ctrl+U)
        </button>
      </div>
      <div className="toolbar-group">
        <button
          type="button"
          className="toolbar-button"
          onClick={() => toggleBlock("numbered-list")}
          aria-pressed={isBlockActive(editor, "numbered-list")}
        >
          Lista numerada
        </button>
        <button
          type="button"
          className="toolbar-button"
          onClick={() => toggleBlock("bulleted-list")}
          aria-pressed={isBlockActive(editor, "bulleted-list")}
        >
          Lista
        </button>
      </div>
      <div className="toolbar-group">
        <button type="button" className="toolbar-button" onClick={() => setAlignment(editor, "left")}>
          Esquerda
        </button>
        <button type="button" className="toolbar-button" onClick={() => setAlignment(editor, "center")}>
          Centro
        </button>
        <button type="button" className="toolbar-button" onClick={() => setAlignment(editor, "right")}>
          Direita
        </button>
      </div>
      <div className="toolbar-group">
        <button type="button" className="toolbar-button" onClick={insertImage}>
          Inserir imagem
        </button>
        <button type="button" className="toolbar-button" onClick={insertTable}>
          Inserir tabela
        </button>
        <button type="button" className="toolbar-button" onClick={onOpenInsertMenu}>
          Inserir variável
        </button>
      </div>
      <div className="toolbar-group">
        <button type="button" className="toolbar-button" onClick={() => HistoryEditor.undo(editor)}>
          Desfazer
        </button>
        <button type="button" className="toolbar-button" onClick={() => HistoryEditor.redo(editor)}>
          Refazer
        </button>
      </div>
    </div>
  );
};

function isBlockActive(editor: Editor, format: BlockFormat) {
  const [match] = Array.from(
    Editor.nodes(editor, {
      match: (node) => !Editor.isEditor(node) && SlateElement.isElement(node) && node.type === format,
    })
  );
  return Boolean(match);
}

function isMarkActive(editor: Editor, format: MarkFormat) {
  const marks = Editor.marks(editor);
  if (!marks) return false;
  if (format === "fontSize") {
    return Boolean(marks.fontSize);
  }
  return Boolean(marks[format]);
}

function getCurrentBlock(editor: Editor): BlockFormat {
  if (isBlockActive(editor, "heading-one")) return "heading-one";
  if (isBlockActive(editor, "heading-two")) return "heading-two";
  if (isBlockActive(editor, "bulleted-list")) return "bulleted-list";
  if (isBlockActive(editor, "numbered-list")) return "numbered-list";
  if (isBlockActive(editor, "blockquote")) return "blockquote";
  return "paragraph";
}

function getCurrentFontSize(editor: Editor): string {
  const marks = Editor.marks(editor);
  return (marks?.fontSize as string) ?? "16px";
}

function setAlignment(editor: Editor, align: "left" | "center" | "right") {
  Transforms.setNodes(
    editor,
    { align },
    {
      match: (node) => SlateElement.isElement(node) && Editor.isBlock(editor, node),
    }
  );
}

export default EditorToolbar;
