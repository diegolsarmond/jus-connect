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

interface Empresa {
  id: number;
  nome: string;
  cnpj: string;
}

export default function Empresas() {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [newEmpresa, setNewEmpresa] = useState({ nome: "", cnpj: "" });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingEmpresa, setEditingEmpresa] = useState({ nome: "", cnpj: "" });

  const addEmpresa = () => {
    if (!newEmpresa.nome.trim() || !newEmpresa.cnpj.trim()) return;
    setEmpresas([...empresas, { id: Date.now(), ...newEmpresa }]);
    setNewEmpresa({ nome: "", cnpj: "" });
  };

  const startEdit = (empresa: Empresa) => {
    setEditingId(empresa.id);
    setEditingEmpresa({ nome: empresa.nome, cnpj: empresa.cnpj });
  };

  const saveEdit = () => {
    if (editingId === null) return;
    setEmpresas(empresas.map(e => (e.id === editingId ? { id: editingId, ...editingEmpresa } : e)));
    setEditingId(null);
    setEditingEmpresa({ nome: "", cnpj: "" });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingEmpresa({ nome: "", cnpj: "" });
  };

  const deleteEmpresa = (id: number) => {
    setEmpresas(empresas.filter(e => e.id !== id));
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Empresas</h1>
        <p className="text-muted-foreground">Gerencie as empresas do sistema</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          placeholder="Nome da empresa"
          value={newEmpresa.nome}
          onChange={(e) => setNewEmpresa({ ...newEmpresa, nome: e.target.value })}
          className="max-w-sm"
        />
        <Input
          placeholder="CNPJ"
          value={newEmpresa.cnpj}
          onChange={(e) => setNewEmpresa({ ...newEmpresa, cnpj: e.target.value })}
          className="max-w-sm"
        />
        <Button onClick={addEmpresa}>
          <Plus className="mr-2 h-4 w-4" />
          Adicionar
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>CNPJ</TableHead>
            <TableHead className="w-32">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {empresas.map((empresa) => (
            <TableRow key={empresa.id}>
              <TableCell>
                {editingId === empresa.id ? (
                  <Input
                    value={editingEmpresa.nome}
                    onChange={(e) =>
                      setEditingEmpresa((prev) => ({ ...prev, nome: e.target.value }))
                    }
                  />
                ) : (
                  empresa.nome
                )}
              </TableCell>
              <TableCell>
                {editingId === empresa.id ? (
                  <Input
                    value={editingEmpresa.cnpj}
                    onChange={(e) =>
                      setEditingEmpresa((prev) => ({ ...prev, cnpj: e.target.value }))
                    }
                  />
                ) : (
                  empresa.cnpj
                )}
              </TableCell>
              <TableCell className="flex gap-2">
                {editingId === empresa.id ? (
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
                      onClick={() => startEdit(empresa)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => deleteEmpresa(empresa.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </TableCell>
            </TableRow>
          ))}
          {empresas.length === 0 && (
            <TableRow>
              <TableCell colSpan={3} className="text-center text-muted-foreground">
                Nenhuma empresa cadastrada
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
