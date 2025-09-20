import { parseDataArray as parseCompaniesDataArray } from "./companies-data";

export type CompanyFormData = {
  name: string;
  email: string;
  cnpj: string;
  phone: string;
  planId: string;
  managerId: string;
  isActive: boolean;
};

export interface CompanyFormApiPlan {
  id?: number | string | null;
  nome?: string | null;
  ativo?: boolean | number | string | null;
}

export interface CompanyFormApiUser {
  id?: number | string | null;
  nome_completo?: string | null;
  email?: string | null;
}

export type PlanOption = {
  id: string;
  label: string;
  isActive: boolean;
};

export type UserOption = {
  id: string;
  label: string;
};

export const initialCompanyFormData: CompanyFormData = {
  name: "",
  email: "",
  cnpj: "",
  phone: "",
  planId: "",
  managerId: "",
  isActive: true,
};

export const NO_PLAN_SELECTED_VALUE = "__no_plan_selected__";
export const NO_MANAGER_SELECTED_VALUE = "__no_manager_selected__";

export const parseDataArray = <T,>(payload: unknown): T[] => parseCompaniesDataArray<T>(payload);

export const resolveBooleanFlag = (value: unknown): boolean | null => {
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

export const mapPlanToOption = (plan: CompanyFormApiPlan, index: number): PlanOption | null => {
  const id = resolveNumericId(plan.id);
  if (!id) {
    return null;
  }

  const name =
    typeof plan.nome === "string" && plan.nome.trim().length > 0 ? plan.nome.trim() : `Plano ${index + 1}`;

  return {
    id,
    label: name,
    isActive: resolveBooleanFlag(plan.ativo) ?? true,
  } satisfies PlanOption;
};

export const mapUserToOption = (user: CompanyFormApiUser, index: number): UserOption | null => {
  const id = resolveNumericId(user.id);
  if (!id) {
    return null;
  }

  const name =
    typeof user.nome_completo === "string" && user.nome_completo.trim().length > 0
      ? user.nome_completo.trim()
      : null;
  const email = typeof user.email === "string" && user.email.trim().length > 0 ? user.email.trim() : null;

  const label = name && email ? `${name} — ${email}` : name ?? email ?? `Usuário ${index + 1}`;

  return {
    id,
    label,
  } satisfies UserOption;
};

export const sanitizeDigits = (value: string): string => value.replace(/[^0-9]/g, "");

export const parseOptionalNumber = (value: string): number | null => {
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

export const createPlansIndex = (plans: CompanyFormApiPlan[]): Map<string, CompanyFormApiPlan> => {
  const index = new Map<string, CompanyFormApiPlan>();

  plans.forEach((plan) => {
    if (plan?.id == null) {
      return;
    }

    const id = resolveNumericId(plan.id);
    if (!id) {
      return;
    }

    index.set(id, plan);
  });

  return index;
};

export const createUsersIndex = (users: CompanyFormApiUser[]): Map<string, CompanyFormApiUser> => {
  const index = new Map<string, CompanyFormApiUser>();

  users.forEach((user) => {
    if (user?.id == null) {
      return;
    }

    const id = resolveNumericId(user.id);
    if (!id) {
      return;
    }

    index.set(id, user);
  });

  return index;
};

export const getUserLabelFromIndex = (
  usersIndex: Map<string, CompanyFormApiUser> | undefined,
  userId: string | null,
): string | null => {
  if (!userId) {
    return null;
  }

  const user = usersIndex?.get(userId);
  if (!user) {
    return null;
  }

  const name = typeof user.nome_completo === "string" ? user.nome_completo.trim() : "";
  if (name) {
    return name;
  }

  const email = typeof user.email === "string" ? user.email.trim() : "";
  if (email) {
    return email;
  }

  return null;
};
