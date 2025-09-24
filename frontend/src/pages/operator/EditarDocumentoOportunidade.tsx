import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type RefObject,
} from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SaveButton } from "@/features/document-editor/components/SaveButton";
import {
  EditorToolbar,
  type ToolbarAlignment,
  type ToolbarBlock,
  type ToolbarState,
} from "@/features/document-editor/components/EditorToolbar";
import { InsertMenu } from "@/features/document-editor/components/InsertMenu";
import { SidebarNavigation } from "@/features/document-editor/components/SidebarNavigation";
import type { VariableMenuItem } from "@/features/document-editor/data/variable-items";
import { variableMenuTree } from "@/features/document-editor/data/variable-items";
import { useToast } from "@/hooks/use-toast";
import { getApiBaseUrl } from "@/lib/api";
import {
  extractOpportunityDocument,
  type OpportunityDocument,
} from "@/lib/opportunity-documents";
import type { EditorJsonContent, EditorJsonNode } from "@/types/templates";

function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function nodeToHtml(node: EditorJsonNode): string {
  if (node.type === "text") {
    return escapeHtml(node.text ?? "");
  }

  const attrs = node.attrs
    ? Object.entries(node.attrs)
        .map(([key, value]) => `${key}="${escapeHtml(value)}"`)
        .join(" ")
    : "";
  const children = (node.children ?? []).map(nodeToHtml).join("");
  if (["img", "br", "hr"].includes(node.type)) {
    return `<${node.type}${attrs ? ` ${attrs}` : ""} />`;
  }
  return `<${node.type}${attrs ? ` ${attrs}` : ""}>${children}</${node.type}>`;
}

function jsonToHtml(content: EditorJsonContent | null): string {
  if (!content || content.length === 0) return "<p></p>";
  return content.map(nodeToHtml).join("");
}

function serializeNode(node: Node): EditorJsonNode | null {
  if (node.nodeType === Node.TEXT_NODE) {
    return { type: "text", text: node.textContent ?? "" };
  }
  if (node.nodeType === Node.ELEMENT_NODE) {
    const element = node as HTMLElement;
    const attrs: Record<string, string> = {};
    Array.from(element.attributes).forEach((attr) => {
      if (attr.name === "style" && attr.value.trim().length === 0) return;
      attrs[attr.name] = attr.value;
    });
    const children = Array.from(element.childNodes)
      .map((child) => serializeNode(child))
      .filter((child): child is EditorJsonNode => child !== null);
    return {
      type: element.tagName.toLowerCase(),
      attrs,
      children,
    };
  }
  return null;
}

function htmlToJson(html: string): EditorJsonContent {
  if (typeof window === "undefined") {
    return [];
  }
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const nodes: EditorJsonContent = [];
  Array.from(doc.body.childNodes).forEach((node) => {
    const serialized = serializeNode(node);
    if (serialized) {
      nodes.push(serialized);
    }
  });
  return nodes;
}

function extractPlaceholders(html: string): string[] {
  const regex = /{{\s*([\w.]+)\s*}}/g;
  const matches = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html))) {
    matches.add(match[1]);
  }
  return Array.from(matches);
}

function formatVariableLabel(name: string, label?: string | null): string {
  if (label && label.trim().length > 0) {
    return label.trim();
  }
  return name
    .split(".")
    .map((part) =>
      part
        .replace(/_/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase()),
    )
    .join(" • ");
}

function cloneVariableMenuItems(items: VariableMenuItem[]): VariableMenuItem[] {
  return items.map((item) => ({
    ...item,
    children: item.children ? cloneVariableMenuItems(item.children) : undefined,
  }));
}

const fontSizeMap: Record<string, string> = {
  "1": "10px",
  "2": "12px",
  "3": "16px",
  "4": "18px",
  "5": "24px",
  "6": "32px",
  "7": "48px",
};

