import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useIsMobile } from '@/hooks/use-mobile';
import { useToast } from '@/hooks/use-toast';
import {
  API_KEY_PROVIDER_LABELS,
  fetchIntegrationApiKeys,
  generateAiText,
  type IntegrationApiKey,
} from '@/lib/integrationApiKeys';
import { createTemplate, getTemplate, updateTemplate } from '@/lib/templates';
import type {
  EditorJsonContent,
  EditorJsonNode,
  TemplatePayload,
} from '@/types/templates';
import { defaultTemplateMetadata } from '@/types/templates';
import type { VariableMenuItem } from '@/features/document-editor/data/variable-items';
import { InsertMenu } from '@/features/document-editor/components/InsertMenu';
import { EditorToolbar, type ToolbarAlignment, type ToolbarBlock, type ToolbarState } from '@/features/document-editor/components/EditorToolbar';
import { SidebarNavigation } from '@/features/document-editor/components/SidebarNavigation';
import { MetadataModal, type MetadataFormValues } from '@/features/document-editor/components/MetadataModal';
import { SaveButton } from '@/features/document-editor/components/SaveButton';
import { Menu, Sparkles } from 'lucide-react';

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function nodeToHtml(node: EditorJsonNode): string {
  if (node.type === 'text') {
    return escapeHtml(node.text ?? '');
  }

  const attrs = node.attrs
    ? Object.entries(node.attrs)
        .map(([key, value]) => `${key}="${escapeHtml(value)}"`)
        .join(' ')
    : '';
  const children = (node.children ?? []).map(nodeToHtml).join('');
  if (['img', 'br', 'hr'].includes(node.type)) {
    return `<${node.type}${attrs ? ` ${attrs}` : ''} />`;
  }
  return `<${node.type}${attrs ? ` ${attrs}` : ''}>${children}</${node.type}>`;
}

function jsonToHtml(content: EditorJsonContent | null): string {
  if (!content) return '<p></p>';
  return content.map(nodeToHtml).join('');
}

