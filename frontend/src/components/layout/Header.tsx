import { useEffect, useMemo, useState } from "react";

import { HeaderActions } from "@/components/layout/HeaderActions";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { usePlan } from "@/features/plans/PlanProvider";

const getPlanDisplayName = (name: string | null | undefined, id: number | null | undefined) => {
  const normalizedName = typeof name === "string" ? name.trim() : "";
  if (normalizedName.length > 0) {
    return normalizedName;
  }

  if (typeof id === "number" && Number.isFinite(id)) {
    return `Plano ${id}`;
  }

  return "Plano não definido";
};

export function Header() {
  const { plan, isLoading, error } = usePlan();
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const scrollContainer = document.querySelector<HTMLElement>("[data-crm-scroll-container]");

    const updateScrollState = () => {
      const scrollTop = scrollContainer?.scrollTop ?? window.scrollY ?? 0;
      setIsScrolled(scrollTop > 0);
    };

    updateScrollState();

    const options: AddEventListenerOptions = { passive: true };
    if (scrollContainer) {
      scrollContainer.addEventListener("scroll", updateScrollState, options);
    } else {
      window.addEventListener("scroll", updateScrollState, options);
    }

    return () => {
      scrollContainer?.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("scroll", updateScrollState);
    };
  }, []);

  const planName = useMemo(
    () => getPlanDisplayName(plan?.nome, plan?.id),
    [plan?.id, plan?.nome],
  );

  const planStatusLabel = useMemo(() => {
    if (isLoading) {
      return "Carregando plano...";
    }

    if (error) {
      return "Não foi possível carregar o plano";
    }

    return planName;
  }, [error, isLoading, planName]);

  const planStatusTone = error
    ? "text-destructive border-destructive/40 bg-destructive/10"
    : "text-primary border-primary/30 bg-primary/10";

  return (
    <header
      className={cn(
        "sticky top-0 z-50 border-b border-border/60 transition-colors",
        isScrolled
          ? "bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60"
          : "bg-background",
      )}
    >
      <div className="flex h-16 flex-wrap items-center gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <SidebarTrigger className="text-muted-foreground" />

          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Plano atual</p>
            <span
              className={cn(
                "mt-1 inline-flex max-w-full items-center gap-2 truncate rounded-full border px-3 py-1 text-sm font-semibold",
                planStatusTone,
              )}
              title={planStatusLabel}
            >
              {planStatusLabel}
            </span>
          </div>
        </div>

        {/* Actions */}
        <HeaderActions />
      </div>
    </header>
  );
}
