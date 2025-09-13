import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";

interface FluxoTrabalhoItem {
  id: number;
  nome: string;
  exibe_menu: boolean;
  ordem: number | null;
}

export default function FluxoTrabalho() {
  const apiUrl = (import.meta.env.VITE_API_URL as string) || "http://localhost:3000";

  const [items, setItems] = useState<FluxoTrabalhoItem[]>([]);
  const [newNome, setNewNome] = useState("");
  const [newExibeMenu, setNewExibeMenu] = useState(true);
  const [newOrdem, setNewOrdem] = useState<string>("");
  const [editing, setEditing] = useState<FluxoTrabalhoItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setErrorMsg(null);
      try {
        const res = await fetch(`${apiUrl}/api/fluxos-trabalho`, {
          headers: { Accept: "application/json" },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
        const data = await res.json();
        const parsed: unknown[] = Array.isArray(data)
          ? data
          : Array.isArray(data?.rows)
          ? data.rows
          : Array.isArray(data?.data?.rows)
          ? data.data.rows
          : Array.isArray(data?.data)
          ? data.data
          : [];
        setItems(
          parsed.map((r) => {
            const item = r as {
              id: number | string;
              nome?: string;
              exibe_menu?: boolean;
              ordem?: number | null;
            };
            return {
              id: Number(item.id),
              nome: item.nome ?? "",
              exibe_menu: item.exibe_menu ?? true,
              ordem:
                item.ordem === undefined || item.ordem === null
                  ? null
                  : Number(item.ordem),
            };
          })
        );
      } catch (e: unknown) {
        console.error(e);
        setErrorMsg(e instanceof Error ? e.message : "Erro ao buscar dados");
        setItems([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [apiUrl]);

  const resetNewFields = () => {
    setNewNome("");
    setNewExibeMenu(true);
    setNewOrdem("");
  };

  const addItem = async () => {
    const nome = newNome.trim();
    if (!nome) return;
    const payload = {
      nome,
      ativo: true,
      exibe_menu: newExibeMenu,
      ordem: newOrdem === "" ? null : Number(newOrdem),
    };
    try {
      const res = await fetch(`${apiUrl}/api/fluxos-trabalho`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      const created = await res.json();
      setItems((prev) => [
        ...prev,
        {
          id: Number(created?.id ?? created?.data?.id ?? Date.now()),
          nome: created?.nome ?? nome,
          exibe_menu: created?.exibe_menu ?? payload.exibe_menu ?? true,
          ordem:
            created?.ordem === undefined || created?.ordem === null
              ? null
              : Number(created.ordem),
        },
      ]);
      resetNewFields();
    } catch (e) {
      console.error(e);
      setErrorMsg("Não foi possível criar o item.");
    }
  };

  const startEdit = (item: FluxoTrabalhoItem) => {
    setEditing({ ...item });
  };

  const cancelEdit = () => setEditing(null);

  const saveEdit = async () => {
    if (!editing) return;
    const nome = editing.nome.trim();
    if (!nome) return;
    const payload = {
      nome,
      ativo: true,
      exibe_menu: editing.exibe_menu,
      ordem: editing.ordem,
    };
    try {
      const res = await fetch(`${apiUrl}/api/fluxos-trabalho/${editing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      const updated = await res.json();
      setItems((prev) =>
        prev.map((i) =>
          i.id === editing.id
            ? {
                id: Number(updated?.id ?? editing.id),
                nome: updated?.nome ?? nome,
                exibe_menu: updated?.exibe_menu ?? payload.exibe_menu,
                ordem:
                  updated?.ordem === undefined || updated?.ordem === null
                    ? null
                    : Number(updated.ordem),
              }
            : i
        )
      );
      setEditing(null);
    } catch (e) {
      console.error(e);
      setErrorMsg("Não foi possível salvar a edição.");
    }
  };

  const deleteItem = async (id: number) => {
    try {
      const res = await fetch(`${apiUrl}/api/fluxos-trabalho/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (e) {
      console.error(e);
      setErrorMsg("Não foi possível excluir o item.");
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Fluxo de Trabalho</h1>
        <p className="text-muted-foreground">Gerencie os fluxos de trabalho</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Novo fluxo de trabalho"
          value={newNome}
          onChange={(e) => setNewNome(e.target.value)}
          className="max-w-sm"
        />
        <div className="flex items-center gap-2">
          <Checkbox
            id="newExibeMenu"
            checked={newExibeMenu}
            onCheckedChange={(v) => setNewExibeMenu(!!v)}
          />
          <label htmlFor="newExibeMenu">Exibe no menu</label>
        </div>
        <Input
          type="number"
          placeholder="Ordem"
          value={newOrdem}
          onChange={(e) => setNewOrdem(e.target.value)}
          className="w-24"
        />
        <Button onClick={addItem}>
          <Plus className="mr-2 h-4 w-4" />
          Adicionar
        </Button>
      </div>

      {loading && <p className="text-muted-foreground">Carregando…</p>}
      {errorMsg && <p className="text-red-600">{errorMsg}</p>}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead className="w-40">Exibe no menu</TableHead>
            <TableHead className="w-24">Ordem</TableHead>
            <TableHead className="w-32">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell>
                {editing?.id === item.id ? (
                  <Input
                    value={editing.nome}
                    onChange={(e) =>
                      setEditing((prev) => (prev ? { ...prev, nome: e.target.value } : prev))
                    }
                  />
                ) : (
                  item.nome
                )}
              </TableCell>
              <TableCell>
                {editing?.id === item.id ? (
                  <Checkbox
                    checked={editing.exibe_menu}
                    onCheckedChange={(v) =>
                      setEditing((prev) =>
                        prev ? { ...prev, exibe_menu: !!v } : prev
                      )
                    }
                  />
                ) : item.exibe_menu ? (
                  "Sim"
                ) : (
                  "Não"
                )}
              </TableCell>
              <TableCell>
                {editing?.id === item.id ? (
                  <Input
                    type="number"
                    value={editing.ordem === null ? "" : String(editing.ordem)}
                    onChange={(e) =>
                      setEditing((prev) =>
                        prev
                          ? {
                              ...prev,
                              ordem:
                                e.target.value === ""
                                  ? null
                                  : Number(e.target.value),
                            }
                          : prev
                      )
                    }
                    className="w-20"
                  />
                ) : (
                  item.ordem ?? ""
                )}
              </TableCell>
              <TableCell className="flex gap-2">
                {editing?.id === item.id ? (
                  <>
                    <Button size="icon" variant="ghost" onClick={saveEdit}>
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={cancelEdit}>
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => startEdit(item)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => deleteItem(item.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {!loading && items.length === 0 && (
        <p className="text-muted-foreground">Nenhum fluxo de trabalho cadastrado</p>
      )}
    </div>
  );
}

