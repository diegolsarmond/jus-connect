import { useState } from "react";
import { ArrowLeft, Bell, Mail, Smartphone, MessageSquare, Calendar, Shield, FileText, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ProfileCard } from "@/components/profile/ProfileCard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface NotificationSettings {
  email: {
    newMessages: boolean;
    appointments: boolean;
    deadlines: boolean;
    systemUpdates: boolean;
    securityAlerts: boolean;
    teamActivity: boolean;
  };
  push: {
    newMessages: boolean;
    appointments: boolean;
    deadlines: boolean;
    securityAlerts: boolean;
  };
  sms: {
    appointments: boolean;
    securityAlerts: boolean;
    emergencyOnly: boolean;
  };
  frequency: {
    emailDigest: string;
    reminderTiming: string;
  };
}

export default function NotificacoesPreferencias() {
  const [settings, setSettings] = useState<NotificationSettings>({
    email: {
      newMessages: true,
      appointments: true,
      deadlines: true,
      systemUpdates: false,
      securityAlerts: true,
      teamActivity: true,
    },
    push: {
      newMessages: true,
      appointments: true,
      deadlines: true,
      securityAlerts: true,
    },
    sms: {
      appointments: false,
      securityAlerts: true,
      emergencyOnly: true,
    },
    frequency: {
      emailDigest: "daily",
      reminderTiming: "1hour",
    },
  });

  const [isDirty, setIsDirty] = useState(false);

  const updateSetting = (category: keyof NotificationSettings, key: string, value: boolean | string) => {
    setSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: value
      }
    }));
    setIsDirty(true);
  };

  const handleSave = () => {
    console.log("Saving notification settings:", settings);
    setIsDirty(false);
    // Show success toast
  };

  const NotificationSwitch = ({ 
    label, 
    description, 
    checked, 
    onChange,
    icon
  }: {
    label: string;
    description: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
    icon: React.ReactNode;
  }) => (
    <div className="flex items-start justify-between py-3">
      <div className="flex items-start gap-3 flex-1">
        <div className="p-1 mt-1">
          {icon}
        </div>
        <div className="space-y-1">
          <Label className="text-sm font-medium">{label}</Label>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Notificações e Preferências</h1>
            <p className="text-muted-foreground">Configure como e quando você quer ser notificado</p>
          </div>
        </div>

        <Button onClick={handleSave} disabled={!isDirty} className="bg-primary hover:bg-primary-hover">
          Salvar Alterações
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Email Notifications */}
          <ProfileCard title="Notificações por Email" icon={<Mail className="h-5 w-5" />}>
            <div className="space-y-1">
              <NotificationSwitch
                label="Novas mensagens"
                description="Receba emails quando alguém enviar uma mensagem para você"
                checked={settings.email.newMessages}
                onChange={(checked) => updateSetting('email', 'newMessages', checked)}
                icon={<MessageSquare className="h-4 w-4 text-muted-foreground" />}
              />
              
              <Separator />
              
              <NotificationSwitch
                label="Compromissos e reuniões"
                description="Lembretes sobre próximos compromissos na agenda"
                checked={settings.email.appointments}
                onChange={(checked) => updateSetting('email', 'appointments', checked)}
                icon={<Calendar className="h-4 w-4 text-muted-foreground" />}
              />
              
              <Separator />
              
              <NotificationSwitch
                label="Prazos e deadlines"
                description="Alertas sobre prazos processuais se aproximando"
                checked={settings.email.deadlines}
                onChange={(checked) => updateSetting('email', 'deadlines', checked)}
                icon={<Bell className="h-4 w-4 text-muted-foreground" />}
              />
              
              <Separator />
              
              <NotificationSwitch
                label="Atualizações do sistema"
                description="Novidades, melhorias e mudanças na plataforma"
                checked={settings.email.systemUpdates}
                onChange={(checked) => updateSetting('email', 'systemUpdates', checked)}
                icon={<FileText className="h-4 w-4 text-muted-foreground" />}
              />
              
              <Separator />
              
              <NotificationSwitch
                label="Alertas de segurança"
                description="Notificações sobre login suspeito e atividades de segurança"
                checked={settings.email.securityAlerts}
                onChange={(checked) => updateSetting('email', 'securityAlerts', checked)}
                icon={<Shield className="h-4 w-4 text-muted-foreground" />}
              />
              
              <Separator />
              
              <NotificationSwitch
                label="Atividade da equipe"
                description="Atualizações sobre processos e clientes da sua equipe"
                checked={settings.email.teamActivity}
                onChange={(checked) => updateSetting('email', 'teamActivity', checked)}
                icon={<Users className="h-4 w-4 text-muted-foreground" />}
              />
            </div>
          </ProfileCard>

          {/* Push Notifications */}
          <ProfileCard title="Notificações Push" icon={<Smartphone className="h-5 w-5" />}>
            <div className="space-y-1">
              <NotificationSwitch
                label="Novas mensagens"
                description="Notificações instantâneas no navegador e dispositivo"
                checked={settings.push.newMessages}
                onChange={(checked) => updateSetting('push', 'newMessages', checked)}
                icon={<MessageSquare className="h-4 w-4 text-muted-foreground" />}
              />
              
              <Separator />
              
              <NotificationSwitch
                label="Compromissos"
                description="Lembretes 15 minutos antes dos compromissos"
                checked={settings.push.appointments}
                onChange={(checked) => updateSetting('push', 'appointments', checked)}
                icon={<Calendar className="h-4 w-4 text-muted-foreground" />}
              />
              
              <Separator />
              
              <NotificationSwitch
                label="Prazos urgentes"
                description="Alertas para prazos que vencem em 24 horas"
                checked={settings.push.deadlines}
                onChange={(checked) => updateSetting('push', 'deadlines', checked)}
                icon={<Bell className="h-4 w-4 text-muted-foreground" />}
              />
              
              <Separator />
              
              <NotificationSwitch
                label="Alertas de segurança"
                description="Notificações imediatas sobre atividades suspeitas"
                checked={settings.push.securityAlerts}
                onChange={(checked) => updateSetting('push', 'securityAlerts', checked)}
                icon={<Shield className="h-4 w-4 text-muted-foreground" />}
              />
            </div>
          </ProfileCard>

          {/* SMS Notifications */}
          <ProfileCard title="Notificações por SMS" icon={<MessageSquare className="h-5 w-5" />}>
            <div className="space-y-1">
              <NotificationSwitch
                label="Compromissos importantes"
                description="SMS para audiências e reuniões críticas"
                checked={settings.sms.appointments}
                onChange={(checked) => updateSetting('sms', 'appointments', checked)}
                icon={<Calendar className="h-4 w-4 text-muted-foreground" />}
              />
              
              <Separator />
              
              <NotificationSwitch
                label="Alertas de segurança"
                description="SMS para tentativas de login suspeitas"
                checked={settings.sms.securityAlerts}
                onChange={(checked) => updateSetting('sms', 'securityAlerts', checked)}
                icon={<Shield className="h-4 w-4 text-muted-foreground" />}
              />
              
              <Separator />
              
              <NotificationSwitch
                label="Apenas emergências"
                description="Limitar SMS apenas para situações críticas"
                checked={settings.sms.emergencyOnly}
                onChange={(checked) => updateSetting('sms', 'emergencyOnly', checked)}
                icon={<Bell className="h-4 w-4 text-muted-foreground" />}
              />
            </div>
          </ProfileCard>

          {/* Frequency Settings */}
          <ProfileCard title="Frequência e Timing" icon={<Bell className="h-5 w-5" />}>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email-digest">Resumo por email</Label>
                <Select 
                  value={settings.frequency.emailDigest} 
                  onValueChange={(value) => updateSetting('frequency', 'emailDigest', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="realtime">Tempo real</SelectItem>
                    <SelectItem value="hourly">A cada hora</SelectItem>
                    <SelectItem value="daily">Diário</SelectItem>
                    <SelectItem value="weekly">Semanal</SelectItem>
                    <SelectItem value="never">Nunca</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reminder-timing">Lembretes de compromissos</Label>
                <Select 
                  value={settings.frequency.reminderTiming} 
                  onValueChange={(value) => updateSetting('frequency', 'reminderTiming', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15min">15 minutos antes</SelectItem>
                    <SelectItem value="30min">30 minutos antes</SelectItem>
                    <SelectItem value="1hour">1 hora antes</SelectItem>
                    <SelectItem value="2hours">2 horas antes</SelectItem>
                    <SelectItem value="1day">1 dia antes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </ProfileCard>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <ProfileCard title="Ações Rápidas" variant="compact">
            <div className="space-y-2">
              <Button variant="outline" size="sm" className="w-full">
                Testar Notificações
              </Button>
              <Button variant="outline" size="sm" className="w-full">
                Silenciar por 1 hora
              </Button>
              <Button variant="outline" size="sm" className="w-full">
                Restaurar Padrões
              </Button>
            </div>
          </ProfileCard>

          {/* Notification Summary */}
          <ProfileCard title="Resumo" variant="compact">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Email ativo</span>
                <span className="text-sm font-medium">
                  {Object.values(settings.email).filter(Boolean).length}/6
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Push ativo</span>
                <span className="text-sm font-medium">
                  {Object.values(settings.push).filter(Boolean).length}/4
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">SMS ativo</span>
                <span className="text-sm font-medium">
                  {Object.values(settings.sms).filter(Boolean).length}/3
                </span>
              </div>
            </div>
          </ProfileCard>

          {/* Do Not Disturb */}
          <ProfileCard title="Não Perturbe" variant="compact">
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Configure horários para pausar notificações não urgentes
              </p>
              <div className="space-y-2">
                <Label className="text-sm">Horário de descanso</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Select defaultValue="22:00">
                    <SelectTrigger className="text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="20:00">20:00</SelectItem>
                      <SelectItem value="21:00">21:00</SelectItem>
                      <SelectItem value="22:00">22:00</SelectItem>
                      <SelectItem value="23:00">23:00</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select defaultValue="07:00">
                    <SelectTrigger className="text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="06:00">06:00</SelectItem>
                      <SelectItem value="07:00">07:00</SelectItem>
                      <SelectItem value="08:00">08:00</SelectItem>
                      <SelectItem value="09:00">09:00</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Switch />
            </div>
          </ProfileCard>

          {/* Contact Preferences */}
          <ProfileCard title="Preferências de Contato" variant="compact">
            <div className="space-y-3">
              <div className="space-y-2">
                <Label className="text-sm">Telefone principal</Label>
                <p className="text-sm text-muted-foreground">(11) 99999-9999</p>
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Email principal</Label>
                <p className="text-sm text-muted-foreground">joao.silva@escritorio.com.br</p>
              </div>
              <Button variant="outline" size="sm" className="w-full">
                Alterar Contatos
              </Button>
            </div>
          </ProfileCard>
        </div>
      </div>
    </div>
  );
}