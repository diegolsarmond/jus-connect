import { useMemo, useState } from "react";
import {
  User as UserIcon,
  MapPin,
  Briefcase,
  Scale,
  Bell,
  Shield,
  Calendar,
  Clock,
  Building,
  Link,
  FileText,
  Activity,
} from "lucide-react";
import { AvatarUploader } from "@/components/profile/AvatarUploader";
import { EditableField } from "@/components/profile/EditableField";
import { ProfileCard } from "@/components/profile/ProfileCard";
import { AuditTimeline } from "@/components/profile/AuditTimeline";
import { SessionsList } from "@/components/profile/SessionsList";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import type { AuditLog, UserSession } from "@/types/user";

interface ProfileData {
  id: string;
  name: string;
  title: string;
  email: string;
  phone: string;
  bio: string;
  office: string;
  oabNumber?: string;
  oabUf?: string;
  specialties: string[];
  hourlyRate?: number;
  timezone: string;
  language: string;
  linkedin?: string;
  website?: string;
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
  };
  notifications: {
    securityAlerts: boolean;
    agendaReminders: boolean;
    newsletter: boolean;
  };
  security: {
    twoFactor: boolean;
    loginAlerts: boolean;
    deviceApproval: boolean;
  };
  lastLogin: Date;
  memberSince: Date;
  avatar?: string;
}

const initialProfile: ProfileData = {
  id: "me",
  name: "Dr. Diego Armond",
  title: "Advogado Sênior",
  email: "diego.armond@jusconnect.com",
  phone: "(11) 99876-5432",
  bio: "Atuo há mais de 10 anos em direito empresarial e digital, auxiliando empresas em questões contratuais complexas, governança corporativa e proteção de dados.",
  office: "JusConnect - Matriz",
  oabNumber: "123456",
  oabUf: "SP",
  specialties: ["Direito Empresarial", "Direito Digital", "Contratos"],
  hourlyRate: 450,
  timezone: "America/Sao_Paulo",
  language: "Português (Brasil)",
  linkedin: "https://www.linkedin.com/in/diego-armond",
  website: "https://jusconnect.com/diego-armond",
  address: {
    street: "Av. Paulista, 1000",
    city: "São Paulo",
    state: "SP",
    zip: "01310-100",
  },
  notifications: {
    securityAlerts: true,
    agendaReminders: true,
    newsletter: false,
  },
  security: {
    twoFactor: true,
    loginAlerts: true,
    deviceApproval: false,
  },
  lastLogin: new Date("2024-02-12T08:45:00"),
  memberSince: new Date("2021-03-10T10:00:00"),
  avatar: undefined,
};

const initialAuditLogs: AuditLog[] = [
  {
    id: "log-1",
    userId: "me",
    action: "LOGIN",
    description: "Login realizado no portal web",
    timestamp: new Date("2024-02-12T08:45:00"),
    performedBy: "Dr. Diego Armond",
  },
  {
    id: "log-2",
    userId: "me",
    action: "TWO_FACTOR_ENABLED",
    description: "Autenticação de dois fatores ativada",
    timestamp: new Date("2024-02-10T11:20:00"),
    performedBy: "Dr. Diego Armond",
  },
  {
    id: "log-3",
    userId: "me",
    action: "PROFILE_UPDATE",
    description: "Informações profissionais atualizadas",
    timestamp: new Date("2024-02-05T16:10:00"),
    performedBy: "Dr. Diego Armond",
  },
];

const initialSessions: UserSession[] = [
  {
    id: "session-1",
    userId: "me",
    device: "Chrome 120.0 - macOS",
    location: "São Paulo, SP - Brasil",
    lastActivity: new Date("2024-02-12T08:45:00"),
    isActive: true,
  },
  {
    id: "session-2",
    userId: "me",
    device: "Safari 17.2 - iPhone",
    location: "São Paulo, SP - Brasil",
    lastActivity: new Date("2024-02-11T22:10:00"),
    isActive: true,
  },
  {
    id: "session-3",
    userId: "me",
    device: "Edge 120.0 - Windows 11",
    location: "Campinas, SP - Brasil",
    lastActivity: new Date("2024-02-08T18:30:00"),
    isActive: false,
  },
];

