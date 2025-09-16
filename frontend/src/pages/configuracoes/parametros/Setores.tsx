import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { getApiBaseUrl } from "@/lib/api";
import { toast } from "@/components/ui/use-toast";

interface ApiSetor {
  id: number | string;
  nome?: string;
  empresa?: number | string | null;
  empresa_nome?: string | null;
  ativo?: boolean;
  datacriacao?: string | null;
}

interface ApiEmpresa {
  id: number | string;
  nome_empresa?: string;
}

interface EmpresaOption {
  id: number;
  nome: string;
}

interface Setor {
  id: number;
  nome: string;
  empresaId: number | null;
  empresaNome: string;
  ativo: boolean;
  datacriacao?: string;
}

interface SetorFormState {
  nome: string;
  empresaId: string;
  ativo: boolean;
}

const apiUrl = getApiBaseUrl();
const endpointBase = "/api/setores";

const emptyForm: SetorFormState = {
  nome: "",
  empresaId: "",
  ativo: true,
};

function joinUrl(base: string, path = "") {
  const b = base.replace(/\/+$/, "");
  const p = path ? (path.startsWith("/") ? path : `/${path}`) : "";
  return `${b}${p}`;
}

function parseArray<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.rows)) return obj.rows as T[];
    if (obj.data) {
      const data = obj.data as unknown;
      if (Array.isArray(data)) return data as T[];
      if (data && typeof data === "object" && Array.isArray((data as Record<string, unknown>).rows)) {
        return (data as Record<string, unknown>).rows as T[];
      }
    }
  }
  return [];
}

