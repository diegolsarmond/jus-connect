import { useEffect, useMemo, useState, type KeyboardEventHandler } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Loader2, RefreshCw, Search } from "lucide-react";
import clsx from "clsx";
import { fetchWahaChats, type WahaChatSummary } from "../services/wahaChatApi";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { normalizeText } from "../utils/format";

const PAGE_SIZE = 50;

const messages = {
  "pt-BR": {
    title: "Conversas",
    subtitle: "Chats sincronizados com o WAHA",
    searchPlaceholder: "Buscar por nome ou ID",
    loading: "Carregando conversas...",
    empty: "Nenhuma conversa encontrada",
    error: "Não foi possível carregar as conversas.",
    retry: "Tentar novamente",
    refresh: "Atualizar",
    pagination: {
      previous: "Anterior",
      next: "Próxima",
      summary: (start: number, end: number, total: number) =>
        `Mostrando ${start}–${end} de ${total}`,
    },
  },
};

const locale = "pt-BR" as const;
const t = messages[locale];

const getInitials = (value: string) => {
  const words = value
    .split(/\s+/)
    .filter((item) => item.length > 0)
    .slice(0, 2);
  if (words.length === 0) {
    return "?";
  }
  return words
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
};

const buildItemId = (conversationId: string) =>
  `waha-conversation-${conversationId.replace(/[^a-zA-Z0-9_-]/g, "-")}`;

const filterConversations = (conversations: WahaChatSummary[], query: string) => {
  if (!query) {
    return conversations;
  }
  const normalizedQuery = normalizeText(query);
  return conversations.filter((conversation) => {
    const normalizedName = normalizeText(conversation.contact_name);
    const normalizedId = normalizeText(conversation.conversation_id);
    return (
      normalizedName.includes(normalizedQuery) ||
      normalizedId.includes(normalizedQuery)
    );
  });
};

const paginate = (conversations: WahaChatSummary[], page: number) => {
  const start = page * PAGE_SIZE;
  const end = start + PAGE_SIZE;
  return conversations.slice(start, end);
};

export const WahaConversationsList = () => {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const debouncedSearch = useDebouncedValue(search, 300);

  const { data, isLoading, isError, refetch, isFetching, error } = useQuery({
    queryKey: ["waha", "chats"],
    queryFn: ({ signal }) => fetchWahaChats({ signal }),
    staleTime: 30_000,
  });

  const filtered = useMemo(
    () => filterConversations(data ?? [], debouncedSearch),
    [data, debouncedSearch],
  );

  useEffect(() => {
    setPage(0);
  }, [debouncedSearch]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const paginated = useMemo(
    () => paginate(filtered, currentPage),
    [filtered, currentPage],
  );

  useEffect(() => {
    if (paginated.length > 0) {
      setFocusedIndex(0);
    } else {
      setFocusedIndex(null);
    }
  }, [paginated]);

  useEffect(() => {
    if (focusedIndex === null) {
      return;
    }
    const conversation = paginated[focusedIndex];
    if (!conversation) {
      return;
    }
    const element = document.getElementById(buildItemId(conversation.conversation_id));
    element?.scrollIntoView({ block: "nearest" });
  }, [focusedIndex, paginated]);

  const handleListKeyDown: KeyboardEventHandler<HTMLDivElement> = (event) => {
    if (!paginated.length) {
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setFocusedIndex((current) => {
        const next = current === null ? 0 : Math.min(paginated.length - 1, current + 1);
        return next;
      });
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setFocusedIndex((current) => {
        const next = current === null ? 0 : Math.max(0, current - 1);
        return next;
      });
    } else if (event.key === "Home") {
      event.preventDefault();
      setFocusedIndex(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setFocusedIndex(paginated.length - 1);
    }
  };

  const summaryStart = filtered.length === 0 ? 0 : currentPage * PAGE_SIZE + 1;
  const summaryEnd = Math.min(filtered.length, summaryStart + paginated.length - 1);

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold leading-tight text-foreground">
            {t.title}
          </h1>
          <p className="text-sm text-muted-foreground">{t.subtitle}</p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isFetching}
        >
          {isFetching ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
          )}
          <span className="hidden sm:inline">{t.refresh}</span>
        </button>
      </header>

      <div className="flex items-center gap-3 rounded-lg border border-input bg-background px-4 py-3 shadow-sm">
        <Search className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t.searchPlaceholder}
          className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          aria-label={t.searchPlaceholder}
        />
      </div>

      <div className="flex flex-col gap-4">
        <div
          role="list"
          aria-busy={isFetching}
          tabIndex={0}
          onKeyDown={handleListKeyDown}
          className="relative flex-1 overflow-hidden rounded-xl border border-input bg-card shadow-sm focus:outline-none"
        >
          <div className="h-full overflow-auto">
            {isLoading ? (
              <ul className="divide-y divide-border" aria-label={t.loading}>
                {Array.from({ length: 6 }).map((_, index) => (
                  <li key={`skeleton-${index}`} className="flex items-center gap-4 px-4 py-4">
                    <div className="h-12 w-12 animate-pulse rounded-full bg-muted" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
                      <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
                    </div>
                  </li>
                ))}
              </ul>
            ) : isError ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 px-6 py-12 text-center">
                <AlertCircle className="h-6 w-6 text-destructive" aria-hidden="true" />
                <p className="text-sm text-muted-foreground">
                  {error instanceof Error ? error.message : t.error}
                </p>
                <button
                  type="button"
                  onClick={() => refetch()}
                  className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  {t.retry}
                </button>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex h-full items-center justify-center px-6 py-12 text-sm text-muted-foreground">
                {t.empty}
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {paginated.map((conversation, index) => {
                  const itemId = buildItemId(conversation.conversation_id);
                  const isFocused = focusedIndex === index;
                  return (
                    <li
                      key={conversation.conversation_id}
                      id={itemId}
                      role="listitem"
                      data-focused={isFocused}
                      className={clsx(
                        "flex cursor-default items-center gap-4 px-4 py-4 transition",
                        "focus-within:outline-none",
                        "data-[focused=true]:bg-muted/40 data-[focused=true]:ring-2 data-[focused=true]:ring-primary",
                      )}
                      tabIndex={-1}
                      onMouseEnter={() => setFocusedIndex(index)}
                    >
                      {conversation.photo_url ? (
                        <img
                          src={conversation.photo_url}
                          alt=""
                          className="h-12 w-12 flex-shrink-0 rounded-full object-cover"
                          aria-hidden="true"
                        />
                      ) : (
                        <div
                          className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground"
                          aria-hidden="true"
                        >
                          {getInitials(conversation.contact_name || conversation.conversation_id)}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {conversation.contact_name}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {conversation.conversation_id}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
          <p>
            {filtered.length === 0
              ? t.pagination.summary(0, 0, 0)
              : t.pagination.summary(summaryStart, summaryEnd, filtered.length)}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((value) => Math.max(0, value - 1))}
              disabled={currentPage === 0 || filtered.length === 0}
              className="inline-flex items-center rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium text-foreground shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              {t.pagination.previous}
            </button>
            <span className="tabular-nums">
              {filtered.length === 0 ? "0 / 0" : `${currentPage + 1} / ${totalPages}`}
            </span>
            <button
              type="button"
              onClick={() => setPage((value) => Math.min(totalPages - 1, value + 1))}
              disabled={currentPage >= totalPages - 1 || filtered.length === 0}
              className="inline-flex items-center rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium text-foreground shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              {t.pagination.next}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

