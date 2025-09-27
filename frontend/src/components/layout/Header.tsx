import { useEffect, useState } from "react";

import { HeaderActions } from "@/components/layout/HeaderActions";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

export function Header() {
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

  return (
    <header
      className={cn(
        "sticky top-0 z-50 border-b border-border/60 transition-colors",
        isScrolled
          ? "bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60"
          : "bg-background",
      )}
    >
      <div className="flex h-16 flex-wrap items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <SidebarTrigger className="text-muted-foreground" />
        </div>

        <HeaderActions />
      </div>
    </header>
  );
}
