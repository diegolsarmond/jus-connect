import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, Filter, User, Building2, Phone, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Client } from "@/types/client";

const apiUrl = (import.meta.env.VITE_API_URL as string) || "http://localhost:3000";

function joinUrl(base: string, path = "") {
  const b = base.replace(/\/+$/, "");
  const p = path ? (path.startsWith("/") ? path : `/${path}`) : "";
  return `${b}${p}`;
}

interface ApiClient {
  id: number;
  nome: string;
  tipo: string;
  documento: string;
  email: string;
  telefone: string;
  cep: string;
  rua: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  ativo: boolean;
  foto: string | null;
  datacadastro: string;
}

const mapApiClientToClient = (c: ApiClient): Client => ({
  id: c.id,
  name: c.nome,
  email: c.email,
  phone: c.telefone,
  type: c.tipo === "J" || c.tipo === "PJ" ? "Pessoa Jurídica" : "Pessoa Física",
  document: c.documento,
  address: `${c.rua}, ${c.numero} - ${c.bairro}, ${c.cidade} - ${c.uf}`,
  area: "",
  status: c.ativo ? "Ativo" : "Inativo",
  lastContact: c.datacadastro,
  processes: [],
});

export default function Clientes() {
  const [clients, setClients] = useState<Client[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("todos");
  const navigate = useNavigate();

  useEffect(() => {
    const fetchClients = async () => {
      try {
        const url = joinUrl(apiUrl, "/api/clientes");
        const response = await fetch(url, { headers: { Accept: "application/json" } });
        if (!response.ok) {
          throw new Error("Failed to fetch clients");
        }
        const json = await response.json();
        const data: ApiClient[] = Array.isArray(json)
          ? json
          : Array.isArray(json?.rows)
            ? json.rows
            : Array.isArray(json?.data?.rows)
              ? json.data.rows
              : Array.isArray(json?.data)
                ? json.data
                : [];
        setClients(data.map(mapApiClientToClient));
      } catch (error) {
        console.error("Erro ao buscar clientes:", error);
      }
    };

    fetchClients();
  }, []);

  const filteredClients = clients.filter(client => {
    const matchesSearch = client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter =
      filterType === "todos" ||
      (filterType === "pf" && client.type === "Pessoa Física") ||
      (filterType === "pj" && client.type === "Pessoa Jurídica");
    return matchesSearch && matchesFilter;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Ativo": return "bg-success text-success-foreground";
      case "Proposta": return "bg-warning text-warning-foreground";
      case "Negociação": return "bg-primary text-primary-foreground";
      case "Inativo": return "bg-muted text-muted-foreground";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Clientes</h1>
          <p className="text-muted-foreground">Gerencie todos os seus clientes</p>
        </div>
        <Button
          className="bg-primary hover:bg-primary-hover"
          onClick={() => navigate("/clientes/novo")}
        >
          <Plus className="mr-2 h-4 w-4" />
          Novo Cliente
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar por nome ou email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
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

      {/* Clients Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredClients.map((client) => (
          <Card
            key={client.id}
            className="hover:shadow-lg transition-all duration-200 cursor-pointer"
            onClick={() => navigate(`/clientes/${client.id}`)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {client.type === "Pessoa Física" ? (
                        <User className="h-6 w-6" />
                      ) : (
                        <Building2 className="h-6 w-6" />
                      )}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-lg">{client.name}</CardTitle>
                    <Badge variant="outline" className="text-xs mt-1">
                      {client.type}
                    </Badge>
                  </div>
                </div>
                <Badge className={getStatusColor(client.status)}>
                  {client.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="h-4 w-4" />
                  {client.email}
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="h-4 w-4" />
                  {client.phone}
                </div>
              </div>
              
              <div className="pt-2 border-t border-border">
                <p className="text-sm font-medium text-foreground">{client.area}</p>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-xs text-muted-foreground">
                    {client.processes.length} {client.processes.length === 1 ? "caso" : "casos"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Último contato: {new Date(client.lastContact).toLocaleDateString("pt-BR")}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredClients.length === 0 && (
        <div className="text-center py-12">
          <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">Nenhum cliente encontrado</h3>
          <p className="text-muted-foreground">
            {searchTerm ? "Tente ajustar os filtros de busca" : "Adicione seu primeiro cliente para começar"}
          </p>
        </div>
      )}
    </div>
  );
}