export default function Setores() {
  const [setores, setSetores] = useState<Setor[]>([]);
  const [empresas, setEmpresas] = useState<EmpresaOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSetor, setEditingSetor] = useState<Setor | null>(null);
  const [formState, setFormState] = useState<SetorFormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [setorToDelete, setSetorToDelete] = useState<Setor | null>(null);
  const [deleting, setDeleting] = useState(false);

  const empresaMap = useMemo(() => {
    const map = new Map<number, string>();
    empresas.forEach((empresa) => {
      map.set(empresa.id, empresa.nome);
    });
    return map;
  }, [empresas]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setErrorMsg(null);
      try {
        const [empresasRes, setoresRes] = await Promise.all([
          fetch(joinUrl(apiUrl, "/api/empresas"), { headers: { Accept: "application/json" } }),
          fetch(joinUrl(apiUrl, endpointBase), { headers: { Accept: "application/json" } }),
        ]);

        if (!empresasRes.ok) {
          throw new Error(`HTTP ${empresasRes.status}: ${await empresasRes.text()}`);
        }
        if (!setoresRes.ok) {
          throw new Error(`HTTP ${setoresRes.status}: ${await setoresRes.text()}`);
        }

        const empresasData = parseArray<ApiEmpresa>(await empresasRes.json()).map((empresa) => ({
          id: Number(empresa.id),
          nome: empresa.nome_empresa ?? "",
        }));
        setEmpresas(empresasData);

        const mapEmpresas = new Map<number, string>();
        empresasData.forEach((empresa) => mapEmpresas.set(empresa.id, empresa.nome));

        const setoresData = parseArray<ApiSetor>(await setoresRes.json()).map((setor) => mapApiSetorToSetor(setor, mapEmpresas));
        setSetores(sortSetores(setoresData));
      } catch (error) {
        console.error(error);
        setErrorMsg("Não foi possível carregar os setores.");
        setSetores([]);
        setEmpresas([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const openCreateDialog = () => {
    setEditingSetor(null);
    setFormState(emptyForm);
    setFormError(null);
    setDialogOpen(true);
  };

  const openEditDialog = (setor: Setor) => {
    setEditingSetor(setor);
    setFormState({
      nome: setor.nome,
      empresaId: setor.empresaId != null ? setor.empresaId.toString() : "",
      ativo: setor.ativo,
    });
    setFormError(null);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    if (saving) return;
    setDialogOpen(false);
    setEditingSetor(null);
    setFormState(emptyForm);
    setFormError(null);
  };

  const handleSubmit = async () => {
    const nome = formState.nome.trim();
    if (!nome) {
      setFormError("Nome é obrigatório");
      return;
    }

    const empresaId = formState.empresaId ? Number(formState.empresaId) : null;
    const payload = {
      nome,
      empresa: empresaId,
      ativo: formState.ativo,
    };

    setSaving(true);
    setFormError(null);

    try {
      const url = editingSetor
        ? joinUrl(apiUrl, `${endpointBase}/${editingSetor.id}`)
        : joinUrl(apiUrl, endpointBase);
      const response = await fetch(url, {
        method: editingSetor ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }
      const data = await response.json();
      const setor = mapApiSetorToSetor(data, empresaMap);

      setSetores((prev) => {
        const updated = editingSetor
          ? prev.map((item) => (item.id === editingSetor.id ? setor : item))
          : [...prev, setor];
        return sortSetores(updated);
      });

      toast({
        title: editingSetor ? "Setor atualizado" : "Setor criado",
        description: editingSetor
          ? "As informações do setor foram atualizadas com sucesso."
          : "Novo setor cadastrado com sucesso.",
      });

      closeDialog();
    } catch (error) {
      console.error(error);
      setFormError("Não foi possível salvar o setor.");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (setor: Setor) => {
    setSetorToDelete(setor);
  };

  const cancelDelete = () => {
    if (deleting) return;
    setSetorToDelete(null);
  };

  const handleDelete = async () => {
    if (!setorToDelete) return;
    setDeleting(true);
    setErrorMsg(null);
    try {
      const url = joinUrl(apiUrl, `${endpointBase}/${setorToDelete.id}`);
      const response = await fetch(url, { method: "DELETE" });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }
      setSetores((prev) => prev.filter((item) => item.id !== setorToDelete.id));
      toast({ title: "Setor excluído" });
      setSetorToDelete(null);
    } catch (error) {
      console.error(error);
      setErrorMsg("Não foi possível excluir o setor.");
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (value?: string) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(date);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Setores</h1>
          <p className="text-muted-foreground">Gerencie os setores e escritórios da sua organização</p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Novo setor
        </Button>
      </div>

      {errorMsg && <p className="text-red-600">{errorMsg}</p>}
      {loading && <p className="text-muted-foreground">Carregando…</p>}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Empresa</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Criado em</TableHead>
            <TableHead className="w-32 text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {setores.map((setor) => (
            <TableRow key={setor.id}>
              <TableCell>{setor.nome}</TableCell>
              <TableCell>{setor.empresaNome || "-"}</TableCell>
              <TableCell>
                <Badge variant={setor.ativo ? "secondary" : "outline"}>
                  {setor.ativo ? "Ativo" : "Inativo"}
                </Badge>
              </TableCell>
              <TableCell>{formatDate(setor.datacriacao)}</TableCell>
              <TableCell className="flex justify-end gap-2">
                <Button size="icon" variant="ghost" onClick={() => openEditDialog(setor)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => confirmDelete(setor)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {!loading && setores.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground">
                Nenhum setor cadastrado
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Dialog open={dialogOpen} onOpenChange={(open) => (open ? setDialogOpen(true) : closeDialog())}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingSetor ? "Editar setor" : "Novo setor"}</DialogTitle>
            <DialogDescription>
              {editingSetor
                ? "Atualize as informações do setor selecionado."
                : "Informe os dados do novo setor."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome</Label>
              <Input
                id="nome"
                value={formState.nome}
                onChange={(event) => setFormState((prev) => ({ ...prev, nome: event.target.value }))}
                placeholder="Nome do setor"
              />
            </div>

            <div className="space-y-2">
              <Label>Empresa</Label>
              <Select
                value={formState.empresaId}
                onValueChange={(value) => setFormState((prev) => ({ ...prev, empresaId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma empresa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Sem empresa</SelectItem>
                  {empresas.map((empresa) => (
                    <SelectItem key={empresa.id} value={empresa.id.toString()}>
                      {empresa.nome || `Empresa #${empresa.id}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <Label className="text-base">Ativo</Label>
                <p className="text-sm text-muted-foreground">
                  Defina se o setor está disponível para uso nas demais telas.
                </p>
              </div>
              <Switch
                checked={formState.ativo}
                onCheckedChange={(value) => setFormState((prev) => ({ ...prev, ativo: value }))}
              />
            </div>

            {formError && <p className="text-sm text-red-600">{formError}</p>}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!setorToDelete} onOpenChange={(open) => (!open ? cancelDelete() : undefined)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir setor</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação não pode ser desfeita. Tem certeza de que deseja excluir o setor
              {" "}
              <strong>{setorToDelete?.nome}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelDelete} disabled={deleting}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting}>
              {deleting ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function mapApiSetorToSetor(apiSetor: ApiSetor, empresas: Map<number, string>): Setor {
  const id = Number(apiSetor.id);
  const empresaRaw = apiSetor.empresa;
  const empresaId = empresaRaw === null || empresaRaw === undefined || empresaRaw === ""
    ? null
    : Number(empresaRaw);
  const ativo = typeof apiSetor.ativo === "boolean" ? apiSetor.ativo : Boolean(apiSetor.ativo);
  return {
    id,
    nome: apiSetor.nome ?? "",
    empresaId,
    empresaNome: apiSetor.empresa_nome ?? (empresaId != null ? empresas.get(empresaId) ?? "" : ""),
    ativo,
    datacriacao: apiSetor.datacriacao ?? undefined,
  };
}

function sortSetores(items: Setor[]): Setor[] {
  return [...items].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}
