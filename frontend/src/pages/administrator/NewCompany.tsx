import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { routes } from "@/config/routes";
import { getApiUrl } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

type FormData = {
  name: string;
  email: string;
  cnpj: string;
  phone: string;
  planId: string;
  managerId: string;
  isActive: boolean;
};

type ApiPlan = {
  id?: number | string | null;
  nome?: string | null;
  ativo?: boolean | number | string | null;
};

type PlanOption = {
  id: string;
  label: string;
  isActive: boolean;
};

type ApiUser = {
  id?: number | string | null;
  nome_completo?: string | null;
  email?: string | null;
};

type UserOption = {
  id: string;
  label: string;
};

const parseDataArray = <T,>(payload: unknown): T[] => {
  if (Array.isArray(payload)) {
    return payload as T[];
  }

  if (payload && typeof payload === "object") {
    const rows = (payload as { rows?: unknown }).rows;
    if (Array.isArray(rows)) {
      return rows as T[];
    }

    const data = (payload as { data?: unknown }).data;
    if (Array.isArray(data)) {
      return data as T[];
    }

    if (data && typeof data === "object") {
      const nestedRows = (data as { rows?: unknown }).rows;
      if (Array.isArray(nestedRows)) {
        return nestedRows as T[];
      }
    }
  }

  return [];
};

const normalizeBoolean = (value: unknown): boolean => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (["false", "0", "inativo", "inactive", "nao", "não", "no", "n"].includes(normalized)) {
      return false;
    }

    if (["true", "1", "ativo", "active", "sim", "yes", "y", "s"].includes(normalized)) {
      return true;
    }
  }

  return Boolean(value);
};

const resolveNumericId = (value: unknown): string | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const parsed = Number(trimmed);
    if (!Number.isNaN(parsed) && Number.isFinite(parsed)) {
      return String(parsed);
    }
  }

  return null;
};

const mapPlanToOption = (plan: ApiPlan, index: number): PlanOption | null => {
  const id = resolveNumericId(plan.id);
  if (!id) {
    return null;
  }

  const name =
    typeof plan.nome === "string" && plan.nome.trim().length > 0
      ? plan.nome.trim()
      : `Plano ${index + 1}`;

  return {
    id,
    label: name,
    isActive: normalizeBoolean(plan.ativo),
  } satisfies PlanOption;
};

const mapUserToOption = (user: ApiUser, index: number): UserOption | null => {
  const id = resolveNumericId(user.id);
  if (!id) {
    return null;
  }

  const name =
    typeof user.nome_completo === "string" && user.nome_completo.trim().length > 0
      ? user.nome_completo.trim()
      : null;
  const email =
    typeof user.email === "string" && user.email.trim().length > 0
      ? user.email.trim()
      : null;

  const label =
    name && email
      ? `${name} — ${email}`
      : name ?? email ?? `Usuário ${index + 1}`;

  return {
    id,
    label,
  } satisfies UserOption;
};

const sanitizeDigits = (value: string): string => value.replace(/[^0-9]/g, "");

const parseOptionalNumber = (value: string): number | null => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);
  if (Number.isNaN(parsed) || !Number.isFinite(parsed)) {
    return null;
  }

  return parsed;
};

const initialFormData: FormData = {
  name: "",
  email: "",
  cnpj: "",
  phone: "",
  planId: "",
  managerId: "",
  isActive: true,
};

