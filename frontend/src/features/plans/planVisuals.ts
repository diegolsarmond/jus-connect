import type { PlanInfo } from "@/features/plans/PlanProvider";

export interface PlanVisualMeta {
  tier: string;
  crowns: number;
  canUpgrade: boolean;
}

const FALLBACK_PLAN_META: PlanVisualMeta = {
  tier: "Plano",
  crowns: 0,
  canUpgrade: true,
};

const PLAN_META_MAP: Record<string, PlanVisualMeta> = (() => {
  const entries: Array<{ keys: string[]; meta: PlanVisualMeta }> = [
    {
      keys: ["basico", "básico", "starter", "inicial"],
      meta: { tier: "Essencial", crowns: 1, canUpgrade: true },
    },
    {
      keys: ["essencial", "standard", "padrao", "padrão"],
      meta: { tier: "Essencial", crowns: 1, canUpgrade: true },
    },
    {
      keys: ["intermediario", "intermediário", "pro", "profissional"],
      meta: { tier: "Profissional", crowns: 2, canUpgrade: true },
    },
    {
      keys: ["avancado", "avançado", "premium", "completo"],
      meta: { tier: "Premium", crowns: 3, canUpgrade: false },
    },
    {
      keys: ["enterprise", "corporativo", "ilimitado"],
      meta: { tier: "Enterprise", crowns: 3, canUpgrade: false },
    },
  ];

  const map: Record<string, PlanVisualMeta> = {};

  for (const { keys, meta } of entries) {
    for (const key of keys) {
      const normalized = normalizePlanName(key);
      if (normalized) {
        map[normalized] = meta;
      }
    }
  }

  return map;
})();

function normalizePlanName(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const withoutPrefix = trimmed.replace(/^plano\s+/iu, "");
  return withoutPrefix
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function getPlanVisualMeta(plan: Pick<PlanInfo, "nome"> | null): PlanVisualMeta {
  const normalizedName = normalizePlanName(plan?.nome ?? null);
  if (!normalizedName) {
    return FALLBACK_PLAN_META;
  }

  return PLAN_META_MAP[normalizedName] ?? FALLBACK_PLAN_META;
}

export function getPlanDisplayName(plan: Pick<PlanInfo, "id" | "nome"> | null): string {
  const normalizedName = typeof plan?.nome === "string" ? plan.nome.trim() : "";
  if (normalizedName.length > 0) {
    return normalizedName;
  }

  if (typeof plan?.id === "number" && Number.isFinite(plan.id)) {
    return `Plano ${plan.id}`;
  }

  return "Plano não definido";
}
