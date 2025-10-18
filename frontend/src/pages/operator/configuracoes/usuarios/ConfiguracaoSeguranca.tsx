import { useState } from "react";
import { ArrowLeft, Shield, Smartphone, QrCode, Copy, Check, AlertTriangle, Key, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ProfileCard } from "@/components/profile/ProfileCard";

export default function ConfiguracaoSeguranca() {
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [isSetupModalOpen, setIsSetupModalOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Mock QR code data
  const qrCodeData = "otpauth://totp/CRM%20Jurídico:joao.silva@escritorio.com.br?secret=JBSWY3DPEHPK3PXP&issuer=CRM%20Jurídico";
  const secretKey = "JBSWY3DPEHPK3PXP";

  const generateBackupCodes = () => {
    const codes = Array.from({ length: 10 }, () => 
      Math.random().toString(36).substring(2, 8).toUpperCase()
    );
    setBackupCodes(codes);
    setShowBackupCodes(true);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(text);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleEnable2FA = () => {
    if (verificationCode.length === 6) {
      setTwoFactorEnabled(true);
      generateBackupCodes();
      setIsSetupModalOpen(false);
      setVerificationCode("");
    }
  };

  const handleDisable2FA = () => {
    setTwoFactorEnabled(false);
    setBackupCodes([]);
    setShowBackupCodes(false);
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
                      <Badge variant={twoFactorEnabled ? "default" : "outline"} className={twoFactorEnabled ? "bg-success text-success-foreground" : ""}>
                        {twoFactorEnabled ? "Ativo" : "Inativo"}
                      </Badge>
                      <Dialog open={isSetupModalOpen} onOpenChange={setIsSetupModalOpen}>
                        <DialogTrigger asChild>
                          <Switch
                            checked={twoFactorEnabled}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setIsSetupModalOpen(true);
                              } else {
                                handleDisable2FA();
                              }
                            }}
                          />
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                          <DialogHeader>
                            <DialogTitle>Configurar Autenticação 2FA</DialogTitle>
                            <DialogDescription>
                              Escaneie o QR code com seu aplicativo autenticador
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            {/* QR Code Placeholder */}
                            <div className="flex justify-center">
                              <div className="w-48 h-48 bg-muted border-2 border-dashed rounded-lg flex items-center justify-center">
                                <div className="text-center space-y-2">
                                  <QrCode className="h-12 w-12 mx-auto text-muted-foreground" />
                                  <p className="text-sm text-muted-foreground">QR Code aqui</p>
                                </div>
                              </div>
                            </div>

                            {/* Manual Entry */}
                            <div className="space-y-2">
                              <Label className="text-sm">Ou digite manualmente:</Label>
                              <div className="flex gap-2">
                                <Input
                                  readOnly
                                  value={secretKey}
                                  className="font-mono text-sm"
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => copyToClipboard(secretKey)}
                                >
                                  {copiedCode === secretKey ? (
                                    <Check className="h-4 w-4" />
                                  ) : (
                                    <Copy className="h-4 w-4" />
                                  )}
                                </Button>
                              </div>
                            </div>

                            {/* Verification */}
                            <div className="space-y-2">
                              <Label htmlFor="verification-code">Código de verificação</Label>
                              <Input
                                id="verification-code"
                                placeholder="000000"
                                value={verificationCode}
                                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                className="text-center text-2xl tracking-widest"
                                maxLength={6}
                              />
                            </div>

                            <Button
                              onClick={handleEnable2FA}
                              disabled={verificationCode.length !== 6}
                              className="w-full"
                            >
                              Ativar 2FA
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>

                  {/* Backup Codes */}
                  {twoFactorEnabled && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">Códigos de Backup</h4>
                        <Button variant="outline" size="sm" onClick={generateBackupCodes}>
                          Gerar Novos Códigos
                        </Button>
                      </div>

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
        </TabsContent>

        {/* Sessions Management */}
        <TabsContent value="sessions" className="space-y-6">
          <ProfileCard title="Gerenciamento de Sessões" icon={<Clock className="h-5 w-5" />}>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Gerencie dispositivos e sessões ativas. Para mais detalhes, acesse a página de sessões.
              </p>
              <Button variant="outline">
                Ver Todas as Sessões
              </Button>
            </div>
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