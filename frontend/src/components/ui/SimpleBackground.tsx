import { memo } from "react";

import { cn } from "@/lib/utils";

interface SimpleBackgroundProps {
  className?: string;
}

const SimpleBackground = memo(({ className }: SimpleBackgroundProps) => {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden",
        className,
      )}
    >
      <div className="absolute -top-24 -left-20 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute -bottom-24 -right-16 h-72 w-72 rounded-full bg-primary/15 blur-3xl" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.08),_transparent_65%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(120deg,_rgba(14,116,144,0.1),_transparent_60%)]" />
    </div>
  );
});

SimpleBackground.displayName = "SimpleBackground";

export default SimpleBackground;
