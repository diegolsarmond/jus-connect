import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import quantumLogo from "@/assets/quantum-logo.png";
import { routes } from "@/config/routes";
import { appConfig } from "@/config/app-config";
import { Loader2 } from "lucide-react";
import { getApiUrl } from "@/lib/api";

const Register = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    company: "",
    password: "",
    confirmPassword: ""
  });
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const extractErrorMessage = async (response: Response) => {
    try {
      const data = await response.clone().json();
      if (typeof data?.error === "string" && data.error.trim().length > 0) {
        return data.error;
      }
      if (typeof data?.message === "string" && data.message.trim().length > 0) {
        return data.message;
      }
    } catch (error) {
      console.warn("Falha ao interpretar erro de cadastro", error);
    }

    try {
      const text = await response.text();
      const trimmed = text.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    } catch (error) {
      console.warn("Falha ao ler resposta de erro", error);
    }

    return "Não foi possível concluir o cadastro. Tente novamente.";
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "As senhas não coincidem."
      });
      return;
    }

    setIsSubmitting(true);

    const payload = {
      nome_completo: formData.name.trim(),
      cpf: "",
      email: formData.email.trim(),
      perfil: null,
      empresa: null,
      escritorio: null,
      oab: null,
      status: true,
      senha: formData.password,
      telefone: null,
      ultimo_login: null,
      observacoes:
        formData.company.trim().length > 0
          ? `Empresa informada no cadastro: ${formData.company.trim()}`
          : null
    };

    try {
      const response = await fetch(getApiUrl("usuarios"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorMessage = await extractErrorMessage(response);
        throw new Error(errorMessage);
      }

      toast({
        title: "Cadastro realizado!",
        description: "Sua conta foi criada com sucesso."
      });
      navigate(routes.login);
    } catch (error) {
      const description =
        error instanceof Error
          ? error.message
          : "Não foi possível concluir o cadastro. Tente novamente.";
      toast({
        variant: "destructive",
        title: "Erro ao cadastrar",
        description
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-primary/5 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-accent/10" />
      
      <Card className="w-full max-w-md relative backdrop-blur-sm border-primary/10 shadow-glow">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <img src={quantumLogo} alt={appConfig.appName} className="h-16 w-auto" />
          </div>
          <CardTitle className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            Criar Conta
          </CardTitle>
          <CardDescription>
            Preencha os dados para criar sua conta no {appConfig.appName}
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome Completo</Label>
              <Input
                id="name"
                name="name"
                type="text"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="Seu nome completo"
                required
                className="border-primary/20 focus:border-primary"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="seu@email.com"
                required
                className="border-primary/20 focus:border-primary"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="company">Empresa</Label>
              <Input
                id="company"
                name="company"
                type="text"
                value={formData.company}
                onChange={handleInputChange}
                placeholder="Nome da sua empresa"
                required
                className="border-primary/20 focus:border-primary"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                name="password"
                type="password"
                value={formData.password}
                onChange={handleInputChange}
                placeholder="Sua senha"
                required
                className="border-primary/20 focus:border-primary"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar Senha</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                placeholder="Confirme sua senha"
                required
                className="border-primary/20 focus:border-primary"
              />
            </div>
            
            <Button type="submit" className="w-full bg-gradient-primary hover:opacity-90" disabled={isSubmitting}>
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processando...
                </span>
              ) : (
                "Criar Conta"
              )}
            </Button>
          </form>
          
          <Separator className="my-6" />
          
          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              Já tem uma conta?{" "}
              <Link to={routes.login} className="text-primary hover:underline font-medium">
                Fazer login
              </Link>
            </p>
            <Link to={routes.home} className="text-sm text-muted-foreground hover:text-primary transition-colors">
              ← Voltar para home
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Register;