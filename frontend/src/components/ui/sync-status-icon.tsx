import { Wifi } from "lucide-react";
import { cn } from "@/lib/utils";

interface SyncStatusIconProps {
  isSyncing?: boolean;
  className?: string;
}

export function SyncStatusIcon({ isSyncing = false, className }: SyncStatusIconProps) {
  return (
    <div className="relative inline-flex items-center justify-center">
      <Wifi
        className={cn(
          "h-4 w-4",
          isSyncing && "animate-pulse text-primary",
          !isSyncing && "text-muted-foreground",
          className
        )}
      />
      {isSyncing && (
        <>
          <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-20 animate-ping" />
          <span className="absolute inline-flex h-3/4 w-3/4 rounded-full bg-primary opacity-30 animate-pulse" />
        </>
      )}
    </div>
  );
}
