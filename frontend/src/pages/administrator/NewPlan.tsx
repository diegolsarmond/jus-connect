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
import { getApiBaseUrl } from "@/lib/api";

interface Plan {
  id: number;
  name: string;
  price: string;
}

function joinUrl(base: string, path = "") {
  const normalizedBase = base.replace(/\/+$/, "");
  const normalizedPath = path ? (path.startsWith("/") ? path : `/${path}`) : "";
  return `${normalizedBase}${normalizedPath}`;
}

export default function NewPlan() {
  const apiUrl = getApiBaseUrl();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [newPlan, setNewPlan] = useState({ name: "", price: "" });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingPlan, setEditingPlan] = useState({ name: "", price: "" });
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const fetchPlans = async () => {
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
        setPlans(
          parsed.map((item) => {
            const plan = item as { id: number | string; nome?: string; valor?: string | number };
            return {
              id: Number(plan.id),
              name: plan.nome ?? "",
              price: String(plan.valor ?? ""),
            };
          }),
        );
      } catch (error) {
        console.error(error);
        setErrorMsg(error instanceof Error ? error.message : "Erro ao buscar dados");
        setPlans([]);
      } finally {
        setLoading(false);
      }
    };

    fetchPlans();
  }, [apiUrl]);

  const addPlan = () => {
    if (!newPlan.name.trim() || !newPlan.price.trim()) return;
    setPlans([...plans, { id: Date.now(), ...newPlan }]);
    setNewPlan({ name: "", price: "" });
  };

  const startEdit = (plan: Plan) => {
    setEditingId(plan.id);
    setEditingPlan({ name: plan.name, price: plan.price });
  };

  const saveEdit = () => {
    if (editingId === null) return;
    setPlans(plans.map((plan) => (plan.id === editingId ? { id: editingId, ...editingPlan } : plan)));
    setEditingId(null);
    setEditingPlan({ name: "", price: "" });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingPlan({ name: "", price: "" });
  };

  const deletePlan = (id: number) => {
    setPlans(plans.filter((plan) => plan.id !== id));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Planos</h1>
        <p className="text-muted-foreground">Gerencie os planos disponíveis</p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          placeholder="Nome do plano"
          value={newPlan.name}
          onChange={(event) => setNewPlan({ ...newPlan, name: event.target.value })}
          className="max-w-sm"
        />
        <Input
          placeholder="Valor"
          value={newPlan.price}
          onChange={(event) => setNewPlan({ ...newPlan, price: event.target.value })}
          className="max-w-sm"
        />
        <Button onClick={addPlan}>
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
          {plans.map((plan) => (
            <TableRow key={plan.id}>
              <TableCell>
                {editingId === plan.id ? (
                  <Input
                    value={editingPlan.name}
                    onChange={(event) => setEditingPlan((prev) => ({ ...prev, name: event.target.value }))}
                  />
                ) : (
                  plan.name
                )}
              </TableCell>
              <TableCell>
                {editingId === plan.id ? (
                  <Input
                    value={editingPlan.price}
                    onChange={(event) => setEditingPlan((prev) => ({ ...prev, price: event.target.value }))}
                  />
                ) : (
                  plan.price
                )}
              </TableCell>
              <TableCell className="flex gap-2">
                {editingId === plan.id ? (
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
                    <Button size="icon" variant="ghost" onClick={() => startEdit(plan)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => deletePlan(plan.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </TableCell>
            </TableRow>
          ))}
          {plans.length === 0 && (
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
