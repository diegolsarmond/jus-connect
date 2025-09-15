import { useState, useEffect } from "react";
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

interface Plano {
  id: number;
  nome: string;
  valor: string;
}

function joinUrl(base: string, path = "") {
  const b = base.replace(/\/+$/, "");
  const p = path ? (path.startsWith("/") ? path : `/${path}`) : "";
  return `${b}${p}`;
}

export default function Planos() {
  const apiUrl = (import.meta.env.VITE_API_URL as string) || "http://localhost:3001";
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [newPlano, setNewPlano] = useState({ nome: "", valor: "" });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingPlano, setEditingPlano] = useState({ nome: "", valor: "" });
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const fetchPlanos = async () => {
      const url = joinUrl(apiUrl, "/api/planos");
      setLoading(true);
      setErrorMsg(null);
      try {
        const res = await fetch(url, { headers: { Accept: "application/json" } });
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
        setPlanos(
          parsed.map((p) => {
            const item = p as { id: number | string; nome?: string; valor?: string | number };
            return {
              id: Number(item.id),
              nome: item.nome ?? "",
              valor: String(item.valor ?? ""),
            };
          })
        );
      } catch (e) {
        console.error(e);
        setErrorMsg(e instanceof Error ? e.message : "Erro ao buscar dados");
        setPlanos([]);
      } finally {
        setLoading(false);
      }
    };

    fetchPlanos();
  }, [apiUrl]);

  const addPlano = () => {
    if (!newPlano.nome.trim() || !newPlano.valor.trim()) return;
    setPlanos([...planos, { id: Date.now(), ...newPlano }]);
    setNewPlano({ nome: "", valor: "" });
  };

  const startEdit = (plano: Plano) => {
    setEditingId(plano.id);
    setEditingPlano({ nome: plano.nome, valor: plano.valor });
  };

  const saveEdit = () => {
    if (editingId === null) return;
    setPlanos(planos.map(p => (p.id === editingId ? { id: editingId, ...editingPlano } : p)));
    setEditingId(null);
    setEditingPlano({ nome: "", valor: "" });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingPlano({ nome: "", valor: "" });
  };

  const deletePlano = (id: number) => {
    setPlanos(planos.filter(p => p.id !== id));
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Planos</h1>
        <p className="text-muted-foreground">Gerencie os planos disponíveis</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          placeholder="Nome do plano"
          value={newPlano.nome}
          onChange={(e) => setNewPlano({ ...newPlano, nome: e.target.value })}
          className="max-w-sm"
        />
        <Input
          placeholder="Valor"
          value={newPlano.valor}
          onChange={(e) => setNewPlano({ ...newPlano, valor: e.target.value })}
          className="max-w-sm"
        />
        <Button onClick={addPlano}>
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
            <TableHead>Valor</TableHead>
            <TableHead className="w-32">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {planos.map((plano) => (
            <TableRow key={plano.id}>
              <TableCell>
                {editingId === plano.id ? (
                  <Input
                    value={editingPlano.nome}
                    onChange={(e) =>
                      setEditingPlano((prev) => ({ ...prev, nome: e.target.value }))
                    }
                  />
                ) : (
                  plano.nome
                )}
              </TableCell>
              <TableCell>
                {editingId === plano.id ? (
                  <Input
                    value={editingPlano.valor}
                    onChange={(e) =>
                      setEditingPlano((prev) => ({ ...prev, valor: e.target.value }))
                    }
                  />
                ) : (
                  plano.valor
                )}
              </TableCell>
              <TableCell className="flex gap-2">
                {editingId === plano.id ? (
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
                      onClick={() => startEdit(plano)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => deletePlano(plano.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </TableCell>
            </TableRow>
          ))}
          {planos.length === 0 && (
            <TableRow>
              <TableCell colSpan={3} className="text-center text-muted-foreground">
                Nenhum plano cadastrado
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

