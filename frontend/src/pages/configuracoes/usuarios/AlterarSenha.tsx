import { useState } from "react";
import { ArrowLeft, Eye, EyeOff, Shield, Check, X, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ProfileCard } from "@/components/profile/ProfileCard";
import { Badge } from "@/components/ui/badge";

interface PasswordStrength {
  score: number;
  label: string;
  color: string;
  suggestions: string[];
}

export default function AlterarSenha() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });
  const [isLoading, setIsLoading] = useState(false);

  // Password strength calculation
  const calculatePasswordStrength = (password: string): PasswordStrength => {
    let score = 0;
    const suggestions: string[] = [];

    if (password.length >= 10) score += 1;
    else suggestions.push("Use pelo menos 10 caracteres");

    if (/[a-z]/.test(password)) score += 1;
    else suggestions.push("Adicione letras minúsculas");

    if (/[A-Z]/.test(password)) score += 1;
    else suggestions.push("Adicione letras maiúsculas");

    if (/[0-9]/.test(password)) score += 1;
    else suggestions.push("Adicione números");

    if (/[^A-Za-z0-9]/.test(password)) score += 1;
    else suggestions.push("Adicione símbolos (!@#$%^&*)");

    const strengthLevels = {
      0: { label: "Muito Fraca", color: "text-destructive" },
      1: { label: "Fraca", color: "text-destructive" },
      2: { label: "Regular", color: "text-warning" },
      3: { label: "Boa", color: "text-primary" },
      4: { label: "Forte", color: "text-success" },
      5: { label: "Muito Forte", color: "text-success" }
    };

    const level = strengthLevels[score as keyof typeof strengthLevels];

    return {
      score: (score / 5) * 100,
      label: level.label,
      color: level.color,
      suggestions
    };
  };

  const passwordStrength = calculatePasswordStrength(newPassword);
  const passwordsMatch = newPassword && confirmPassword && newPassword === confirmPassword;
  const isFormValid = currentPassword && newPassword && confirmPassword && passwordsMatch && passwordStrength.score >= 60;

  const togglePasswordVisibility = (field: keyof typeof showPasswords) => {
    setShowPasswords(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;

    setIsLoading(true);
    
    // Simulate API call
    setTimeout(() => {
      setIsLoading(false);
      console.log("Password changed successfully");
      // Reset form and show success
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }, 2000);
  };

  const PasswordInput = ({ 
    id, 
    label, 
    value, 
    onChange, 
    showPassword, 
    onToggleVisibility 
  }: {
    id: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
    showPassword: boolean;
    onToggleVisibility: () => void;
  }) => (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={showPassword ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="pr-10"
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
          onClick={onToggleVisibility}
        >
          {showPassword ? (
            <EyeOff className="h-4 w-4 text-muted-foreground" />
          ) : (
            <Eye className="h-4 w-4 text-muted-foreground" />
          )}
        </Button>
      </div>
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
          <h1 className="text-3xl font-bold">Alterar Senha</h1>
          <p className="text-muted-foreground">Mantenha sua conta segura com uma senha forte</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Form */}
        <div className="lg:col-span-2">
          <ProfileCard title="Nova Senha" icon={<Shield className="h-5 w-5" />}>
            <form onSubmit={handleSubmit} className="space-y-6">
              <PasswordInput
                id="current-password"
                label="Senha Atual *"
                value={currentPassword}
                onChange={setCurrentPassword}
                showPassword={showPasswords.current}
                onToggleVisibility={() => togglePasswordVisibility('current')}
              />

              <PasswordInput
                id="new-password"
                label="Nova Senha *"
                value={newPassword}
                onChange={setNewPassword}
                showPassword={showPasswords.new}
                onToggleVisibility={() => togglePasswordVisibility('new')}
              />

              {/* Password Strength */}
              {newPassword && (
                <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Força da senha:</span>
                    <Badge variant="outline" className={passwordStrength.color}>
                      {passwordStrength.label}
                    </Badge>
                  </div>
                  <Progress value={passwordStrength.score} className="h-2" />
                  {passwordStrength.suggestions.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Sugestões para melhorar:</p>
                      <ul className="text-xs text-muted-foreground space-y-1">
                        {passwordStrength.suggestions.map((suggestion, index) => (
                          <li key={index} className="flex items-center gap-2">
                            <X className="h-3 w-3 text-destructive" />
                            {suggestion}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              <PasswordInput
                id="confirm-password"
                label="Confirmar Nova Senha *"
                value={confirmPassword}
                onChange={setConfirmPassword}
                showPassword={showPasswords.confirm}
                onToggleVisibility={() => togglePasswordVisibility('confirm')}
              />

              {/* Password Match Validation */}
              {confirmPassword && (
                <div className={`flex items-center gap-2 text-sm ${
                  passwordsMatch ? 'text-success' : 'text-destructive'
                }`}>
                  {passwordsMatch ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <X className="h-4 w-4" />
                  )}
                  {passwordsMatch ? 'As senhas coincidem' : 'As senhas não coincidem'}
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <Button
                  type="submit"
                  disabled={!isFormValid || isLoading}
                  className="bg-primary hover:bg-primary-hover"
                >
                  {isLoading ? "Alterando..." : "Alterar Senha"}
                </Button>
                <Button type="button" variant="outline">
                  Cancelar
                </Button>
              </div>
            </form>
          </ProfileCard>
        </div>

        {/* Security Guidelines */}
        <div className="space-y-6">
          <ProfileCard title="Política de Senhas" variant="compact">
            <div className="space-y-4">
              <div className="space-y-2">
                <h4 className="font-medium text-foreground">Requisitos mínimos:</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li className="flex items-center gap-2">
                    <Check className="h-3 w-3 text-success" />
                    Mínimo 10 caracteres
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-3 w-3 text-success" />
                    Letras maiúsculas e minúsculas
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-3 w-3 text-success" />
                    Pelo menos um número
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-3 w-3 text-success" />
                    Pelo menos um símbolo
                  </li>
                </ul>
              </div>
            </div>
          </ProfileCard>

          <ProfileCard title="Dicas de Segurança" variant="compact">
            <div className="space-y-3">
              <div className="flex gap-3">
                <AlertTriangle className="h-5 w-5 text-warning mt-0.5" />
                <div className="space-y-2">
                  <ul className="text-sm text-muted-foreground space-y-2">
                    <li>• Use senhas únicas para cada conta</li>
                    <li>• Considere usar um gerenciador de senhas</li>
                    <li>• Nunca compartilhe sua senha</li>
                    <li>• Ative a autenticação de dois fatores</li>
                    <li>• Altere senhas regularmente</li>
                  </ul>
                </div>
              </div>
            </div>
          </ProfileCard>

          <ProfileCard title="Histórico" variant="compact">
            <div className="text-sm text-muted-foreground space-y-2">
              <p>Última alteração: 15/01/2024 às 14:30</p>
              <p>Alterações nos últimos 90 dias: 2</p>
            </div>
          </ProfileCard>
        </div>
      </div>
    </div>
  );
}