import { useCallback, useMemo } from "react";
import { useQueries, type UseQueryResult } from "@tanstack/react-query";

import { fetchConversations } from "@/features/chat/services/chatApi";
import { fetchUnreadNotificationsCount } from "@/services/notifications";

export type SidebarCounterKey = "messages" | "agenda" | "tasks";

export type SidebarCounterState = {
  count?: number;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
};

export type SidebarCountersMap = Record<SidebarCounterKey, SidebarCounterState>;

export interface UseSidebarCountersResult {
  counters: SidebarCountersMap;
  refetchAll: () => Promise<unknown[]>;
}

const formatUnreadMessagesTotal = (conversations: Awaited<ReturnType<typeof fetchConversations>>): number =>
  conversations.reduce((total, conversation) => {
    const unread = typeof conversation.unreadCount === "number" ? conversation.unreadCount : 0;
    return total + Math.max(0, unread);
  }, 0);

const toCounterState = (query: UseQueryResult<number, Error>): SidebarCounterState => ({
  count: query.status === "success" ? query.data ?? 0 : undefined,
  isLoading: query.isLoading,
  isFetching: query.isFetching,
  isError: query.isError,
});

export function useSidebarCounters(): UseSidebarCountersResult {
  const results = useQueries({
    queries: [
      {
        queryKey: ["sidebar", "unread", "messages"],
        queryFn: async () => {
          const conversations = await fetchConversations();
          return formatUnreadMessagesTotal(conversations);
        },
        staleTime: 60_000,
      },
      {
        queryKey: ["sidebar", "unread", "agenda"],
        queryFn: () => fetchUnreadNotificationsCount("agenda"),
        staleTime: 60_000,
      },
      {
        queryKey: ["sidebar", "unread", "tasks"],
        queryFn: () => fetchUnreadNotificationsCount("tasks"),
        staleTime: 60_000,
      },
    ],
  });

  const counters = useMemo<SidebarCountersMap>(() => {
    const [messages, agenda, tasks] = results as [
      UseQueryResult<number, Error>,
      UseQueryResult<number, Error>,
      UseQueryResult<number, Error>,
    ];

    return {
      messages: toCounterState(messages),
      agenda: toCounterState(agenda),
      tasks: toCounterState(tasks),
    };
  }, [results]);

  const refetchAll = useCallback(() => Promise.all(results.map((query) => query.refetch())), [results]);

  return { counters, refetchAll };
}
