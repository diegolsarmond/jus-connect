import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { mockSubscriptions, mockCompanies, mockPlans } from "@/data/mockData";
import { Plus, Search, CreditCard, TrendingUp, Calendar, AlertTriangle } from "lucide-react";
import { useState } from "react";

export default function Subscriptions() {
  const [searchTerm, setSearchTerm] = useState("");

  const subscriptionsWithDetails = mockSubscriptions.map(sub => {
    const company = mockCompanies.find(c => c.id === sub.companyId);
    const plan = mockPlans.find(p => p.id === sub.planId);
    return { ...sub, company, plan };
  });

  const filteredSubscriptions = subscriptionsWithDetails.filter(sub =>
    sub.company?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    sub.plan?.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    const variants = {
      active: "default",
      trialing: "secondary",
      past_due: "destructive",
      canceled: "destructive",
      suspended: "outline"
    } as const;
    
    const labels = {
      active: "Ativo",
      trialing: "Trial",
      past_due: "Em Atraso",
      canceled: "Cancelado",
      suspended: "Suspenso"
    };

    return (
      <Badge variant={variants[status as keyof typeof variants]}>
        {labels[status as keyof typeof labels]}
      </Badge>
    );
  };

  const totalMRR = mockSubscriptions.reduce((acc, sub) => acc + sub.mrr, 0);
  const activeSubscriptions = mockSubscriptions.filter(sub => sub.status === 'active').length;
  const trialSubscriptions = mockSubscriptions.filter(sub => sub.status === 'trialing').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Assinaturas</h1>
          <p className="text-muted-foreground">Gerencie todas as assinaturas ativas e trials</p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Nova Assinatura
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">MRR Total</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ {totalMRR.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Receita mensal recorrente</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Assinaturas Ativas</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeSubscriptions}</div>
            <p className="text-xs text-muted-foreground">Pagando mensalmente</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Em Trial</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{trialSubscriptions}</div>
            <p className="text-xs text-muted-foreground">Potenciais conversões</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">ARPU</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              R$ {activeSubscriptions > 0 ? (totalMRR / activeSubscriptions).toFixed(0) : '0'}
            </div>
            <p className="text-xs text-muted-foreground">Receita média por usuário</p>
          </CardContent>
        </Card>
      </div>

      {/* Subscriptions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Assinaturas</CardTitle>
          <CardDescription>Visualize e gerencie todas as assinaturas</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar assinaturas..."
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
                  <TableHead>Empresa</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>MRR</TableHead>
                  <TableHead>Período Atual</TableHead>
                  <TableHead>Próxima Cobrança</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSubscriptions.map((subscription) => (
                  <TableRow key={subscription.id}>
                    <TableCell>
                      <div className="font-medium">{subscription.company?.name}</div>
                      <div className="text-sm text-muted-foreground">{subscription.company?.email}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{subscription.plan?.name}</div>
                      <div className="text-sm text-muted-foreground">
                        R$ {subscription.plan?.price}/mês
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(subscription.status)}</TableCell>
                    <TableCell>
                      <div className="font-medium">R$ {subscription.mrr.toLocaleString()}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {new Date(subscription.currentPeriodStart).toLocaleDateString('pt-BR')} - {' '}
                        {new Date(subscription.currentPeriodEnd).toLocaleDateString('pt-BR')}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {subscription.status === 'trialing' && subscription.trialEnd
                          ? `Trial até ${new Date(subscription.trialEnd).toLocaleDateString('pt-BR')}`
                          : new Date(subscription.currentPeriodEnd).toLocaleDateString('pt-BR')
                        }
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        <Button variant="ghost" size="sm">
                          Ver Detalhes
                        </Button>
                        <Button variant="outline" size="sm">
                          Gerenciar
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

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Ações Rápidas</CardTitle>
            <CardDescription>Operações frequentes em assinaturas</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button className="w-full justify-start" variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Criar Nova Assinatura
            </Button>
            <Button className="w-full justify-start" variant="outline">
              <CreditCard className="h-4 w-4 mr-2" />
              Processar Cobranças Pendentes
            </Button>
            <Button className="w-full justify-start" variant="outline">
              <AlertTriangle className="h-4 w-4 mr-2" />
              Revisar Trials Expirando
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Métricas de Conversão</CardTitle>
            <CardDescription>Performance de trials e upgrades</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm">Taxa de Conversão Trial</span>
              <span className="font-medium">78.5%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Upgrade Rate</span>
              <span className="font-medium">23.1%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Downgrade Rate</span>
              <span className="font-medium">4.2%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Churn Rate</span>
              <span className="font-medium text-destructive">5.2%</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}