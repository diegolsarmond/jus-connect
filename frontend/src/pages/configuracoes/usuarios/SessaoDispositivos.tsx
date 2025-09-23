import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, Monitor, RefreshCw, Shield, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProfileCard } from "@/components/profile/ProfileCard";
import { SessionsList } from "@/components/profile/SessionsList";
import {
  fetchMeuPerfilSessions,
  fetchMeuPerfilAuditLogs,
  revokeMeuPerfilSession,
  revokeTodasMeuPerfilSessions,
} from "@/services/meuPerfil";
import type { AuditLog, UserSession } from "@/types/user";

const isAbortError = (error: unknown): error is DOMException =>
  error instanceof DOMException && error.name === "AbortError";

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : "Não foi possível carregar os dados.");

export default function SessaoDispositivos() {
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isAuditLoading, setIsAuditLoading] = useState(false);

  const loadSessions = useCallback(async (signal?: AbortSignal) => {
    setIsLoadingSessions(true);
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
      setIsLoadingSessions(false);
    }
  }, []);

  const loadAuditLogs = useCallback(async (signal?: AbortSignal) => {
    setIsAuditLoading(true);
    try {
      const data = await fetchMeuPerfilAuditLogs({ signal, limit: 10 });
      setAuditLogs(data);
    } catch (error) {
      if (isAbortError(error)) {
        return;
      }
      console.warn("Não foi possível carregar os logs de auditoria.", error);
    } finally {
      setIsAuditLoading(false);
    }
  }, []);

  useEffect(() => {
    const sessionsController = new AbortController();
    const logsController = new AbortController();

    void loadSessions(sessionsController.signal);
    void loadAuditLogs(logsController.signal);

    return () => {
      sessionsController.abort();
      logsController.abort();
    };
  }, [loadSessions, loadAuditLogs]);

  const handleRevokeSession = useCallback(
    async (sessionId: string) => {
      setSessionsError(null);
      try {
        const revoked = await revokeMeuPerfilSession(sessionId);
        setSessions((prev) => prev.map((session) => (session.id === revoked.id ? revoked : session)));
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

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await loadSessions();
      await loadAuditLogs();
    } finally {
      setIsRefreshing(false);
    }
  }, [loadSessions, loadAuditLogs]);

  const activeSessions = useMemo(() => sessions.filter((session) => session.isActive), [sessions]);
  const mobileSessionsCount = useMemo(
    () =>
      sessions.filter((session) => /iphone|android|ipad/i.test(session.device)).length,
    [sessions],
  );
  const revokedSessionsCount = useMemo(
    () => sessions.filter((session) => !session.isActive && session.revokedAt).length,
    [sessions],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Sessões e Dispositivos</h1>
            <p className="text-muted-foreground">Monitore e gerencie o acesso à sua conta.</p>
          </div>
        </div>

        <Button variant="outline" onClick={() => void handleRefresh()} disabled={isRefreshing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <ProfileCard title="Sessões Ativas" variant="compact" isLoading={isLoadingSessions}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-success-light">
              <Shield className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{activeSessions.length}</p>
              <p className="text-sm text-muted-foreground">dispositivos</p>
            </div>
          </div>
        </ProfileCard>

        <ProfileCard title="Total de Dispositivos" variant="compact" isLoading={isLoadingSessions}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary-light">
              <Monitor className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{sessions.length}</p>
              <p className="text-sm text-muted-foreground">registrados</p>
            </div>
          </div>
        </ProfileCard>

        <ProfileCard title="Dispositivos Móveis" variant="compact" isLoading={isLoadingSessions}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent">
              <Smartphone className="h-5 w-5 text-accent-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{mobileSessionsCount}</p>
              <p className="text-sm text-muted-foreground">dispositivos</p>
            </div>
          </div>
        </ProfileCard>

        <ProfileCard title="Sessões Revogadas" variant="compact" isLoading={isLoadingSessions}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-warning-light">
              <AlertTriangle className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{revokedSessionsCount}</p>
              <p className="text-sm text-muted-foreground">nas últimas sessões</p>
            </div>
          </div>
        </ProfileCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ProfileCard
            title="Todas as Sessões"
            isLoading={isLoadingSessions}
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
        </div>

        <div className="space-y-6">
          <ProfileCard
            title="Logs de Segurança"
            isLoading={isAuditLoading}
            onRetry={() => void loadAuditLogs()}
            emptyState={<p className="text-sm text-muted-foreground">Nenhum evento recente.</p>}
          >
            {auditLogs.length > 0 && (
              <ul className="space-y-3 text-sm text-muted-foreground">
                {auditLogs.slice(0, 5).map((log) => (
                  <li key={log.id}>
                    <p className="font-medium text-foreground">{log.action}</p>
                    <p>{log.description}</p>
                  </li>
                ))}
              </ul>
            )}
          </ProfileCard>

          <ProfileCard title="Recomendações" variant="compact">
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>• Revogue sessões de dispositivos que você não reconhece.</p>
              <p>• Mantenha a autenticação de dois fatores ativada para maior segurança.</p>
              <p>• Atualize periodicamente sua senha e verifique o histórico de acessos.</p>
            </div>
          </ProfileCard>
        </div>
      </div>
    </div>
  );
}
