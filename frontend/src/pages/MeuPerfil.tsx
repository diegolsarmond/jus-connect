import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Bell,
  Briefcase,
  Building,
  Calendar,
  Clock,
  FileText,
  Link,
  MapPin,
  Scale,
  Shield,
  User as UserIcon,
} from "lucide-react";
import { AvatarUploader } from "@/components/profile/AvatarUploader";
import { AuditTimeline } from "@/components/profile/AuditTimeline";
import { EditableField } from "@/components/profile/EditableField";
import { ProfileCard } from "@/components/profile/ProfileCard";
import { SessionsList } from "@/components/profile/SessionsList";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  fetchMeuPerfil,
  fetchMeuPerfilAuditLogs,
  fetchMeuPerfilSessions,
  revokeMeuPerfilSession,
  revokeTodasMeuPerfilSessions,
  updateMeuPerfil,
  type MeuPerfilProfile,
  type UpdateMeuPerfilPayload,
} from "@/services/meuPerfil";
import type { AuditLog, UserSession } from "@/types/user";

const formatCurrency = (value: number | null | undefined) => {
  if (value == null) {
    return "Não informado";
  }

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(value);
};

const formatDate = (date: Date | null | undefined) => {
  if (!date) {
    return "Não informado";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
};

const validateRequired = (value: string) => (value.trim().length === 0 ? "Campo obrigatório" : null);

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

const toNullableString = (value: string): string | null => {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
};

const isAbortError = (error: unknown): error is DOMException =>
  error instanceof DOMException && error.name === "AbortError";

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : "Não foi possível completar a ação.");

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        resolve(result);
      } else {
        reject(new Error("Formato de arquivo inválido."));
      }
    };
    reader.onerror = () => reject(new Error("Não foi possível processar o arquivo selecionado."));
    reader.readAsDataURL(file);
  });

