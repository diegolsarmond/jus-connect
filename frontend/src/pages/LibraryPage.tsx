import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ExternalLink, Pencil, Trash2, Download, FilePlus2, Loader2 } from 'lucide-react';
import { fetchTemplates, deleteTemplate, updateTemplate, exportTemplatePdf } from '@/lib/templates';
import { createDocxBlobFromHtml } from '@/lib/docx';
import type { Template } from '@/types/templates';
import type { TemplatePayload } from '@/types/templates';

type ExportFormat = 'pdf' | 'docx';

const INVALID_FILENAME_CHARS = /[<>:"/\\|?*]/g;
const CONTROL_CHARACTER_RANGE = `${String.fromCharCode(0)}-${String.fromCharCode(31)}`;
const CONTROL_CHARACTERS_PATTERN = new RegExp(`[${CONTROL_CHARACTER_RANGE}]`, 'g');

function buildFileName(rawTitle: string | undefined, extension: ExportFormat): string {
  const fallback = `modelo.${extension}`;
  if (!rawTitle) {
    return fallback;
  }

  const cleaned = rawTitle
    .replace(CONTROL_CHARACTERS_PATTERN, ' ')
    .replace(INVALID_FILENAME_CHARS, ' ')
    .trim();
  const normalized = cleaned.replace(/\s+/g, ' ');

  const truncated = normalized.slice(0, 100);
  const baseName = truncated.length > 0 ? truncated : 'modelo';
  const withoutTrailingDots = baseName.replace(/\.+$/, '') || 'modelo';
  return `${withoutTrailingDots.replace(/\s+/g, '-')}.${extension}`;
}

function triggerDownloadFromUrl(url: string, fileName: string) {
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  try {
    triggerDownloadFromUrl(url, fileName);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function getSnippet(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
}

export default function LibraryPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: templates, isLoading } = useQuery({ queryKey: ['templates'], queryFn: fetchTemplates });

  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'todos' | string>('todos');
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [exporting, setExporting] = useState<{ id: number; format: ExportFormat } | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteTemplate(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['templates'] }),
  });

  const renameMutation = useMutation({
    mutationFn: ({ template, title }: { template: Template; title: string }) => {
      const payload: TemplatePayload = {
        title,
        content_html: template.content_html,
        content_editor_json: template.content_editor_json,
        metadata: template.metadata,
      };
      return updateTemplate(template.id, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      setRenamingId(null);
    },
  });

  const typeOptions = useMemo(() => {
    const options = new Set<string>();
    templates?.forEach(template => {
      if (template.metadata.type) {
        options.add(template.metadata.type);
      }
    });
    return Array.from(options);
  }, [templates]);

  const filteredTemplates = useMemo(() => {
    return (
      templates?.filter(template => {
        const matchesSearch = template.title.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = typeFilter === 'todos' || template.metadata.type === typeFilter;
        return matchesSearch && matchesType;
      }) ?? []
    );
  }, [templates, searchTerm, typeFilter]);

  async function handleExportPdf(template: Template) {
    const previewWindow = window.open('', '_blank', 'noopener,noreferrer');
    const fileName = buildFileName(template.title, 'pdf');
    try {
      setExporting({ id: template.id, format: 'pdf' });
      const blob = await exportTemplatePdf(template.id);
      const url = URL.createObjectURL(blob);

      if (previewWindow) {
        previewWindow.document.title = fileName;
        previewWindow.location.href = url;
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      } else {
        triggerDownloadFromUrl(url, fileName);
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Erro ao exportar modelo em PDF', error);
      if (previewWindow) {
        previewWindow.close();
      }
    } finally {
      setExporting(null);
    }
  }

  function handleExportDocx(template: Template) {
    try {
      setExporting({ id: template.id, format: 'docx' });
      const htmlContent = template.content_html || '<p></p>';
      const blob = createDocxBlobFromHtml(htmlContent);
      downloadBlob(blob, buildFileName(template.title, 'docx'));
    } catch (error) {
      console.error('Erro ao exportar modelo em DOCX', error);
    } finally {
      setExporting(null);
    }
  }

  function handleStartRename(template: Template) {
    setRenamingId(template.id);
    setRenameValue(template.title);
  }

  function handleRenameConfirm(template: Template) {
    const trimmed = renameValue.trim();
    if (!trimmed) {
      setRenameValue(template.title);
      setRenamingId(null);
      return;
    }
    if (trimmed === template.title) {
      setRenamingId(null);
      return;
    }
    renameMutation.mutate({ template, title: trimmed });
  }

  return (
    <div className="space-y-6 px-6 py-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Modelos de documento</h1>
          <p className="text-muted-foreground">Organize, busque e gerencie seus modelos prontos para uso.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => navigate('/documentos/editor/novo')}>
            Em branco
          </Button>
          <Button onClick={() => navigate('/documentos/editor/novo', { state: { openMetadata: true } })}>
            <FilePlus2 className="mr-2 h-4 w-4" />
            Criar novo modelo
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-4 rounded-md border bg-card p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="flex w-full max-w-xl items-center gap-3">
          <Input
            value={searchTerm}
            onChange={event => setSearchTerm(event.target.value)}
            placeholder="Buscar por nome"
            aria-label="Buscar modelo"
          />
        </div>
        <div className="flex items-center gap-3">
          <Select value={typeFilter} onValueChange={value => setTypeFilter(value)}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filtrar por tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os tipos</SelectItem>
              {typeOptions.map(option => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-[320px] w-full" />
          ))}
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="rounded-md border border-dashed bg-muted/30 p-12 text-center">
          <p className="text-lg font-semibold">Nenhum modelo encontrado</p>
          <p className="text-sm text-muted-foreground">
            Ajuste os filtros ou crie um novo modelo para começar a sua biblioteca.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {filteredTemplates.map(template => (
            <Card key={template.id} className="flex flex-col">
              <CardHeader className="pb-4">
                {renamingId === template.id ? (
                  <Input
                    value={renameValue}
                    onChange={event => setRenameValue(event.target.value)}
                    onBlur={() => handleRenameConfirm(template)}
                    onKeyDown={event => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        handleRenameConfirm(template);
                      }
                      if (event.key === 'Escape') {
                        event.preventDefault();
                        setRenamingId(null);
                        setRenameValue(template.title);
                      }
                    }}
                    disabled={renameMutation.isPending}
                    aria-label="Renomear modelo"
                    className="text-lg font-semibold"
                    autoFocus
                  />
                ) : (
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-lg">{template.title}</CardTitle>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleStartRename(template)}
                          aria-label="Renomear modelo"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Renomear</TooltipContent>
                    </Tooltip>
                  </div>
                )}
                <p className="text-sm text-muted-foreground">{template.metadata.area || 'Área não definida'}</p>
              </CardHeader>
              <CardContent className="flex-1 space-y-4">
                <div className="rounded-md border bg-background/70 p-2">
                  <div className="relative h-48 overflow-hidden rounded-sm bg-white">
                    <div
                      className="pointer-events-none origin-top-left scale-[0.35] transform"
                      style={{ width: '210mm', minHeight: '297mm' }}
                      dangerouslySetInnerHTML={{ __html: template.content_html || '<p>Modelo sem conteúdo</p>' }}
                    />
                  </div>
                </div>
                <p
                  className="text-sm text-muted-foreground"
                  style={{
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {getSnippet(template.content_html)}...
                </p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{template.metadata.type}</Badge>
                  {template.metadata.complexity && (
                    <Badge variant="outline">Complexidade: {template.metadata.complexity}</Badge>
                  )}
                  {template.metadata.visibility && (
                    <Badge variant="outline">
                      Visibilidade:{' '}
                      {template.metadata.visibility === 'publico'
                        ? 'Público'
                        : template.metadata.visibility.charAt(0).toUpperCase() + template.metadata.visibility.slice(1)}
                    </Badge>
                  )}
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-3">
                <div className="flex w-full flex-wrap justify-between gap-2">
                  <Button variant="default" onClick={() => navigate(`/documentos/editor/${template.id}`)}>
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Abrir
                  </Button>
                  <div className="flex items-center gap-2">
                    <DropdownMenu>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              disabled={exporting?.id === template.id}
                              aria-label="Opções de download"
                            >
                              {exporting?.id === template.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Download className="h-4 w-4" />
                              )}
                            </Button>
                          </DropdownMenuTrigger>
                        </TooltipTrigger>
                        <TooltipContent>Download</TooltipContent>
                      </Tooltip>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem
                          onClick={() => void handleExportPdf(template)}
                          disabled={exporting?.id === template.id}
                        >
                          Abrir PDF em nova aba
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleExportDocx(template)}
                          disabled={exporting?.id === template.id}
                        >
                          Baixar DOCX
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (window.confirm('Deseja realmente excluir este modelo?')) {
                              deleteMutation.mutate(template.id);
                            }
                          }}
                          disabled={deleteMutation.isPending}
                          aria-label="Excluir modelo"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Excluir</TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
