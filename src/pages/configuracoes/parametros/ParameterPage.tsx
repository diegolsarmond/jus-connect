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

interface Item {
  id: number;
  nome: string;
}

interface ParameterPageProps {
  title: string;
  description: string;
  placeholder: string;
  emptyMessage: string;
  /**
   * Optional API endpoint. When provided the component will
   * persist items using the backend instead of local state only.
   */
  endpoint?: string;
}

export default function ParameterPage({
  title,
  description,
  placeholder,
  emptyMessage,
  endpoint,
}: ParameterPageProps) {
  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";
  const [items, setItems] = useState<Item[]>([]);
  const [newItem, setNewItem] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");

  // Load existing items when an endpoint is provided
  useEffect(() => {
    if (!endpoint) return;
    fetch(`${apiUrl}${endpoint}`)
      .then((res) => res.json())
      .then((data) => setItems(data))
      .catch((err) => console.error(err));
  }, [apiUrl, endpoint]);

  const addItem = async () => {
    if (!newItem.trim()) return;
    const nome = newItem.trim();
    if (endpoint) {
      try {
        const res = await fetch(`${apiUrl}${endpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nome, ativo: true }),
        });
        const created = await res.json();
        setItems([...items, created]);
      } catch (err) {
        console.error(err);
      }
    } else {
      setItems([...items, { id: Date.now(), nome }]);
    }
    setNewItem("");
  };

  const startEdit = (id: number, nome: string) => {
    setEditingId(id);
    setEditingName(nome);
  };

  const saveEdit = async () => {
    if (editingId === null) return;
    const nome = editingName;
    if (endpoint) {
      try {
        const res = await fetch(`${apiUrl}${endpoint}/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nome, ativo: true }),
        });
        const updated = await res.json();
        setItems(items.map((i) => (i.id === editingId ? updated : i)));
      } catch (err) {
        console.error(err);
      }
    } else {
      setItems(items.map((i) => (i.id === editingId ? { ...i, nome } : i)));
    }
    setEditingId(null);
    setEditingName("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingName("");
  };

  const deleteItem = async (id: number) => {
    if (endpoint) {
      try {
        await fetch(`${apiUrl}${endpoint}/${id}`, { method: "DELETE" });
      } catch (err) {
        console.error(err);
        return;
      }
    }
    setItems(items.filter((i) => i.id !== id));
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">{title}</h1>
        <p className="text-muted-foreground">{description}</p>
      </div>

      <div className="flex items-center gap-2">
        <Input
          placeholder={placeholder}
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          className="max-w-sm"
        />
        <Button onClick={addItem}>
          <Plus className="mr-2 h-4 w-4" />
          Adicionar
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead className="w-32">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell>
                {editingId === item.id ? (
                  <Input
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                  />
                ) : (
                  item.nome
                )}
              </TableCell>
              <TableCell className="flex gap-2">
                {editingId === item.id ? (
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
                      onClick={() => startEdit(item.id, item.nome)}
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
          {items.length === 0 && (
            <TableRow>
              <TableCell colSpan={2} className="text-center text-muted-foreground">
                {emptyMessage}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