export default function MeuPerfil() {
  const [profile, setProfile] = useState<MeuPerfilProfile | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isAuditLoading, setIsAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);

  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [isSessionsLoading, setIsSessionsLoading] = useState(false);
  const [sessionsError, setSessionsError] = useState<string | null>(null);

  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const loadProfile = useCallback(async (signal?: AbortSignal) => {
    setIsProfileLoading(true);
    setProfileError(null);
    try {
      const data = await fetchMeuPerfil({ signal });
      setProfile(data);
    } catch (error) {
      if (isAbortError(error)) {
        return;
      }
      setProfileError(errorMessage(error));
    } finally {
      setIsProfileLoading(false);
    }
  }, []);

  const loadAuditLogs = useCallback(async (signal?: AbortSignal) => {
    setIsAuditLoading(true);
    setAuditError(null);
    try {
      const data = await fetchMeuPerfilAuditLogs({ signal, limit: 20 });
      setAuditLogs(data);
    } catch (error) {
      if (isAbortError(error)) {
        return;
      }
      setAuditError(errorMessage(error));
    } finally {
      setIsAuditLoading(false);
    }
  }, []);

  const loadSessions = useCallback(async (signal?: AbortSignal) => {
    setIsSessionsLoading(true);
    setSessionsError(null);
    try {
      const data = await fetchMeuPerfilSessions({ signal });
      setSessions(data);
    } catch (error) {
      if (isAbortError(error)) {
        return;
      }
      setSessionsError(errorMessage(error));
    } finally {
      setIsSessionsLoading(false);
    }
  }, []);

  useEffect(() => {
    const profileController = new AbortController();
    const logsController = new AbortController();
    const sessionsController = new AbortController();

    void loadProfile(profileController.signal);
    void loadAuditLogs(logsController.signal);
    void loadSessions(sessionsController.signal);

    return () => {
      profileController.abort();
      logsController.abort();
      sessionsController.abort();
    };
  }, [loadProfile, loadAuditLogs, loadSessions]);

  const mutateProfile = useCallback(
    async (payload: UpdateMeuPerfilPayload) => {
      setMutationError(null);
      setIsUpdatingProfile(true);
      try {
        const updated = await updateMeuPerfil(payload);
        setProfile(updated);
        await loadAuditLogs();
        return updated;
      } catch (error) {
        if (isAbortError(error)) {
          return null;
        }
        const message = errorMessage(error);
        setMutationError(message);
        throw error instanceof Error ? error : new Error(message);
      } finally {
        setIsUpdatingProfile(false);
      }
    },
    [loadAuditLogs],
  );

  const buildFieldSaveHandler = useCallback(
    (field: "name" | "title" | "email" | "phone" | "bio" | "office" | "oabNumber" | "oabUf" | "timezone" | "language" | "linkedin" | "website") =>
      async (rawValue: string) => {
        await mutateProfile({ [field]: toNullableString(rawValue) } as UpdateMeuPerfilPayload);
      },
    [mutateProfile],
  );

  const handleAddressSave = useCallback(
    (field: "street" | "city" | "state" | "zip") =>
      async (rawValue: string) => {
        await mutateProfile({ address: { [field]: toNullableString(rawValue) } });
      },
    [mutateProfile],
  );

  const handleSpecialtiesSave = useCallback(
    async (value: string) => {
      const specialties = value
        .split(",")
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
      await mutateProfile({ specialties });
    },
    [mutateProfile],
  );

  const handleHourlyRateSave = useCallback(
    async (value: string) => {
      if (value.trim().length === 0) {
        await mutateProfile({ hourlyRate: null });
        return;
      }

      const normalized = value.replace(/\./g, "").replace(",", ".");
      const parsed = Number(normalized);
      if (Number.isNaN(parsed)) {
        throw new Error("Informe um valor numérico");
      }
      await mutateProfile({ hourlyRate: parsed });
    },
    [mutateProfile],
  );

  const handleNotificationToggle = useCallback(
    async (field: keyof MeuPerfilProfile["notifications"], checked: boolean) => {
      let previousValue: boolean | undefined;
      setProfile((prev) => {
        if (!prev) {
          previousValue = undefined;
          return prev;
        }

        previousValue = prev.notifications[field];
        return {
          ...prev,
          notifications: {
            ...prev.notifications,
            [field]: checked,
          },
        } satisfies MeuPerfilProfile;
      });

      try {
        await mutateProfile({ notifications: { [field]: checked } });
      } catch (error) {
        setProfile((prev) => {
          if (!prev) {
            return prev;
          }
          return {
            ...prev,
            notifications: {
              ...prev.notifications,
              [field]: previousValue ?? false,
            },
          } satisfies MeuPerfilProfile;
        });
        throw error;
      }
    },
    [mutateProfile],
  );

  const handleSecurityToggle = useCallback(
    async (field: keyof MeuPerfilProfile["security"], checked: boolean) => {
      let previousValue: boolean | undefined;
      setProfile((prev) => {
        if (!prev) {
          previousValue = undefined;
          return prev;
        }

        previousValue = prev.security[field];
        return {
          ...prev,
          security: {
            ...prev.security,
            [field]: checked,
          },
        } satisfies MeuPerfilProfile;
      });

      try {
        await mutateProfile({ security: { [field]: checked } });
      } catch (error) {
        setProfile((prev) => {
          if (!prev) {
            return prev;
          }
          return {
            ...prev,
            security: {
              ...prev.security,
              [field]: previousValue ?? false,
            },
          } satisfies MeuPerfilProfile;
        });
        throw error;
      }
    },
    [mutateProfile],
  );

  const handleAvatarChange = useCallback(
    async (file: File | null) => {
      if (file) {
        const dataUrl = await readFileAsDataUrl(file);
        await mutateProfile({ avatarUrl: dataUrl });
        return;
      }
      await mutateProfile({ avatarUrl: null });
    },
    [mutateProfile],
  );

  const handleRevokeSession = useCallback(
    async (sessionId: string) => {
      setSessionsError(null);
      try {
        const session = await revokeMeuPerfilSession(sessionId);
        setSessions((prev) =>
          prev.map((item) => (item.id === session.id ? session : item)),
        );
        await loadAuditLogs();
      } catch (error) {
        const message = errorMessage(error);
        setSessionsError(message);
        throw error instanceof Error ? error : new Error(message);
      }
    },
    [loadAuditLogs],
  );

  const handleRevokeAllSessions = useCallback(async () => {
    setSessionsError(null);
    try {
      await revokeTodasMeuPerfilSessions();
      await loadSessions();
      await loadAuditLogs();
    } catch (error) {
      const message = errorMessage(error);
      setSessionsError(message);
      throw error instanceof Error ? error : new Error(message);
    }
  }, [loadAuditLogs, loadSessions]);

  const handleExportData = useCallback(async () => {
    setExportError(null);
    setIsExporting(true);
    try {
      const [profileData, auditData, sessionsData] = await Promise.all([
        fetchMeuPerfil(),
        fetchMeuPerfilAuditLogs({ limit: 100 }),
        fetchMeuPerfilSessions(),
      ]);

      const payload = {
        generatedAt: new Date().toISOString(),
        profile: profileData,
        auditLogs: auditData,
        sessions: sessionsData,
      };

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `jusconnect-perfil-${new Date().toISOString()}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setExportError(errorMessage(error));
    } finally {
      setIsExporting(false);
    }
  }, []);

  const initials = useMemo(() => {
    if (!profile?.name) {
      return "JP";
    }

    return profile.name
      .split(" ")
      .filter(Boolean)
      .map((word) => word[0])
      .join("")
      .toUpperCase();
  }, [profile?.name]);

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold text-foreground">Meu Perfil</h1>
        <p className="text-muted-foreground">
          Personalize suas informações profissionais, controle seus acessos e mantenha seus dados sempre atualizados.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <ProfileCard
            title="Identidade Profissional"
            icon={<UserIcon className="h-5 w-5" />}
            isLoading={isProfileLoading}
            error={profileError}
            onRetry={() => void loadProfile()}
            emptyState={<p className="text-sm text-muted-foreground">Nenhuma informação disponível.</p>}
          >
            {profile && (
              <div className="flex flex-col gap-6 md:flex-row">
                <div className="flex flex-col items-center gap-4">
                  <AvatarUploader currentAvatar={profile.avatarUrl ?? undefined} userName={profile.name} onAvatarChange={handleAvatarChange} />
                </div>

                <div className="flex-1 space-y-4">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-16 w-16">
                      <AvatarImage src={profile.avatarUrl ?? undefined} alt={profile.name} />
                      <AvatarFallback>{initials}</AvatarFallback>
                    </Avatar>

                    <div className="space-y-1">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h2 className="text-2xl font-semibold text-foreground">{profile.name}</h2>
                        {profile.office && <Badge variant="outline">{profile.office}</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground">Membro desde {formatDate(profile.memberSince)}</p>
                    </div>
                  </div>

                  {mutationError && <p className="text-sm text-destructive">{mutationError}</p>}

                  <div className="grid gap-4 md:grid-cols-2">
                    <EditableField
                      label="Nome completo"
                      value={profile.name}
                      onSave={buildFieldSaveHandler("name")}
                      validation={validateRequired}
                      disabled={isUpdatingProfile}
                    />
                    <EditableField
                      label="Título profissional"
                      value={profile.title ?? ""}
                      onSave={buildFieldSaveHandler("title")}
                      placeholder="Ex: Advogado Sênior"
                      disabled={isUpdatingProfile}
                    />
                    <EditableField
                      label="E-mail"
                      value={profile.email}
                      onSave={buildFieldSaveHandler("email")}
                      type="email"
                      validation={validateEmail}
                      disabled={isUpdatingProfile}
                    />
                    <EditableField
                      label="Telefone"
                      value={profile.phone ?? ""}
                      onSave={buildFieldSaveHandler("phone")}
                      type="tel"
                      validation={validatePhone}
                      disabled={isUpdatingProfile}
                    />
                  </div>

                  <EditableField
                    label="Biografia"
                    value={profile.bio ?? ""}
                    onSave={buildFieldSaveHandler("bio")}
                    type="textarea"
                    placeholder="Compartilhe sua experiência profissional"
                    disabled={isUpdatingProfile}
                  />

                  <div className="grid gap-4 md:grid-cols-2">
                    <EditableField
                      label="Escritório"
                      value={profile.office ?? ""}
                      onSave={buildFieldSaveHandler("office")}
                      placeholder="Ex: JusConnect - Matriz"
                      disabled={isUpdatingProfile}
                    />
                    <EditableField
                      label="Especialidades"
                      value={specialtiesToString(profile.specialties)}
                      onSave={handleSpecialtiesSave}
                      placeholder="Separe as especialidades por vírgula"
                      disabled={isUpdatingProfile}
                    />
                    <EditableField
                      label="OAB"
                      value={profile.oabNumber ?? ""}
                      onSave={buildFieldSaveHandler("oabNumber")}
                      placeholder="Número da OAB"
                      disabled={isUpdatingProfile}
                    />
                    <EditableField
                      label="UF"
                      value={profile.oabUf ?? ""}
                      onSave={buildFieldSaveHandler("oabUf")}
                      placeholder="Estado"
                      disabled={isUpdatingProfile}
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <EditableField
                      label="Tarifa por hora"
                      value={profile.hourlyRate != null ? profile.hourlyRate.toString().replace(".", ",") : ""}
                      onSave={handleHourlyRateSave}
                      validation={validateHourlyRate}
                      placeholder="Ex: 450,00"
                      disabled={isUpdatingProfile}
                    />
                    <EditableField
                      label="Fuso horário"
                      value={profile.timezone ?? ""}
                      onSave={buildFieldSaveHandler("timezone")}
                      placeholder="Ex: America/Sao_Paulo"
                      disabled={isUpdatingProfile}
                    />
                    <EditableField
                      label="Idioma"
                      value={profile.language ?? ""}
                      onSave={buildFieldSaveHandler("language")}
                      placeholder="Ex: Português (Brasil)"
                      disabled={isUpdatingProfile}
                    />
                    <EditableField
                      label="LinkedIn"
                      value={profile.linkedin ?? ""}
                      onSave={buildFieldSaveHandler("linkedin")}
                      placeholder="URL do LinkedIn"
                      validation={validateUrl}
                      disabled={isUpdatingProfile}
                    />
                    <EditableField
                      label="Website"
                      value={profile.website ?? ""}
                      onSave={buildFieldSaveHandler("website")}
                      placeholder="URL do seu site"
                      validation={validateUrl}
                      disabled={isUpdatingProfile}
                    />
                  </div>
                </div>
              </div>
            )}
          </ProfileCard>

          <ProfileCard
            title="Endereço"
            icon={<MapPin className="h-5 w-5" />}
            isLoading={isProfileLoading}
            error={profileError}
            onRetry={() => void loadProfile()}
            emptyState={<p className="text-sm text-muted-foreground">Nenhum endereço cadastrado.</p>}
          >
            {profile && (
              <div className="grid gap-4 md:grid-cols-2">
                <EditableField
                  label="Rua"
                  value={profile.address.street ?? ""}
                  onSave={handleAddressSave("street")}
                  disabled={isUpdatingProfile}
                />
                <EditableField
                  label="Cidade"
                  value={profile.address.city ?? ""}
                  onSave={handleAddressSave("city")}
                  disabled={isUpdatingProfile}
                />
                <EditableField
                  label="Estado"
                  value={profile.address.state ?? ""}
                  onSave={handleAddressSave("state")}
                  disabled={isUpdatingProfile}
                />
                <EditableField
                  label="CEP"
                  value={profile.address.zip ?? ""}
                  onSave={handleAddressSave("zip")}
                  validation={validateZip}
                  disabled={isUpdatingProfile}
                />
              </div>
            )}
          </ProfileCard>

          <ProfileCard
            title="Preferências"
            icon={<Bell className="h-5 w-5" />}
            isLoading={isProfileLoading}
            error={profileError}
            onRetry={() => void loadProfile()}
          >
            {profile && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-primary" />
                      <span>Alertas de segurança</span>
                    </div>
                    <Switch
                      checked={profile.notifications.securityAlerts}
                      onCheckedChange={(checked) => handleNotificationToggle("securityAlerts", checked).catch(() => {})}
                      disabled={isUpdatingProfile}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Receba notificações sobre atividades suspeitas e novos dispositivos.
                  </p>
                </div>

                <div className="space-y-2 border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-primary" />
                      <span>Lembretes da agenda</span>
                    </div>
                    <Switch
                      checked={profile.notifications.agendaReminders}
                      onCheckedChange={(checked) => handleNotificationToggle("agendaReminders", checked).catch(() => {})}
                      disabled={isUpdatingProfile}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Seja avisado sobre compromissos e prazos importantes.</p>
                </div>

                <div className="space-y-2 border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary" />
                      <span>Newsletter</span>
                    </div>
                    <Switch
                      checked={profile.notifications.newsletter}
                      onCheckedChange={(checked) => handleNotificationToggle("newsletter", checked).catch(() => {})}
                      disabled={isUpdatingProfile}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Receba novidades e materiais exclusivos da JusConnect.</p>
                </div>

                <div className="space-y-2 border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Scale className="h-4 w-4 text-primary" />
                      <span>Políticas e compliance</span>
                    </div>
                    <Switch checked readOnly disabled />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Notificações críticas relacionadas às políticas do escritório são sempre enviadas.
                  </p>
                </div>
              </div>
            )}
          </ProfileCard>

          <ProfileCard
            title="Segurança"
            icon={<Shield className="h-5 w-5" />}
            isLoading={isProfileLoading}
            error={profileError}
            onRetry={() => void loadProfile()}
          >
            {profile && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-primary" />
                      <span>Autenticação em duas etapas</span>
                    </div>
                    <Switch
                      checked={profile.security.twoFactor}
                      onCheckedChange={(checked) => handleSecurityToggle("twoFactor", checked).catch(() => {})}
                      disabled={isUpdatingProfile}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Exige um segundo fator de autenticação para novos acessos.
                  </p>
                </div>

                <div className="space-y-2 border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Activity className="h-4 w-4 text-primary" />
                      <span>Alertas de login</span>
                    </div>
                    <Switch
                      checked={profile.security.loginAlerts}
                      onCheckedChange={(checked) => handleSecurityToggle("loginAlerts", checked).catch(() => {})}
                      disabled={isUpdatingProfile}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Seja avisado sempre que uma nova sessão for iniciada.
                  </p>
                </div>

                <div className="space-y-2 border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Building className="h-4 w-4 text-primary" />
                      <span>Aprovação de dispositivos</span>
                    </div>
                    <Switch
                      checked={profile.security.deviceApproval}
                      onCheckedChange={(checked) => handleSecurityToggle("deviceApproval", checked).catch(() => {})}
                      disabled={isUpdatingProfile}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Novos dispositivos precisam ser autorizados antes de acessar o sistema.
                  </p>
                </div>

                <div className="space-y-2 border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-primary" />
                      <span>Último acesso</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{formatDate(profile.lastLogin)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Manter a autenticação atualizada aumenta a proteção dos seus dados.
                  </p>
                </div>
              </div>
            )}
          </ProfileCard>
        </div>

        <div className="space-y-6">
          <ProfileCard
            title="Resumo Profissional"
            icon={<Briefcase className="h-5 w-5" />}
            isLoading={isProfileLoading}
            error={profileError}
            onRetry={() => void loadProfile()}
          >
            {profile && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Tarifa por hora</span>
                  <span className="font-medium text-foreground">{formatCurrency(profile.hourlyRate)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Especialidades</span>
                  <span className="font-medium text-foreground text-right">
                    {profile.specialties.length > 0 ? specialtiesToString(profile.specialties) : "Não informado"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Website</span>
                  <span className="font-medium text-foreground break-all">
                    {profile.website ? (
                      <a href={profile.website} target="_blank" rel="noreferrer" className="text-primary underline">
                        {profile.website}
                      </a>
                    ) : (
                      "Não informado"
                    )}
                  </span>
                </div>
              </div>
            )}
          </ProfileCard>

          <ProfileCard title="Exportar dados" icon={<FileText className="h-5 w-5" /> }>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Baixe uma cópia de todas as suas informações de perfil, histórico de auditoria e sessões ativas.
              </p>
              {exportError && <p className="text-sm text-destructive">{exportError}</p>}
              <Button onClick={() => void handleExportData()} disabled={isExporting} className="w-full">
                {isExporting ? "Preparando..." : "Exportar dados"}
              </Button>
            </div>
          </ProfileCard>

          <ProfileCard
            title="Histórico recente"
            icon={<Activity className="h-5 w-5" />}
            isLoading={isAuditLoading}
            error={auditError}
            onRetry={() => void loadAuditLogs()}
          >
            <AuditTimeline logs={auditLogs} maxItems={5} />
          </ProfileCard>

          <ProfileCard
            title="Sessões ativas"
            icon={<Shield className="h-5 w-5" />}
            isLoading={isSessionsLoading}
            error={sessionsError}
            onRetry={() => void loadSessions()}
          >
            <SessionsList
              sessions={sessions}
              onRevokeSession={handleRevokeSession}
              onRevokeAllSessions={handleRevokeAllSessions}
              onReload={() => loadSessions()}
            />
          </ProfileCard>

          <ProfileCard
            title="Acesso rápido"
            icon={<Link className="h-5 w-5" />}
            isLoading={isProfileLoading}
            error={profileError}
            onRetry={() => void loadProfile()}
            emptyState={<p className="text-sm text-muted-foreground">Sem links disponíveis.</p>}
          >
            {profile && (
              <div className="space-y-2">
                <Button variant="outline" className="w-full" asChild>
                  <a href="/configuracoes/usuarios/sessoes" className="flex items-center justify-center gap-2">
                    <Shield className="h-4 w-4" /> Gerenciar sessões
                  </a>
                </Button>
                {profile.linkedin && (
                  <Button variant="outline" className="w-full" asChild>
                    <a href={profile.linkedin} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2">
                      <Link className="h-4 w-4" /> Perfil no LinkedIn
                    </a>
                  </Button>
                )}
              </div>
            )}
          </ProfileCard>
        </div>
      </div>
    </div>
  );
}
