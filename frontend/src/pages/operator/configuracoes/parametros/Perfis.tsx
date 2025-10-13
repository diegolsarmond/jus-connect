import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Check, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getApiBaseUrl } from "@/lib/api";

interface ModuleInfo {
  id: string;
  nome: string;
  descricao?: string;
  categoria?: string;
}

const STATIC_MODULES: ModuleInfo[] = [
  {
    id: "arquivos",
    nome: "Meus Arquivos",
  },
];

const HIDDEN_MODULES: ModuleInfo[] = [
  {
    id: "configuracoes-conteudo-blog",
    nome: "Configurações - Conteúdo - Blog",
  },
];

const HIDDEN_MODULE_IDS = new Set(HIDDEN_MODULES.map((module) => module.id));

const ensureDefaultModules = (modules: ModuleInfo[]): ModuleInfo[] => {
  if (modules.length === 0) {
    return [...STATIC_MODULES];
  }

  const knownIds = new Set(modules.map((module) => module.id));
  const augmented = [...modules];

  STATIC_MODULES.forEach((module) => {
    if (!knownIds.has(module.id)) {
      augmented.push(module);
    }
  });

  return augmented;
};

interface PerfilItem {
  id: number;
  nome: string;
  modulos: string[];
  viewAllConversations: boolean;
}

const extractCollection = (data: unknown): unknown[] => {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    if (Array.isArray(record.rows)) return record.rows;
    if (Array.isArray(record.data)) return record.data;
    if (record.data && typeof record.data === "object") {
      const inner = record.data as Record<string, unknown>;
      if (Array.isArray(inner.rows)) return inner.rows;
    }
  }
  return [];
};

const normalizeModuleIds = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  const unique: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string") continue;
    const trimmed = entry.trim();
    if (!trimmed || unique.includes(trimmed)) continue;
    unique.push(trimmed);
  }
  return unique;
};

const orderModules = (modules: string[], available: ModuleInfo[]): string[] => {
  if (modules.length <= 1 || available.length === 0) return [...modules];
  const index = new Map<string, number>();
  available.forEach((module, position) => {
    index.set(module.id, position);
  });
  return [...modules].sort((a, b) => {
    const indexA = index.get(a);
    const indexB = index.get(b);
    if (indexA == null && indexB == null) return a.localeCompare(b);
    if (indexA == null) return 1;
    if (indexB == null) return -1;
    if (indexA === indexB) return a.localeCompare(b);
    return indexA - indexB;
  });
};

const sortProfilesByName = (profiles: PerfilItem[]): PerfilItem[] =>
  [...profiles].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

const parseNumberId = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const parseViewAllConversations = (value: unknown, fallback: boolean): boolean => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return fallback;
    }
    return value !== 0;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      return fallback;
    }

    if (["1", "true", "t", "yes", "y", "sim", "on", "ativo", "ativa"].includes(normalized)) {
      return true;
    }

    if (["0", "false", "f", "no", "n", "nao", "não", "off", "inativo", "inativa"].includes(normalized)) {
      return false;
    }
  }

  return fallback;
};

