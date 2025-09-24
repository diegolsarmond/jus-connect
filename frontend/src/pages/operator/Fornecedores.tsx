import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, Filter, Edit, Eye, UserCheck, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Supplier } from "@/types/supplier";
import { getApiBaseUrl } from "@/lib/api";

const apiUrl = getApiBaseUrl();

function joinUrl(base: string, path = "") {
  const b = base.replace(/\/+$/, "");
  const p = path ? (path.startsWith("/") ? path : `/${path}`) : "";
  return `${b}${p}`;
}

interface ApiSupplier {
  id: number;
  nome: string;
  tipo: string | null;
  documento: string | null;
  email: string | null;
  telefone: string | null;
  cep: string | null;
  rua: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  ativo: boolean;
  datacadastro: string;
}

const mapApiSupplierToSupplier = (supplier: ApiSupplier): Supplier => {
  const streetParts = [supplier.rua, supplier.numero].filter(Boolean).join(", ");
  const cityParts = [supplier.bairro, supplier.cidade, supplier.uf].filter(Boolean).join(", ");
  const address = [streetParts, cityParts].filter(Boolean).join(" - ");

  const tipo = supplier.tipo?.toUpperCase();
  const isPessoaJuridica = tipo === "2" || tipo === "PJ" || tipo === "J";

  return {
    id: supplier.id,
    name: supplier.nome,
    email: supplier.email ?? "",
    phone: supplier.telefone ?? "",
    type: isPessoaJuridica ? "Pessoa Jurídica" : "Pessoa Física",
    document: supplier.documento ?? "",
    address,
    status: supplier.ativo ? "Ativo" : "Inativo",
    createdAt: supplier.datacadastro,
  };
};

export default function Fornecedores() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("todos");
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchSuppliers = async () => {
      try {
        const url = joinUrl(apiUrl, "/api/fornecedores");
        const response = await fetch(url, { headers: { Accept: "application/json" } });
        if (!response.ok) {
          throw new Error("Failed to fetch suppliers");
        }
        const json = await response.json();
        const data: ApiSupplier[] = Array.isArray(json)
          ? json
          : Array.isArray(json?.rows)
            ? json.rows
            : Array.isArray(json?.data?.rows)
              ? json.data.rows
              : Array.isArray(json?.data)
                ? json.data
                : [];
        setSuppliers(data.map(mapApiSupplierToSupplier));
      } catch (error) {
        console.error("Erro ao buscar fornecedores:", error);
      }
    };

    fetchSuppliers();
  }, []);

  const filteredSuppliers = suppliers.filter((supplier) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      supplier.name.toLowerCase().includes(term) || supplier.email.toLowerCase().includes(term);
    const matchesFilter =
      filterType === "todos" ||
      (filterType === "pf" && supplier.type === "Pessoa Física") ||
      (filterType === "pj" && supplier.type === "Pessoa Jurídica");
    return matchesSearch && matchesFilter;
  });

  const toggleSupplierStatus = async () => {
    if (!selectedSupplier) return;

    try {
      const url = joinUrl(apiUrl, `/api/fornecedores/${selectedSupplier.id}`);
      const response = await fetch(url, { method: "DELETE" });
      if (!response.ok) {
        throw new Error("Failed to update supplier status");
      }
      setSuppliers((prev) =>
        prev.map((supplier) =>
          supplier.id === selectedSupplier.id
            ? {
                ...supplier,
                status: supplier.status === "Ativo" ? "Inativo" : "Ativo",
              }
            : supplier,
        ),
      );
    } catch (error) {
      console.error("Erro ao atualizar status do fornecedor:", error);
    } finally {
      setSelectedSupplier(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Ativo":
        return "bg-success text-success-foreground";
      case "Inativo":
        return "bg-muted text-muted-foreground";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Fornecedores</h1>
          <p className="text-muted-foreground">Gerencie todos os seus fornecedores</p>
        </div>
        <Button className="bg-primary hover:bg-primary-hover" onClick={() => navigate("/fornecedores/novo")}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Fornecedor
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar por nome ou email..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-48">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os Tipos</SelectItem>
            <SelectItem value="pf">Pessoa Física</SelectItem>
            <SelectItem value="pj">Pessoa Jurídica</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Fornecedores</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSuppliers.map((supplier) => (
                <TableRow key={supplier.id}>
                  <TableCell className="font-medium">{supplier.name}</TableCell>
                  <TableCell>{supplier.email}</TableCell>
                  <TableCell>{supplier.phone}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{supplier.type}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(supplier.status)}>{supplier.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => navigate(`/fornecedores/${supplier.id}`)}
                        aria-label="Visualizar fornecedor"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => navigate(`/fornecedores/${supplier.id}/editar`)}
                        aria-label="Editar fornecedor"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant={supplier.status === "Ativo" ? "destructive" : "default"}
                        size="icon"
                        onClick={() => setSelectedSupplier(supplier)}
                        aria-label={supplier.status === "Ativo" ? "Inativar fornecedor" : "Ativar fornecedor"}
                      >
                        {supplier.status === "Ativo" ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredSuppliers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Nenhum fornecedor encontrado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog open={Boolean(selectedSupplier)} onOpenChange={() => setSelectedSupplier(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {selectedSupplier?.status === "Ativo" ? "Inativar fornecedor" : "Ativar fornecedor"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {selectedSupplier?.status === "Ativo"
                ? "Tem certeza que deseja inativar este fornecedor?"
                : "Tem certeza que deseja ativar este fornecedor?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={toggleSupplierStatus}>
              {selectedSupplier?.status === "Ativo" ? "Inativar" : "Ativar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