const formatCurrency = (value?: number) => {
  if (value == null) return "Não informado";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(value);
};

const formatDate = (date: Date) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);

const validateRequired = (value: string) =>
  value.trim().length === 0 ? "Campo obrigatório" : null;

const validateEmail = (value: string) => {
  if (value.trim().length === 0) return "Campo obrigatório";
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(value) ? null : "Informe um e-mail válido";
};

const validatePhone = (value: string) => {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 10 ? null : "Informe um telefone válido";
};

const validateZip = (value: string) => {
  if (!value) return "Campo obrigatório";
  const zipRegex = /^\d{5}-?\d{3}$/;
  return zipRegex.test(value) ? null : "CEP inválido";
};

const validateUrl = (value: string) => {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (!url.protocol.startsWith("http")) {
      return "Use uma URL iniciando com http ou https";
    }
    return null;
  } catch (error) {
    return "URL inválida";
  }
};

const validateHourlyRate = (value: string) => {
  if (!value) return null;
  const normalized = value.replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isNaN(parsed) ? "Informe um valor numérico" : null;
};

const specialtiesToString = (specialties: string[]) => specialties.join(", ");

export default function MeuPerfil() {
  const [profile, setProfile] = useState<ProfileData>(initialProfile);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(initialAuditLogs);
  const [sessions, setSessions] = useState<UserSession[]>(initialSessions);
  const [avatarPreview, setAvatarPreview] = useState<string | undefined>(initialProfile.avatar);

  const initials = useMemo(
    () =>
      profile.name
        .split(" ")
        .filter(Boolean)
        .map((word) => word[0])
        .join("")
        .toUpperCase(),
    [profile.name],
  );

  const addAuditLog = (action: AuditLog["action"], description: string, performedByName?: string) => {
    setAuditLogs((previous) => [
      {
        id: `log-${Date.now()}`,
        userId: profile.id,
        action,
        description,
        timestamp: new Date(),
        performedBy: performedByName ?? profile.name,
      },
      ...previous,
    ]);
  };

  const handleFieldSave = (field: keyof ProfileData, value: string) => {
    setProfile((prev) => ({ ...prev, [field]: value }));
    const description = `Campo "${field}" atualizado.`;
    const performedByName = field === "name" ? value : undefined;
    const action = field === "email" ? "EMAIL_CHANGE" : "PROFILE_UPDATE";
    addAuditLog(action, description, performedByName);
  };

  const handleAddressSave = (field: keyof ProfileData["address"], value: string) => {
    setProfile((prev) => ({
      ...prev,
      address: {
        ...prev.address,
        [field]: value,
      },
    }));
    addAuditLog("PROFILE_UPDATE", `Endereço atualizado: campo ${field}.`);
  };

  const handleSpecialtiesSave = (value: string) => {
    const specialties = value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    setProfile((prev) => ({ ...prev, specialties }));
    addAuditLog("PROFILE_UPDATE", "Especialidades atualizadas.");
  };

  const handleHourlyRateSave = (value: string) => {
    const normalized = value.replace(/\./g, "").replace(",", ".");
    const parsed = value ? Number(normalized) : undefined;
    setProfile((prev) => ({ ...prev, hourlyRate: parsed }));
    addAuditLog("PROFILE_UPDATE", "Tarifa por hora atualizada.");
  };

  const handleNotificationToggle = (
    field: keyof ProfileData["notifications"],
    checked: boolean,
  ) => {
    const labels = {
      securityAlerts: "Alertas de segurança",
      agendaReminders: "Lembretes da agenda",
      newsletter: "Newsletter",
    } satisfies Record<keyof ProfileData["notifications"], string>;

    setProfile((prev) => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        [field]: checked,
      },
    }));
    addAuditLog(
      "PROFILE_UPDATE",
      `${labels[field]} ${checked ? "ativado" : "desativado"}.`,
    );
  };

  const handleSecurityToggle = (
    field: keyof ProfileData["security"],
    checked: boolean,
  ) => {
    const labels = {
      twoFactor: "Autenticação de dois fatores",
      loginAlerts: "Alertas de login",
      deviceApproval: "Aprovação de novos dispositivos",
    } satisfies Record<keyof ProfileData["security"], string>;

    setProfile((prev) => ({
      ...prev,
      security: {
        ...prev.security,
        [field]: checked,
      },
    }));

    if (field === "twoFactor") {
      addAuditLog(
        checked ? "TWO_FACTOR_ENABLED" : "TWO_FACTOR_DISABLED",
        `${labels[field]} ${checked ? "ativada" : "desativada"}.`,
      );
      return;
    }

    addAuditLog(
      "PERMISSION_CHANGE",
      `${labels[field]} ${checked ? "ativado" : "desativado"}.`,
    );
  };

  const handleAvatarChange = (file: File | null) => {
    if (file) {
      const objectUrl = URL.createObjectURL(file);
      setAvatarPreview((prev) => {
        if (prev && prev.startsWith("blob:")) {
          URL.revokeObjectURL(prev);
        }
        return objectUrl;
      });
      setProfile((prev) => ({ ...prev, avatar: objectUrl }));
      addAuditLog("PROFILE_UPDATE", "Avatar atualizado.");
    } else {
      setAvatarPreview((prev) => {
        if (prev && prev.startsWith("blob:")) {
          URL.revokeObjectURL(prev);
        }
        return undefined;
      });
      setProfile((prev) => ({ ...prev, avatar: undefined }));
      addAuditLog("PROFILE_UPDATE", "Avatar removido.");
    }
  };

  const handleRevokeSession = (sessionId: string) => {
    const session = sessions.find((item) => item.id === sessionId);
    setSessions((prev) =>
      prev.map((item) =>
        item.id === sessionId
          ? { ...item, isActive: false, lastActivity: new Date() }
          : item,
      ),
    );
    if (session) {
      addAuditLog(
        "STATUS_CHANGE",
        `Sessão revogada: ${session.device}.`,
      );
    }
  };

  const handleRevokeAllSessions = () => {
    setSessions((prev) =>
      prev.map((item) =>
        item.isActive
          ? { ...item, isActive: false, lastActivity: new Date() }
          : item,
      ),
    );
    addAuditLog(
      "STATUS_CHANGE",
      "Todas as sessões ativas foram revogadas.",
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold text-foreground">Meu Perfil</h1>
        <p className="text-muted-foreground">
          Personalize suas informações profissionais, controle seus acessos e mantenha seus dados sempre atualizados.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <ProfileCard title="Identidade Profissional" icon={<UserIcon className="h-5 w-5" />}>
            <div className="flex flex-col gap-6 md:flex-row">
              <AvatarUploader
                currentAvatar={avatarPreview ?? profile.avatar}
                userName={profile.name}
                onAvatarChange={handleAvatarChange}
                size="lg"
              />

              <div className="grid flex-1 gap-4">
                <EditableField
                  label="Nome Completo"
                  value={profile.name}
                  onSave={(value) => handleFieldSave("name", value)}
                  validation={validateRequired}
                />
                <EditableField
                  label="Título Profissional"
                  value={profile.title}
                  onSave={(value) => handleFieldSave("title", value)}
                  validation={validateRequired}
                />
                <EditableField
                  label="E-mail"
                  type="email"
                  value={profile.email}
                  onSave={(value) => handleFieldSave("email", value)}
                  validation={validateEmail}
                />
                <EditableField
                  label="Telefone"
                  type="tel"
                  value={profile.phone}
                  onSave={(value) => handleFieldSave("phone", value)}
                  validation={validatePhone}
                />
              </div>
            </div>
          </ProfileCard>

          <ProfileCard title="Biografia" icon={<FileText className="h-5 w-5" />}>
            <EditableField
              label="Sobre você"
              type="textarea"
              value={profile.bio}
              onSave={(value) => handleFieldSave("bio", value)}
              placeholder="Compartilhe sua experiência, áreas de atuação e principais cases."
            />
          </ProfileCard>

          <ProfileCard title="Informações Profissionais" icon={<Briefcase className="h-5 w-5" />}>
            <div className="grid gap-4 md:grid-cols-2">
              <EditableField
                label="Escritório"
                value={profile.office}
                onSave={(value) => handleFieldSave("office", value)}
                validation={validateRequired}
              />
              <EditableField
                label="Tarifa por hora"
                value={profile.hourlyRate ? profile.hourlyRate.toString() : ""}
                onSave={handleHourlyRateSave}
                validation={validateHourlyRate}
                placeholder="Ex: 450"
              />
              <EditableField
                label="Número da OAB"
                value={profile.oabNumber ?? ""}
                onSave={(value) => handleFieldSave("oabNumber", value)}
              />
              <EditableField
                label="UF da OAB"
                value={profile.oabUf ?? ""}
                onSave={(value) => handleFieldSave("oabUf", value.toUpperCase())}
                placeholder="Ex: SP"
              />
              <EditableField
                label="Especialidades"
                value={specialtiesToString(profile.specialties)}
                onSave={handleSpecialtiesSave}
                placeholder="Separe por vírgulas"
              />
              <EditableField
                label="Idioma principal"
                value={profile.language}
                onSave={(value) => handleFieldSave("language", value)}
              />
              <EditableField
                label="Fuso horário"
                value={profile.timezone}
                onSave={(value) => handleFieldSave("timezone", value)}
                placeholder="Ex: America/Sao_Paulo"
              />
            </div>
          </ProfileCard>

          <ProfileCard title="Localização" icon={<MapPin className="h-5 w-5" />}>
            <div className="grid gap-4 md:grid-cols-2">
              <EditableField
                label="Endereço"
                value={profile.address.street}
                onSave={(value) => handleAddressSave("street", value)}
                validation={validateRequired}
              />
              <EditableField
                label="Cidade"
                value={profile.address.city}
                onSave={(value) => handleAddressSave("city", value)}
                validation={validateRequired}
              />
              <EditableField
                label="Estado"
                value={profile.address.state}
                onSave={(value) => handleAddressSave("state", value.toUpperCase())}
                validation={validateRequired}
              />
              <EditableField
                label="CEP"
                value={profile.address.zip}
                onSave={(value) => handleAddressSave("zip", value)}
                validation={validateZip}
                placeholder="00000-000"
              />
            </div>
          </ProfileCard>

          <ProfileCard title="Presença Digital" icon={<Link className="h-5 w-5" />}>
            <div className="grid gap-4 md:grid-cols-2">
              <EditableField
                label="LinkedIn"
                value={profile.linkedin ?? ""}
                onSave={(value) => handleFieldSave("linkedin", value)}
                validation={validateUrl}
                placeholder="https://www.linkedin.com/in/..."
              />
              <EditableField
                label="Website"
                value={profile.website ?? ""}
                onSave={(value) => handleFieldSave("website", value)}
                validation={validateUrl}
                placeholder="https://"
              />
            </div>
          </ProfileCard>

          <ProfileCard title="Preferências e Segurança" icon={<Shield className="h-5 w-5" />}>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">Autenticação de dois fatores</p>
                    <p className="text-sm text-muted-foreground">
                      Requer código adicional no login para reforçar sua segurança.
                    </p>
                  </div>
                  <Switch
                    checked={profile.security.twoFactor}
                    onCheckedChange={(checked) => handleSecurityToggle("twoFactor", Boolean(checked))}
                  />
                </div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">Alertas de login</p>
                    <p className="text-sm text-muted-foreground">
                      Receba notificações ao acessar de novos dispositivos.
                    </p>
                  </div>
                  <Switch
                    checked={profile.security.loginAlerts}
                    onCheckedChange={(checked) => handleSecurityToggle("loginAlerts", Boolean(checked))}
                  />
                </div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">Aprovação de dispositivos</p>
                    <p className="text-sm text-muted-foreground">
                      Exigir aprovação manual para novos acessos.
                    </p>
                  </div>
                  <Switch
                    checked={profile.security.deviceApproval}
                    onCheckedChange={(checked) => handleSecurityToggle("deviceApproval", Boolean(checked))}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">Alertas de segurança</p>
                    <p className="text-sm text-muted-foreground">
                      Receba e-mails sobre eventos críticos da conta.
                    </p>
                  </div>
                  <Switch
                    checked={profile.notifications.securityAlerts}
                    onCheckedChange={(checked) => handleNotificationToggle("securityAlerts", Boolean(checked))}
                  />
                </div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">Lembretes da agenda</p>
                    <p className="text-sm text-muted-foreground">
                      Envio automático de lembretes das suas audiências e tarefas.
                    </p>
                  </div>
                  <Switch
                    checked={profile.notifications.agendaReminders}
                    onCheckedChange={(checked) => handleNotificationToggle("agendaReminders", Boolean(checked))}
                  />
                </div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">Newsletter mensal</p>
                    <p className="text-sm text-muted-foreground">
                      Receba novidades e materiais exclusivos da JusConnect.
                    </p>
                  </div>
                  <Switch
                    checked={profile.notifications.newsletter}
                    onCheckedChange={(checked) => handleNotificationToggle("newsletter", Boolean(checked))}
                  />
                </div>
              </div>
            </div>
          </ProfileCard>
        </div>

        <div className="space-y-6">
          <ProfileCard title="Visão Geral" icon={<Calendar className="h-5 w-5" />}>
            <div className="flex flex-col items-center gap-4 text-center">
              <Avatar className="h-20 w-20">
                <AvatarImage src={profile.avatar} alt={profile.name} />
                <AvatarFallback className="bg-primary text-primary-foreground text-xl font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-1">
                <h2 className="text-xl font-semibold text-foreground">{profile.name}</h2>
                <p className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                  <Briefcase className="h-4 w-4" />
                  {profile.title}
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                <Badge variant="outline" className="flex items-center gap-1">
                  <Building className="h-3 w-3" />
                  {profile.office}
                </Badge>
                {profile.oabNumber && profile.oabUf && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <Scale className="h-3 w-3" />
                    OAB {profile.oabNumber}/{profile.oabUf}
                  </Badge>
                )}
              </div>

              {profile.specialties.length > 0 && (
                <div className="w-full space-y-2">
                  <p className="text-sm font-medium text-foreground">Especialidades</p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {profile.specialties.map((item) => (
                      <Badge key={item} variant="outline">
                        {item}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="w-full rounded-lg border bg-muted/30 p-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Tarifa hora</span>
                  <span className="font-medium text-foreground">{formatCurrency(profile.hourlyRate)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Último acesso
                  </span>
                  <span>{formatDate(profile.lastLogin)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> Membro desde
                  </span>
                  <span>{formatDate(profile.memberSince)}</span>
                </div>
              </div>

              <Button variant="outline" className="w-full">
                <Bell className="mr-2 h-4 w-4" /> Configurar notificações
              </Button>
            </div>
          </ProfileCard>

          <ProfileCard title="Atividade Recente" icon={<Activity className="h-5 w-5" />}>
            <AuditTimeline logs={auditLogs} maxItems={5} />
          </ProfileCard>

          <ProfileCard title="Sessões e Dispositivos" icon={<Shield className="h-5 w-5" />}>
            <SessionsList
              sessions={sessions}
              onRevokeSession={handleRevokeSession}
              onRevokeAllSessions={handleRevokeAllSessions}
            />
          </ProfileCard>
        </div>
      </div>
    </div>
  );
}
