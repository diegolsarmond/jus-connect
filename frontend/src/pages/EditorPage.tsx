import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  BaseEditor,
  Descendant,
  Editor,
  Element as SlateElement,
  Transforms,
  createEditor,
  Text,
} from "slate";
import { HistoryEditor, withHistory } from "slate-history";
import {
  Editable,
  ReactEditor,
  RenderElementProps,
  RenderLeafProps,
  Slate,
  useFocused,
  useSelected,
  withReact,
} from "slate-react";
import InsertMenu from "../components/InsertMenu";
import VariableTag from "../components/VariableTag";
import MetadataModal, { MetadataFormData } from "../components/MetadataModal";
import EditorToolbar from "../components/EditorToolbar";
import SaveButton from "../components/SaveButton";
import {
  VariableNode,
  createTemplate,
  getTemplateById,
  getVariables,
  updateTemplate,
  type TemplateDetail,
} from "../services/api";

// Tipos customizados do Slate para permitir nodes específicos do editor.
type CustomText = { text: string; bold?: boolean; italic?: boolean; underline?: boolean; fontSize?: string };

type ParagraphElement = { type: "paragraph"; align?: string; children: Descendant[] };
type HeadingElement = { type: "heading-one" | "heading-two"; align?: string; children: Descendant[] };
type ListElement = { type: "numbered-list" | "bulleted-list"; children: Descendant[] };
type ListItemElement = { type: "list-item"; children: Descendant[] };
type VariableElement = { type: "variable"; value: string; label: string; children: [{ text: "" }] };
type ImageElement = { type: "image"; url: string; children: [{ text: "" }] };
type TableElement = { type: "table"; children: Descendant[] };
type TableRowElement = { type: "table-row"; children: Descendant[] };
type TableCellElement = { type: "table-cell"; children: Descendant[] };

type CustomElement =
  | ParagraphElement
  | HeadingElement
  | ListElement
  | ListItemElement
  | VariableElement
  | ImageElement
  | TableElement
  | TableRowElement
  | TableCellElement;

type CustomEditor = BaseEditor & HistoryEditor & ReactEditor;

declare module "slate" {
  interface CustomTypes {
    Editor: CustomEditor;
    Element: CustomElement;
    Text: CustomText;
  }
}

const defaultValue: Descendant[] = [
  {
    type: "paragraph",
    children: [
      {
        text: "Comece a escrever seu documento aqui. Utilize o menu de variáveis para inserir placeholders automatizados.",
      },
    ],
  },
];

// Para ampliar a lista de variáveis suportadas, inclua novos objetos neste array ou ajuste o retorno da API.
const fallbackVariables: VariableNode[] = [
  {
    label: "Cliente",
    value: "cliente",
    children: [
      { label: "Primeiro nome", value: "cliente.primeiro_nome" },
      { label: "Sobrenome", value: "cliente.sobrenome" },
      { label: "Documento", value: "cliente.documento" },
      {
        label: "Endereço",
        value: "cliente.endereco",
        children: [
          { label: "Rua", value: "cliente.endereco.rua" },
          { label: "Número", value: "cliente.endereco.numero" },
          { label: "Bairro", value: "cliente.endereco.bairro" },
        ],
      },
    ],
  },
  {
    label: "Processo",
    value: "processo",
    children: [
      { label: "Número", value: "processo.numero" },
      { label: "Vara", value: "processo.vara" },
      { label: "Comarca", value: "processo.comarca" },
    ],
  },
  {
    label: "Escritório",
    value: "escritorio",
    children: [
      { label: "Nome", value: "escritorio.nome" },
      { label: "Telefone", value: "escritorio.telefone" },
      { label: "E-mail", value: "escritorio.email" },
    ],
  },
  {
    label: "Usuário",
    value: "usuario",
    children: [
      { label: "Nome", value: "usuario.nome" },
      { label: "Cargo", value: "usuario.cargo" },
    ],
  },
  {
    label: "Data atual",
    value: "sistema.data_atual",
  },
];

const baseMetadata: MetadataFormData = {
  name: "Novo modelo",
  type: "",
  area: "",
  complexity: "media",
  visibility: "PUBLIC",
  autoCreateClient: false,
  autoCreateProcess: false,
  description: "",
};

interface EditorPageProps {
  mode: "create" | "edit";
}

const withVariables = (editor: CustomEditor) => {
  const { isInline, isVoid } = editor;
  editor.isInline = (element) => (element.type === "variable" ? true : isInline(element));
  editor.isVoid = (element) => (element.type === "variable" || element.type === "image" ? true : isVoid(element));
  return editor;
};

