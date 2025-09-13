import { useState } from "react";
import { ArrowLeft, Save, User, Mail, Phone, Building2, Scale, Globe, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProfileCard } from "@/components/profile/ProfileCard";
import { AvatarUploader } from "@/components/profile/AvatarUploader";
import { UserFormData } from "@/types/user";
import { X } from "lucide-react";

const mockUserData: UserFormData = {
  name: "Dr. João Silva",
  email: "joao.silva@escritorio.com.br",
  phone: "(11) 99999-9999",
  role: "advogado",
  escritorio: "principal",
  oabNumero: "123456",
  oabUf: "SP",
  especialidades: ["Direito Civil", "Direito Empresarial"],
  tarifaPorHora: 350,
  timezone: "America/Sao_Paulo",
  idioma: "pt-BR",
  lgpdConsent: true,
};

export default function EditarPerfil() {
  const [formData, setFormData] = useState<UserFormData>(mockUserData);
  const [especialidadesInput, setEspecialidadesInput] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [emailVerificationPending, setEmailVerificationPending] = useState(false);

  const isAdvogado = formData.role === "advogado";

  const handleInputChange = <K extends keyof UserFormData>(
    field: K,
    value: UserFormData[K],
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setIsDirty(true);

    // Simulate email verification requirement
    if (field === "email" && value !== mockUserData.email) {
      setEmailVerificationPending(true);
    }
  };

  const addEspecialidade = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && especialidadesInput.trim()) {
      e.preventDefault();
      if (!formData.especialidades.includes(especialidadesInput.trim())) {
        handleInputChange("especialidades", [...formData.especialidades, especialidadesInput.trim()]);
      }
      setEspecialidadesInput("");
    }
  };

  const removeEspecialidade = (especialidade: string) => {
    handleInputChange("especialidades", formData.especialidades.filter(e => e !== especialidade));
  };

  const handleAvatarChange = (file: File | null) => {
    if (file) {
      // In real implementation, upload to server and get URL
      console.log("Avatar file:", file);
      setIsDirty(true);
    }
  };

  const handleSave = () => {
    console.log("Saving profile:", formData);
    setIsDirty(false);
    // Show success toast
  };

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
            <h1 className="text-3xl font-bold">Editar Perfil</h1>
            <p className="text-muted-foreground">Atualize suas informações pessoais e profissionais</p>
          </div>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" disabled={!isDirty}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!isDirty} className="bg-primary hover:bg-primary-hover">
            <Save className="h-4 w-4 mr-2" />
            Salvar Alterações
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Information */}
          <ProfileCard title="Informações Básicas" icon={<User className="h-5 w-5" />}>
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome Completo *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                    placeholder="João Silva"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role">Função</Label>
                  <Select value={formData.role} onValueChange={(value) => handleInputChange("role", value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Administrador</SelectItem>
                      <SelectItem value="advogado">Advogado</SelectItem>
                      <SelectItem value="estagiario">Estagiário</SelectItem>
                      <SelectItem value="secretario">Secretário</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="escritorio">Escritório</Label>
                <Select value={formData.escritorio} onValueChange={(value) => handleInputChange("escritorio", value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="principal">Escritório Principal</SelectItem>
                    <SelectItem value="filial-sp">Filial São Paulo</SelectItem>
                    <SelectItem value="filial-rj">Filial Rio de Janeiro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </ProfileCard>

          {/* Contact Information */}
          <ProfileCard title="Contato" icon={<Mail className="h-5 w-5" />}>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                  placeholder="joao@escritorio.com.br"
                />
                {emailVerificationPending && (
                  <div className="flex items-center gap-2 text-sm text-warning">
                    <Mail className="h-4 w-4" />
                    <span>Alteração pendente de verificação por email</span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => handleInputChange("phone", e.target.value)}
                  placeholder="(11) 99999-9999"
                />
              </div>
            </div>
          </ProfileCard>

          {/* OAB Information - Only for lawyers */}
          {isAdvogado && (
            <ProfileCard title="Dados OAB" icon={<Scale className="h-5 w-5" />}>
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="oabNumero">Número OAB *</Label>
                    <Input
                      id="oabNumero"
                      value={formData.oabNumero}
                      onChange={(e) => handleInputChange("oabNumero", e.target.value)}
                      placeholder="123456"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="oabUf">UF *</Label>
                    <Select value={formData.oabUf} onValueChange={(value) => handleInputChange("oabUf", value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="UF" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SP">SP</SelectItem>
                        <SelectItem value="RJ">RJ</SelectItem>
                        <SelectItem value="MG">MG</SelectItem>
                        <SelectItem value="RS">RS</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Especialidades</Label>
                  <Input
                    placeholder="Digite e pressione Enter para adicionar"
                    value={especialidadesInput}
                    onChange={(e) => setEspecialidadesInput(e.target.value)}
                    onKeyDown={addEspecialidade}
                  />
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formData.especialidades.map((especialidade) => (
                      <Badge key={especialidade} variant="secondary" className="pr-1">
                        {especialidade}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-4 w-4 p-0 ml-1 hover:bg-destructive hover:text-destructive-foreground"
                          onClick={() => removeEspecialidade(especialidade)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tarifaPorHora">Tarifa por Hora (R$)</Label>
                  <Input
                    id="tarifaPorHora"
                    type="number"
                    value={formData.tarifaPorHora}
                    onChange={(e) => handleInputChange("tarifaPorHora", parseFloat(e.target.value))}
                    placeholder="350.00"
                  />
                </div>
              </div>
            </ProfileCard>
          )}

          {/* Preferences */}
          <ProfileCard title="Preferências" icon={<Globe className="h-5 w-5" />}>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <Select value={formData.timezone} onValueChange={(value) => handleInputChange("timezone", value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="America/Sao_Paulo">Brasília (GMT-3)</SelectItem>
                    <SelectItem value="America/Manaus">Manaus (GMT-4)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="idioma">Idioma</Label>
                <Select value={formData.idioma} onValueChange={(value) => handleInputChange("idioma", value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pt-BR">Português (Brasil)</SelectItem>
                    <SelectItem value="en-US">English (US)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </ProfileCard>

          {/* LGPD Consent */}
          <ProfileCard title="Consentimento LGPD">
            <div className="flex items-start space-x-3">
              <Checkbox
                id="lgpdConsent"
                checked={formData.lgpdConsent}
                onCheckedChange={(checked) => handleInputChange("lgpdConsent", checked)}
              />
              <div className="space-y-1 leading-none">
                <Label htmlFor="lgpdConsent" className="cursor-pointer">
                  Concordo com o tratamento dos meus dados pessoais
                </Label>
                <p className="text-sm text-muted-foreground">
                  Autorizo o tratamento de meus dados pessoais conforme nossa Política de Privacidade.
                </p>
              </div>
            </div>
          </ProfileCard>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Avatar */}
          <ProfileCard title="Avatar">
            <AvatarUploader
              currentAvatar=""
              userName={formData.name}
              onAvatarChange={handleAvatarChange}
              size="lg"
            />
          </ProfileCard>

          {/* Preview */}
          <ProfileCard title="Pré-visualização" variant="compact">
            <div className="space-y-3">
              <div className="text-center">
                <h3 className="font-semibold text-foreground">{formData.name}</h3>
                <p className="text-sm text-muted-foreground">{formData.email}</p>
                <div className="flex justify-center mt-2">
                  <Badge variant="outline">
                    {formData.role === "admin" ? "Administrador" : 
                     formData.role === "advogado" ? "Advogado" :
                     formData.role === "estagiario" ? "Estagiário" : "Secretário"}
                  </Badge>
                </div>
              </div>
              
              {isAdvogado && formData.oabNumero && formData.oabUf && (
                <div className="text-center">
                  <Badge variant="secondary">
                    OAB: {formData.oabNumero}/{formData.oabUf}
                  </Badge>
                </div>
              )}
            </div>
          </ProfileCard>
        </div>
      </div>
    </div>
  );
}