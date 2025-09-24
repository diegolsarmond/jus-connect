import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CheckCircle,
  Download,
  FileText,
  Shield,
  Trash2,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProfileCard } from "@/components/profile/ProfileCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  fetchMeuPerfil,
  fetchMeuPerfilAuditLogs,
  fetchMeuPerfilSessions,
  type MeuPerfilProfile,
} from "@/services/meuPerfil";
import type { AuditLog } from "@/types/user";

interface ConsentRecord {
  id: string;
  description: string;
  granted: boolean;
  timestamp: Date;
  action: string;
}

const isAbortError = (error: unknown): error is DOMException =>
  error instanceof DOMException && error.name === "AbortError";

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : "Não foi possível completar a ação.");

const formatDateTime = (date: Date) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);

const extractConsentHistory = (logs: AuditLog[]): ConsentRecord[] =>
  logs
    .filter((log) => /consent|lgpd/i.test(log.action) || /consentimento/i.test(log.description))
    .map((log) => {
      const text = `${log.action} ${log.description}`.toLowerCase();
      const granted = !/revogad|negad/.test(text);
      return {
        id: log.id,
        description: log.description,
        granted,
        timestamp: log.timestamp,
        action: log.action,
      } satisfies ConsentRecord;
    });

export default function PrivacidadeLGPD() {
  const [profile, setProfile] = useState<MeuPerfilProfile | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isAuditLoading, setIsAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);

  const [isDeletionDialogOpen, setIsDeletionDialogOpen] = useState(false);
  const [deletionReason, setDeletionReason] = useState("");
  const [deletionMessage, setDeletionMessage] = useState<string | null>(null);

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
      const data = await fetchMeuPerfilAuditLogs({ signal, limit: 30 });
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

  useEffect(() => {
    const profileController = new AbortController();
    const logsController = new AbortController();

    void loadProfile(profileController.signal);
    void loadAuditLogs(logsController.signal);

    return () => {
      profileController.abort();
      logsController.abort();
    };
  }, [loadProfile, loadAuditLogs]);

  const consentHistory = useMemo(() => extractConsentHistory(auditLogs), [auditLogs]);

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
      anchor.download = `jusconnect-dados-${new Date().toISOString()}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setExportError(errorMessage(error));
    } finally {
      setIsExporting(false);
    }
  }, []);

  const handleDeleteAccount = useCallback(() => {
    if (deletionReason.trim().length === 0) {
      return;
    }
    setDeletionMessage(
      "Sua solicitação de exclusão foi registrada. Nossa equipe entrará em contato para confirmar os próximos passos.",
    );
    setIsDeletionDialogOpen(false);
    setDeletionReason("");
  }, [deletionReason]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Privacidade e LGPD</h1>
          <p className="text-muted-foreground">Gerencie seus dados pessoais e direitos de privacidade.</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <ProfileCard title="Seus Direitos" icon={<Shield className="h-5 w-5" />}>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                De acordo com a Lei Geral de Proteção de Dados (LGPD), você tem direito de acessar, corrigir, exportar e
                solicitar a exclusão dos seus dados pessoais armazenados na JusConnect.
              </p>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="p-3 bg-muted/50 rounded-lg">
                  <h4 className="font-medium text-sm mb-1">Acesso aos Dados</h4>
                  <p className="text-xs text-muted-foreground">Visualize quais dados pessoais coletamos</p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <h4 className="font-medium text-sm mb-1">Portabilidade</h4>
                  <p className="text-xs text-muted-foreground">Exportar seus dados em formato estruturado</p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <h4 className="font-medium text-sm mb-1">Correção</h4>
                  <p className="text-xs text-muted-foreground">Corrigir dados incompletos ou desatualizados</p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <h4 className="font-medium text-sm mb-1">Eliminação</h4>
                  <p className="text-xs text-muted-foreground">Solicitar exclusão dos seus dados</p>
                </div>
              </div>
            </div>
          </ProfileCard>

          <ProfileCard title="Exportar Dados" icon={<Download className="h-5 w-5" />}>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Baixe uma cópia de todos os seus dados pessoais em formato JSON estruturado.
              </p>

              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-primary" />
                  <div>
                    <h4 className="font-medium text-sm">Dados Completos</h4>
                    <p className="text-xs text-muted-foreground">Perfil, histórico, configurações e logs de auditoria</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => void handleExportData()} disabled={isExporting}>
                  {isExporting ? "Preparando..." : "Exportar"}
                </Button>
              </div>

              {exportError && <p className="text-sm text-destructive">{exportError}</p>}

              <div className="text-xs text-muted-foreground p-3 bg-accent/50 rounded-lg">
                <p className="font-medium mb-1">Informações sobre o export:</p>
                <ul className="space-y-1">
                  <li>• O arquivo será enviado para seu email em até 48 horas</li>
                  <li>• Dados sensíveis serão anonimizados quando necessário</li>
                  <li>• O link de download expira em 7 dias</li>
                </ul>
              </div>
            </div>
          </ProfileCard>

          <ProfileCard
            title="Histórico de Consentimentos"
            icon={<Calendar className="h-5 w-5" />}
            isLoading={isAuditLoading}
            error={auditError}
            onRetry={() => void loadAuditLogs()}
          >
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Registros dos consentimentos concedidos e revogados em conformidade com a LGPD.
              </p>

              {consentHistory.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <User className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Nenhum consentimento registrado.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {consentHistory.map((consent) => (
                    <div key={consent.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-start gap-3 flex-1">
                        <div className={`p-2 rounded-lg ${consent.granted ? "bg-success-light" : "bg-muted"}`}>
                          {consent.granted ? (
                            <CheckCircle className="h-4 w-4 text-success" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-warning" />
                          )}
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium text-foreground">{consent.description}</h4>
                          <div className="text-xs text-muted-foreground space-y-1 mt-1">
                            <p>Ação: {consent.action}</p>
                            <p>{formatDateTime(consent.timestamp)}</p>
                          </div>
                        </div>
                      </div>
                      <Badge
                        variant={consent.granted ? "default" : "outline"}
                        className={consent.granted ? "bg-success text-success-foreground" : ""}
                      >
                        {consent.granted ? "Concedido" : "Revogado"}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </ProfileCard>
        </div>

        <div className="space-y-6">
          <ProfileCard
            title="Resumo do Perfil"
            isLoading={isProfileLoading}
            error={profileError}
            onRetry={() => void loadProfile()}
            emptyState={<p className="text-sm text-muted-foreground">Nenhum dado encontrado.</p>}
          >
            {profile && (
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  <span className="font-medium text-foreground">Nome:</span> {profile.name}
                </p>
                <p>
                  <span className="font-medium text-foreground">Email:</span> {profile.email}
                </p>
                <p>
                  <span className="font-medium text-foreground">Fuso horário:</span> {profile.timezone ?? "Não informado"}
                </p>
                <p>
                  <span className="font-medium text-foreground">Idioma:</span> {profile.language ?? "Não informado"}
                </p>
              </div>
            )}
          </ProfileCard>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Solicitar exclusão da conta</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Ao solicitar a exclusão, seus dados serão processados conforme os requisitos legais. Esse procedimento é
                irreversível.
              </p>

              {deletionMessage && <p className="text-sm text-success">{deletionMessage}</p>}

              <Dialog open={isDeletionDialogOpen} onOpenChange={setIsDeletionDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="destructive" className="w-full">
                    <Trash2 className="h-4 w-4 mr-2" /> Solicitar exclusão
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Confirmar solicitação</DialogTitle>
                    <DialogDescription>
                      Informe o motivo da solicitação de exclusão. Nossa equipe analisará e retornará o contato.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="deletion-reason">Motivo</Label>
                      <Textarea
                        id="deletion-reason"
                        value={deletionReason}
                        onChange={(event) => setDeletionReason(event.target.value)}
                        placeholder="Explique o motivo da solicitação"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handleDeleteAccount} disabled={deletionReason.trim().length === 0}>
                        Confirmar solicitação
                      </Button>
                      <Button variant="outline" onClick={() => setIsDeletionDialogOpen(false)}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
