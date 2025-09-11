import { useState } from "react";
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

export default function Clientes() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("todos");
  const navigate = useNavigate();

  const clients = [
    {
      id: 1,
      name: "João Silva",
      email: "joao.silva@email.com",
      phone: "(11) 99999-9999",
      type: "Pessoa Física",
      area: "Direito Trabalhista",
      status: "Ativo",
      lastContact: "2024-01-15",
      cases: 3
    },
    {
      id: 2,
      name: "Tech Solutions Ltda",
      email: "contato@techsolutions.com.br",
      phone: "(11) 88888-8888",
      type: "Pessoa Jurídica",
      area: "Direito Empresarial",
      status: "Proposta",
      lastContact: "2024-01-14",
      cases: 1
    },
    {
      id: 3,
      name: "Maria Santos",
      email: "maria.santos@email.com",
      phone: "(11) 77777-7777",
      type: "Pessoa Física",
      area: "Direito de Família",
      status: "Ativo",
      lastContact: "2024-01-13",
      cases: 2
    },
    {
      id: 4,
      name: "Construtora ABC Ltda",
      email: "juridico@construtorabc.com.br",
      phone: "(11) 66666-6666",
      type: "Pessoa Jurídica",
      area: "Direito Tributário",
      status: "Negociação",
      lastContact: "2024-01-12",
      cases: 5
    },
    {
      id: 5,
      name: "Carlos Oliveira",
      email: "carlos.oliveira@email.com",
      phone: "(11) 55555-5555",
      type: "Pessoa Física",
      area: "Direito Civil",
      status: "Inativo",
      lastContact: "2024-01-10",
      cases: 1
    },
  ];

  const filteredClients = clients.filter(client => {
    const matchesSearch = client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         client.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterType === "todos" || 
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
          <Card key={client.id} className="hover:shadow-lg transition-all duration-200 cursor-pointer">
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
                    {client.cases} {client.cases === 1 ? "caso" : "casos"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Último contato: {new Date(client.lastContact).toLocaleDateString('pt-BR')}
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