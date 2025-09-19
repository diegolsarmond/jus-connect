import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { 
  Settings as SettingsIcon, 
  CreditCard, 
  Bell, 
  Shield, 
  Globe, 
  Database,
  Webhook,
  Mail,
  Key,
  Users
} from "lucide-react";

export default function Settings() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Configurações</h1>
        <p className="text-muted-foreground">Gerencie as configurações do seu sistema CRM SaaS</p>
      </div>

      {/* System Configuration */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <SettingsIcon className="h-5 w-5" />
            <CardTitle>Configurações Gerais</CardTitle>
          </div>
          <CardDescription>Configurações básicas do sistema</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="company-name">Nome da Empresa</Label>
              <Input id="company-name" placeholder="CRM SaaS Ltd." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="support-email">Email de Suporte</Label>
              <Input id="support-email" type="email" placeholder="suporte@crmsaas.com" />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="app-url">URL da Aplicação</Label>
            <Input id="app-url" placeholder="https://app.crmsaas.com" />
          </div>

          <Separator />

          <div className="space-y-4">
            <h4 className="text-sm font-medium">Configurações de Sistema</h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Manutenção</Label>
                  <p className="text-sm text-muted-foreground">Ativar modo de manutenção</p>
                </div>
                <Switch />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Debug Mode</Label>
                  <p className="text-sm text-muted-foreground">Mostrar logs detalhados</p>
                </div>
                <Switch />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Auto Backup</Label>
                  <p className="text-sm text-muted-foreground">Backup automático diário</p>
                </div>
                <Switch defaultChecked />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            <CardTitle>Configurações de Pagamento</CardTitle>
          </div>
          <CardDescription>Configurações do gateway de pagamento</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-primary rounded flex items-center justify-center">
                <span className="text-xs font-bold text-primary-foreground">S</span>
              </div>
              <div>
                <p className="font-medium">Stripe</p>
                <p className="text-sm text-muted-foreground">Gateway principal</p>
              </div>
            </div>
            <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
              Conectado
            </Badge>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="stripe-public">Stripe Public Key</Label>
              <Input id="stripe-public" placeholder="pk_live_..." type="password" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="stripe-secret">Stripe Secret Key</Label>
              <Input id="stripe-secret" placeholder="sk_live_..." type="password" />
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-sm font-medium">Configurações de Cobrança</h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Cobrança Automática</Label>
                  <p className="text-sm text-muted-foreground">Processar pagamentos automaticamente</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Retry Failed Payments</Label>
                  <p className="text-sm text-muted-foreground">Tentar novamente pagamentos falhados</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Prorated Upgrades</Label>
                  <p className="text-sm text-muted-foreground">Calcular proporcionalmente upgrades</p>
                </div>
                <Switch defaultChecked />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* API & Webhooks */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              <CardTitle>API Configuration</CardTitle>
            </div>
            <CardDescription>Configurações da API REST</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="api-key">API Key</Label>
              <Input id="api-key" placeholder="••••••••••••••••" type="password" />
              <Button variant="outline" size="sm">Gerar Nova Chave</Button>
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Rate Limiting</Label>
                  <p className="text-sm text-muted-foreground">1000 req/min por key</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>API Logs</Label>
                  <p className="text-sm text-muted-foreground">Registrar chamadas API</p>
                </div>
                <Switch defaultChecked />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Webhook className="h-5 w-5" />
              <CardTitle>Webhooks</CardTitle>
            </div>
            <CardDescription>Configurações de webhooks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="webhook-url">URL do Webhook</Label>
              <Input id="webhook-url" placeholder="https://seu-crm.com/webhooks" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="webhook-secret">Secret</Label>
              <Input id="webhook-secret" placeholder="••••••••••••••••" type="password" />
            </div>

            <div className="space-y-3">
              <Label>Eventos</Label>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Switch defaultChecked />
                  <Label>customer.created</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch defaultChecked />
                  <Label>subscription.updated</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch />
                  <Label>payment.failed</Label>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Notifications & Security */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              <CardTitle>Notificações</CardTitle>
            </div>
            <CardDescription>Configurações de notificação</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Email Notifications</Label>
                  <p className="text-sm text-muted-foreground">Receber notificações por email</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Slack Integration</Label>
                  <p className="text-sm text-muted-foreground">Enviar alertas para Slack</p>
                </div>
                <Switch />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Payment Alerts</Label>
                  <p className="text-sm text-muted-foreground">Alertas de pagamento</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Churn Alerts</Label>
                  <p className="text-sm text-muted-foreground">Alertas de cancelamento</p>
                </div>
                <Switch defaultChecked />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              <CardTitle>Segurança</CardTitle>
            </div>
            <CardDescription>Configurações de segurança</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Two-Factor Auth</Label>
                  <p className="text-sm text-muted-foreground">Autenticação em duas etapas</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Password Policy</Label>
                  <p className="text-sm text-muted-foreground">Política de senhas forte</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Session Timeout</Label>
                  <p className="text-sm text-muted-foreground">Timeout em 30 minutos</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Audit Logs</Label>
                  <p className="text-sm text-muted-foreground">Logs de auditoria</p>
                </div>
                <Switch defaultChecked />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Save Settings */}
      <div className="flex justify-end">
        <Button size="lg">
          Salvar Configurações
        </Button>
      </div>
    </div>
  );
}