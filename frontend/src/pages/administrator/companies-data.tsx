import { Badge } from "@/components/ui/badge";

export type CompanyStatus = "active" | "inactive" | "trial";

export interface ApiCompany {
  id: number;
  nome_empresa?: string | null;
  cnpj?: string | null;
  telefone?: string | null;
  email?: string | null;
  plano?: number | string | null;
  responsavel?: number | string | null;
  ativo?: boolean | null;
  datacadastro?: string | Date | null;
  atualizacao?: string | Date | null;
}

export interface ApiPlan {
  id?: number;
  nome?: string | null;
  valor?: number | null;
}

export interface ApiUser {
  id?: number | string | null;
  nome_completo?: string | null;
  email?: string | null;
}

export interface Company {
  id: number;
  name: string;
  email: string;
  cnpj: string;
  phone: string;
  planId: string | null;
  planName: string;
  planValue?: number | null;
  status: CompanyStatus;
  managerId: string | null;
  managerName: string;
  isActive: boolean;
  createdAt: string | null;
  lastActivity: string | null;
}

export const parseDataArray = <T,>(payload: unknown): T[] => {
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

export const parseDataItem = <T,>(payload: unknown): T | null => {
  if (payload == null) {
    return null;
  }

  if (Array.isArray(payload)) {
    return (payload[0] ?? null) as T | null;
  }

  if (typeof payload === "object") {
    const rows = (payload as { rows?: unknown }).rows;
    if (Array.isArray(rows) && rows.length > 0) {
      return rows[0] as T;
    }

    const data = (payload as { data?: unknown }).data;
    if (Array.isArray(data) && data.length > 0) {
      return data[0] as T;
    }

    if (data && typeof data === "object") {
      const nestedRows = (data as { rows?: unknown }).rows;
      if (Array.isArray(nestedRows) && nestedRows.length > 0) {
        return nestedRows[0] as T;
      }
    }

    return payload as T;
  }

  return null;
};

const toIsoString = (value: unknown): string | null => {
  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return null;
};

const normalizeBoolean = (value: unknown): boolean | null => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (!normalized) {
      return null;
    }

    if (["false", "0", "inativo", "inactive", "nao", "não", "no", "n"].includes(normalized)) {
      return false;
    }

    if (["true", "1", "ativo", "active", "sim", "yes", "y", "s"].includes(normalized)) {
      return true;
    }
  }

  return null;
};

export const resolveCompanyStatus = (
  status: boolean | null | undefined,
  planId: string | null,
): CompanyStatus => {
  if (status === false) {
    return "inactive";
  }

  if (planId) {
    return "active";
  }

  return "trial";
};

const buildPlansIndex = (plans: ApiPlan[]): Map<string, ApiPlan> => {
  const index = new Map<string, ApiPlan>();

  plans.forEach((plan) => {
    if (plan?.id != null) {
      index.set(String(plan.id), plan);
    }
  });

  return index;
};

export const buildUsersIndex = (users: ApiUser[]): Map<string, ApiUser> => {
  const index = new Map<string, ApiUser>();

  users.forEach((user) => {
    if (user?.id == null) {
      return;
    }

    const id = String(user.id);
    if (!id) {
      return;
    }

    index.set(id, user);
  });

  return index;
};

export const getPlanIndex = (plans: ApiPlan[]): Map<string, ApiPlan> => buildPlansIndex(plans);

const getUserDisplayName = (user: ApiUser | undefined, fallbackId: string | null): string => {
  const fallbackLabel = fallbackId ? `Usuário ${fallbackId}` : "";

  if (!user) {
    return fallbackLabel;
  }

  const name = typeof user.nome_completo === "string" ? user.nome_completo.trim() : "";
  if (name) {
    return name;
  }

  const email = typeof user.email === "string" ? user.email.trim() : "";
  if (email) {
    return email;
  }

  return fallbackLabel;
};

export const mapApiCompanyToCompany = (
  company: ApiCompany,
  plansIndex: Map<string, ApiPlan>,
  usersIndex?: Map<string, ApiUser>,
): Company => {
  const planId = company.plano != null ? String(company.plano) : null;
  const plan = planId ? plansIndex.get(planId) : undefined;
  const managerId = company.responsavel != null ? String(company.responsavel) : null;
  const normalizedActive = normalizeBoolean(company.ativo);
  const status = resolveCompanyStatus(normalizedActive, planId);

  const managerNameFromApi =
    typeof company.responsavel === "string" && company.responsavel.trim().length > 0
      ? company.responsavel.trim()
      : "";
  const managerName =
    managerId && usersIndex
      ? getUserDisplayName(usersIndex.get(managerId), managerId)
      : managerNameFromApi || (managerId ? `Usuário ${managerId}` : "");

  return {
    id: company.id,
    name: company.nome_empresa?.trim() || `Empresa #${company.id}`,
    email: company.email?.trim() || "",
    cnpj: company.cnpj?.trim() || "",
    phone: company.telefone?.trim() || "",
    planId,
    planName: plan?.nome?.trim() || (planId ? `Plano ${planId}` : "Sem plano"),
    planValue: typeof plan?.valor === "number" ? plan.valor : null,
    status,
    managerId,
    managerName,
    isActive: normalizedActive ?? status !== "inactive",
    createdAt: toIsoString(company.datacadastro),
    lastActivity: toIsoString(company.atualizacao) ?? toIsoString(company.datacadastro),
  };
};

export const formatDate = (value: string | null) => {
  if (!value) {
    return "--";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "--";
  }

  return date.toLocaleDateString("pt-BR");
};

export const formatCurrency = (value?: number | null) => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "0";
  }

  return value.toLocaleString("pt-BR");
};

const statusBadgeVariants: Record<CompanyStatus, "default" | "secondary" | "destructive"> = {
  active: "default",
  trial: "secondary",
  inactive: "destructive",
};

const statusBadgeLabels: Record<CompanyStatus, string> = {
  active: "Ativo",
  trial: "Trial",
  inactive: "Inativo",
};

interface CompanyStatusBadgeProps {
  status: CompanyStatus;
}

export const CompanyStatusBadge = ({ status }: CompanyStatusBadgeProps) => (
  <Badge variant={statusBadgeVariants[status]}>
    {statusBadgeLabels[status]}
  </Badge>
);

