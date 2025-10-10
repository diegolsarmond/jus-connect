import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  BadgeCheck,
  Bell,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  Gavel,
  Loader2,
  Mail,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import type { Notification } from "@/services/notifications";
import { fetchIntimacoes, markIntimacaoAsRead, type Intimacao } from "@/services/intimacoes";

const notificationsQueryKey = ["notifications", "projudi", "list"] as const;

type NotificationKind = "deadline" | "document" | "task" | "hearing" | "movement" | "general";
type NotificationStatus = "completed" | "in_progress" | "pending";

const TYPE_CONFIG: Record<NotificationKind, { icon: LucideIcon; className: string; label: string }> = {
  deadline: {
    icon: Calendar,
    className: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200",
    label: "Prazos",
  },
  document: {
    icon: FileText,
    className: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200",
    label: "Documentos",
  },
  task: {
    icon: BadgeCheck,
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200",
    label: "Tarefas",
  },
  hearing: {
    icon: Gavel,
    className: "bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-200",
    label: "Audiências",
  },
  movement: {
    icon: Mail,
    className: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200",
    label: "Movimentações",
  },
  general: {
    icon: Bell,
    className: "bg-muted text-foreground dark:bg-muted/40",
    label: "Atualizações",
  },
};

const STATUS_CONFIG: Record<NotificationStatus, { label: string; icon: LucideIcon; className: string }> = {
  completed: {
    label: "Cumprida",
    icon: CheckCircle2,
    className:
      "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-200",
  },
  in_progress: {
    label: "Em andamento",
    icon: Clock,
    className: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-500/20 dark:text-amber-200",
  },
  pending: {
    label: "Pendente",
    icon: AlertTriangle,
    className:
      "bg-destructive/10 text-destructive border-destructive/20 dark:bg-destructive/20 dark:text-destructive",
  },
};

const COMPLETED_KEYWORDS = ["cumprid", "conclu", "finaliz", "resolvid"];
const IN_PROGRESS_KEYWORDS = ["andament", "analise", "aguard", "process"];

interface ToggleNotificationVariables {
  id: string;
}

function pickFirstNonEmpty(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }
  }
  return null;
}

function buildNotificationFromIntimacao(intimacao: Intimacao): Notification {
  const processNumber =
    pickFirstNonEmpty(intimacao.numero_processo, intimacao.numerocomunicacao) ?? null;
  const tipo = pickFirstNonEmpty(intimacao.tipoComunicacao, intimacao.tipodocumento);
  const status = pickFirstNonEmpty(intimacao.status);
  const prazo = pickFirstNonEmpty(intimacao.prazo);
  const createdAt =
    pickFirstNonEmpty(intimacao.data_disponibilizacao, intimacao.created_at, intimacao.updated_at)
      ?? new Date().toISOString();

  const metadata: Record<string, unknown> = {};

  if (tipo) {
    metadata.alertType = tipo;
  }

  if (processNumber) {
    metadata.processNumber = processNumber;
  }

  if (prazo) {
    metadata.dueDate = prazo;
  }

  if (status) {
    metadata.status = status;
    metadata.state = status;
  }

  if (intimacao.nomeclasse) {
    metadata.categoryName = intimacao.nomeclasse;
  }

  if (intimacao.nomeOrgao) {
    metadata.origin = intimacao.nomeOrgao;
  }

  return {
    id: String(intimacao.id),
    title:
      processNumber && tipo
        ? `${tipo} — Processo ${processNumber}`
        : tipo ?? processNumber ?? "Intimação",
    message: pickFirstNonEmpty(intimacao.texto) ?? "",
    category: "projudi",
    type: prazo ? "warning" : "info",
    read: intimacao.nao_lida === true ? false : true,
    createdAt,
    readAt: intimacao.nao_lida === true ? null : pickFirstNonEmpty(intimacao.updated_at),
    actionUrl: pickFirstNonEmpty(intimacao.link),
    metadata,
  };
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDueDate(value: string | null | undefined): string | null {
  const date = parseDate(value);
  if (!date) {
    return null;
  }
  try {
    return format(date, "dd/MM/yyyy", { locale: ptBR });
  } catch (error) {
    console.warn("Falha ao formatar data de prazo", error);
    return null;
  }
}

function capitalize(value: string): string {
  if (!value) {
    return value;
  }
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatRelativeTime(value: string | null | undefined): string | null {
  const date = parseDate(value);
  if (!date) {
    return null;
  }

  try {
    const distance = formatDistanceToNow(date, { addSuffix: true, locale: ptBR });
    return capitalize(distance);
  } catch (error) {
    console.warn("Falha ao calcular tempo relativo da notificação", error);
    return null;
  }
}

function readMetadataString(notification: Notification, keys: string[]): string | undefined {
  const metadata = notification.metadata;
  if (!metadata) {
    return undefined;
  }

  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    } else if (typeof value === "number" && Number.isFinite(value)) {
      return value.toString();
    }
  }

  return undefined;
}

