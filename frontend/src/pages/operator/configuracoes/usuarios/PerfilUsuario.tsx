import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Briefcase, Calendar, Clock, MapPin, Monitor } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProfileCard } from "@/components/profile/ProfileCard";
import { AuditTimeline } from "@/components/profile/AuditTimeline";
import { SessionsList } from "@/components/profile/SessionsList";
import {
  fetchMeuPerfil,
  fetchMeuPerfilAuditLogs,
  fetchMeuPerfilSessions,
  type MeuPerfilProfile,
} from "@/services/meuPerfil";
import type { AuditLog, UserSession } from "@/types/user";

const isAbortError = (error: unknown): error is DOMException =>
  error instanceof DOMException && error.name === "AbortError";

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : "Não foi possível carregar os dados.");

const formatDateTime = (date: Date | null | undefined) => {
  if (!date) {
    return "Não informado";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

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

const specialtiesToString = (specialties: string[]) => (specialties.length > 0 ? specialties.join(", ") : "Não informado");

export default function PerfilUsuario() {
  const [profile, setProfile] = useState<MeuPerfilProfile | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isAuditLoading, setIsAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);

  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [isSessionsLoading, setIsSessionsLoading] = useState(false);
  const [sessionsError, setSessionsError] = useState<string | null>(null);

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
      const data = await fetchMeuPerfilAuditLogs({ signal, limit: 15 });
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

  const initials = useMemo(() => {
    if (!profile?.name) {
      return "US";
    }
    return profile.name
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .toUpperCase();
  }, [profile?.name]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Perfil do Usuário</h1>
          <p className="text-muted-foreground">Visualize detalhes, histórico e sessões ativas.</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <ProfileCard
            title="Informações Básicas"
            icon={<Briefcase className="h-5 w-5" />}
            isLoading={isProfileLoading}
            error={profileError}
            onRetry={() => void loadProfile()}
            emptyState={<p className="text-sm text-muted-foreground">Nenhuma informação disponível.</p>}
          >
            {profile && (
              <div className="space-y-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-center">
                  <Avatar className="h-20 w-20">
                    <AvatarImage src={profile.avatarUrl ?? undefined} alt={profile.name} />
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                  <div className="space-y-1">
                    <h2 className="text-2xl font-semibold text-foreground">{profile.name}</h2>
                    <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                      {profile.email && <span>{profile.email}</span>}
                      {profile.phone && <span>• {profile.phone}</span>}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {profile.office && <Badge variant="outline">{profile.office}</Badge>}
                      {profile.oabNumber && profile.oabUf && (
                        <Badge variant="secondary">OAB {profile.oabNumber}/{profile.oabUf}</Badge>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1">
                    <span className="text-xs uppercase text-muted-foreground">Tarifa por hora</span>
                    <p className="font-medium text-foreground">{formatCurrency(profile.hourlyRate)}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs uppercase text-muted-foreground">Especialidades</span>
                    <p className="font-medium text-foreground">{specialtiesToString(profile.specialties)}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs uppercase text-muted-foreground">Fuso horário</span>
                    <p className="font-medium text-foreground">{profile.timezone ?? "Não informado"}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs uppercase text-muted-foreground">Idioma</span>
                    <p className="font-medium text-foreground">{profile.language ?? "Não informado"}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-xs uppercase text-muted-foreground">Endereço</span>
                  <p className="text-sm text-foreground">
                    {profile.address.street ? `${profile.address.street}, ` : ""}
                    {profile.address.number ? `${profile.address.number} - ` : ""}
                    {profile.address.neighborhood ? `${profile.address.neighborhood}, ` : ""}
                    {profile.address.city ? `${profile.address.city} - ` : ""}
                    {profile.address.state ?? ""}
                    {profile.address.zip ? ` • CEP ${profile.address.zip}` : ""}
                    {profile.address.complement ? ` • ${profile.address.complement}` : ""}
                  </p>
                </div>
              </div>
            )}
          </ProfileCard>

          <ProfileCard
            title="Atividade"
            icon={<Calendar className="h-5 w-5" />}
            isLoading={isProfileLoading}
            error={profileError}
            onRetry={() => void loadProfile()}
          >
            {profile && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <span className="text-xs uppercase text-muted-foreground">Último login</span>
                  <p className="font-medium text-foreground">{formatDateTime(profile.lastLogin)}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-xs uppercase text-muted-foreground">Membro desde</span>
                  <p className="font-medium text-foreground">{formatDateTime(profile.memberSince)}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-xs uppercase text-muted-foreground">Alertas de segurança</span>
                  <p className="font-medium text-foreground">
                    {profile.notifications.securityAlerts ? "Ativos" : "Desativados"}
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="text-xs uppercase text-muted-foreground">2FA</span>
                  <p className="font-medium text-foreground">{profile.security.twoFactor ? "Ativo" : "Inativo"}</p>
                </div>
              </div>
            )}
          </ProfileCard>
        </div>

        <div className="space-y-6">
          <ProfileCard
            title="Histórico de Auditoria"
            icon={<Clock className="h-5 w-5" />}
            isLoading={isAuditLoading}
            error={auditError}
            onRetry={() => void loadAuditLogs()}
          >
            <AuditTimeline logs={auditLogs} maxItems={6} />
          </ProfileCard>

          <ProfileCard
            title="Sessões e Dispositivos"
            icon={<Monitor className="h-5 w-5" />}
            isLoading={isSessionsLoading}
            error={sessionsError}
            onRetry={() => void loadSessions()}
          >
            <SessionsList sessions={sessions} onReload={() => loadSessions()} />
          </ProfileCard>

          <ProfileCard
            title="Localizações Recentes"
            icon={<MapPin className="h-5 w-5" />}
            isLoading={isSessionsLoading}
            error={sessionsError}
            onRetry={() => void loadSessions()}
            emptyState={<p className="text-sm text-muted-foreground">Nenhum acesso registrado.</p>}
          >
            {sessions.length > 0 && (
              <ul className="space-y-2 text-sm text-muted-foreground">
                {sessions.slice(0, 5).map((session) => (
                  <li key={session.id}>
                    {session.location ?? "Localização não informada"} • {formatDateTime(session.lastActivity)}
                  </li>
                ))}
              </ul>
            )}
          </ProfileCard>
        </div>
      </div>
    </div>
  );
}
