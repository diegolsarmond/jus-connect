import { useState } from "react";
import { ArrowLeft, Download, Trash2, Shield, FileText, Calendar, User, AlertTriangle, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ProfileCard } from "@/components/profile/ProfileCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface ConsentRecord {
  id: string;
  type: string;
  purpose: string;
  granted: boolean;
  timestamp: Date;
  version: string;
  ipAddress: string;
}

const mockConsentHistory: ConsentRecord[] = [
  {
    id: "1",
    type: "LGPD_CONSENT",
    purpose: "Tratamento de dados pessoais para funcionamento do sistema",
    granted: true,
    timestamp: new Date("2024-01-01T10:00:00"),
    version: "1.0",
    ipAddress: "192.168.1.100"
  },
  {
    id: "2", 
    type: "MARKETING_CONSENT",
    purpose: "Envio de comunicações promocionais e newsletters",
    granted: false,
    timestamp: new Date("2024-01-01T10:00:00"),
    version: "1.0",
    ipAddress: "192.168.1.100"
  },
  {
    id: "3",
    type: "ANALYTICS_CONSENT",
    purpose: "Coleta de dados para análise de uso da plataforma",
    granted: true,
    timestamp: new Date("2024-01-01T10:00:00"),
    version: "1.0",
    ipAddress: "192.168.1.100"
  }
];