export default function NewCompany() {
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [planOptions, setPlanOptions] = useState<PlanOption[]>([]);
  const [userOptions, setUserOptions] = useState<UserOption[]>([]);
  const [isLoadingPlans, setIsLoadingPlans] = useState(false);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [auxiliaryError, setAuxiliaryError] = useState<string | null>(null);

  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const controller = new AbortController();

    const loadPlans = async () => {
      setIsLoadingPlans(true);
      try {
        const response = await fetch(getApiUrl("planos"), {
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
          .map(mapPlanToOption)
          .filter((option): option is PlanOption => option !== null)
          .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));

        setPlanOptions(options);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        console.error(error);
        setAuxiliaryError((previous) => previous ?? "Não foi possível carregar algumas informações auxiliares.");
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingPlans(false);
        }
      }
    };

    const loadUsers = async () => {
      setIsLoadingUsers(true);
      try {
        const response = await fetch(getApiUrl("usuarios"), {
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Falha ao carregar usuários (${response.status}).`);
        }

        const payload = await response.json();
        if (controller.signal.aborted) {
          return;
        }

        if (!Array.isArray(payload)) {
          throw new Error("Resposta inesperada ao carregar usuários.");
        }

        const options = payload
          .map((item, index) => mapUserToOption(item as ApiUser, index))
          .filter((option): option is UserOption => option !== null)
          .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));

        setUserOptions(options);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        console.error(error);
        setAuxiliaryError((previous) => previous ?? "Não foi possível carregar algumas informações auxiliares.");
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingUsers(false);
        }
      }
    };

    void loadPlans();
    void loadUsers();

    return () => {
      controller.abort();
    };
  }, []);

  const isLoadingAuxiliaryData = isLoadingPlans || isLoadingUsers;

  const selectedPlanLabel = useMemo(() => {
    if (!formData.planId) {
      return null;
    }

    const plan = planOptions.find((option) => option.id === formData.planId);
    if (!plan) {
      return null;
    }

    return plan.isActive ? plan.label : `${plan.label} (inativo)`;
  }, [formData.planId, planOptions]);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setFormData((previous) => ({ ...previous, [name]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    const digitsOnlyCnpj = sanitizeDigits(formData.cnpj);
    const digitsOnlyPhone = sanitizeDigits(formData.phone);
    const cnpjValue = digitsOnlyCnpj.length > 0 ? digitsOnlyCnpj : formData.cnpj.trim();

    const payload = {
      nome_empresa: formData.name.trim(),
      cnpj: cnpjValue,
      telefone: digitsOnlyPhone.length > 0 ? digitsOnlyPhone : formData.phone.trim() || null,
      email: formData.email.trim() || null,
      plano: parseOptionalNumber(formData.planId),
      responsavel: parseOptionalNumber(formData.managerId),
      ativo: formData.isActive,
    };

    try {
      const response = await fetch(getApiUrl("empresas"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let errorMessage = `Erro ao cadastrar empresa (código ${response.status}).`;
        try {
          const errorPayload = await response.json();
          if (errorPayload && typeof errorPayload === "object") {
            const message = (errorPayload as { error?: unknown }).error;
            if (typeof message === "string" && message.trim().length > 0) {
              errorMessage = message;
            }
          }
        } catch (error) {
          console.error(error);
        }

        throw new Error(errorMessage);
      }

      await response.json().catch(() => null);

      toast({
        title: "Empresa cadastrada",
        description: "A empresa foi criada com sucesso.",
      });
      navigate(routes.admin.companies);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Não foi possível cadastrar a empresa.";

      toast({
        title: "Erro ao cadastrar empresa",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Nova Empresa</h1>
        <p className="text-muted-foreground">Cadastre uma nova empresa no sistema</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Dados da Empresa</CardTitle>
          <CardDescription>Preencha os campos obrigatórios para cadastrar a empresa</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {auxiliaryError ? (
            <Alert variant="destructive">
              <AlertTitle>Atenção</AlertTitle>
              <AlertDescription>
                {auxiliaryError}
              </AlertDescription>
            </Alert>
          ) : null}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Nome</Label>
                <Input
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  autoComplete="organization"
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
                  required
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cnpj">CNPJ</Label>
                <Input
                  id="cnpj"
                  name="cnpj"
                  value={formData.cnpj}
                  onChange={handleInputChange}
                  required
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  placeholder="(00) 0000-0000"
                  autoComplete="tel"
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="planId">Plano</Label>
                <Select
                  value={formData.planId}
                  onValueChange={(value) =>
                    setFormData((previous) => ({ ...previous, planId: value }))
                  }
                  disabled={isLoadingPlans}
                >
                  <SelectTrigger id="planId">
                    <SelectValue
                      placeholder={
                        isLoadingPlans
                          ? "Carregando planos..."
                          : "Selecione um plano (opcional)"
                      }
                    >
                      {selectedPlanLabel}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Sem plano</SelectItem>
                    {planOptions.map((plan) => (
                      <SelectItem key={plan.id} value={plan.id}>
                        {plan.isActive ? plan.label : `${plan.label} (inativo)`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="managerId">Responsável</Label>
                <Select
                  value={formData.managerId}
                  onValueChange={(value) =>
                    setFormData((previous) => ({ ...previous, managerId: value }))
                  }
                  disabled={isLoadingUsers}
                >
                  <SelectTrigger id="managerId">
                    <SelectValue
                      placeholder={
                        isLoadingUsers
                          ? "Carregando usuários..."
                          : "Selecione um responsável (opcional)"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Sem responsável</SelectItem>
                    {userOptions.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-col gap-4 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <Switch
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) =>
                    setFormData((previous) => ({ ...previous, isActive: checked }))
                  }
                />
                <Label htmlFor="isActive" className="font-medium">
                  Empresa ativa
                </Label>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate(-1)}
                  disabled={isSubmitting}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSubmitting || isLoadingAuxiliaryData}>
                  {isSubmitting ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      Salvando...
                    </span>
                  ) : (
                    "Salvar"
                  )}
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