function normalizeText(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function resolveNotificationKind(notification: Notification): NotificationKind {
  const alertType = readMetadataString(notification, ["alertType", "tipo", "type", "kind"]);
  if (alertType) {
    const normalized = normalizeText(alertType);

    if (normalized.includes("prazo") || normalized.includes("deadline")) {
      return "deadline";
    }

    if (normalized.includes("doc")) {
      return "document";
    }

    if (normalized.includes("tarefa") || normalized.includes("task")) {
      return "task";
    }

    if (normalized.includes("audien") || normalized.includes("hearing")) {
      return "hearing";
    }

    if (normalized.includes("moviment") || normalized.includes("movement")) {
      return "movement";
    }
  }

  if (notification.category === "projudi") {
    return "movement";
  }

  return "general";
}

function inferStatus(notification: Notification): NotificationStatus {
  if (notification.read) {
    return "completed";
  }

  const statusText = readMetadataString(notification, [
    "status",
    "situacao",
    "situacaoAtual",
    "state",
    "progress",
  ]);

  if (statusText) {
    const normalized = normalizeText(statusText);

    if (COMPLETED_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
      return "completed";
    }

    if (IN_PROGRESS_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
      return "in_progress";
    }
  }

  if (notification.type === "success") {
    return "completed";
  }

  if (notification.type === "warning") {
    return "in_progress";
  }

  return "pending";
}

function buildCategorySummary(notifications: Notification[]) {
  const counts = new Map<NotificationKind, number>();
  notifications.forEach((notification) => {
    const kind = resolveNotificationKind(notification);
    counts.set(kind, (counts.get(kind) ?? 0) + 1);
  });

  return Array.from(counts.entries())
    .map(([kind, count]) => ({ kind, count }))
    .sort((a, b) => b.count - a.count);
}

export function IntimacaoMenu() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [activeNotificationId, setActiveNotificationId] = useState<string | null>(null);

  const notificationsQuery = useQuery({
    queryKey: notificationsQueryKey,
    queryFn: async ({ signal }) => {
      const intimacoes = await fetchIntimacoes(signal);
      return intimacoes
        .filter((item) => item.arquivada !== true)
        .slice(0, 10)
        .map((intimacao) => buildNotificationFromIntimacao(intimacao));
    },
    staleTime: 30_000,
  });

  const notifications = notificationsQuery.data ?? [];

  const unreadCount = useMemo(
    () => notifications.reduce((total, notification) => total + (notification.read ? 0 : 1), 0),
    [notifications],
  );

  const categorySummaries = useMemo(() => buildCategorySummary(notifications), [notifications]);

  const toggleNotificationMutation = useMutation({
    mutationFn: async ({ id }: ToggleNotificationVariables) => {
      const result = await markIntimacaoAsRead(id);
      return { id: String(result.id) };
    },
    onMutate: ({ id }) => {
      setActiveNotificationId(id);
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error ? error.message : "Não foi possível atualizar a intimação. Tente novamente.";
      toast({
        title: "Erro ao atualizar intimação",
        description: message,
        variant: "destructive",
      });
    },
    onSuccess: ({ id }) => {
      queryClient.setQueryData<Notification[] | undefined>(notificationsQueryKey, (previous) => {
        if (!previous) {
          return previous;
        }
        return previous.map((item) => (item.id === id ? { ...item, read: true, readAt: new Date().toISOString() } : item));
      });
    },
    onSettled: () => {
      setActiveNotificationId(null);
    },
  });

  const markAllMutation = useMutation({
    mutationFn: async () => {
      const current = queryClient.getQueryData<Notification[] | undefined>(notificationsQueryKey) ?? [];
      const unread = current.filter((notification) => !notification.read);
      await Promise.all(unread.map((notification) => markIntimacaoAsRead(notification.id)));
      return unread.map((notification) => notification.id);
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error ? error.message : "Não foi possível marcar as intimações como lidas.";
      toast({
        title: "Erro ao atualizar intimações",
        description: message,
        variant: "destructive",
      });
    },
    onSuccess: (updatedIds) => {
      queryClient.setQueryData<Notification[] | undefined>(notificationsQueryKey, (previous) => {
        if (!previous) {
          return previous;
        }
        const timestamp = new Date().toISOString();
        return previous.map((item) =>
          updatedIds.includes(item.id) ? { ...item, read: true, readAt: timestamp } : item,
        );
      });
      toast({
        title: "Intimações atualizadas",
        description:
          updatedIds.length > 0
            ? `${updatedIds.length} ${updatedIds.length > 1 ? "intimações" : "intimação"} marcada${
                updatedIds.length > 1 ? "s" : ""
              } como lida${updatedIds.length > 1 ? "s" : ""}.`
            : "Nenhuma intimação pendente.",
      });
    },
  });

  const isLoading = notificationsQuery.isLoading && notifications.length === 0;
  const isError = notificationsQuery.isError && notifications.length === 0;
  const errorMessage =
    notificationsQuery.error instanceof Error
      ? notificationsQuery.error.message
      : "Não foi possível carregar as intimações.";

  const hasNotifications = notifications.length > 0;
  const disableMarkAll = unreadCount === 0 || markAllMutation.isPending;

  const handleToggleNotification = (notification: Notification) => {
    if (notification.read || toggleNotificationMutation.isPending || markAllMutation.isPending) {
      return;
    }

    toggleNotificationMutation.mutate({ id: notification.id });
  };

  const handleMarkAll = () => {
    if (disableMarkAll) {
      return;
    }
    markAllMutation.mutate();
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Abrir notificações de intimações">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 ? (
            <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground shadow-sm">
              {unreadCount}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[420px] p-0" align="end">
        <div className="border-b border-border px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-sm font-semibold">Intimações</p>
              <p className="text-xs text-muted-foreground">Acompanhe publicações, prazos e movimentações recentes.</p>
              {categorySummaries.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {categorySummaries.map(({ kind, count }) => {
                    const config = TYPE_CONFIG[kind];
                    const TypeIcon = config.icon;
                    return (
                      <Badge
                        key={kind}
                        variant="outline"
                        className="flex items-center gap-1 rounded-full border-transparent bg-muted/60 px-2 text-[11px] font-medium text-muted-foreground"
                      >
                        <TypeIcon className="h-3.5 w-3.5" />
                        {config.label} {count}
                      </Badge>
                    );
                  })}
                </div>
              ) : null}
            </div>
            <Badge variant="outline" className="rounded-full px-2 text-xs font-medium">
              {unreadCount} pendente{unreadCount === 1 ? "" : "s"}
            </Badge>
          </div>
        </div>
        <ScrollArea className="max-h-80">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center gap-3 px-4 py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Carregando intimações...</span>
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center gap-3 px-4 py-10 text-center">
              <p className="text-sm text-muted-foreground">{errorMessage}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => notificationsQuery.refetch()}
                disabled={notificationsQuery.isFetching}
              >
                Tentar novamente
              </Button>
            </div>
          ) : hasNotifications ? (
            <ul className="divide-y divide-border">
              {notifications.map((notification) => {
                const kind = resolveNotificationKind(notification);
                const typeConfig = TYPE_CONFIG[kind];
                const TypeIcon = typeConfig.icon;

                const statusKey = inferStatus(notification);
                const statusConfig = STATUS_CONFIG[statusKey];
                const StatusIcon = statusConfig.icon;

                const processNumber = readMetadataString(notification, [
                  "processNumber",
                  "numeroProcesso",
                  "processo",
                  "caseNumber",
                ]);
                const dueDate = formatDueDate(
                  readMetadataString(notification, ["dueDate", "prazo", "deadline", "due_date"]),
                );
                const receivedAt = formatRelativeTime(notification.createdAt);
                const statusLabel =
                  readMetadataString(notification, ["status", "situacao", "state"]) ?? statusConfig.label;

                const isUpdating =
                  markAllMutation.isPending ||
                  (toggleNotificationMutation.isPending && activeNotificationId === notification.id);

                return (
                  <li key={notification.id} className="px-4 py-3">
                    <div className="flex gap-3">
                      <span
                        className={cn(
                          "mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm",
                          typeConfig.className,
                        )}
                      >
                        <TypeIcon className="h-5 w-5" />
                      </span>
                      <div className="flex-1 space-y-2">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="space-y-1">
                            <p className="text-sm font-semibold leading-tight text-foreground">
                              {notification.title}
                            </p>
                            {notification.message ? (
                              <p className="text-xs leading-snug text-muted-foreground">
                                {notification.message}
                              </p>
                            ) : null}
                          </div>
                          <Badge
                            variant="outline"
                            className={cn(
                              "flex items-center gap-1 rounded-full px-2 text-[11px] font-medium",
                              statusConfig.className,
                            )}
                          >
                            <StatusIcon className="h-3.5 w-3.5" />
                            {statusLabel}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                          {processNumber ? <span>Processo {processNumber}</span> : null}
                          {dueDate ? <span>Prazo {dueDate}</span> : null}
                          {receivedAt ? <span>Recebida {receivedAt}</span> : null}
                        </div>
                        <div className="flex items-center justify-end">
                          <button
                            type="button"
                            onClick={() => handleToggleNotification(notification)}
                            disabled={isUpdating || notification.read}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline disabled:text-muted-foreground"
                            data-testid={`notification-${notification.id}-toggle-read`}
                          >
                            {isUpdating && !notification.read ? (
                              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                            ) : null}
                            {notification.read ? "Lida" : "Marcar como lida"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center text-muted-foreground">
              <CheckCircle2 className="h-6 w-6" />
              <p className="text-sm font-medium">Nenhuma intimação pendente.</p>
              <p className="text-xs">Suas notificações recentes aparecerão aqui assim que chegarem.</p>
            </div>
          )}
        </ScrollArea>
        <div className="border-t border-border bg-muted/40 px-3 py-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleMarkAll}
              disabled={disableMarkAll}
              data-testid="mark-all-notifications"
              className="justify-center"
            >
              {markAllMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              ) : null}
              Marcar todas como lidas
            </Button>
            <Button variant="ghost" className="w-full justify-between text-sm font-medium sm:w-auto">
              Ver todas as intimações
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

