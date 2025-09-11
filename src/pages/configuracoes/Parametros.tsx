import { useState } from "react";
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

interface Area {
  id: number;
  nome: string;
}

export default function Parametros() {
  const [areas, setAreas] = useState<Area[]>([]);
  const [newArea, setNewArea] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");

  const addArea = () => {
    if (!newArea.trim()) return;
    setAreas([...areas, { id: Date.now(), nome: newArea.trim() }]);
    setNewArea("");
  };

  const startEdit = (id: number, nome: string) => {
    setEditingId(id);
    setEditingName(nome);
  };

  const saveEdit = () => {
    if (editingId === null) return;
    setAreas(areas.map((a) => (a.id === editingId ? { ...a, nome: editingName } : a)));
    setEditingId(null);
    setEditingName("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingName("");
  };

  const deleteArea = (id: number) => {
    setAreas(areas.filter((a) => a.id !== id));
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Parâmetros</h1>
        <p className="text-muted-foreground">Gerencie as áreas de atuação</p>
      </div>

      <div className="flex items-center gap-2">
        <Input
          placeholder="Nova área de atuação"
          value={newArea}
          onChange={(e) => setNewArea(e.target.value)}
          className="max-w-sm"
        />
        <Button onClick={addArea}>
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
          {areas.map((area) => (
            <TableRow key={area.id}>
              <TableCell>
                {editingId === area.id ? (
                  <Input
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                  />
                ) : (
                  area.nome
                )}
              </TableCell>
              <TableCell className="flex gap-2">
                {editingId === area.id ? (
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
                      onClick={() => startEdit(area.id, area.nome)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => deleteArea(area.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </TableCell>
            </TableRow>
          ))}
          {areas.length === 0 && (
            <TableRow>
              <TableCell colSpan={2} className="text-center text-muted-foreground">
                Nenhuma área cadastrada
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