const initialToolbarState: ToolbarState = {
  block: "paragraph",
  fontSize: "default",
  align: "left",
  bold: false,
  italic: false,
  underline: false,
  strike: false,
  orderedList: false,
  bulletList: false,
  blockquote: false,
  highlight: false,
};

interface LocationState {
  document?: OpportunityDocument;
}

export default function EditarDocumentoOportunidade() {
  const { id, documentId } = useParams<{ id: string; documentId: string }>();
  const navigate = useNavigate();
  const location = useLocation<LocationState>();
  const { toast } = useToast();

  const apiUrl = getApiBaseUrl();
  const editorRef = useRef<HTMLDivElement | null>(null);
  const editorSectionRef = useRef<HTMLDivElement | null>(null);
  const metadataSectionRef = useRef<HTMLDivElement | null>(null);
  const placeholdersSectionRef = useRef<HTMLDivElement | null>(null);

  const initialDocument = location.state?.document ?? null;
  const initialHtml = initialDocument
    ? initialDocument.content_editor_json
      ? jsonToHtml(initialDocument.content_editor_json)
      : initialDocument.content_html
    : "<p></p>";

  const [documentData, setDocumentData] = useState<OpportunityDocument | null>(initialDocument);
  const [title, setTitle] = useState(initialDocument?.title ?? "");
  const [contentHtml, setContentHtml] = useState(initialHtml);
  const [editorJson, setEditorJson] = useState<EditorJsonContent | null>(
    initialDocument?.content_editor_json ?? null,
  );
  const [placeholderList, setPlaceholderList] = useState<string[]>(
    initialDocument ? extractPlaceholders(initialHtml) : [],
  );
  const [toolbarState, setToolbarState] = useState<ToolbarState>(initialToolbarState);
  const [activeSection, setActiveSection] = useState<string>("editor");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [loading, setLoading] = useState(!initialDocument);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const variableMenuItems = useMemo(() => cloneVariableMenuItems(variableMenuTree), []);

  const decorateVariableTags = useCallback((container?: HTMLElement | null) => {
    const host = container ?? editorRef.current;
    if (!host) return;
    const tags = host.querySelectorAll<HTMLElement>("[data-variable]");
    tags.forEach((tag) => {
      tag.classList.add("variable-tag");
      tag.setAttribute("contenteditable", "false");
      tag.setAttribute("tabindex", "0");
      const variable = tag.getAttribute("data-variable") ?? "";
      const label = tag.getAttribute("data-label");
      tag.textContent = formatVariableLabel(variable, label);
      tag.setAttribute("role", "button");
      tag.setAttribute("aria-label", `Editar rótulo para ${variable}`);
    });
  }, []);

  const normalizeFontTags = useCallback(() => {
    const container = editorRef.current;
    if (!container) return;
    const fonts = container.querySelectorAll("font");
    fonts.forEach((font) => {
      const size = font.getAttribute("size") ?? "3";
      const span = document.createElement("span");
      span.style.fontSize = fontSizeMap[size] ?? fontSizeMap["3"];
      span.innerHTML = font.innerHTML;
      font.replaceWith(span);
    });
  }, []);

  const updateToolbarState = useCallback(() => {
    if (typeof document === "undefined") return;
    const selection = document.getSelection();
    if (!selection || !editorRef.current) return;
    if (!editorRef.current.contains(selection.anchorNode)) return;

    const blockValue = (document.queryCommandValue("formatBlock") || "p").toString().toLowerCase();
    const block: ToolbarBlock =
      blockValue === "h1" ? "h1" : blockValue === "h2" ? "h2" : blockValue === "h3" ? "h3" : "paragraph";
    const fontSizeValue = document.queryCommandValue("fontSize")?.toString() ?? "default";
    let align: ToolbarAlignment = "left";
    if (document.queryCommandState("justifyCenter")) align = "center";
    else if (document.queryCommandState("justifyRight")) align = "right";
    else if (document.queryCommandState("justifyFull")) align = "justify";

    const highlightValue = document.queryCommandValue("hiliteColor") || document.queryCommandValue("backColor");
    const highlight =
      typeof highlightValue === "string" &&
      highlightValue !== "transparent" &&
      highlightValue !== "rgba(0, 0, 0, 0)" &&
      highlightValue !== "";

    setToolbarState({
      block,
      fontSize: fontSizeValue || "default",
      align,
      bold: document.queryCommandState("bold"),
      italic: document.queryCommandState("italic"),
      underline: document.queryCommandState("underline"),
      strike: document.queryCommandState("strikeThrough"),
      orderedList: document.queryCommandState("insertOrderedList"),
      bulletList: document.queryCommandState("insertUnorderedList"),
      blockquote: blockValue === "blockquote",
      highlight,
    });
  }, []);

  const handleContentUpdate = useCallback(() => {
    const container = editorRef.current;
    if (!container) return;
    decorateVariableTags(container);
    normalizeFontTags();
    const html = container.innerHTML;
    setContentHtml(html);
    setEditorJson(htmlToJson(html));
    setPlaceholderList(extractPlaceholders(html));
    setIsDirty(true);
  }, [decorateVariableTags, normalizeFontTags]);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.execCommand("styleWithCSS", false, "true");
    }
  }, []);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const handleInput = () => {
      handleContentUpdate();
      updateToolbarState();
    };

    const handleDrop = (event: DragEvent) => {
      event.preventDefault();
      const text = event.dataTransfer?.getData("text/plain");
      if (text) {
        document.execCommand("insertText", false, text);
        handleContentUpdate();
      }
    };

    editor.addEventListener("input", handleInput);
    editor.addEventListener("blur", handleInput);
    editor.addEventListener("drop", handleDrop);

    return () => {
      editor.removeEventListener("input", handleInput);
      editor.removeEventListener("blur", handleInput);
      editor.removeEventListener("drop", handleDrop);
    };
  }, [handleContentUpdate, updateToolbarState]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const handler = () => updateToolbarState();
    document.addEventListener("selectionchange", handler);
    return () => document.removeEventListener("selectionchange", handler);
  }, [updateToolbarState]);

  const fetchDocument = useCallback(
    async (options?: { signal?: AbortSignal; ignore?: () => boolean }) => {
      if (!id || !documentId) {
        setError("Parâmetros inválidos.");
        setLoading(false);
        return;
      }

      if (options?.ignore?.()) {
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `${apiUrl}/api/oportunidades/${id}/documentos/${documentId}`,
          {
            method: "GET",
            headers: { Accept: "application/json" },
            signal: options?.signal,
          },
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const payload = (await response.json()) as unknown;
        if (options?.ignore?.()) {
          return;
        }

        const parsed = extractOpportunityDocument(payload);
        if (!parsed) {
          throw new Error("Documento inválido");
        }

        setDocumentData(parsed);
      } catch (fetchError) {
        if (options?.ignore?.()) {
          return;
        }
        if (fetchError instanceof DOMException && fetchError.name === "AbortError") {
          return;
        }
        console.error(fetchError);
        setError("Não foi possível carregar o documento.");
      } finally {
        if (!options?.ignore?.()) {
          setLoading(false);
        }
      }
    },
    [apiUrl, id, documentId],
  );

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    fetchDocument({ signal: controller.signal, ignore: () => cancelled }).catch((error) => {
      console.error(error);
    });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [fetchDocument]);

  useEffect(() => {
    if (!documentData) {
      if (editorRef.current) {
        editorRef.current.innerHTML = "<p></p>";
      }
      if (!loading) {
        const emptyHtml = "<p></p>";
        setContentHtml(emptyHtml);
        setEditorJson(htmlToJson(emptyHtml));
        setPlaceholderList([]);
        setIsDirty(false);
        updateToolbarState();
      }
      return;
    }

    const editor = editorRef.current;
    if (!editor) return;

    const html = documentData.content_editor_json
      ? jsonToHtml(documentData.content_editor_json)
      : documentData.content_html;
    editor.innerHTML = html;
    decorateVariableTags(editor);
    normalizeFontTags();
    setContentHtml(html);
    setEditorJson(documentData.content_editor_json ?? htmlToJson(html));
    setPlaceholderList(extractPlaceholders(html));
    setTitle(documentData.title);
    setIsDirty(false);
    updateToolbarState();
  }, [
    documentData,
    decorateVariableTags,
    normalizeFontTags,
    loading,
    updateToolbarState,
  ]);

  const focusEditor = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus({ preventScroll: true });
  }, []);

  const executeCommand = useCallback(
    (command: string, value?: string) => {
      focusEditor();
      document.execCommand(command, false, value);
      handleContentUpdate();
      updateToolbarState();
    },
    [focusEditor, handleContentUpdate, updateToolbarState],
  );

  const handleAlignmentChange = useCallback(
    (value: ToolbarAlignment) => {
      const commands: Record<ToolbarAlignment, string> = {
        left: "justifyLeft",
        center: "justifyCenter",
        right: "justifyRight",
        justify: "justifyFull",
      };
      executeCommand(commands[value]);
    },
    [executeCommand],
  );

  const handleBlockChange = useCallback(
    (value: ToolbarBlock) => {
      const blockMap: Record<ToolbarBlock, string> = {
        paragraph: "P",
        h1: "H1",
        h2: "H2",
        h3: "H3",
      };
      executeCommand("formatBlock", blockMap[value]);
    },
    [executeCommand],
  );

  const handleFontSizeChange = useCallback(
    (value: string) => {
      const size = value === "default" ? "3" : value;
      executeCommand("fontSize", size);
      normalizeFontTags();
      handleContentUpdate();
    },
    [executeCommand, handleContentUpdate, normalizeFontTags],
  );

  const toggleHighlight = useCallback(() => {
    focusEditor();
    const color = toolbarState.highlight ? "transparent" : "#fef08a";
    document.execCommand("hiliteColor", false, color);
    handleContentUpdate();
    updateToolbarState();
  }, [focusEditor, handleContentUpdate, toolbarState.highlight, updateToolbarState]);

  const handleInsertImage = useCallback(() => {
    const src = window.prompt("Informe a URL ou base64 da imagem:");
    if (!src) return;
    executeCommand("insertImage", src);
  }, [executeCommand]);

  const handleInsertTable = useCallback(() => {
    const rows = 3;
    const cols = 3;
    let html = '<table class="editor-table"><tbody>';
    for (let r = 0; r < rows; r += 1) {
      html += "<tr>";
      for (let c = 0; c < cols; c += 1) {
        html += '<td style="border:1px solid #d4d4d8;padding:8px;min-width:80px">&nbsp;</td>';
      }
      html += "</tr>";
    }
    html += "</tbody></table>";
    executeCommand("insertHTML", html);
  }, [executeCommand]);

  const handleInsertVariable = useCallback(
    (item: VariableMenuItem) => {
      if (!item.value) {
        return;
      }

      const selection = document.getSelection();
      const editor = editorRef.current;
      if (!selection || !editor || selection.rangeCount === 0) return;
      focusEditor();
      const range = selection.getRangeAt(0);
      range.deleteContents();
      const span = document.createElement("span");
      span.className = "variable-tag";
      span.setAttribute("data-variable", item.value);
      span.setAttribute("data-label", item.label ?? "");
      span.setAttribute("contenteditable", "false");
      span.setAttribute("tabindex", "0");
      span.setAttribute("role", "button");
      span.setAttribute("aria-label", `Editar rótulo para ${item.value}`);
      span.textContent = formatVariableLabel(item.value, item.label);
      range.insertNode(span);
      range.setStartAfter(span);
      range.setEndAfter(span);
      selection.removeAllRanges();
      selection.addRange(range);
      handleContentUpdate();
      updateToolbarState();
      setActiveSection("editor");
    },
    [focusEditor, handleContentUpdate, updateToolbarState],
  );

  const handleUndo = useCallback(() => {
    focusEditor();
    document.execCommand("undo");
    handleContentUpdate();
    updateToolbarState();
  }, [focusEditor, handleContentUpdate, updateToolbarState]);

  const handleRedo = useCallback(() => {
    focusEditor();
    document.execCommand("redo");
    handleContentUpdate();
    updateToolbarState();
  }, [focusEditor, handleContentUpdate, updateToolbarState]);

  const handleTitleChange = (event: ChangeEvent<HTMLInputElement>) => {
    setTitle(event.target.value);
    setIsDirty(true);
  };

  const focusSection = useCallback(
    (section: string) => {
      setActiveSection(section);
      const map: Record<string, RefObject<HTMLDivElement>> = {
        editor: editorSectionRef,
        metadata: metadataSectionRef,
        placeholders: placeholdersSectionRef,
      };
      map[section]?.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    [],
  );

  const handleRetry = () => {
    fetchDocument().catch((retryError) => {
      console.error(retryError);
    });
  };

  const handleSaveDocument = useCallback(async () => {
    if (!id || !documentId) {
      toast({
        title: "Documento inválido",
        description: "Não foi possível identificar a oportunidade ou o documento.",
        variant: "destructive",
      });
      return;
    }

    if (!editorRef.current) {
      toast({
        title: "Editor indisponível",
        description: "O editor não está pronto para salvar as alterações.",
        variant: "destructive",
      });
      return;
    }

    const html = editorRef.current.innerHTML;
    const json = htmlToJson(html);
    const trimmedTitle = title.trim();
    const finalTitle = trimmedTitle.length > 0 ? trimmedTitle : documentData?.title ?? "Documento";

    setSaving(true);
    try {
      const response = await fetch(
        `${apiUrl}/api/oportunidades/${id}/documentos/${documentId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: finalTitle,
            content_html: html,
            content_editor_json: json,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      let updatedDocument: OpportunityDocument | null = null;
      try {
        const payload = (await response.json()) as unknown;
        updatedDocument = extractOpportunityDocument(payload);
      } catch {
        updatedDocument = null;
      }

      if (updatedDocument) {
        setDocumentData(updatedDocument);
      } else {
        setDocumentData((prev) =>
          prev
            ? {
                ...prev,
                title: finalTitle,
                content_html: html,
                content_editor_json: json,
              }
            : prev,
        );
      }

      setContentHtml(html);
      setEditorJson(json);
      setPlaceholderList(extractPlaceholders(html));
      setIsDirty(false);
      setTitle(finalTitle);

      toast({
        title: "Documento atualizado",
        description: "As alterações foram salvas com sucesso.",
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Erro ao salvar documento",
        description:
          error instanceof Error ? error.message : "Não foi possível salvar as alterações.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }, [apiUrl, documentData, documentId, id, title, toast]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (!saving) {
          void handleSaveDocument();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleSaveDocument, saving]);

  const metadataContent = documentData?.metadata;
  const variableEntries = documentData?.variables &&
    typeof documentData.variables === "object" &&
    !Array.isArray(documentData.variables)
      ? Object.entries(documentData.variables)
      : [];

  return (
    <div className="flex min-h-screen bg-muted/20">
      <SidebarNavigation
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((prev) => !prev)}
        activeSection={activeSection}
        onSelectSection={focusSection}
        onInsertVariable={handleInsertVariable}
        items={variableMenuItems}
      />
      <div className="flex flex-1 flex-col bg-background">
        <header className="border-b bg-background">
          <div className="mx-auto flex max-w-[1100px] flex-col gap-4 px-4 py-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-col gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(-1)}
                  className="-ml-2 w-fit"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Voltar
                </Button>
                <div className="space-y-1">
                  <h1 className="text-2xl font-semibold">Editar documento</h1>
                  <p className="text-sm text-muted-foreground">
                    Ajuste o conteúdo gerado para a oportunidade antes de finalizar.
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input
                  value={title}
                  onChange={handleTitleChange}
                  placeholder="Título do documento"
                  className="w-full sm:w-80"
                />
                <InsertMenu onSelect={handleInsertVariable} items={variableMenuItems} />
              </div>
            </div>
            <EditorToolbar
              state={toolbarState}
              onBlockChange={handleBlockChange}
              onFontSizeChange={handleFontSizeChange}
              onAlignmentChange={handleAlignmentChange}
              onCommand={executeCommand}
              onHighlight={toggleHighlight}
              onInsertImage={handleInsertImage}
              onInsertTable={handleInsertTable}
              onUndo={handleUndo}
              onRedo={handleRedo}
            />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <section ref={editorSectionRef} id="editor" className="px-4 py-6">
            <div className="mx-auto flex max-w-[1100px] flex-col gap-6">
              {error && (
                <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <span>{error}</span>
                    <Button variant="outline" size="sm" onClick={handleRetry}>
                      Tentar novamente
                    </Button>
                  </div>
                </div>
              )}
              <div className="relative flex justify-center">
                <div className="w-full max-w-[210mm]">
                  <div className="mx-auto min-h-[297mm] w-full max-w-[210mm] bg-card px-12 py-16 text-card-foreground shadow-lg">
                    {loading && !documentData ? (
                      <div className="flex h-full min-h-[200px] items-center justify-center text-muted-foreground">
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Carregando documento...
                      </div>
                    ) : (
                      <div
                        ref={editorRef}
                        className="wysiwyg-editor focus:outline-none"
                        contentEditable
                        role="textbox"
                        aria-multiline="true"
                        spellCheck
                        suppressContentEditableWarning
                      />
                    )}
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Atalhos: Ctrl/⌘ + B (negrito), Ctrl/⌘ + I (itálico), Ctrl/⌘ + U (sublinhar), Ctrl/⌘ + S (salvar)
              </p>
            </div>
          </section>

          <section ref={metadataSectionRef} id="metadata" className="px-4 py-6">
            <div className="mx-auto max-w-[1100px] space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Metadados do documento</CardTitle>
                </CardHeader>
                <CardContent>
                  {metadataContent ? (
                    <pre className="whitespace-pre-wrap rounded-md bg-muted/50 p-4 text-xs leading-relaxed">
                      {JSON.stringify(metadataContent, null, 2)}
                    </pre>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Nenhum metadado disponível para este documento.
                    </p>
                  )}
                </CardContent>
              </Card>

              {variableEntries && variableEntries.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Valores utilizados</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {variableEntries.map(([key, value]) => (
                      <div
                        key={key}
                        className="flex items-start justify-between gap-4 rounded border border-border/60 bg-background/60 p-3"
                      >
                        <span className="font-medium text-muted-foreground">{key}</span>
                        <span className="max-w-[65%] break-words text-foreground">
                          {typeof value === "object" ? JSON.stringify(value, null, 2) : String(value ?? "")}
                        </span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          </section>

          <section ref={placeholdersSectionRef} id="placeholders" className="px-4 py-6">
            <div className="mx-auto max-w-[1100px]">
              <Card>
                <CardHeader>
                  <CardTitle>Campos preenchidos automaticamente</CardTitle>
                </CardHeader>
                <CardContent>
                  {placeholderList.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Insira variáveis pelo menu “Inserir” ou pela barra lateral para preencher dados automaticamente.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {placeholderList.map((variable) => (
                        <Badge key={variable} variant="secondary" className="text-xs font-medium">
                          {`{{${variable}}}`}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </section>
        </main>
      </div>
      <SaveButton
        onClick={handleSaveDocument}
        disabled={saving || !isDirty}
        isDirty={isDirty}
        label={saving ? "Salvando..." : "Salvar alterações"}
      />
    </div>
  );
}

