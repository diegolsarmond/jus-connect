import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchPlanOptions, formatPlanPriceLabel, type PlanOption } from "@/features/plans/api";

const Register = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    company: "",
    phone: "",
    password: "",
    confirmPassword: ""
  });
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchParams] = useSearchParams();
  const planFromUrl = searchParams.get("plan");
  const [planOptions, setPlanOptions] = useState<PlanOption[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [isPlansLoading, setIsPlansLoading] = useState(true);
  const [plansError, setPlansError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    const loadPlans = async () => {
      setIsPlansLoading(true);
      setPlansError(null);

      try {
        const plans = await fetchPlanOptions(controller.signal);
        if (!active) {
          return;
        }

        setPlanOptions(plans);

        if (plans.length === 0) {
          setSelectedPlanId("");
          return;
        }

        const normalizedParam = planFromUrl ? planFromUrl.trim() : "";
        const matched = plans.find((plan) => String(plan.id) === normalizedParam);
        const fallback = matched ?? plans[0];
        setSelectedPlanId(String(fallback.id));
      } catch (error) {
        if (!active || (error instanceof DOMException && error.name === "AbortError")) {
          return;
        }

        console.error("Falha ao carregar planos disponíveis para cadastro", error);
        setPlansError("Não foi possível carregar os planos disponíveis no momento.");
        setPlanOptions([]);
        setSelectedPlanId("");
      } finally {
        if (active) {
          setIsPlansLoading(false);
        }
      }
    };

    void loadPlans();

    return () => {
      active = false;
      controller.abort();
    };
  }, [planFromUrl]);

  const selectedPlan = useMemo(
    () => planOptions.find((plan) => String(plan.id) === selectedPlanId) ?? null,
    [planOptions, selectedPlanId],
  );

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

  const formatPhoneInput = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 2) {
      return digits;
    }
    if (digits.length <= 6) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    }
    if (digits.length <= 10) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    }
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!selectedPlanId) {
      toast({
        variant: "destructive",
        title: "Plano obrigatório",
        description: "Selecione um plano para iniciar o teste gratuito.",
      });
      return;
    }

    const parsedPlanId = Number.parseInt(selectedPlanId, 10);
    if (!Number.isFinite(parsedPlanId)) {
      toast({
        variant: "destructive",
        title: "Plano inválido",
        description: "O plano selecionado é inválido. Atualize a página e tente novamente.",
      });
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "As senhas não coincidem."
      });
      return;
    }

    setIsSubmitting(true);

    const phoneDigits = formData.phone.replace(/\D/g, "");
    const payload = {
      name: formData.name.trim(),
      email: formData.email.trim(),
      company: formData.company.trim(),
      password: formData.password,
      phone: phoneDigits.length > 0 ? phoneDigits : undefined,
      planId: parsedPlanId,
    };

    try {
      const response = await fetch(getApiUrl("auth/register"), {
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
        description: "Sua conta foi criada, confirme o e-mail para ter acesso ao sistema."
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
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === "phone" ? formatPhoneInput(value) : value
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
              <Label htmlFor="planId">Plano que deseja testar</Label>
              <Select
                value={selectedPlanId}
                onValueChange={setSelectedPlanId}
                disabled={isPlansLoading || planOptions.length === 0}
              >
                <SelectTrigger
                  id="planId"
                  className="border-primary/20 focus:border-primary"
                >
                  <SelectValue
                    placeholder={
                      isPlansLoading ? "Carregando planos..." : "Selecione o plano do teste"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {planOptions.map((plan) => (
                    <SelectItem key={plan.id} value={String(plan.id)}>
                      {`${plan.name} • ${formatPlanPriceLabel(plan)}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {plansError ? (
                <p className="text-sm text-destructive">{plansError}</p>
              ) : selectedPlan ? (
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {selectedPlan.description ??
                    "Você terá acesso a todos os recursos desse plano durante 14 dias sem custo."}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Escolha o plano para liberar seu teste gratuito de 14 dias.
                </p>
              )}
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
              <Label htmlFor="phone">Telefone</Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                value={formData.phone}
                onChange={handleInputChange}
                placeholder="(11) 99999-0000"
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
            
            <Button
              type="submit"
              className="w-full bg-gradient-primary hover:opacity-90"
              disabled={
                isSubmitting ||
                isPlansLoading ||
                planOptions.length === 0 ||
                !selectedPlanId
              }
            >
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
