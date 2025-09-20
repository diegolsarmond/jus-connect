import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { routes } from "@/config/routes";
import { getApiUrl } from "@/lib/api";
import { ApiCompany, ApiPlan, parseDataArray } from "./companies-data";

type Option = {
  id: string;
  label: string;
};

const normalizeId = (value: unknown): string | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }

  return null;
};

const mapCompanyToOption = (company: ApiCompany, index: number): Option | null => {
  const id = normalizeId(company.id);
  if (!id) {
    return null;
  }

  const label =
    typeof company.nome_empresa === "string" && company.nome_empresa.trim().length > 0
      ? company.nome_empresa.trim()
      : `Empresa ${index + 1}`;

  return { id, label } satisfies Option;
};

const mapPlanToOption = (plan: ApiPlan, index: number): Option | null => {
  const id = normalizeId(plan.id);
  if (!id) {
    return null;
  }

  const label =
    typeof plan.nome === "string" && plan.nome.trim().length > 0 ? plan.nome.trim() : `Plano ${index + 1}`;

  return { id, label } satisfies Option;
};

const NewSubscription = () => {
  const [companyId, setCompanyId] = useState("");
  const [planId, setPlanId] = useState("");
  const [status, setStatus] = useState("trialing");
  const [startDate, setStartDate] = useState("");
  const [companyOptions, setCompanyOptions] = useState<Option[]>([]);
  const [planOptions, setPlanOptions] = useState<Option[]>([]);
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(false);
  const [isLoadingPlans, setIsLoadingPlans] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const controller = new AbortController();

    const loadCompanies = async () => {
      setIsLoadingCompanies(true);
      try {
        const response = await fetch(getApiUrl("get_api_empresas"), {
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Falha ao carregar empresas (${response.status}).`);
        }

        const payload = await response.json();
        if (controller.signal.aborted) {
          return;
        }

        const options = parseDataArray<ApiCompany>(payload)
          .map((company, index) => mapCompanyToOption(company, index))
          .filter((option): option is Option => option !== null)
          .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));

        setCompanyOptions(options);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        console.error("Erro ao carregar empresas:", error);
        setCompanyOptions([]);
        toast({
          variant: "destructive",
          title: "Erro",
          description: "Não foi possível carregar a lista de empresas.",
        });
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingCompanies(false);
        }
      }
    };

    const loadPlans = async () => {
      setIsLoadingPlans(true);
      try {
        const response = await fetch(getApiUrl("get_api_planos"), {
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Falha ao carregar planos (${response.status}).`);
        }

        const payload = await response.json();
        if (controller.signal.aborted) {
          return;
        }

        const options = parseDataArray<ApiPlan>(payload)
          .map((plan, index) => mapPlanToOption(plan, index))
          .filter((option): option is Option => option !== null)
          .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));

        setPlanOptions(options);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        console.error("Erro ao carregar planos:", error);
        setPlanOptions([]);
        toast({
          variant: "destructive",
          title: "Erro",
          description: "Não foi possível carregar a lista de planos.",
        });
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingPlans(false);
        }
      }
    };

    void loadCompanies();
    void loadPlans();

    return () => {
      controller.abort();
    };
  }, [toast]);

  useEffect(() => {
    if (companyId && !companyOptions.some((option) => option.id === companyId)) {
      setCompanyId("");
    }
  }, [companyOptions, companyId]);

  useEffect(() => {
    if (planId && !planOptions.some((option) => option.id === planId)) {
      setPlanId("");
    }
  }, [planOptions, planId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!companyId || !planId || !startDate) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Preencha todos os campos obrigatórios.",
      });
      return;
    }

    toast({
      title: "Assinatura criada!",
      description: "A nova assinatura foi registrada com sucesso.",
    });

    navigate(routes.admin.subscriptions);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Nova Assinatura</h1>
        <p className="text-muted-foreground">Cadastre uma nova assinatura para uma empresa.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Detalhes da Assinatura</CardTitle>
          <CardDescription>Informe os dados necessários para criar a assinatura</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Empresa</Label>
              <Select value={companyId} onValueChange={setCompanyId} disabled={isLoadingCompanies}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a empresa" />
                </SelectTrigger>
                <SelectContent>
                  {isLoadingCompanies ? (
                    <SelectItem value="__loading" disabled>
                      Carregando empresas...
                    </SelectItem>
                  ) : companyOptions.length > 0 ? (
                    companyOptions.map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.label}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="__empty" disabled>
                      Nenhuma empresa disponível
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Plano</Label>
              <Select value={planId} onValueChange={setPlanId} disabled={isLoadingPlans}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o plano" />
                </SelectTrigger>
                <SelectContent>
                  {isLoadingPlans ? (
                    <SelectItem value="__loading" disabled>
                      Carregando planos...
                    </SelectItem>
                  ) : planOptions.length > 0 ? (
                    planOptions.map((plan) => (
                      <SelectItem key={plan.id} value={plan.id}>
                        {plan.label}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="__empty" disabled>
                      Nenhum plano disponível
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativa</SelectItem>
                  <SelectItem value="trialing">Trial</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="startDate">Início do Período</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>

            <Button type="submit" className="w-full">
              Salvar Assinatura
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default NewSubscription;

