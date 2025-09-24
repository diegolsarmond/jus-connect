import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "react-router-dom";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getApiBaseUrl } from "@/lib/api";

const apiUrl = getApiBaseUrl();

function joinUrl(base: string, path = "") {
  const b = base.replace(/\/+$/, "");
  const p = path ? (path.startsWith("/") ? path : `/${path}`) : "";
  return `${b}${p}`;
}

interface ApiEmpresa {
  id: number;
  nome_empresa: string;
  cnpj: string;
  telefone: string;
  email: string;
  plano: number | string;
  responsavel: number | string;
}

interface Empresa {
  id: number;
  nome: string;
  cnpj: string;
  responsavel: string;
  telefone: string;
  plano: string;
}

const mapApiEmpresaToEmpresa = (e: ApiEmpresa): Empresa => ({
  id: e.id,
  nome: e.nome_empresa,
  cnpj: e.cnpj,
  responsavel: e.responsavel?.toString() ?? "",
  telefone: e.telefone,
  plano: e.plano?.toString() ?? "",
});

export default function Empresas() {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingEmpresa, setEditingEmpresa] = useState({
    nome: "",
    cnpj: "",
    responsavel: "",
    telefone: "",
    plano: "",
  });

  useEffect(() => {
    const fetchEmpresas = async () => {
      try {
        const url = joinUrl(apiUrl, "/api/empresas");
        const response = await fetch(url, { headers: { Accept: "application/json" } });
        if (!response.ok) {
          throw new Error("Failed to fetch empresas");
        }
        const json = await response.json();
        const data: ApiEmpresa[] = Array.isArray(json)
          ? json
          : Array.isArray(json?.rows)
            ? json.rows
            : Array.isArray(json?.data?.rows)
              ? json.data.rows
              : Array.isArray(json?.data)
                ? json.data
                : [];
        setEmpresas(data.map(mapApiEmpresaToEmpresa));
      } catch (error) {
        console.error("Erro ao buscar empresas:", error);
      }
    };

    fetchEmpresas();
  }, []);

  const startEdit = (empresa: Empresa) => {
    setEditingId(empresa.id);
    setEditingEmpresa({
      nome: empresa.nome,
      cnpj: empresa.cnpj,
      responsavel: empresa.responsavel,
      telefone: empresa.telefone,
      plano: empresa.plano,
    });
  };

  const saveEdit = () => {
    if (editingId === null) return;
    setEmpresas(empresas.map(e => (e.id === editingId ? { id: editingId, ...editingEmpresa } : e)));
    setEditingId(null);
    setEditingEmpresa({ nome: "", cnpj: "", responsavel: "", telefone: "", plano: "" });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingEmpresa({ nome: "", cnpj: "", responsavel: "", telefone: "", plano: "" });
  };

  const deleteEmpresa = (id: number) => {
    setEmpresas(empresas.filter(e => e.id !== id));
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Empresas</h1>
          <p className="text-muted-foreground">Gerencie as empresas do sistema</p>
        </div>
        <Button asChild>
          <Link to="/configuracoes/empresas/nova">
            <Plus className="mr-2 h-4 w-4" /> Nova Empresa
          </Link>
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>CNPJ</TableHead>
            <TableHead>Responsável</TableHead>
            <TableHead>Telefone</TableHead>
            <TableHead>Plano</TableHead>
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
              <TableCell>
                {editingId === empresa.id ? (
                  <Input
                    value={editingEmpresa.responsavel}
                    onChange={(e) =>
                      setEditingEmpresa((prev) => ({ ...prev, responsavel: e.target.value }))
                    }
                  />
                ) : (
                  empresa.responsavel
                )}
              </TableCell>
              <TableCell>
                {editingId === empresa.id ? (
                  <Input
                    value={editingEmpresa.telefone}
                    onChange={(e) =>
                      setEditingEmpresa((prev) => ({ ...prev, telefone: e.target.value }))
                    }
                  />
                ) : (
                  empresa.telefone
                )}
              </TableCell>
              <TableCell>
                {editingId === empresa.id ? (
                  <Input
                    value={editingEmpresa.plano}
                    onChange={(e) =>
                      setEditingEmpresa((prev) => ({ ...prev, plano: e.target.value }))
                    }
                  />
                ) : (
                  empresa.plano
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
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                Nenhuma empresa cadastrada
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
