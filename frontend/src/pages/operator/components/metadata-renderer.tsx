import { type ReactNode } from "react";

import { cn } from "@/lib/utils";

import type { MetadataEntry } from "../utils/judit";

export interface RenderMetadataEntriesOptions {
  level?: number;
  keyPrefix?: string;
  containerClassName?: string;
  nestedContainerClassName?: string;
  termClassName?: string;
  nestedTermClassName?: string;
  valueClassName?: string;
  nestedValueClassName?: string;
  nestedCardClassName?: string;
}

export const renderMetadataEntries = (
  entries: MetadataEntry[],
  {
    level = 0,
    keyPrefix = "metadata",
    containerClassName = "grid gap-2 sm:grid-cols-2",
    nestedContainerClassName = "space-y-2",
    termClassName =
      "text-[11px] font-semibold uppercase tracking-wide text-muted-foreground",
    nestedTermClassName =
      "text-[10px] font-semibold uppercase tracking-wide text-muted-foreground",
    valueClassName = "text-sm text-foreground break-words",
    nestedValueClassName = "text-xs text-foreground break-words",
    nestedCardClassName = "rounded-md border border-border/40 bg-background/60 p-3",
  }: RenderMetadataEntriesOptions = {},
): ReactNode => {
  if (!entries || entries.length === 0) {
    return null;
  }

  const currentContainerClass =
    level === 0 ? containerClassName : nestedContainerClassName;
  const currentTermClass = level === 0 ? termClassName : nestedTermClassName;
  const currentValueClass = level === 0 ? valueClassName : nestedValueClassName;

  return (
    <dl className={currentContainerClass}>
      {entries.map((entry, index) => {
        const entryKey = `${keyPrefix}-${level}-${entry.key ?? index}`;
        const isNested = Array.isArray(entry.value);

        if (!isNested) {
          return (
            <div key={entryKey} className="space-y-1">
              <dt className={currentTermClass}>{entry.label}</dt>
              <dd className={currentValueClass}>{entry.value}</dd>
            </div>
          );
        }

        return (
          <div key={entryKey} className="space-y-2">
            <dt className={currentTermClass}>{entry.label}</dt>
            <dd className="space-y-2">
              <div className={cn(nestedCardClassName, "space-y-2")}>
                {renderMetadataEntries(entry.value, {
                  level: level + 1,
                  keyPrefix: entryKey,
                  containerClassName,
                  nestedContainerClassName,
                  termClassName,
                  nestedTermClassName,
                  valueClassName,
                  nestedValueClassName,
                  nestedCardClassName,
                })}
              </div>
            </dd>
          </div>
        );
      })}
    </dl>
  );
};