export default function PrivacidadeLGPD() {
  const [consentHistory] = useState<ConsentRecord[]>(mockConsentHistory);
  const [isDeletionDialogOpen, setIsDeletionDialogOpen] = useState(false);
  const [deletionReason, setDeletionReason] = useState("");
  const [isExporting, setIsExporting] = useState(false);

  const formatDateTime = (date: Date) => {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const handleExportData = () => {
    setIsExporting(true);
    
    // Simulate data export
    setTimeout(() => {
      setIsExporting(false);
      console.log("Data export completed");
      // In real app, trigger download
    }, 3000);
  };

  const handleDeleteAccount = () => {
    if (deletionReason.trim()) {
      console.log("Account deletion requested:", deletionReason);
      setIsDeletionDialogOpen(false);
      setDeletionReason("");
      // In real app, start deletion process
    }
  };

  const ConsentItem = ({ consent }: { consent: ConsentRecord }) => (
    <div className="flex items-center justify-between p-4 border rounded-lg">
      <div className="flex items-start gap-3 flex-1">
        <div className={`p-2 rounded-lg ${consent.granted ? 'bg-success-light' : 'bg-muted'}`}>
          {consent.granted ? (
            <CheckCircle className="h-4 w-4 text-success" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1">
          <h4 className="font-medium text-foreground">{consent.purpose}</h4>
          <div className="text-sm text-muted-foreground space-y-1 mt-1">
            <p>Versão: {consent.version} • {formatDateTime(consent.timestamp)}</p>
            <p>IP: {consent.ipAddress}</p>
          </div>
        </div>
      </div>
      <Badge variant={consent.granted ? "default" : "outline"} className={consent.granted ? "bg-success text-success-foreground" : ""}>
        {consent.granted ? "Concedido" : "Negado"}
      </Badge>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Privacidade e LGPD</h1>
          <p className="text-muted-foreground">Gerencie seus dados pessoais e direitos de privacidade</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Your Rights */}
          <ProfileCard title="Seus Direitos" icon={<Shield className="h-5 w-5" />}>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                De acordo com a Lei Geral de Proteção de Dados (LGPD), você tem os seguintes direitos:
              </p>
              
              <div className="grid gap-3 md:grid-cols-2">
                <div className="p-3 bg-muted/50 rounded-lg">
                  <h4 className="font-medium text-sm mb-1">Acesso aos Dados</h4>
                  <p className="text-xs text-muted-foreground">Visualizar quais dados pessoais coletamos</p>
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

          {/* Data Export */}
          <ProfileCard title="Exportar Dados" icon={<Download className="h-5 w-5" />}>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Baixe uma cópia de todos os seus dados pessoais em formato JSON estruturado.
              </p>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-primary" />
                    <div>
                      <h4 className="font-medium text-sm">Dados Completos</h4>
                      <p className="text-xs text-muted-foreground">
                        Perfil, histórico, configurações e logs de auditoria
                      </p>
                    </div>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleExportData}
                    disabled={isExporting}
                  >
                    {isExporting ? "Preparando..." : "Exportar"}
                  </Button>
                </div>

                <div className="text-xs text-muted-foreground p-3 bg-accent/50 rounded-lg">
                  <p className="font-medium mb-1">Informações sobre o export:</p>
                  <ul className="space-y-1">
                    <li>• O arquivo será enviado para seu email em até 48 horas</li>
                    <li>• Dados sensíveis serão anonimizados quando necessário</li>
                    <li>• O link de download expira em 7 dias</li>
                  </ul>
                </div>
              </div>
            </div>
          </ProfileCard>

          {/* Consent History */}
          <ProfileCard title="Histórico de Consentimentos" icon={<Calendar className="h-5 w-5" />}>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Registro completo dos consentimentos concedidos ou negados.
              </p>
              
              <div className="space-y-3">
                {consentHistory.map(consent => (
                  <ConsentItem key={consent.id} consent={consent} />
                ))}
              </div>
            </div>
          </ProfileCard>

          {/* Account Deletion */}
          <ProfileCard title="Exclusão de Conta" icon={<Trash2 className="h-5 w-5" />}>
            <div className="space-y-4">
              <div className="p-4 bg-warning-light/10 border border-warning/20 rounded-lg">
                <div className="flex gap-3">
                  <AlertTriangle className="h-5 w-5 text-warning mt-0.5" />
                  <div className="space-y-2">
                    <h4 className="font-medium text-foreground">Atenção!</h4>
                    <p className="text-sm text-muted-foreground">
                      A exclusão da conta é permanente e irreversível. Todos os seus dados serão removidos em até 30 dias, 
                      exceto informações que devemos manter por obrigações legais.
                    </p>
                  </div>
                </div>
              </div>

              <Dialog open={isDeletionDialogOpen} onOpenChange={setIsDeletionDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    Solicitar Exclusão da Conta
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Confirmar Exclusão da Conta</DialogTitle>
                    <DialogDescription>
                      Esta ação não pode ser desfeita. Todos os seus dados serão permanentemente removidos.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="deletion-reason">Motivo da exclusão (opcional)</Label>
                      <Textarea
                        id="deletion-reason"
                        placeholder="Conte-nos por que está deixando nossa plataforma..."
                        value={deletionReason}
                        onChange={(e) => setDeletionReason(e.target.value)}
                      />
                    </div>
                    
                    <div className="flex gap-3">
                      <Button 
                        variant="destructive" 
                        onClick={handleDeleteAccount}
                        className="flex-1"
                      >
                        Confirmar Exclusão
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={() => setIsDeletionDialogOpen(false)}
                        className="flex-1"
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </ProfileCard>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Data Summary */}
          <ProfileCard title="Resumo dos Dados" variant="compact">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Dados pessoais</span>
                <Badge variant="outline">15 campos</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Logs de atividade</span>
                <Badge variant="outline">847 registros</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Documentos</span>
                <Badge variant="outline">23 arquivos</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Sessões</span>
                <Badge variant="outline">12 registros</Badge>
              </div>
            </div>
          </ProfileCard>

          {/* Privacy Settings */}
          <ProfileCard title="Configurações de Privacidade" variant="compact">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Perfil público</span>
                <Badge variant="outline">Desabilitado</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Analytics</span>
                <Badge variant="default" className="bg-success text-success-foreground">Ativo</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Marketing</span>
                <Badge variant="outline">Desabilitado</Badge>
              </div>
              <Button variant="outline" size="sm" className="w-full">
                Gerenciar Preferências
              </Button>
            </div>
          </ProfileCard>

          {/* Contact DPO */}
          <ProfileCard title="Contato - DPO" variant="compact">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Encarregado de Dados</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Para questões sobre privacidade e proteção de dados:
              </p>
              <div className="text-sm space-y-1">
                <p>dpo@escritorio.com.br</p>
                <p>(11) 3000-0000</p>
              </div>
              <Button variant="outline" size="sm" className="w-full">
                Entrar em Contato
              </Button>
            </div>
          </ProfileCard>

          {/* Legal Documents */}
          <ProfileCard title="Documentos" variant="compact">
            <div className="space-y-2">
              <Button variant="ghost" size="sm" className="w-full justify-start">
                <FileText className="h-4 w-4 mr-2" />
                Política de Privacidade
              </Button>
              <Button variant="ghost" size="sm" className="w-full justify-start">
                <FileText className="h-4 w-4 mr-2" />
                Termos de Uso
              </Button>
              <Button variant="ghost" size="sm" className="w-full justify-start">
                <FileText className="h-4 w-4 mr-2" />
                Política de Cookies
              </Button>
            </div>
          </ProfileCard>
        </div>
      </div>
    </div>
  );
}