export default function Perfis() {
  const apiUrl = getApiBaseUrl();

  const [availableModules, setAvailableModules] = useState<ModuleInfo[]>([]);
  const [profiles, setProfiles] = useState<PerfilItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [newModules, setNewModules] = useState<string[]>([]);
  const [newViewAllConversations, setNewViewAllConversations] = useState(true);
  const [savingNew, setSavingNew] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingModules, setEditingModules] = useState<string[]>([]);
  const [editingViewAllConversations, setEditingViewAllConversations] = useState(true);
  const [savingEdit, setSavingEdit] = useState(false);

  const [deletingId, setDeletingId] = useState<number | null>(null);

  const moduleLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    availableModules.forEach((module) => {
      map.set(module.id, module.nome);
    });
    HIDDEN_MODULES.forEach((module) => {
      if (!map.has(module.id)) {
        map.set(module.id, module.nome);
      }
    });
    return map;
  }, [availableModules]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [modulesRes, profilesRes] = await Promise.all([
          fetch(`${apiUrl}/api/perfis/modulos`, { headers: { Accept: "application/json" } }),
          fetch(`${apiUrl}/api/perfis`, { headers: { Accept: "application/json" } }),
        ]);

        if (!modulesRes.ok) {
          throw new Error(`HTTP ${modulesRes.status}: ${await modulesRes.text()}`);
        }
        if (!profilesRes.ok) {
          throw new Error(`HTTP ${profilesRes.status}: ${await profilesRes.text()}`);
        }

        const rawModules = extractCollection(await modulesRes.json());
        const parsedModules = rawModules
          .map((entry) => {
            if (!entry || typeof entry !== "object") return null;
            const data = entry as Record<string, unknown>;
            const id = typeof data.id === "string" ? data.id : null;
            const nome = typeof data.nome === "string" ? data.nome : null;
            if (!id || !nome) return null;
            return {
              id,
              nome,
              descricao: typeof data.descricao === "string" ? data.descricao : undefined,
              categoria: typeof data.categoria === "string" ? data.categoria : undefined,
            } satisfies ModuleInfo;
          })
          .filter((item): item is ModuleInfo => item !== null);

        const augmentedModules = ensureDefaultModules(parsedModules);
        const visibleModules = augmentedModules.filter((module) => !HIDDEN_MODULE_IDS.has(module.id));

        setAvailableModules(visibleModules);

        const rawProfiles = extractCollection(await profilesRes.json());
        const parsedProfiles = rawProfiles
          .map((entry) => {
            if (!entry || typeof entry !== "object") return null;
            const data = entry as Record<string, unknown>;
            const id = parseNumberId(data.id);
            if (id == null) return null;
            const nome =
              typeof data.nome === "string"
                ? data.nome
                : typeof data.descricao === "string"
                  ? data.descricao
                  : typeof data.name === "string"
                    ? data.name
                    : "";
            const modulos = orderModules(normalizeModuleIds(data.modulos), augmentedModules);
            const viewAllConversations = parseViewAllConversations(
              data.viewAllConversations ??
                data.visualizarTodasConversas ??
                data.verTodasConversas ??
                data.view_all_conversations ??
                (data as { perfilVerTodasConversas?: unknown }).perfilVerTodasConversas ??
                (data as { perfil_ver_todas_conversas?: unknown }).perfil_ver_todas_conversas,
              true,
            );
            return { id, nome, modulos, viewAllConversations } satisfies PerfilItem;
          })
          .filter((item): item is PerfilItem => item !== null);

        setProfiles(sortProfilesByName(parsedProfiles));
      } catch (err) {
        console.error(err);
        setError("Não foi possível carregar os dados de perfis.");
        setProfiles([]);
        setAvailableModules([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [apiUrl]);

  useEffect(() => {
    if (availableModules.length === 0) {
      setNewModules([]);
      setEditingModules([]);
      return;
    }

    setNewModules((prev) => orderModules(prev.filter((id) => moduleLabelMap.has(id)), availableModules));
    if (editingId != null) {
      setEditingModules((prev) =>
        orderModules(prev.filter((id) => moduleLabelMap.has(id)), availableModules)
      );
    }
  }, [availableModules, moduleLabelMap, editingId]);

  const updateSelection = (current: string[], moduleId: string, checked: boolean) => {
    const next = new Set(current);
    if (checked) {
      next.add(moduleId);
    } else {
      next.delete(moduleId);
    }
    return orderModules(Array.from(next), availableModules);
  };

  const handleCreateProfile = async () => {
    const nome = newName.trim();
    if (!nome || savingNew) return;

    setSavingNew(true);
    setError(null);

    const payload = {
      nome,
      ativo: true,
      modulos: orderModules(newModules, availableModules),
      visualizarTodasConversas: newViewAllConversations,
    };

    try {
      const response = await fetch(`${apiUrl}/api/perfis`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      const data = await response.json();
      const createdModules = orderModules(normalizeModuleIds((data as Record<string, unknown>)?.modulos), availableModules);
      const parsedId = parseNumberId((data as Record<string, unknown>)?.id);
      const createdViewAll = parseViewAllConversations(
        (data as Record<string, unknown>)?.viewAllConversations ??
          (data as Record<string, unknown>)?.visualizarTodasConversas ??
          (data as Record<string, unknown>)?.verTodasConversas ??
          (data as Record<string, unknown>)?.view_all_conversations,
        newViewAllConversations,
      );
      const created: PerfilItem = {
        id: parsedId ?? Date.now(),
        nome: typeof data?.nome === "string" ? data.nome : nome,
        modulos: createdModules,
        viewAllConversations: createdViewAll,
      };

      setProfiles((prev) => sortProfilesByName([...prev, created]));
      setNewName("");
      setNewModules([]);
      setNewViewAllConversations(true);
    } catch (err) {
      console.error(err);
      setError("Não foi possível criar o perfil.");
    } finally {
      setSavingNew(false);
    }
  };

  const startEdit = (profile: PerfilItem) => {
    setError(null);
    setEditingId(profile.id);
    setEditingName(profile.nome);
    setEditingModules(orderModules(profile.modulos, availableModules));
    setEditingViewAllConversations(profile.viewAllConversations);
  };

  const cancelEdit = () => {
    if (savingEdit) return;
    setEditingId(null);
    setEditingName("");
    setEditingModules([]);
    setEditingViewAllConversations(true);
  };

  const handleSaveEdit = async () => {
    if (editingId == null || savingEdit) return;
    const nome = editingName.trim();
    if (!nome) return;

    setSavingEdit(true);
    setError(null);

    const payload = {
      nome,
      ativo: true,
      modulos: orderModules(editingModules, availableModules),
      visualizarTodasConversas: editingViewAllConversations,
    };

    try {
      const response = await fetch(`${apiUrl}/api/perfis/${editingId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      const data = await response.json();
      const updatedModules = orderModules(normalizeModuleIds((data as Record<string, unknown>)?.modulos), availableModules);
      const updatedViewAll = parseViewAllConversations(
        (data as Record<string, unknown>)?.viewAllConversations ??
          (data as Record<string, unknown>)?.visualizarTodasConversas ??
          (data as Record<string, unknown>)?.verTodasConversas ??
          (data as Record<string, unknown>)?.view_all_conversations,
        editingViewAllConversations,
      );

      setProfiles((prev) =>
        sortProfilesByName(
          prev.map((item) =>
            item.id === editingId
              ? {
                  ...item,
                  nome: typeof data?.nome === "string" ? data.nome : nome,
                  modulos: updatedModules,
                  viewAllConversations: updatedViewAll,
                }
              : item
          )
        )
      );

      setEditingId(null);
      setEditingName("");
      setEditingModules([]);
      setEditingViewAllConversations(true);
    } catch (err) {
      console.error(err);
      setError("Não foi possível salvar as alterações do perfil.");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (deletingId != null) return;
    setError(null);
    setDeletingId(id);
    try {
      const response = await fetch(`${apiUrl}/api/perfis/${id}`, { method: "DELETE" });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }
      setProfiles((prev) => prev.filter((item) => item.id !== id));
      if (editingId === id) {
        cancelEdit();
      }
    } catch (err) {
      console.error(err);
      setError("Não foi possível remover o perfil.");
    } finally {
      setDeletingId(null);
    }
  };

  const renderModuleBadges = (modules: string[]) => {
    if (modules.length === 0) {
      return <span className="text-sm text-muted-foreground">Nenhum módulo</span>;
    }

    return (
      <div className="flex flex-wrap gap-2">
        {modules.map((moduleId) => (
          <Badge key={moduleId} variant="secondary">
            {moduleLabelMap.get(moduleId) ?? moduleId}
          </Badge>
        ))}
      </div>
    );
  };

  const renderModuleCheckboxes = (
    selected: string[],
    onChange: (moduleId: string, checked: boolean) => void,
    idPrefix: string
  ) => {
    if (availableModules.length === 0) {
      return <span className="text-sm text-muted-foreground">Nenhum módulo disponível</span>;
    }

    return (
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {availableModules.map((module) => (
          <label key={module.id} className="flex items-center gap-2 text-sm font-medium">
            <Checkbox
              id={`${idPrefix}-${module.id}`}
              checked={selected.includes(module.id)}
              onCheckedChange={(value) => onChange(module.id, value === true)}
            />
            <span>{module.nome}</span>
          </label>
        ))}
      </div>
    );
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Perfis</h1>
        <p className="text-muted-foreground">Gerencie os perfis do sistema e seus módulos de acesso.</p>
      </div>

      <div className="space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <div className="flex-1 space-y-2">
            <Input
              placeholder="Nome do novo perfil"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              className="max-w-sm"
            />
          </div>
          <Button onClick={handleCreateProfile} disabled={!newName.trim() || savingNew}>
            {savingNew ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            Adicionar
          </Button>
        </div>
        {renderModuleCheckboxes(newModules, (moduleId, checked) => {
          setNewModules((prev) => updateSelection(prev, moduleId, checked));
        }, 'new')}
        <div className="flex items-start gap-3">
          <Switch
            id="new-view-all-conversations"
            checked={newViewAllConversations}
            onCheckedChange={(value) => setNewViewAllConversations(value === true)}
          />
          <div>
            <Label htmlFor="new-view-all-conversations" className="text-sm font-medium">
              Visualizar todas as conversas
            </Label>
            <p className="text-xs text-muted-foreground">
              Desative para limitar o acesso às conversas atribuídas ao usuário.
            </p>
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading && <p className="text-sm text-muted-foreground">Carregando…</p>}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-56">Nome</TableHead>
            <TableHead>Módulos</TableHead>
            <TableHead className="w-64">Conversas</TableHead>
            <TableHead className="w-32">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {profiles.map((profile) => (
            <TableRow key={profile.id}>
              <TableCell>
                {editingId === profile.id ? (
                  <Input value={editingName} onChange={(event) => setEditingName(event.target.value)} />
                ) : (
                  profile.nome
                )}
              </TableCell>
              <TableCell>
                {editingId === profile.id
                  ? renderModuleCheckboxes(editingModules, (moduleId, checked) => {
                      setEditingModules((prev) => updateSelection(prev, moduleId, checked));
                    }, `edit-${profile.id}`)
                  : renderModuleBadges(profile.modulos)}
              </TableCell>
              <TableCell>
                {editingId === profile.id ? (
                  <div className="flex items-start gap-3">
                    <Switch
                      id={`edit-view-all-${profile.id}`}
                      checked={editingViewAllConversations}
                      onCheckedChange={(value) => setEditingViewAllConversations(value === true)}
                    />
                    <div>
                      <Label htmlFor={`edit-view-all-${profile.id}`} className="text-sm font-medium">
                        Visualizar todas as conversas
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Desative para limitar o acesso às conversas atribuídas ao usuário.
                      </p>
                    </div>
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    {profile.viewAllConversations ? "Todas as conversas" : "Somente atribuídas"}
                  </span>
                )}
              </TableCell>
              <TableCell className="flex gap-2">
                {editingId === profile.id ? (
                  <>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={handleSaveEdit}
                      disabled={savingEdit || !editingName.trim()}
                    >
                      {savingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    </Button>
                    <Button size="icon" variant="ghost" onClick={cancelEdit} disabled={savingEdit}>
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <Button size="icon" variant="ghost" onClick={() => startEdit(profile)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDelete(profile.id)}
                      disabled={deletingId === profile.id}
                    >
                      {deletingId === profile.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </>
                )}
              </TableCell>
            </TableRow>
          ))}
          {!loading && profiles.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground">
                Nenhum perfil cadastrado
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
