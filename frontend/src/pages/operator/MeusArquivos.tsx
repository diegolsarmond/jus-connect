import { useMemo, useState } from "react";
import {
  Folder,
  FileText,
  HardDrive,
  Upload,
  FolderPlus,
  Share2,
  Server,
  ShieldCheck,
  ChevronRight,
  Link,
  Clock,
  User,
  Copy,
  LayoutGrid,
  List,
  Globe,
  Cloud,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

interface FolderNode {
  id: string;
  name: string;
  description?: string;
  items?: number;
  children?: FolderNode[];
}

interface FileItem {
  id: string;
  name: string;
  type: "folder" | "file";
  size: number;
  updatedAt: string;
  owner: string;
  sharedWith: string[];
  status: "online" | "sincronizando" | "offline";
  folderPath: string[];
  tags?: string[];
}

interface ShareLink {
  id: string;
  name: string;
  audience: string;
  expiresIn: string;
  permissions: string;
  status: "ativo" | "expirado";
}

const folderTree: FolderNode[] = [
  {
    id: "clientes",
    name: "Clientes",
    description: "Contratos, documentos, petições",
    items: 126,
    children: [
      { id: "clientes/vip", name: "VIP", items: 18 },
      { id: "clientes/andamento", name: "Em andamento", items: 64 },
      { id: "clientes/arquivados", name: "Arquivados", items: 44 },
    ],
  },
  {
    id: "financeiro",
    name: "Financeiro",
    description: "Relatórios, notas fiscais",
    items: 58,
    children: [
      { id: "financeiro/fiscal", name: "Fiscal", items: 22 },
      { id: "financeiro/relatorios", name: "Relatórios", items: 17 },
      { id: "financeiro/contratos", name: "Contratos", items: 19 },
    ],
  },
  {
    id: "juridico",
    name: "Jurídico",
    description: "Peças processuais, modelos",
    items: 204,
    children: [
      { id: "juridico/contestacoes", name: "Contestações", items: 41 },
      { id: "juridico/recursos", name: "Recursos", items: 37 },
      { id: "juridico/modelos", name: "Modelos", items: 126 },
    ],
  },
  {
    id: "marketing",
    name: "Marketing",
    description: "Materiais e campanhas",
    items: 33,
  },
];

const ftpAccess = {
  host: "ftp.jusconnect.app",
  port: 21,
  user: "workspace@jusconnect.app",
  root: "/cloud/workspaces/justica",
  secure: true,
};

const shareLinks: ShareLink[] = [
  {
    id: "link-clientes",
    name: "Área compartilhada clientes premium",
    audience: "Clientes VIP",
    expiresIn: "Expira em 2 dias",
    permissions: "Somente leitura",
    status: "ativo",
  },
  {
    id: "link-financeiro",
    name: "Dossiê mensal escrituração",
    audience: "Contabilidade Externa",
    expiresIn: "Expira em 7 dias",
    permissions: "Upload habilitado",
    status: "ativo",
  },
  {
    id: "link-arquivados",
    name: "Pasta compartilhada com tribunal",
    audience: "TJSP",
    expiresIn: "Expirado",
    permissions: "Somente leitura",
    status: "expirado",
  },
];

const fileItems: FileItem[] = [
  {
    id: "clientes",
    name: "Clientes",
    type: "folder",
    size: 0,
    updatedAt: "Hoje, 08:15",
    owner: "Você",
    sharedWith: ["Equipe Comercial"],
    status: "online",
    folderPath: ["Raiz"],
    tags: ["colaboração"],
  },
  {
    id: "relatorio-financeiro.pdf",
    name: "Relatorio-financeiro-2024.pdf",
    type: "file",
    size: 18_432_000,
    updatedAt: "Ontem, 18:22",
    owner: "Ana Paula",
    sharedWith: ["Financeiro", "Diretoria"],
    status: "sincronizando",
    folderPath: ["Raiz", "Financeiro"],
    tags: ["confidencial"],
  },
  {
    id: "peticao-inicial.docx",
    name: "Peticao-inicial-Case-8942.docx",
    type: "file",
    size: 2_536_000,
    updatedAt: "12 Nov, 13:05",
    owner: "Marcos Silva",
    sharedWith: ["Jurídico"],
    status: "online",
    folderPath: ["Raiz", "Jurídico", "Contestações"],
    tags: ["andamento"],
  },
  {
    id: "clientes-vip",
    name: "Clientes VIP",
    type: "folder",
    size: 0,
    updatedAt: "8 Nov, 09:42",
    owner: "Você",
    sharedWith: ["Consultores"],
    status: "online",
    folderPath: ["Raiz", "Clientes"],
    tags: ["prioridade"],
  },
  {
    id: "auditoria.zip",
    name: "Auditoria-processual-2024.zip",
    type: "file",
    size: 754_000_000,
    updatedAt: "2 Nov, 22:11",
    owner: "Carla Mendes",
    sharedWith: ["Compliance"],
    status: "offline",
    folderPath: ["Raiz", "Jurídico", "Modelos"],
  },
];

const viewFilters = [
  { id: "todos", label: "Todos" },
  { id: "recentes", label: "Recentes" },
  { id: "compartilhados", label: "Compartilhados" },
  { id: "favoritos", label: "Favoritos" },
  { id: "offline", label: "Disponível offline" },
];

const storageUsage = {
  used: 412,
  total: 1024,
};

const quickShortcuts = [
  {
    id: "compartilhar",
    title: "Compartilhar pasta",
    description: "Gere um link seguro para um cliente ou parceiro",
    icon: Share2,
    actionLabel: "Gerar link",
  },
  {
    id: "credenciais",
    title: "Credenciais FTP",
    description: "Envie os dados de conexão para um colaborador",
    icon: Server,
    actionLabel: "Copiar dados",
  },
  {
    id: "auditoria",
    title: "Auditoria de acessos",
    description: "Monitore uploads e downloads recentes",
    icon: ShieldCheck,
    actionLabel: "Abrir relatório",
  },
];

const formatSize = (bytes: number) => {
  if (!bytes) return "-";
  const units = ["B", "KB", "MB", "GB", "TB"] as const;
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
};

const storagePercent = Math.round((storageUsage.used / storageUsage.total) * 100);

export default function MeusArquivos() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState<string>("todos");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [activeFolder, setActiveFolder] = useState<string[]>(["Raiz"]);

  const breadcrumbs = useMemo(() => {
    return activeFolder.map((segment, index) => ({
      label: segment,
      path: activeFolder.slice(0, index + 1),
    }));
  }, [activeFolder]);

  const filteredFiles = useMemo(() => {
    return fileItems.filter((item) => {
      const matchesFolder = item.folderPath.every((segment, index) => activeFolder[index] === segment);
      const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());

      let matchesFilter = true;
      if (filter === "compartilhados") {
        matchesFilter = item.sharedWith.length > 0;
      }
      if (filter === "offline") {
        matchesFilter = item.status === "offline";
      }
      if (filter === "recentes") {
        matchesFilter = item.updatedAt.toLowerCase().includes("hoje") || item.updatedAt.toLowerCase().includes("ontem");
      }
      if (filter === "favoritos") {
        matchesFilter = item.tags?.includes("prioridade") ?? false;
      }

      return matchesFolder && matchesSearch && matchesFilter;
    });
  }, [activeFolder, filter, searchTerm]);

  const handleNavigateFolder = (path: string[]) => {
    setActiveFolder(path);
  };

  const handleOpenFolder = (item: FileItem) => {
    if (item.type === "folder") {
      setActiveFolder([...item.folderPath, item.name]);
    }
  };

  const isActiveFolder = (path: string[]) => {
    if (path.length !== activeFolder.length) return false;
    return path.every((segment, index) => segment === activeFolder[index]);
  };

  return (
    <div className="space-y-6 px-6 py-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold">Meus arquivos</h1>
          <p className="text-muted-foreground">
            Organize, compartilhe e acompanhe o armazenamento do seu escritório com conexão FTP dedicada.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline">
            <FolderPlus className="mr-2 h-4 w-4" />
            Nova pasta
          </Button>
          <Button>
            <Upload className="mr-2 h-4 w-4" />
            Upload de arquivos
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px,1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader className="space-y-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Conexão rápida FTP</CardTitle>
                <Badge variant={ftpAccess.secure ? "default" : "secondary"} className="gap-1">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {ftpAccess.secure ? "FTPS ativo" : "FTP"}
                </Badge>
              </div>
              <CardDescription>
                Utilize qualquer cliente FTP para sincronizar grandes volumes de dados com o workspace.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3">
                <label className="text-xs font-medium uppercase text-muted-foreground">Servidor</label>
                <Input value={`${ftpAccess.host}:${ftpAccess.port}`} readOnly className="font-mono text-sm" />
              </div>
              <div className="grid gap-3">
                <label className="text-xs font-medium uppercase text-muted-foreground">Usuário</label>
                <Input value={ftpAccess.user} readOnly className="font-mono text-sm" />
              </div>
              <div className="grid gap-3">
                <label className="text-xs font-medium uppercase text-muted-foreground">Diretório raiz</label>
                <Input value={ftpAccess.root} readOnly className="font-mono text-sm" />
              </div>
            </CardContent>
            <CardFooter className="flex flex-wrap items-center justify-between gap-3">
              <Button size="sm" variant="outline" className="gap-2">
                <Copy className="h-4 w-4" />
                Copiar credenciais
              </Button>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Server className="h-3.5 w-3.5" />
                Conexão ativa nas últimas 2h
              </div>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader className="space-y-1">
              <CardTitle className="text-base">Estrutura de pastas</CardTitle>
              <CardDescription>Selecione a área para explorar os arquivos disponíveis.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {folderTree.map((folder) => (
                <div key={folder.id} className="space-y-3 rounded-lg border p-3">
                  <button
                    type="button"
                    onClick={() => handleNavigateFolder(["Raiz", folder.name])}
                    className={cn(
                      "flex w-full items-start justify-between gap-2 text-left",
                      isActiveFolder(["Raiz", folder.name]) ? "text-primary" : "hover:text-primary",
                    )}
                  >
                    <div className="flex flex-1 items-start gap-3">
                      <div className="mt-1 rounded-md bg-muted p-2">
                        <Folder className="h-4 w-4" />
                      </div>
                      <div className="space-y-1">
                        <p className="font-medium leading-none">{folder.name}</p>
                        {folder.description ? (
                          <p className="text-xs text-muted-foreground">{folder.description}</p>
                        ) : null}
                      </div>
                    </div>
                    <Badge variant="secondary">{folder.items ?? 0} itens</Badge>
                  </button>
                  {folder.children ? (
                    <div className="space-y-2 pl-11">
                      {folder.children.map((child) => (
                        <button
                          key={child.id}
                          type="button"
                          onClick={() => handleNavigateFolder(["Raiz", folder.name, child.name])}
                          className={cn(
                            "flex w-full items-center justify-between gap-2 rounded-md px-2 py-1 text-left text-sm",
                            isActiveFolder(["Raiz", folder.name, child.name])
                              ? "bg-primary/10 text-primary"
                              : "hover:bg-muted",
                          )}
                        >
                          <span className="flex items-center gap-2">
                            <ChevronRight className="h-3.5 w-3.5" />
                            {child.name}
                          </span>
                          <span className="text-xs text-muted-foreground">{child.items ?? 0}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-start justify-between">
              <div>
                <CardTitle className="text-base">Compartilhamentos ativos</CardTitle>
                <CardDescription>Acompanhe os acessos liberados para clientes e parceiros.</CardDescription>
              </div>
              <Badge variant="outline" className="gap-1">
                <Globe className="h-3.5 w-3.5" />
                {shareLinks.filter((link) => link.status === "ativo").length} ativos
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              {shareLinks.map((link) => (
                <div key={link.id} className="space-y-2 rounded-lg border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{link.name}</p>
                      <p className="text-xs text-muted-foreground">{link.audience}</p>
                    </div>
                    <Badge
                      variant={link.status === "ativo" ? "default" : "secondary"}
                      className={cn(link.status === "expirado" && "bg-muted text-muted-foreground")}
                    >
                      {link.status === "ativo" ? "Ativo" : "Expirado"}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {link.expiresIn}
                    </span>
                    <span className="flex items-center gap-1">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      {link.permissions}
                    </span>
                  </div>
                  <Button size="sm" variant="ghost" className="gap-2">
                    <Link className="h-4 w-4" />
                    Copiar link seguro
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="space-y-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <Breadcrumb>
                  <BreadcrumbList>
                    {breadcrumbs.map((crumb, index) => (
                      <BreadcrumbItem key={crumb.label}>
                        <BreadcrumbLink
                          asChild
                          onClick={(event) => {
                            event.preventDefault();
                            handleNavigateFolder(crumb.path);
                          }}
                        >
                          <button type="button" className="text-sm text-muted-foreground hover:text-primary">
                            {crumb.label}
                          </button>
                        </BreadcrumbLink>
                        {index < breadcrumbs.length - 1 ? <BreadcrumbSeparator /> : null}
                      </BreadcrumbItem>
                    ))}
                  </BreadcrumbList>
                </Breadcrumb>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant={viewMode === "list" ? "default" : "ghost"}
                    onClick={() => setViewMode("list")}
                  >
                    <List className="mr-2 h-4 w-4" />
                    Lista
                  </Button>
                  <Button
                    size="sm"
                    variant={viewMode === "grid" ? "default" : "ghost"}
                    onClick={() => setViewMode("grid")}
                  >
                    <LayoutGrid className="mr-2 h-4 w-4" />
                    Grade
                  </Button>
                </div>
              </div>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-4">
                <div className="flex-1">
                  <Input
                    placeholder="Buscar arquivos ou pastas"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                  />
                </div>
                <Select value={filter} onValueChange={setFilter}>
                  <SelectTrigger className="w-full lg:w-[200px]">
                    <SelectValue placeholder="Filtrar" />
                  </SelectTrigger>
                  <SelectContent>
                    {viewFilters.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {viewMode === "list" ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[200px]">Nome</TableHead>
                      <TableHead>Proprietário</TableHead>
                      <TableHead>Compartilhado com</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Tamanho</TableHead>
                      <TableHead>Atualizado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredFiles.map((item) => (
                      <TableRow
                        key={item.id}
                        className="cursor-pointer"
                        onClick={() => handleOpenFolder(item)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div
                              className={cn(
                                "flex h-10 w-10 items-center justify-center rounded-md border",
                                item.type === "folder" ? "bg-primary/10 text-primary" : "bg-muted",
                              )}
                            >
                              {item.type === "folder" ? (
                                <Folder className="h-4 w-4" />
                              ) : (
                                <FileText className="h-4 w-4" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium leading-none">{item.name}</p>
                              <div className="flex flex-wrap gap-2 pt-1">
                                {item.tags?.map((tag) => (
                                  <Badge key={tag} variant="outline" className="text-xs">
                                    {tag}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{item.owner}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          <div className="flex flex-wrap gap-1">
                            {item.sharedWith.map((group) => (
                              <Badge key={group} variant="secondary">
                                {group}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              item.status === "online"
                                ? "default"
                                : item.status === "sincronizando"
                                  ? "outline"
                                  : "secondary"
                            }
                          >
                            {item.status === "sincronizando"
                              ? "Sincronizando"
                              : item.status === "offline"
                                ? "Offline"
                                : "Disponível"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">
                          {item.type === "folder" ? "-" : formatSize(item.size)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{item.updatedAt}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {filteredFiles.map((item) => (
                    <Card
                      key={item.id}
                      className="cursor-pointer transition hover:shadow-md"
                      onClick={() => handleOpenFolder(item)}
                    >
                      <CardContent className="space-y-4 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div
                            className={cn(
                              "flex h-10 w-10 items-center justify-center rounded-md border",
                              item.type === "folder" ? "bg-primary/10 text-primary" : "bg-muted",
                            )}
                          >
                            {item.type === "folder" ? (
                              <Folder className="h-4 w-4" />
                            ) : (
                              <FileText className="h-4 w-4" />
                            )}
                          </div>
                          <Badge
                            variant={
                              item.status === "online"
                                ? "default"
                                : item.status === "sincronizando"
                                  ? "outline"
                                  : "secondary"
                            }
                          >
                            {item.status === "sincronizando"
                              ? "Sincronizando"
                              : item.status === "offline"
                                ? "Offline"
                                : "Disponível"}
                          </Badge>
                        </div>
                        <div>
                          <p className="font-semibold leading-tight">{item.name}</p>
                          <p className="text-xs text-muted-foreground">{item.updatedAt}</p>
                        </div>
                        <Separator />
                        <div className="space-y-2 text-xs text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <User className="h-3.5 w-3.5" />
                            {item.owner}
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {item.sharedWith.map((group) => (
                              <Badge key={group} variant="secondary">
                                {group}
                              </Badge>
                            ))}
                          </div>
                          <div>Tamanho: {item.type === "folder" ? "-" : formatSize(item.size)}</div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card className="md:col-span-2">
              <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-base">Uso de armazenamento</CardTitle>
                  <CardDescription>Monitore quanto espaço está sendo utilizado e disponível.</CardDescription>
                </div>
                <Badge variant="secondary" className="gap-1">
                  <HardDrive className="h-3.5 w-3.5" />
                  {storageUsage.used} GB de {storageUsage.total} GB
                </Badge>
              </CardHeader>
              <CardContent className="space-y-3">
                <Progress value={storagePercent} />
                <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                  <span>{storagePercent}% utilizado</span>
                  <span>Sincronização automática ativa</span>
                </div>
              </CardContent>
            </Card>

            {quickShortcuts.map((shortcut) => (
              <Card key={shortcut.id} className="border-dashed">
                <CardHeader className="flex flex-row items-start gap-3">
                  <div className="rounded-md bg-primary/10 p-2 text-primary">
                    <shortcut.icon className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle className="text-base leading-tight">{shortcut.title}</CardTitle>
                    <CardDescription>{shortcut.description}</CardDescription>
                  </div>
                </CardHeader>
                <CardFooter>
                  <Button variant="ghost" className="gap-2 px-0">
                    <ChevronRight className="h-4 w-4" />
                    {shortcut.actionLabel}
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Próximos passos</CardTitle>
              <CardDescription>
                Configure permissões e fluxos de automação para transformar o FTP em um portal de colaboração.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 rounded-lg border p-4">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Cloud className="h-4 w-4" />
                  Integração com armazenamento em nuvem
                </div>
                <p className="text-xs text-muted-foreground">
                  Conecte um bucket S3 ou Azure Blob para receber os arquivos enviados via FTP automaticamente.
                </p>
              </div>
              <div className="space-y-2 rounded-lg border p-4">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Share2 className="h-4 w-4" />
                  Portais de clientes com acesso controlado
                </div>
                <p className="text-xs text-muted-foreground">
                  Defina permissões de leitura e upload por pasta para disponibilizar documentos aos clientes.
                </p>
              </div>
              <div className="space-y-2 rounded-lg border p-4">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <ShieldCheck className="h-4 w-4" />
                  Logs e trilhas de auditoria detalhadas
                </div>
                <p className="text-xs text-muted-foreground">
                  Receba alertas em tempo real sobre uploads suspeitos e rastreie downloads por usuário.
                </p>
              </div>
              <div className="space-y-2 rounded-lg border p-4">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Server className="h-4 w-4" />
                  Mapeamento em rede local
                </div>
                <p className="text-xs text-muted-foreground">
                  Permita que a equipe acesse a pasta raiz como um disco de rede interno com sincronização automática.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