const EditorPage: React.FC<EditorPageProps> = ({ mode }) => {
  const { templateId } = useParams<{ templateId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as { blank?: boolean } | null;
  const [metadata, setMetadata] = useState<MetadataFormData>(baseMetadata);
  const [variables, setVariables] = useState<VariableNode[]>(fallbackVariables);
  const [showInsertMenu, setShowInsertMenu] = useState(false);
  const [showMetadataModal, setShowMetadataModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [loadingTemplate, setLoadingTemplate] = useState(false);

  const editor = useMemo(() => withHistory(withVariables(withReact(createEditor()))), []);
  const [value, setValue] = useState<Descendant[]>(defaultValue);

  useEffect(() => {
    const loadVariables = async () => {
      try {
        const apiVariables = await getVariables();
        const merged = mergeVariables(apiVariables);
        setVariables(merged);
      } catch (error) {
        console.warn("Falha ao carregar variáveis do backend, utilizando fallback", error);
        setVariables(fallbackVariables);
      }
    };

    loadVariables();
  }, []);

  useEffect(() => {
    if (mode === "edit" && templateId) {
      const fetchTemplate = async () => {
        try {
          setLoadingTemplate(true);
          const template = await getTemplateById(templateId);
          applyTemplate(template);
        } catch (error) {
          console.error(error);
          setStatusMessage("Não foi possível carregar o modelo selecionado.");
        } finally {
          setLoadingTemplate(false);
        }
      };

      fetchTemplate();
    } else if (locationState?.blank) {
      setValue(defaultValue);
      setMetadata(baseMetadata);
    }
  }, [mode, templateId, location.state]);

  const applyTemplate = (template: TemplateDetail) => {
    setMetadata({
      name: template.name,
      type: template.type,
      area: template.area,
      complexity: template.complexity,
      visibility: template.visibility,
      autoCreateClient: template.autoCreateClient,
      autoCreateProcess: template.autoCreateProcess,
      description: template.preview,
    });
    try {
      const parsed = JSON.parse(template.contentEditorJson) as Descendant[];
      setValue(parsed);
    } catch (error) {
      console.error("Falha ao interpretar o JSON do editor, carregando HTML como fallback.", error);
      setValue(defaultValue);
    }
  };

  const insertVariable = (variable: VariableNode) => {
    const node: VariableElement = {
      type: "variable",
      value: variable.value,
      label: variable.label,
      children: [{ text: "" }],
    };
    Transforms.insertNodes(editor, node);
    Transforms.insertText(editor, " ");
    setShowInsertMenu(false);
  };

  const handleSave = async (formData: MetadataFormData) => {
    setShowMetadataModal(false);
    setMetadata(formData);
    setSaving(true);
    setStatusMessage(null);
    const contentHtml = serializeEditorValue(value);
    const contentEditorJson = JSON.stringify(value);

    try {
      if (mode === "edit" && templateId) {
        await updateTemplate(templateId, {
          ...formData,
          contentHtml,
          contentEditorJson,
        });
        setStatusMessage("Modelo atualizado com sucesso.");
      } else {
        const template = await createTemplate({
          ...formData,
          contentHtml,
          contentEditorJson,
        });
        setStatusMessage("Modelo criado com sucesso.");
        navigate(`/templates/${template.id}`, { replace: true });
      }
    } catch (error) {
      console.error(error);
      setStatusMessage("Não foi possível salvar o modelo.");
    } finally {
      setSaving(false);
    }
  };

  const renderElement = useCallback((props: RenderElementProps) => <Element {...props} />, []);
  const renderLeaf = useCallback((props: RenderLeafProps) => <Leaf {...props} />, []);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!event.ctrlKey && !event.metaKey) {
      return;
    }
    switch (event.key.toLowerCase()) {
      case "b":
        event.preventDefault();
        toggleMark(editor, "bold");
        break;
      case "i":
        event.preventDefault();
        toggleMark(editor, "italic");
        break;
      case "u":
        event.preventDefault();
        toggleMark(editor, "underline");
        break;
      default:
        break;
    }
  };

  return (
    <section>
      <header style={{ marginBottom: 24 }}>
        <h1>{metadata.name || "Novo modelo"}</h1>
        <p style={{ color: "#6b7280" }}>
          Tipo: {metadata.type || "sem tipo"} — Área: {metadata.area || "não definida"} — Visibilidade: {metadata.visibility}
        </p>
      </header>
      {loadingTemplate ? <p>Carregando modelo...</p> : null}
      {statusMessage ? <p>{statusMessage}</p> : null}
      <div className="editor-layout">
        <div className="editor-page-wrapper">
          <Slate editor={editor} value={value} onChange={setValue}>
            <EditorToolbar onOpenInsertMenu={() => setShowInsertMenu((prev) => !prev)} />
            {showInsertMenu ? (
              <InsertMenu variables={variables} onSelect={insertVariable} onClose={() => setShowInsertMenu(false)} />
            ) : null}
            <div className="editor-page">
              <Editable
                className="editor-content"
                renderElement={renderElement}
                renderLeaf={renderLeaf}
                spellCheck
                onKeyDown={handleKeyDown}
                placeholder="Digite o conteúdo do documento"
              />
            </div>
          </Slate>
        </div>
      </div>
      <SaveButton onClick={() => setShowMetadataModal(true)} />
      <MetadataModal
        open={showMetadataModal}
        initialData={metadata}
        onClose={() => setShowMetadataModal(false)}
        onSave={handleSave}
      />
      {saving ? <p>Salvando modelo...</p> : null}
    </section>
  );
};

