import { useMemo } from "react";
import { Calendar, FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  parseOptionalString,
  type ProcessoResponseData,
} from "@/pages/operator/utils/judit";

const ATTACHMENT_DATE_KEYS = [
  "data",
  "date",
  "timestamp",
  "created_at",
  "createdAt",
  "criado_em",
  "criadoEm",
  "recebido_em",
  "recebidoEm",
  "updated_at",
  "updatedAt",
  "atualizado_em",
  "atualizadoEm",
  "last_update",
  "lastUpdate",
];

const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const formatDateTimeToPtBR = (value: Date | null, fallback?: string | null): string => {
  if (value) {
    return dateTimeFormatter.format(value);
  }

  if (fallback) {
    return fallback;
  }

  return "Data não informada";
};

const parseDateValue = (value: string): Date | null => {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  if (/^\d{10,13}$/.test(trimmed)) {
    const numericValue = Number(trimmed);

    if (!Number.isFinite(numericValue)) {
      return null;
    }

    if (trimmed.length === 10) {
      return new Date(numericValue * 1000);
    }

    return new Date(numericValue);
  }

  const parsed = Date.parse(trimmed);

  if (Number.isNaN(parsed)) {
    return null;
  }

  return new Date(parsed);
};

const resolveAttachmentTemporalInfo = (
  attachment: Record<string, unknown>,
): { date: Date | null; raw: string | null } | null => {
  let fallbackRaw: string | null = null;

  for (const key of ATTACHMENT_DATE_KEYS) {
    const candidate = parseOptionalString(attachment[key]);

    if (!candidate) {
      continue;
    }

    if (!fallbackRaw) {
      fallbackRaw = candidate;
    }

    const parsed = parseDateValue(candidate);

    if (parsed) {
      return { date: parsed, raw: candidate };
    }
  }

  if (fallbackRaw) {
    return { date: null, raw: fallbackRaw };
  }

  return null;
};

const resolveAttachmentLink = (attachment: Record<string, unknown>): string | null => {
  return (
    parseOptionalString(attachment.url) ??
    parseOptionalString(attachment.href) ??
    parseOptionalString(attachment.link) ??
    null
  );
};

export interface AttachmentsSummaryCardProps {
  attachments: ProcessoResponseData["anexos"];
  className?: string;
  onViewAttachments?: () => void;
  viewAttachmentsLabel?: string;
  disabled?: boolean;
}

export function AttachmentsSummaryCard({
  attachments,
  className,
  onViewAttachments,
  viewAttachmentsLabel = "Ver anexos",
  disabled,
}: AttachmentsSummaryCardProps) {
  const totalAttachments = attachments.length;

  const directLinksCount = useMemo(() => {
    if (totalAttachments === 0) {
      return 0;
    }

    return attachments.reduce((count, attachment) => {
      return resolveAttachmentLink(attachment) ? count + 1 : count;
    }, 0);
  }, [attachments, totalAttachments]);

  const lastAttachmentInfo = useMemo(() => {
    if (totalAttachments === 0) {
      return null;
    }

    let latest: { date: Date | null; raw: string | null } | null = null;

    for (const attachment of attachments) {
      const info = resolveAttachmentTemporalInfo(attachment);

      if (!info) {
        continue;
      }

      if (!latest) {
        latest = info;
        continue;
      }

      if (info.date && (!latest.date || info.date > latest.date)) {
        latest = info;
        continue;
      }

      if (!latest.date && !info.date && info.raw && !latest.raw) {
        latest = info;
      }
    }

    if (latest) {
      return latest;
    }

    const fallback = attachments[attachments.length - 1];
    const fallbackInfo = resolveAttachmentTemporalInfo(fallback);

    return fallbackInfo ?? { date: null, raw: null };
  }, [attachments, totalAttachments]);

  const summaryText = useMemo(() => {
    if (totalAttachments === 0) {
      return "Nenhum anexo foi recebido nas sincronizações mais recentes.";
    }

    const suffix = totalAttachments === 1 ? "" : "s";
    const baseText = `Foram identificados ${totalAttachments} anexo${suffix} disponível${suffix}.`;

    if (directLinksCount === 0 || directLinksCount === totalAttachments) {
      return baseText;
    }

    return `${baseText} ${directLinksCount} dele${directLinksCount === 1 ? "" : "s"} com acesso direto.`;
  }, [directLinksCount, totalAttachments]);

  const isViewDisabled = disabled || totalAttachments === 0;

  return (
    <div
      className={cn(
        "rounded-lg border border-dashed border-border/60 bg-muted/40 p-4",
        className,
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <FileText className="h-3.5 w-3.5" />
            <span>Anexos recebidos</span>
          </div>
          <p className="text-sm text-foreground">{summaryText}</p>
          {totalAttachments > 0 ? (
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              <span>
                Último recebido em {formatDateTimeToPtBR(lastAttachmentInfo?.date ?? null, lastAttachmentInfo?.raw ?? null)}
              </span>
            </p>
          ) : null}
        </div>
        {onViewAttachments ? (
          <Button
            variant="outline"
            size="sm"
            className="w-full sm:w-auto"
            onClick={onViewAttachments}
            disabled={isViewDisabled}
          >
            {viewAttachmentsLabel}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export default AttachmentsSummaryCard;
