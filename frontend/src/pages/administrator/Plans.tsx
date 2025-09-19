import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { mockPlans } from "@/data/mockData";
import { routes } from "@/config/routes";
import { Plus, Check, Package, Users, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Plans() {
  const navigate = useNavigate();
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Planos</h1>
          <p className="text-muted-foreground">Gerencie os planos de assinatura do seu CRM</p>
        </div>
        <Button onClick={() => navigate(routes.admin.newPlan)}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Plano
        </Button>
      </div>

      {/* Plans Overview */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Planos Ativos</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockPlans.filter(p => p.isActive).length}</div>
            <p className="text-xs text-muted-foreground">De {mockPlans.length} planos criados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita Total</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              R$ {mockPlans.reduce((acc, plan) => acc + plan.price, 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Potencial mensal</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Plano Mais Popular</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Profissional</div>
            <p className="text-xs text-muted-foreground">Baseado em assinaturas ativas</p>
          </CardContent>
        </Card>
      </div>

      {/* Plans Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {mockPlans.map((plan) => (
          <Card key={plan.id} className="relative">
            {plan.name === 'Profissional' && (
              <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
                <Badge className="bg-primary text-primary-foreground">Mais Popular</Badge>
              </div>
            )}
            
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                {plan.isActive ? (
                  <Badge variant="default">Ativo</Badge>
                ) : (
                  <Badge variant="secondary">Inativo</Badge>
                )}
              </div>
              <CardDescription>{plan.description}</CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <div className="text-center">
                <div className="text-3xl font-bold">R$ {plan.price}</div>
                <div className="text-sm text-muted-foreground">
                  por {plan.billingCycle === 'monthly' ? 'mês' : 'ano'}
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium">Limites:</div>
                <div className="text-sm text-muted-foreground">
                  • {plan.maxUsers === -1 ? 'Usuários ilimitados' : `Até ${plan.maxUsers} usuários`}
                </div>
                <div className="text-sm text-muted-foreground">
                  • {plan.maxCases === -1 ? 'Casos ilimitados' : `Até ${plan.maxCases} casos`}
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium">Recursos inclusos:</div>
                <div className="space-y-1">
                  {plan.features.map((feature, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Check className="h-3 w-3 text-green-500" />
                      {feature}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button variant="outline" size="sm" className="flex-1">
                  Editar
                </Button>
                <Button 
                  variant={plan.isActive ? "destructive" : "default"} 
                  size="sm" 
                  className="flex-1"
                >
                  {plan.isActive ? 'Desativar' : 'Ativar'}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Plan Comparison */}
      <Card>
        <CardHeader>
          <CardTitle>Comparação de Planos</CardTitle>
          <CardDescription>Visualize as diferenças entre os planos disponíveis</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Recurso</th>
                  {mockPlans.map((plan) => (
                    <th key={plan.id} className="text-center py-2 min-w-[120px]">
                      {plan.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="text-sm">
                <tr className="border-b">
                  <td className="py-2 font-medium">Preço mensal</td>
                  {mockPlans.map((plan) => (
                    <td key={plan.id} className="text-center py-2">
                      R$ {plan.price}
                    </td>
                  ))}
                </tr>
                <tr className="border-b">
                  <td className="py-2 font-medium">Usuários</td>
                  {mockPlans.map((plan) => (
                    <td key={plan.id} className="text-center py-2">
                      {plan.maxUsers === -1 ? 'Ilimitado' : plan.maxUsers}
                    </td>
                  ))}
                </tr>
                <tr className="border-b">
                  <td className="py-2 font-medium">Casos</td>
                  {mockPlans.map((plan) => (
                    <td key={plan.id} className="text-center py-2">
                      {plan.maxCases === -1 ? 'Ilimitado' : plan.maxCases}
                    </td>
                  ))}
                </tr>
                <tr className="border-b">
                  <td className="py-2 font-medium">Suporte prioritário</td>
                  {mockPlans.map((plan) => (
                    <td key={plan.id} className="text-center py-2">
                      {plan.features.some(f => f.includes('prioritário') || f.includes('24/7')) ? (
                        <Check className="h-4 w-4 text-green-500 mx-auto" />
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                  ))}
                </tr>
                <tr className="border-b">
                  <td className="py-2 font-medium">API Access</td>
                  {mockPlans.map((plan) => (
                    <td key={plan.id} className="text-center py-2">
                      {plan.features.some(f => f.includes('API')) ? (
                        <Check className="h-4 w-4 text-green-500 mx-auto" />
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}