function serializeNode(node: Node): EditorJsonNode | null {
  if (node.nodeType === Node.TEXT_NODE) {
    return { type: 'text', text: node.textContent ?? '' };
  }
  if (node.nodeType === Node.ELEMENT_NODE) {
    const element = node as HTMLElement;
    const attrs: Record<string, string> = {};
    Array.from(element.attributes).forEach(attr => {
      if (attr.name === 'style' && attr.value.trim().length === 0) return;
      attrs[attr.name] = attr.value;
    });
    const children = Array.from(element.childNodes)
      .map(child => serializeNode(child))
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
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const nodes: EditorJsonContent = [];
  Array.from(doc.body.childNodes).forEach(node => {
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
    .split('.')
    .map(part =>
      part
        .replace(/_/g, ' ')
        .replace(/\b\w/g, char => char.toUpperCase()),
    )
    .join(' • ');
}

const fontSizeMap: Record<string, string> = {
  '1': '10px',
  '2': '12px',
  '3': '16px',
  '4': '18px',
  '5': '24px',
  '6': '32px',
  '7': '48px',
};

const initialToolbarState: ToolbarState = {
  block: 'paragraph',
  fontSize: 'default',
  align: 'left',
  bold: false,
  italic: false,
  underline: false,
  strike: false,
  orderedList: false,
  bulletList: false,
  blockquote: false,
  highlight: false,
};

const DOCUMENT_TYPE_OPTIONS = [
  { value: 'contrato', label: 'Contrato' },
  { value: 'peticao', label: 'Petição' },
  { value: 'parecer', label: 'Parecer' },
  { value: 'recurso', label: 'Recurso' },
  { value: 'notificacao', label: 'Notificação' },
  { value: 'outro', label: 'Outro' },
];

export default function EditorPage() {
  const { id } = useParams();
  const location = useLocation();
  const isNew = !id || id === 'novo';
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const { toast } = useToast();

  const editorRef = useRef<HTMLDivElement | null>(null);
  const [title, setTitle] = useState('');
  const [metadata, setMetadata] = useState(defaultTemplateMetadata);
  const [contentHtml, setContentHtml] = useState('<p></p>');
  const [editorJson, setEditorJson] = useState<EditorJsonContent | null>(null);
  const [isMetadataModalOpen, setIsMetadataModalOpen] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(isMobile);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<'editor' | 'metadata' | 'placeholders'>('editor');
  const [toolbarState, setToolbarState] = useState<ToolbarState>(initialToolbarState);
  const [tagEditor, setTagEditor] = useState<{ element: HTMLElement; label: string } | null>(null);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiDocumentType, setAiDocumentType] = useState<string>(DOCUMENT_TYPE_OPTIONS[0]?.value ?? 'contrato');
  const [aiPrompt, setAiPrompt] = useState('');
  const [selectedIntegrationId, setSelectedIntegrationId] = useState<number | null>(null);
  const [isGeneratingAiContent, setIsGeneratingAiContent] = useState(false);

  const editorSectionRef = useRef<HTMLDivElement | null>(null);
  const metadataSectionRef = useRef<HTMLDivElement | null>(null);
  const placeholdersSectionRef = useRef<HTMLDivElement | null>(null);

  const locationState = location.state as { openMetadata?: boolean } | null;

  const integrationQuery = useQuery({
    queryKey: ['integration-api-keys'],
    queryFn: fetchIntegrationApiKeys,
  });

  const activeAiIntegrations = useMemo(() => {
    if (!integrationQuery.data) return [] as IntegrationApiKey[];
    return [...integrationQuery.data]
      .filter(integration => integration.active)
      .sort((a, b) => {
        if (a.environment === b.environment) {
          return API_KEY_PROVIDER_LABELS[a.provider].localeCompare(API_KEY_PROVIDER_LABELS[b.provider]);
        }
        if (a.environment === 'producao') return -1;
        if (b.environment === 'producao') return 1;
        return a.environment.localeCompare(b.environment);
      });
  }, [integrationQuery.data]);

  const hasActiveAiIntegrations = activeAiIntegrations.length > 0;
  const isLoadingAiIntegrations = integrationQuery.isLoading;
  const isAiButtonDisabled = isLoadingAiIntegrations || !hasActiveAiIntegrations;

  useEffect(() => {
    if (activeAiIntegrations.length === 0) {
      if (selectedIntegrationId !== null) {
        setSelectedIntegrationId(null);
      }
      return;
    }

    const exists = activeAiIntegrations.some(integration => integration.id === selectedIntegrationId);
    if (!exists) {
      setSelectedIntegrationId(activeAiIntegrations[0].id);
    }
  }, [activeAiIntegrations, selectedIntegrationId]);

  useEffect(() => {
    if (locationState?.openMetadata) {
      setIsMetadataModalOpen(true);
    }
  }, [locationState]);

  useEffect(() => {
    setSidebarCollapsed(isMobile);
    if (!isMobile) {
      setMobileSidebarOpen(false);
    }
  }, [isMobile]);

  const templateQuery = useQuery({
    queryKey: ['template', id],
    queryFn: () => getTemplate(Number(id)),
    enabled: !isNew,
    onSuccess: data => {
      setTitle(data.title);
      setMetadata(data.metadata);
      const html = data.content_editor_json ? jsonToHtml(data.content_editor_json) : data.content_html;
      setContentHtml(html);
      setEditorJson(data.content_editor_json ?? htmlToJson(html));
      setIsDirty(false);
    },
  });

  const saveMutation = useMutation({
    mutationFn: (payload: TemplatePayload) =>
      isNew ? createTemplate(payload) : updateTemplate(Number(id), payload),
    onSuccess: data => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      setIsDirty(false);
      if (isNew) {
        navigate(`/documentos/editor/${data.id}`);
      }
    },
  });

  const decorateVariableTags = useCallback((container?: HTMLElement | null) => {
    const host = container ?? editorRef.current;
    if (!host) return;
    const tags = host.querySelectorAll<HTMLElement>('[data-variable]');
    tags.forEach(tag => {
      tag.classList.add('variable-tag');
      tag.setAttribute('contenteditable', 'false');
      tag.setAttribute('tabindex', '0');
      const variable = tag.getAttribute('data-variable') ?? '';
      const label = tag.getAttribute('data-label');
      tag.textContent = formatVariableLabel(variable, label);
      tag.setAttribute('role', 'button');
      tag.setAttribute('aria-label', `Editar rótulo para ${variable}`);
    });
  }, []);

  const normalizeFontTags = useCallback(() => {
    const container = editorRef.current;
    if (!container) return;
    const fonts = container.querySelectorAll('font');
    fonts.forEach(font => {
      const size = font.getAttribute('size') ?? '3';
      const span = document.createElement('span');
      span.style.fontSize = fontSizeMap[size] ?? fontSizeMap['3'];
      span.innerHTML = font.innerHTML;
      font.replaceWith(span);
    });
  }, []);

  const updateToolbarState = useCallback(() => {
    const selection = document.getSelection();
    if (!selection || !editorRef.current) return;
    if (!editorRef.current.contains(selection.anchorNode)) return;

    const blockValue = (document.queryCommandValue('formatBlock') || 'p').toString().toLowerCase();
    const block: ToolbarBlock = blockValue === 'h1' ? 'h1' : blockValue === 'h2' ? 'h2' : blockValue === 'h3' ? 'h3' : 'paragraph';
    const fontSizeValue = document.queryCommandValue('fontSize')?.toString() ?? 'default';
    let align: ToolbarAlignment = 'left';
    if (document.queryCommandState('justifyCenter')) align = 'center';
    else if (document.queryCommandState('justifyRight')) align = 'right';
    else if (document.queryCommandState('justifyFull')) align = 'justify';

    const highlightValue = document.queryCommandValue('hiliteColor') || document.queryCommandValue('backColor');
    const highlight =
      typeof highlightValue === 'string' &&
      highlightValue !== 'transparent' &&
      highlightValue !== 'rgba(0, 0, 0, 0)' &&
      highlightValue !== '';

    setToolbarState({
      block,
      fontSize: fontSizeValue || 'default',
      align,
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
      strike: document.queryCommandState('strikeThrough'),
      orderedList: document.queryCommandState('insertOrderedList'),
      bulletList: document.queryCommandState('insertUnorderedList'),
      blockquote: blockValue === 'blockquote',
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
    setIsDirty(true);
  }, [decorateVariableTags, normalizeFontTags]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    document.execCommand('styleWithCSS', false, 'true');

    const handleInput = () => {
      handleContentUpdate();
      updateToolbarState();
    };

    const handleDrop = (event: DragEvent) => {
      event.preventDefault();
      const text = event.dataTransfer?.getData('text/plain');
      if (text) {
        document.execCommand('insertText', false, text);
        handleContentUpdate();
      }
    };

    const handleClick = (event: MouseEvent) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>('.variable-tag');
      if (target) {
        event.preventDefault();
        setTagEditor({ element: target, label: target.getAttribute('data-label') ?? target.textContent ?? '' });
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target && target.classList.contains('variable-tag') && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault();
        setTagEditor({ element: target, label: target.getAttribute('data-label') ?? target.textContent ?? '' });
      }
    };

    editor.addEventListener('input', handleInput);
    editor.addEventListener('blur', handleInput);
    editor.addEventListener('drop', handleDrop);
    editor.addEventListener('click', handleClick);
    editor.addEventListener('keydown', handleKeyDown);

    return () => {
      editor.removeEventListener('input', handleInput);
      editor.removeEventListener('blur', handleInput);
      editor.removeEventListener('drop', handleDrop);
      editor.removeEventListener('click', handleClick);
      editor.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleContentUpdate, updateToolbarState]);

  useEffect(() => {
    const handleSelectionChange = () => updateToolbarState();
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, [updateToolbarState]);

  useEffect(() => {
    if (!tagEditor) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (
        tagEditor &&
        !tagEditor.element.contains(target) &&
        !target.closest('.variable-tag-editor')
      ) {
        setTagEditor(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [tagEditor]);

  useEffect(() => {
    if (templateQuery.data && editorRef.current) {
      const html = templateQuery.data.content_editor_json
        ? jsonToHtml(templateQuery.data.content_editor_json)
        : templateQuery.data.content_html;
      editorRef.current.innerHTML = html;
      decorateVariableTags(editorRef.current);
      setContentHtml(html);
      setEditorJson(templateQuery.data.content_editor_json ?? htmlToJson(html));
      setIsDirty(false);
      updateToolbarState();
    } else if (isNew && editorRef.current) {
      editorRef.current.innerHTML = '<p></p>';
      setEditorJson(htmlToJson('<p></p>'));
      decorateVariableTags(editorRef.current);
      updateToolbarState();
    }
  }, [decorateVariableTags, isNew, templateQuery.data, updateToolbarState]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        setIsMetadataModalOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const focusEditor = () => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus({ preventScroll: true });
  };

  const executeCommand = (command: string, value?: string) => {
    focusEditor();
    document.execCommand(command, false, value);
    handleContentUpdate();
    updateToolbarState();
  };

  const handleAlignmentChange = (value: ToolbarAlignment) => {
    const commands: Record<ToolbarAlignment, string> = {
      left: 'justifyLeft',
      center: 'justifyCenter',
      right: 'justifyRight',
      justify: 'justifyFull',
    };
    executeCommand(commands[value]);
  };

  const handleBlockChange = (value: ToolbarBlock) => {
    const blockMap: Record<ToolbarBlock, string> = {
      paragraph: 'P',
      h1: 'H1',
      h2: 'H2',
      h3: 'H3',
    };
    executeCommand('formatBlock', blockMap[value]);
  };

  const handleFontSizeChange = (value: string) => {
    const size = value === 'default' ? '3' : value;
    executeCommand('fontSize', size);
    normalizeFontTags();
    handleContentUpdate();
  };

  const toggleHighlight = () => {
    focusEditor();
    const color = toolbarState.highlight ? 'transparent' : '#fef08a';
    document.execCommand('hiliteColor', false, color);
    handleContentUpdate();
    updateToolbarState();
  };

  const handleInsertImage = () => {
    const src = window.prompt('Informe a URL ou base64 da imagem:');
    if (!src) return;
    executeCommand('insertImage', src);
  };

  const handleInsertTable = () => {
    const rows = 3;
    const cols = 3;
    let html = '<table class="editor-table"><tbody>';
    for (let r = 0; r < rows; r += 1) {
      html += '<tr>';
      for (let c = 0; c < cols; c += 1) {
        html += '<td style="border:1px solid #d4d4d8;padding:8px;min-width:80px">&nbsp;</td>';
      }
      html += '</tr>';
    }
    html += '</tbody></table>';
    executeCommand('insertHTML', html);
  };

  const handleInsertVariable = (item: VariableMenuItem) => {
    const selection = document.getSelection();
    const editor = editorRef.current;
    if (!selection || !editor || selection.rangeCount === 0) return;
    focusEditor();
    const range = selection.getRangeAt(0);
    range.deleteContents();
    const span = document.createElement('span');
    span.className = 'variable-tag';
    span.setAttribute('data-variable', item.value);
    span.setAttribute('data-label', item.label);
    span.setAttribute('contenteditable', 'false');
    span.setAttribute('tabindex', '0');
    span.setAttribute('role', 'button');
    span.setAttribute('aria-label', `Editar rótulo para ${item.value}`);
    span.textContent = formatVariableLabel(item.value, item.label);
    range.insertNode(span);
    range.setStartAfter(span);
    range.setEndAfter(span);
    selection.removeAllRanges();
    selection.addRange(range);
    handleContentUpdate();
    updateToolbarState();
    focusSection('editor');
  };

  const handleMetadataConfirm = (values: MetadataFormValues) => {
    const editor = editorRef.current;
    if (!editor) return;
    const html = editor.innerHTML;
    const json = htmlToJson(html);
    setTitle(values.title);
    const payloadMetadata = {
      type: values.type,
      area: values.area,
      complexity: values.complexity,
      autoCreateClient: values.autoCreateClient,
      autoCreateProcess: values.autoCreateProcess,
      visibility: values.visibility,
    };
    setMetadata(payloadMetadata);
    const payload: TemplatePayload = {
      title: values.title,
      content_html: html,
      content_editor_json: json,
      metadata: payloadMetadata,
    };
    setEditorJson(json);
    saveMutation.mutate(payload);
    setIsMetadataModalOpen(false);
  };

  const focusSection = (section: 'editor' | 'metadata' | 'placeholders') => {
    setActiveSection(section);
    const refMap: Record<typeof section, React.RefObject<HTMLDivElement>> = {
      editor: editorSectionRef,
      metadata: metadataSectionRef,
      placeholders: placeholdersSectionRef,
    };
    refMap[section].current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (isMobile) {
      setMobileSidebarOpen(false);
    }
  };

  const handleGenerateAiContent = async () => {
    const promptText = aiPrompt.trim();
    if (!selectedIntegrationId) {
      toast({
        title: 'Nenhuma integração disponível',
        description: 'Cadastre ou ative uma integração de IA para utilizar este recurso.',
        variant: 'destructive',
      });
      return;
    }

    if (!promptText) {
      toast({
        title: 'Descreva o que precisa',
        description: 'Informe o objetivo do documento para que a IA possa gerar o texto.',
        variant: 'destructive',
      });
      return;
    }

    const documentTypeLabel =
      DOCUMENT_TYPE_OPTIONS.find(option => option.value === aiDocumentType)?.label ?? aiDocumentType;

    setIsGeneratingAiContent(true);

    try {
      const response = await generateAiText({
        integrationId: selectedIntegrationId,
        documentType: documentTypeLabel,
        prompt: promptText,
      });

      const editor = editorRef.current;
      if (editor) {
        editor.innerHTML = response.content;
        handleContentUpdate();
        updateToolbarState();
        focusSection('editor');
        focusEditor();
      }

      toast({
        title: 'Texto gerado com IA',
        description: `Conteúdo criado com ${API_KEY_PROVIDER_LABELS[response.provider]}.`,
      });

      setIsAiModalOpen(false);
      setAiPrompt('');
    } catch (error) {
      console.error('Failed to generate AI text', error);
      toast({
        title: 'Não foi possível gerar o texto',
        description:
          error instanceof Error
            ? error.message
            : 'Erro inesperado ao gerar o texto com IA.',
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingAiContent(false);
    }
  };

  const handleUndo = () => {
    focusEditor();
    document.execCommand('undo');
    handleContentUpdate();
    updateToolbarState();
  };

  const handleRedo = () => {
    focusEditor();
    document.execCommand('redo');
    handleContentUpdate();
    updateToolbarState();
  };

  const placeholderList = useMemo(() => extractPlaceholders(contentHtml), [contentHtml]);

  const metadataFormDefaults: MetadataFormValues = {
    title,
    type: metadata.type,
    area: metadata.area,
    complexity: metadata.complexity,
    autoCreateClient: metadata.autoCreateClient,
    autoCreateProcess: metadata.autoCreateProcess,
    visibility: metadata.visibility,
  };

  const handleTagEditorSubmit = (label: string) => {
    if (!tagEditor) return;
    const element = tagEditor.element;
    const variable = element.getAttribute('data-variable') ?? '';
    const formatted = formatVariableLabel(variable, label);
    element.setAttribute('data-label', label.trim());
    element.textContent = formatted;
    setTagEditor(null);
    handleContentUpdate();
  };

  return (
    <div className="flex min-h-screen bg-muted/20 text-foreground">
      <SidebarNavigation
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(prev => !prev)}
        activeSection={activeSection}
        onSelectSection={focusSection}
        onInsertVariable={handleInsertVariable}
        className="hidden md:flex"
      />

      <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetHeader className="px-4 py-4 text-left">
            <SheetTitle>Navegação</SheetTitle>
          </SheetHeader>
          <SidebarNavigation
            collapsed={false}
            onToggle={() => setMobileSidebarOpen(false)}
            activeSection={activeSection}
            onSelectSection={focusSection}
            onInsertVariable={handleInsertVariable}
            className="border-r-0"
          />
        </SheetContent>
      </Sheet>

      <div className="flex flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75">
          <div className="flex flex-col gap-3 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-1 items-center gap-2">
                {isMobile && (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => setMobileSidebarOpen(true)}
                    aria-label="Abrir navegação"
                  >
                    <Menu className="h-5 w-5" />
                  </Button>
                )}
                <div className="min-w-[200px] flex-1">
                  <Input
                    value={title}
                    placeholder="Título do modelo"
                    onChange={event => {
                      setTitle(event.target.value);
                      setIsDirty(true);
                    }}
                    className="text-lg font-semibold"
                    aria-label="Título do modelo"
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  className="gap-2"
                  onClick={() => setIsAiModalOpen(true)}
                  disabled={isAiButtonDisabled}
                  title={
                    !isLoadingAiIntegrations && !hasActiveAiIntegrations
                      ? 'Cadastre uma integração de IA nas configurações para ativar esta funcionalidade.'
                      : undefined
                  }
                >
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                  {isLoadingAiIntegrations ? 'Carregando IA...' : 'Gerar texto com IA'}
                </Button>
                <InsertMenu onSelect={handleInsertVariable} />
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
              {templateQuery.isLoading ? (
                <Skeleton className="h-[500px] w-full" />
              ) : (
                <div className="relative flex justify-center">
                  <div className="w-full max-w-[210mm]">
                    <div className="mx-auto min-h-[297mm] w-full max-w-[210mm] bg-card px-12 py-16 text-card-foreground shadow-lg">
                      <div
                        ref={editorRef}
                        className="wysiwyg-editor focus:outline-none"
                        contentEditable
                        role="textbox"
                        aria-multiline="true"
                        spellCheck
                        suppressContentEditableWarning
                      />
                    </div>
                  </div>
                </div>
              )}
              <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                <span>
                  Atalhos: Ctrl/⌘ + B (negrito), Ctrl/⌘ + I (itálico), Ctrl/⌘ + U (sublinhar), Ctrl/⌘ + S (salvar)
                </span>
                <Button variant="outline" onClick={() => setIsMetadataModalOpen(true)}>
                  Editar metadados
                </Button>
              </div>
            </div>
          </section>

          <section ref={metadataSectionRef} id="metadata" className="px-4 py-6">
            <div className="mx-auto max-w-[1100px]">
              <Card>
                <CardHeader className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <CardTitle>Metadados do modelo</CardTitle>
                  <Button size="sm" variant="ghost" onClick={() => setIsMetadataModalOpen(true)}>
                    Ajustar metadados
                  </Button>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">Tipo</p>
                    <p className="text-sm font-medium">{metadata.type}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">Área</p>
                    <p className="text-sm font-medium">{metadata.area || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">Complexidade</p>
                    <p className="text-sm font-medium">{metadata.complexity}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">Cadastrar cliente</p>
                    <p className="text-sm font-medium">{metadata.autoCreateClient ? 'Sim' : 'Não'}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">Cadastrar processo</p>
                    <p className="text-sm font-medium">{metadata.autoCreateProcess ? 'Sim' : 'Não'}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">Visibilidade</p>
                    <p className="text-sm font-medium">
                      {metadata.visibility === 'publico'
                        ? 'Público'
                        : metadata.visibility.charAt(0).toUpperCase() + metadata.visibility.slice(1)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>

          <section ref={placeholdersSectionRef} id="placeholders" className="px-4 py-6">
            <div className="mx-auto max-w-[1100px]">
              <Card>
                <CardHeader>
                  <CardTitle>Variáveis utilizadas</CardTitle>
                </CardHeader>
                <CardContent>
                  {placeholderList.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Insira placeholders pelo menu “Inserir” ou pela barra lateral para preencher dados automaticamente.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {placeholderList.map(variable => (
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

      {tagEditor && editorRef.current && (
        <div
          className="variable-tag-editor fixed z-50 rounded-md border bg-card p-3 shadow-lg"
          style={{
            top: `${tagEditor.element.getBoundingClientRect().bottom + 8}px`,
            left: `${tagEditor.element.getBoundingClientRect().left}px`,
          }}
        >
          <div className="flex items-center gap-2">
            <Input
              value={tagEditor.label}
              onChange={event => setTagEditor({ element: tagEditor.element, label: event.target.value })}
              onKeyDown={event => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  handleTagEditorSubmit(tagEditor.label);
                }
                if (event.key === 'Escape') {
                  event.preventDefault();
                  setTagEditor(null);
                }
              }}
              autoFocus
              className="h-9 w-48"
            />
            <Button type="button" size="sm" onClick={() => handleTagEditorSubmit(tagEditor.label)}>
              Salvar
            </Button>
          </div>
        </div>
      )}

      <Dialog
        open={isAiModalOpen}
        onOpenChange={open => {
          if (!open && isGeneratingAiContent) {
            return;
          }
          setIsAiModalOpen(open);
          if (!open) {
            setAiPrompt('');
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Gerar texto com IA</DialogTitle>
            <DialogDescription>
              Utilize uma integração cadastrada para criar um rascunho inicial do documento.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ai-integration">Integração de IA</Label>
              {hasActiveAiIntegrations ? (
                <Select
                  value={selectedIntegrationId ? String(selectedIntegrationId) : undefined}
                  onValueChange={value => setSelectedIntegrationId(Number(value))}
                  disabled={isGeneratingAiContent}
                >
                  <SelectTrigger id="ai-integration">
                    <SelectValue placeholder="Selecione a integração" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeAiIntegrations.map(integration => (
                      <SelectItem key={integration.id} value={integration.id.toString()}>
                        {API_KEY_PROVIDER_LABELS[integration.provider]} •{' '}
                        {integration.environment === 'producao' ? 'Produção' : 'Homologação'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
                  Cadastre uma integração de IA em Configurações &gt; Integrações para utilizar este recurso.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="ai-document-type">Tipo de documento</Label>
              <Select
                value={aiDocumentType}
                onValueChange={value => setAiDocumentType(value)}
                disabled={isGeneratingAiContent}
              >
                <SelectTrigger id="ai-document-type">
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_TYPE_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ai-prompt">O que o texto deve abordar?</Label>
              <Textarea
                id="ai-prompt"
                value={aiPrompt}
                onChange={event => setAiPrompt(event.target.value)}
                placeholder="Descreva o contexto, o objetivo e os pontos essenciais do documento."
                rows={6}
                disabled={isGeneratingAiContent}
              />
              <p className="text-xs text-muted-foreground">
                Quanto mais detalhes você fornecer, mais completo será o rascunho gerado.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (isGeneratingAiContent) return;
                setIsAiModalOpen(false);
                setAiPrompt('');
              }}
              disabled={isGeneratingAiContent}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleGenerateAiContent}
              disabled={
                isGeneratingAiContent || !selectedIntegrationId || aiPrompt.trim().length === 0
              }
            >
              {isGeneratingAiContent ? 'Gerando...' : 'Gerar texto'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MetadataModal
        open={isMetadataModalOpen}
        onOpenChange={setIsMetadataModalOpen}
        defaultValues={metadataFormDefaults}
        onConfirm={handleMetadataConfirm}
        isSaving={saveMutation.isPending}
      />

      <SaveButton onClick={() => setIsMetadataModalOpen(true)} disabled={saveMutation.isPending} isDirty={isDirty} />
    </div>
  );
}
