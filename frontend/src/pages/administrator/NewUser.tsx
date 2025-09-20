import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { routes } from "@/config/routes";
import { getApiUrl } from "@/lib/api";

type ApiCompany = {
  id?: number | string | null;
  nome_empresa?: string | null;
  email?: string | null;
};

type ApiRole = {
  id?: number | string | null;
  nome?: string | null;
  descricao?: string | null;
};

type SelectOption = {
  id: string;
  label: string;
};

const extractCollection = <T,>(payload: unknown): T[] => {
  if (Array.isArray(payload)) {
    return payload as T[];
  }

  if (payload && typeof payload === "object") {
    const record = payload as { rows?: unknown; data?: unknown };

    if (Array.isArray(record.rows)) {
      return record.rows as T[];
    }

    if (Array.isArray(record.data)) {
      return record.data as T[];
    }

    if (record.data && typeof record.data === "object") {
      const nested = record.data as { rows?: unknown };
      if (Array.isArray(nested.rows)) {
        return nested.rows as T[];
      }
    }
  }

  return [];
};

const parseOptionId = (value: unknown): string | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  return null;
};

const mapCompanyToOption = (company: ApiCompany, index: number): SelectOption | null => {
  const id = parseOptionId(company.id);
  if (!id) {
    return null;
  }

  const nameCandidate =
    typeof company.nome_empresa === "string" && company.nome_empresa.trim().length > 0
      ? company.nome_empresa.trim()
      : null;
  const emailCandidate =
    typeof company.email === "string" && company.email.trim().length > 0
      ? company.email.trim()
      : null;

  const label = nameCandidate ?? emailCandidate ?? `Empresa ${index + 1}`;

  return { id, label } satisfies SelectOption;
};

const mapRoleToOption = (role: ApiRole, index: number): SelectOption | null => {
  const id = parseOptionId(role.id);
  if (!id) {
    return null;
  }

  const labelCandidate =
    typeof role.nome === "string" && role.nome.trim().length > 0
      ? role.nome.trim()
      : typeof role.descricao === "string" && role.descricao.trim().length > 0
        ? role.descricao.trim()
        : null;

  const label = labelCandidate ?? `Função ${index + 1}`;

  return { id, label } satisfies SelectOption;
};

export default function NewUser() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    companyId: "",
    role: "",
  });
  const [companies, setCompanies] = useState<SelectOption[]>([]);
  const [roles, setRoles] = useState<SelectOption[]>([]);
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(false);
  const [isLoadingRoles, setIsLoadingRoles] = useState(false);

  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    const loadOptions = async () => {
      setIsLoadingCompanies(true);
      setIsLoadingRoles(true);

      try {
        const [companiesRes, rolesRes] = await Promise.all([
          fetch(getApiUrl("empresas"), { signal, headers: { Accept: "application/json" } }),
          fetch(getApiUrl("perfis"), { signal, headers: { Accept: "application/json" } }),
        ]);

        if (!companiesRes.ok) {
          throw new Error(`Erro ao carregar empresas (${companiesRes.status})`);
        }

        if (!rolesRes.ok) {
          throw new Error(`Erro ao carregar funções (${rolesRes.status})`);
        }

        const companiesPayload = await companiesRes.json();
        const rolesPayload = await rolesRes.json();

        if (signal.aborted) {
          return;
        }

        const companyOptions = extractCollection<ApiCompany>(companiesPayload)
          .map(mapCompanyToOption)
          .filter((option): option is SelectOption => option !== null);

        const roleOptions = extractCollection<ApiRole>(rolesPayload)
          .map(mapRoleToOption)
          .filter((option): option is SelectOption => option !== null);

        setCompanies(companyOptions);
        setRoles(roleOptions);

        setFormData((prev) => {
          let companyId = prev.companyId;
          let role = prev.role;

          if (companyId && !companyOptions.some((option) => option.id === companyId)) {
            companyId = "";
          }

          if (role && !roleOptions.some((option) => option.id === role)) {
            role = "";
          }

          if (companyId === prev.companyId && role === prev.role) {
            return prev;
          }

          return { ...prev, companyId, role };
        });
      } catch (error) {
        if (signal.aborted || (error instanceof DOMException && error.name === "AbortError")) {
          return;
        }

        console.error("Erro ao carregar dados para novo usuário:", error);
        toast({
          title: "Erro ao carregar dados",
          description: "Não foi possível carregar as empresas e funções. Tente novamente mais tarde.",
          variant: "destructive",
        });
      } finally {
        if (!signal.aborted) {
          setIsLoadingCompanies(false);
          setIsLoadingRoles(false);
        }
      }
    };

    void loadOptions();

    return () => {
      controller.abort();
    };
  }, [toast]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.companyId || !formData.role) {
      toast({
        title: "Dados incompletos",
        description: "Selecione a empresa e a função do usuário antes de continuar.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Usuário criado",
      description: "O usuário foi cadastrado com sucesso.",
    });
    navigate(routes.admin.users);
  };

  const companyPlaceholder = isLoadingCompanies
    ? "Carregando empresas..."
    : companies.length === 0
      ? "Nenhuma empresa disponível"
      : "Selecione a empresa";

  const rolePlaceholder = isLoadingRoles
    ? "Carregando funções..."
    : roles.length === 0
      ? "Nenhuma função disponível"
      : "Selecione a função";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Novo Usuário</h1>
          <p className="text-muted-foreground">Cadastre um novo usuário no sistema</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informações</CardTitle>
          <CardDescription>Insira os dados do novo usuário</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company">Empresa</Label>
              <Select
                value={formData.companyId}
                onValueChange={(value) => setFormData({ ...formData, companyId: value })}
              >
                <SelectTrigger id="company" disabled={isLoadingCompanies || companies.length === 0}>
                  <SelectValue placeholder={companyPlaceholder} />
                </SelectTrigger>
                <SelectContent>
                  {isLoadingCompanies ? (
                    <SelectItem value="__loading" disabled>
                      Carregando empresas...
                    </SelectItem>
                  ) : companies.length > 0 ? (
                    companies.map((company) => (
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
              <Label htmlFor="role">Função</Label>
              <Select
                value={formData.role}
                onValueChange={(value) => setFormData({ ...formData, role: value })}
              >
                <SelectTrigger id="role" disabled={isLoadingRoles || roles.length === 0}>
                  <SelectValue placeholder={rolePlaceholder} />
                </SelectTrigger>
                <SelectContent>
                  {isLoadingRoles ? (
                    <SelectItem value="__loading" disabled>
                      Carregando funções...
                    </SelectItem>
                  ) : roles.length > 0 ? (
                    roles.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.label}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="__empty" disabled>
                      Nenhuma função disponível
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end">
              <Button type="submit">Criar Usuário</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
