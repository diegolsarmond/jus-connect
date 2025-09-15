import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { mockSupportTickets, mockCompanies } from "@/data/mockData";
import { Plus, Search, Headphones, Clock, CheckCircle, AlertCircle, XCircle } from "lucide-react";
import { useState } from "react";

export default function Support() {
  const [searchTerm, setSearchTerm] = useState("");

  const ticketsWithCompany = mockSupportTickets.map(ticket => {
    const company = mockCompanies.find(c => c.id === ticket.companyId);
    return { ...ticket, companyName: company?.name || 'Empresa não encontrada' };
  });

  const filteredTickets = ticketsWithCompany.filter(ticket =>
    ticket.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ticket.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ticket.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    const variants = {
      open: "destructive",
      in_progress: "secondary",
      resolved: "default",
      closed: "outline"
    } as const;
    
    const labels = {
      open: "Aberto",
      in_progress: "Em Andamento",
      resolved: "Resolvido",
      closed: "Fechado"
    };

    return (
      <Badge variant={variants[status as keyof typeof variants]}>
        {labels[status as keyof typeof labels]}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const variants = {
      low: "outline",
      medium: "secondary",
      high: "default",
      urgent: "destructive"
    } as const;
    
    const labels = {
      low: "Baixa",
      medium: "Média",
      high: "Alta",
      urgent: "Urgente"
    };

    return (
      <Badge variant={variants[priority as keyof typeof variants]}>
        {labels[priority as keyof typeof labels]}
      </Badge>
    );
  };

  const getStatusIcon = (status: string) => {
    const icons = {
      open: AlertCircle,
      in_progress: Clock,
      resolved: CheckCircle,
      closed: XCircle
    };
    
    const Icon = icons[status as keyof typeof icons];
    return Icon ? <Icon className="h-4 w-4" /> : null;
  };

  const openTickets = mockSupportTickets.filter(t => t.status === 'open').length;
  const inProgressTickets = mockSupportTickets.filter(t => t.status === 'in_progress').length;
  const resolvedTickets = mockSupportTickets.filter(t => t.status === 'resolved').length;
  const avgResponseTime = "2.4 horas"; // Mock data

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Suporte ao Cliente</h1>
          <p className="text-muted-foreground">Gerencie tickets de suporte e solicitações dos clientes</p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Novo Ticket
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tickets Abertos</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{openTickets}</div>
            <p className="text-xs text-muted-foreground">Requerem atenção</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Em Andamento</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inProgressTickets}</div>
            <p className="text-xs text-muted-foreground">Sendo processados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resolvidos Hoje</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{resolvedTickets}</div>
            <p className="text-xs text-muted-foreground">Problemas solucionados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tempo Médio</CardTitle>
            <Headphones className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgResponseTime}</div>
            <p className="text-xs text-muted-foreground">Primeira resposta</p>
          </CardContent>
        </Card>
      </div>

      {/* Support Tickets Table */}
      <Card>
        <CardHeader>
          <CardTitle>Tickets de Suporte</CardTitle>
          <CardDescription>Visualize e gerencie todas as solicitações de suporte</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar tickets..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ticket</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Prioridade</TableHead>
                  <TableHead>Criado</TableHead>
                  <TableHead>Atualizado</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTickets.map((ticket) => (
                  <TableRow key={ticket.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{ticket.title}</div>
                        <div className="text-sm text-muted-foreground line-clamp-1">
                          {ticket.description}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{ticket.companyName}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(ticket.status)}
                        {getStatusBadge(ticket.status)}
                      </div>
                    </TableCell>
                    <TableCell>{getPriorityBadge(ticket.priority)}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {new Date(ticket.createdAt).toLocaleDateString('pt-BR')}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {new Date(ticket.updatedAt).toLocaleDateString('pt-BR')}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{ticket.assignedTo || 'Não atribuído'}</div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        <Button variant="ghost" size="sm">
                          Ver Detalhes
                        </Button>
                        <Button variant="outline" size="sm">
                          Responder
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Support Analytics */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Distribuição por Status</CardTitle>
            <CardDescription>Breakdown dos tickets por status atual</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-destructive" />
                <span className="text-sm">Abertos</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{openTickets}</span>
                <div className="w-16 bg-muted rounded-full h-2">
                  <div 
                    className="bg-destructive h-2 rounded-full" 
                    style={{ width: `${(openTickets / mockSupportTickets.length) * 100}%` }}
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-secondary-foreground" />
                <span className="text-sm">Em Andamento</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{inProgressTickets}</span>
                <div className="w-16 bg-muted rounded-full h-2">
                  <div 
                    className="bg-secondary h-2 rounded-full" 
                    style={{ width: `${(inProgressTickets / mockSupportTickets.length) * 100}%` }}
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm">Resolvidos</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{resolvedTickets}</span>
                <div className="w-16 bg-muted rounded-full h-2">
                  <div 
                    className="bg-green-600 h-2 rounded-full" 
                    style={{ width: `${(resolvedTickets / mockSupportTickets.length) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Métricas de Performance</CardTitle>
            <CardDescription>Indicadores de qualidade do suporte</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm">Taxa de Resolução</span>
              <span className="font-medium text-green-600">92.3%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Satisfação Cliente</span>
              <span className="font-medium">4.7/5.0</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Tempo Primeira Resposta</span>
              <span className="font-medium">{avgResponseTime}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Tempo Resolução</span>
              <span className="font-medium">18.5 horas</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Reaberturas</span>
              <span className="font-medium text-destructive">3.1%</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}