const Element: React.FC<RenderElementProps> = ({ attributes, children, element }) => {
  const selected = useSelected();
  const focused = useFocused();

  switch (element.type) {
    case "heading-one":
      return (
        <h1 {...attributes} style={{ textAlign: element.align ?? "left", marginTop: 24 }}>
          {children}
        </h1>
      );
    case "heading-two":
      return (
        <h2 {...attributes} style={{ textAlign: element.align ?? "left", marginTop: 16 }}>
          {children}
        </h2>
      );
    case "numbered-list":
      return (
        <ol {...attributes} style={{ marginLeft: 24 }}>
          {children}
        </ol>
      );
    case "bulleted-list":
      return (
        <ul {...attributes} style={{ marginLeft: 24 }}>
          {children}
        </ul>
      );
    case "list-item":
      return <li {...attributes}>{children}</li>;
    case "variable":
      return (
        <span {...attributes} contentEditable={false} style={{ margin: "0 4px" }}>
          <VariableTag label={element.label} selected={selected && focused} />
          {children}
        </span>
      );
    case "image":
      return (
        <div {...attributes} contentEditable={false} style={{ textAlign: "center", margin: "16px 0" }}>
          <img src={element.url} alt="Imagem inserida" style={{ maxWidth: "100%", borderRadius: 8 }} />
          {children}
        </div>
      );
    case "table":
      return (
        <table
          {...attributes}
          style={{ width: "100%", borderCollapse: "collapse", margin: "16px 0", fontSize: 14 }}
        >
          <tbody>{children}</tbody>
        </table>
      );
    case "table-row":
      return <tr {...attributes}>{children}</tr>;
    case "table-cell":
      return (
        <td {...attributes} style={{ border: "1px solid #d1d5db", padding: 8 }}>
          {children}
        </td>
      );
    default:
      return (
        <p {...attributes} style={{ textAlign: (element as ParagraphElement).align ?? "left", margin: "12px 0" }}>
          {children}
        </p>
      );
  }
};

const Leaf: React.FC<RenderLeafProps> = ({ attributes, children, leaf }) => {
  let rendered = children;
  if (leaf.bold) {
    rendered = <strong>{rendered}</strong>;
  }
  if (leaf.italic) {
    rendered = <em>{rendered}</em>;
  }
  if (leaf.underline) {
    rendered = <u>{rendered}</u>;
  }

  const style: React.CSSProperties = {};
  if (leaf.fontSize) {
    style.fontSize = leaf.fontSize;
  }

  return (
    <span {...attributes} style={style}>
      {rendered}
    </span>
  );
};

const toggleMark = (editor: CustomEditor, format: "bold" | "italic" | "underline") => {
  const isActive = isMarkActive(editor, format);
  if (isActive) {
    Editor.removeMark(editor, format);
  } else {
    Editor.addMark(editor, format, true);
  }
};

const isMarkActive = (editor: CustomEditor, format: "bold" | "italic" | "underline") => {
  const marks = Editor.marks(editor);
  return marks ? (marks as any)[format] === true : false;
};

function mergeVariables(apiVariables: VariableNode[]): VariableNode[] {
  if (!apiVariables || apiVariables.length === 0) {
    return fallbackVariables;
  }
  const existingLabels = new Set(apiVariables.map((item) => item.label));
  const extras = fallbackVariables.filter((item) => !existingLabels.has(item.label));
  return [...apiVariables, ...extras];
}

export const serializeEditorValue = (nodes: Descendant[]): string => {
  return nodes.map((node) => serializeNode(node)).join("");
};

function serializeNode(node: Descendant): string {
  if (Text.isText(node)) {
    let text = node.text.replace(/\n/g, "<br/>");
    if (!text) {
      return "";
    }
    if (node.bold) {
      text = `<strong>${text}</strong>`;
    }
    if (node.italic) {
      text = `<em>${text}</em>`;
    }
    if (node.underline) {
      text = `<u>${text}</u>`;
    }
    if (node.fontSize) {
      text = `<span style="font-size:${node.fontSize}">${text}</span>`;
    }
    return text;
  }

  const children = node.children.map((child) => serializeNode(child)).join("") || "<br/>";
  const element = node as SlateElement & { align?: string; url?: string; value?: string; label?: string };

  switch (element.type) {
    case "heading-one":
      return `<h1 style="text-align:${element.align ?? "left"}">${children}</h1>`;
    case "heading-two":
      return `<h2 style="text-align:${element.align ?? "left"}">${children}</h2>`;
    case "numbered-list":
      return `<ol>${children}</ol>`;
    case "bulleted-list":
      return `<ul>${children}</ul>`;
    case "list-item":
      return `<li>${children}</li>`;
    case "variable":
      // Serialização para HTML com placeholders no formato {{namespace.campo}}.
      return `{{${element.value}}}`;
    case "image":
      return `<img src="${element.url}" alt="Imagem" />`;
    case "table":
      return `<table><tbody>${children}</tbody></table>`;
    case "table-row":
      return `<tr>${children}</tr>`;
    case "table-cell":
      return `<td>${children}</td>`;
    default:
      return `<p style="text-align:${element.align ?? "left"}">${children}</p>`;
  }
}

export default EditorPage;
