import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/features/auth/AuthProvider";
import { sanitizeModuleList } from "@/features/auth/moduleUtils";
import { getApiUrl } from "@/lib/api";

export interface PlanInfo {
  id: number | null;
  nome: string | null;
  sincronizacaoProcessosHabilitada: boolean;
  sincronizacaoProcessosLimite: number | null;
  modules: string[];
}

interface PlanContextValue {
  plan: PlanInfo | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<PlanInfo | null>;
}

const PlanContext = createContext<PlanContextValue | undefined>(undefined);

type ApiRecord = Record<string, unknown>;

const extractRows = (input: unknown): ApiRecord[] => {
  if (Array.isArray(input)) {
    return input.filter((item): item is ApiRecord =>
      item !== null && typeof item === "object",
    );
  }

  if (input && typeof input === "object") {
    const data = (input as { data?: unknown }).data;
    if (Array.isArray(data)) {
      return data.filter((item): item is ApiRecord =>
        item !== null && typeof item === "object",
      );
    }

    const rows = (input as { rows?: unknown }).rows;
    if (Array.isArray(rows)) {
      return rows.filter((item): item is ApiRecord =>
        item !== null && typeof item === "object",
      );
    }
  }

  return [];
};

const extractRecord = (input: unknown): ApiRecord | null => {
  if (!input || typeof input !== "object") {
    return null;
  }

  if (Array.isArray(input)) {
    return input.find((item): item is ApiRecord => item !== null && typeof item === "object") ?? null;
  }

  const rows = (input as { rows?: unknown }).rows;
  if (Array.isArray(rows)) {
    return rows.find((item): item is ApiRecord => item !== null && typeof item === "object") ?? null;
  }

  return input as ApiRecord;
};

const toInteger = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    const normalized = Math.trunc(value);
    return Number.isNaN(normalized) ? null : normalized;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const parsed = Number.parseInt(trimmed, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
};

const toNonNegativeInteger = (value: unknown): number | null => {
  const parsed = toInteger(value);
  if (parsed === null || parsed < 0) {
    return null;
  }
  return parsed;
};

const parseBooleanFlag = (value: unknown): boolean | null => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return null;
    }

    return value !== 0;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      return null;
    }

    if (
      [
        "1",
        "true",
        "t",
        "yes",
        "y",
        "sim",
        "on",
        "habilitado",
        "habilitada",
        "ativo",
        "ativa",
      ].includes(normalized)
    ) {
      return true;
    }

    if (
      [
        "0",
        "false",
        "f",
        "no",
        "n",
        "nao",
        "não",
        "off",
        "desabilitado",
        "desabilitada",
        "inativo",
        "inativa",
      ].includes(normalized)
    ) {
      return false;
    }
  }

  return null;
};

const normalizeText = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export function PlanProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [plan, setPlan] = useState<PlanInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPlan = useCallback(
    async (signal?: AbortSignal): Promise<PlanInfo | null> => {
      if (!isAuthenticated || user?.empresa_id == null) {
        setPlan(null);
        setError(null);
        setIsLoading(false);
        return null;
      }

      setIsLoading(true);
      setError(null);

      try {
        const [planosRes, empresaRes] = await Promise.all([
          fetch(getApiUrl("planos"), {
            headers: { Accept: "application/json" },
            signal,
          }),
          fetch(getApiUrl(`empresas/${user.empresa_id}`), {
            headers: { Accept: "application/json" },
            signal,
          }),
        ]);

        if (!planosRes.ok) {
          throw new Error(`Falha ao carregar planos (HTTP ${planosRes.status})`);
        }

        if (!empresaRes.ok) {
          throw new Error(
            `Falha ao carregar empresa atual (HTTP ${empresaRes.status})`,
          );
        }

        const [planosJson, empresaJson] = await Promise.all([
          planosRes.json(),
          empresaRes.json(),
        ]);

        if (signal?.aborted) {
          return null;
        }

        const planos = extractRows(planosJson).map((row) => {
          const id = toInteger(row.id);
          const nome = normalizeText(row.nome);
          const syncEnabled = parseBooleanFlag(
            row.sincronizacao_processos_habilitada ??
              row.sincronizacaoProcessosHabilitada,
          );
          const syncLimit = toNonNegativeInteger(
            row.sincronizacao_processos_limite ??
              row.sincronizacaoProcessosLimite,
          );
          const rawModules = Array.isArray(row.modulos)
            ? row.modulos
            : Array.isArray(row.modules)
              ? row.modules
              : [];
          const modules = sanitizeModuleList(rawModules);

          return {
            id,
            nome,
            sincronizacaoProcessosHabilitada: syncEnabled ?? true,
            sincronizacaoProcessosLimite: syncLimit,
            modules,
          } satisfies PlanInfo;
        });

        const empresaRecord = extractRecord(empresaJson);
        const planIdCandidates: number[] = [];
        const rawPlanId = empresaRecord?.plano_id ?? empresaRecord?.plano;
        const parsedPlanId = toInteger(rawPlanId);
        if (parsedPlanId !== null) {
          planIdCandidates.push(parsedPlanId);
        }

        const planNameCandidate = normalizeText(empresaRecord?.plano);

        let selectedPlan: PlanInfo | null = null;

        for (const candidateId of planIdCandidates) {
          const found = planos.find((item) => item.id === candidateId);
          if (found) {
            selectedPlan = found;
            break;
          }
        }

        if (!selectedPlan && planNameCandidate) {
          const normalizedName = planNameCandidate.toLowerCase();
          selectedPlan =
            planos.find(
              (item) => (item.nome ?? "").toLowerCase() === normalizedName,
            ) ?? null;
        }

        if (!selectedPlan) {
          selectedPlan = {
            id: parsedPlanId,
            nome: planNameCandidate,
            sincronizacaoProcessosHabilitada: true,
            sincronizacaoProcessosLimite: null,
            modules: [],
          };
        }

        setPlan(selectedPlan);
        setIsLoading(false);
        setError(null);
        return selectedPlan;
      } catch (loadError) {
        if (signal?.aborted) {
          return null;
        }

        console.error("Erro ao carregar plano atual", loadError);
        const message =
          loadError instanceof Error
            ? loadError.message
            : "Não foi possível carregar o plano atual.";
        setError(message);
        setPlan(null);
        setIsLoading(false);
        return null;
      }
    },
    [isAuthenticated, user?.empresa_id],
  );

  useEffect(() => {
    const controller = new AbortController();
    loadPlan(controller.signal).catch((error) => {
      if (error && (error as { name?: string }).name !== "AbortError") {
        console.warn("Falha ao carregar plano", error);
      }
    });

    return () => {
      controller.abort();
    };
  }, [loadPlan]);

  const refetch = useCallback(() => loadPlan(), [loadPlan]);

  const value = useMemo<PlanContextValue>(
    () => ({ plan, isLoading, error, refetch }),
    [plan, isLoading, error, refetch],
  );

  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
}

export const usePlan = () => {
  const context = useContext(PlanContext);
  if (!context) {
    throw new Error("usePlan deve ser utilizado dentro de um PlanProvider");
  }
  return context;
};
