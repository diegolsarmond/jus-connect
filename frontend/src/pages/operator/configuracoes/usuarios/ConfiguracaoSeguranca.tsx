import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Shield, Smartphone, QrCode, Copy, Check, AlertTriangle, Key, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ProfileCard } from "@/components/profile/ProfileCard";
import { SessionsList } from "@/components/profile/SessionsList";
import { useToast } from "@/components/ui/use-toast";
import {
  approveMeuPerfilDevice,
  confirmMeuPerfilTwoFactor,
  disableMeuPerfilTwoFactor,
  fetchMeuPerfil,
  fetchMeuPerfilSessions,
  initiateMeuPerfilTwoFactor,
  revokeMeuPerfilDeviceApproval,
  revokeMeuPerfilSession,
  revokeTodasMeuPerfilSessions,
  type TwoFactorInitiationPayload,
} from "@/services/meuPerfil";
import type { UserSession } from "@/types/user";

export default function ConfiguracaoSeguranca() {
  const { toast } = useToast();
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [twoFactorSetup, setTwoFactorSetup] = useState<TwoFactorInitiationPayload | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [isSetupModalOpen, setIsSetupModalOpen] = useState(false);
  const [isDisableModalOpen, setIsDisableModalOpen] = useState(false);
  const [isInitiating, setIsInitiating] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isDisabling, setIsDisabling] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsError, setSessionsError] = useState<string | null>(null);

  const getErrorMessage = (error: unknown) =>
    error instanceof Error ? error.message : "Não foi possível completar a ação.";

  const loadProfile = useCallback(async () => {
    setLoadingProfile(true);
    try {
      const profile = await fetchMeuPerfil();
      setTwoFactorEnabled(profile.security.twoFactor);
    } catch (error) {
      toast({ variant: "destructive", description: getErrorMessage(error) });
    } finally {
      setLoadingProfile(false);
    }
  }, [toast]);

  const loadSessions = useCallback(async () => {
    setSessionsLoading(true);
    setSessionsError(null);
    try {
      const data = await fetchMeuPerfilSessions();
      setSessions(data);
    } catch (error) {
      setSessionsError(getErrorMessage(error));
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProfile();
    void loadSessions();
  }, [loadProfile, loadSessions]);

  const copyToClipboard = async (text: string) => {
    if (!text) {
      toast({ variant: "destructive", description: "Nenhum valor disponível para copiar." });
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      setCopiedCode(text);
      setTimeout(() => setCopiedCode(null), 2000);
      toast({ description: "Copiado para a área de transferência." });
    } catch (error) {
      toast({ variant: "destructive", description: getErrorMessage(error) });
    }
  };

  const handleInitiateTwoFactor = async () => {
    try {
      setIsInitiating(true);
      const setup = await initiateMeuPerfilTwoFactor();
      setTwoFactorSetup(setup);
      setVerificationCode("");
      setBackupCodes([]);
      setShowBackupCodes(false);
      setIsSetupModalOpen(true);
    } catch (error) {
      setTwoFactorEnabled(false);
      toast({ variant: "destructive", description: getErrorMessage(error) });
    } finally {
      setIsInitiating(false);
    }
  };

  const handleConfirmTwoFactor = async () => {
    if (!verificationCode.trim()) {
      return;
    }

    try {
      setIsConfirming(true);
      const result = await confirmMeuPerfilTwoFactor(verificationCode.trim());
      setBackupCodes(result.backupCodes);
      setShowBackupCodes(true);
      setTwoFactorEnabled(true);
      setTwoFactorSetup(null);
      setVerificationCode("");
      setIsSetupModalOpen(false);
      toast({ description: "Autenticação de dois fatores ativada com sucesso." });
      await loadProfile();
    } catch (error) {
      toast({ variant: "destructive", description: getErrorMessage(error) });
    } finally {
      setIsConfirming(false);
    }
  };

  const handleDisableTwoFactor = async () => {
    if (!disableCode.trim()) {
      return;
    }

    try {
      setIsDisabling(true);
      await disableMeuPerfilTwoFactor(disableCode.trim());
      setTwoFactorEnabled(false);
      setBackupCodes([]);
      setShowBackupCodes(false);
      setTwoFactorSetup(null);
      setDisableCode("");
      setIsDisableModalOpen(false);
      toast({ description: "Autenticação de dois fatores desativada." });
      await loadProfile();
    } catch (error) {
      toast({ variant: "destructive", description: getErrorMessage(error) });
    } finally {
      setIsDisabling(false);
    }
  };

  const handleApproveDevice = async (sessionId: string) => {
    try {
      await approveMeuPerfilDevice(sessionId);
      await loadSessions();
      toast({ description: "Dispositivo aprovado." });
    } catch (error) {
      toast({ variant: "destructive", description: getErrorMessage(error) });
    }
  };

  const handleRevokeDeviceApproval = async (sessionId: string) => {
    try {
      await revokeMeuPerfilDeviceApproval(sessionId);
      await loadSessions();
      toast({ description: "Aprovação do dispositivo revogada." });
    } catch (error) {
      toast({ variant: "destructive", description: getErrorMessage(error) });
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    try {
      await revokeMeuPerfilSession(sessionId);
      await loadSessions();
      toast({ description: "Sessão revogada." });
    } catch (error) {
      toast({ variant: "destructive", description: getErrorMessage(error) });
    }
  };

  const handleRevokeAllSessions = async () => {
    try {
      await revokeTodasMeuPerfilSessions();
      await loadSessions();
      toast({ description: "Todas as sessões foram revogadas." });
    } catch (error) {
      toast({ variant: "destructive", description: getErrorMessage(error) });
    }
  };

  const handleSetupModalChange = (open: boolean) => {
    setIsSetupModalOpen(open);
    if (!open) {
      setVerificationCode("");
      if (!twoFactorEnabled) {
        setTwoFactorSetup(null);
      }
    }
  };

  const handleDisableModalChange = (open: boolean) => {
    setIsDisableModalOpen(open);
    if (!open) {
      setDisableCode("");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Configurações de Segurança</h1>
          <p className="text-muted-foreground">Proteja sua conta com configurações avançadas de segurança</p>
        </div>
      </div>

      <Tabs defaultValue="2fa" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="2fa">Autenticação 2FA</TabsTrigger>
          <TabsTrigger value="sessions">Sessões</TabsTrigger>
          <TabsTrigger value="recovery">Recuperação</TabsTrigger>
        </TabsList>

        {/* Two-Factor Authentication */}
        <TabsContent value="2fa" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <ProfileCard title="Autenticação de Dois Fatores" icon={<Shield className="h-5 w-5" />}>
                <div className="space-y-6">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${twoFactorEnabled ? 'bg-success-light' : 'bg-muted'}`}>
                        <Smartphone className={`h-5 w-5 ${twoFactorEnabled ? 'text-success' : 'text-muted-foreground'}`} />
                      </div>
                      <div>
                        <h3 className="font-medium">Aplicativo Autenticador</h3>
                        <p className="text-sm text-muted-foreground">
                          Use Google Authenticator, Authy ou similar
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge
                        variant={twoFactorEnabled ? "default" : "outline"}
                        className={twoFactorEnabled ? "bg-success text-success-foreground" : ""}
                      >
                        {loadingProfile ? "Carregando" : twoFactorEnabled ? "Ativo" : "Inativo"}
                      </Badge>
                      <Switch
                        checked={twoFactorEnabled}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            void handleInitiateTwoFactor();
                          } else if (twoFactorEnabled) {
                            setIsDisableModalOpen(true);
                          }
                        }}
                        disabled={loadingProfile || isInitiating || isDisabling}
                      />
                    </div>
                  </div>

                  {/* Backup Codes */}
                  {twoFactorEnabled && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">Códigos de Backup</h4>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowBackupCodes((value) => !value)}
                          disabled={backupCodes.length === 0}
                        >
                          {showBackupCodes ? "Ocultar códigos" : "Mostrar códigos"}
                        </Button>
                      </div>

                      {backupCodes.length === 0 && (
                        <p className="text-sm text-muted-foreground">
                          Os códigos serão exibidos após a confirmação do 2FA.
                        </p>
                      )}

                      {showBackupCodes && backupCodes.length > 0 && (
                        <Card className="border-warning/20 bg-warning-light/5">
                          <CardHeader className="pb-3">
                            <div className="flex items-center gap-2">
                              <AlertTriangle className="h-5 w-5 text-warning" />
                              <CardTitle className="text-sm">Códigos de Recuperação</CardTitle>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <p className="text-sm text-muted-foreground">
                              Guarde estes códigos em local seguro. Cada código pode ser usado apenas uma vez.
                            </p>
                            <div className="grid grid-cols-2 gap-2">
                              {backupCodes.map((code, index) => (
                                <div key={index} className="flex items-center gap-2 p-2 bg-background border rounded">
                                  <code className="flex-1 text-sm font-mono">{code}</code>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0"
                                    onClick={() => copyToClipboard(code)}
                                  >
                                    {copiedCode === code ? (
                                      <Check className="h-3 w-3 text-success" />
                                    ) : (
                                      <Copy className="h-3 w-3" />
                                    )}
                                  </Button>
                                </div>
                              ))}
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => copyToClipboard(backupCodes.join('\n'))}
                              className="w-full"
                            >
                              Copiar Todos os Códigos
                            </Button>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  )}
                </div>
              </ProfileCard>
            </div>

            {/* Security Status */}
            <div>
              <ProfileCard title="Status de Segurança" variant="compact">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Senha forte</span>
                    <Badge variant="default" className="bg-success text-success-foreground">✓</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">2FA ativo</span>
                    <Badge variant={twoFactorEnabled ? "default" : "outline"} className={twoFactorEnabled ? "bg-success text-success-foreground" : ""}>
                      {twoFactorEnabled ? "✓" : "✗"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Email verificado</span>
                    <Badge variant="default" className="bg-success text-success-foreground">✓</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Sessões seguras</span>
                    <Badge variant="default" className="bg-success text-success-foreground">✓</Badge>
                  </div>
                </div>
              </ProfileCard>
            </div>
          </div>
          <Dialog open={isSetupModalOpen} onOpenChange={handleSetupModalChange}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Configurar Autenticação 2FA</DialogTitle>
                <DialogDescription>
                  Escaneie o QR code com seu aplicativo autenticador ou insira o código manualmente.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex justify-center">
                  {twoFactorSetup?.qrCode ? (
                    <img
                      src={twoFactorSetup.qrCode}
                      alt="QR code para autenticação em duas etapas"
                      className="w-48 h-48 rounded-lg border"
                    />
                  ) : (
                    <div className="w-48 h-48 bg-muted border-2 border-dashed rounded-lg flex items-center justify-center">
                      <div className="text-center space-y-2">
                        <QrCode className="h-12 w-12 mx-auto text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">QR code indisponível</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Ou digite manualmente:</Label>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={twoFactorSetup?.secret ?? ""}
                      className="font-mono text-sm"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void copyToClipboard(twoFactorSetup?.secret ?? "")}
                      disabled={!twoFactorSetup?.secret}
                    >
                      {copiedCode === twoFactorSetup?.secret ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="verification-code">Código de verificação</Label>
                  <Input
                    id="verification-code"
                    placeholder="000000"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    className="text-center text-2xl tracking-widest"
                    maxLength={6}
                    autoComplete="one-time-code"
                  />
                </div>

                <Button
                  onClick={handleConfirmTwoFactor}
                  disabled={verificationCode.length !== 6 || isConfirming || !twoFactorSetup}
                  className="w-full"
                >
                  {isConfirming ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Ativando...
                    </span>
                  ) : (
                    "Ativar 2FA"
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isDisableModalOpen} onOpenChange={handleDisableModalChange}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Desativar autenticação 2FA</DialogTitle>
                <DialogDescription>
                  Informe um código do autenticador ou um código de backup para desativar a proteção.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="disable-code">Código</Label>
                  <Input
                    id="disable-code"
                    placeholder="Digite o código"
                    value={disableCode}
                    onChange={(e) => setDisableCode(e.target.value.trim().slice(0, 12))}
                    autoComplete="one-time-code"
                  />
                </div>
                <Button
                  onClick={handleDisableTwoFactor}
                  disabled={!disableCode || isDisabling}
                  className="w-full"
                  variant="destructive"
                >
                  {isDisabling ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Desativando...
                    </span>
                  ) : (
                    "Desativar 2FA"
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* Sessions Management */}
        <TabsContent value="sessions" className="space-y-6">
          <ProfileCard title="Gerenciamento de Sessões" icon={<Clock className="h-5 w-5" />}>
            <SessionsList
              sessions={sessions}
              isLoading={sessionsLoading}
              error={sessionsError}
              onReload={loadSessions}
              onRevokeSession={handleRevokeSession}
              onRevokeAllSessions={handleRevokeAllSessions}
              onApproveDevice={handleApproveDevice}
              onRevokeDeviceApproval={handleRevokeDeviceApproval}
            />
          </ProfileCard>
        </TabsContent>

        {/* Account Recovery */}
        <TabsContent value="recovery" className="space-y-6">
          <ProfileCard title="Recuperação de Conta" icon={<Key className="h-5 w-5" />}>
            <div className="space-y-4">
              <div className="space-y-2">
                <h4 className="font-medium">Email de Recuperação</h4>
                <p className="text-sm text-muted-foreground">joao.silva@escritorio.com.br</p>
                <Button variant="outline" size="sm">Alterar Email</Button>
              </div>
              
              <div className="space-y-2">
                <h4 className="font-medium">Perguntas de Segurança</h4>
                <p className="text-sm text-muted-foreground">Configure perguntas para recuperação de conta</p>
                <Button variant="outline" size="sm">Configurar</Button>
              </div>
            </div>
          </ProfileCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}