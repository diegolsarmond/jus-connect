import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { adminApi, serviceKeys, type Service } from "@/lib/adminApi";

const FIVE_MINUTES_IN_MS = 1000 * 60 * 5;
const EMPTY_SERVICE_SLUG_QUERY_KEY = [...serviceKeys.all, "slug", ""] as const;

export const useServices = (): UseQueryResult<Service[], Error> =>
  useQuery<Service[], Error>({
    queryKey: serviceKeys.list(),
    queryFn: () => adminApi.listServices(),
    staleTime: FIVE_MINUTES_IN_MS,
  });

export const useServiceById = (id: string | null | undefined): UseQueryResult<Service | undefined, Error> => {
  const normalizedId = id?.trim() ?? "";
  const enabled = normalizedId.length > 0;

  return useQuery<Service | undefined, Error>({
    queryKey: enabled ? serviceKeys.detail(normalizedId) : [...serviceKeys.all, "id", ""],
    queryFn: () => adminApi.getServiceById(normalizedId),
    enabled,
    staleTime: FIVE_MINUTES_IN_MS,
  });
};

export const useServiceBySlug = (slug: string | null | undefined): UseQueryResult<Service | undefined, Error> => {
  const normalizedSlug = slug?.trim() ?? "";
  const enabled = normalizedSlug.length > 0;

  return useQuery<Service | undefined, Error>({
    queryKey: enabled ? serviceKeys.detailBySlug(normalizedSlug) : EMPTY_SERVICE_SLUG_QUERY_KEY,
    queryFn: () => adminApi.getServiceBySlug(normalizedSlug),
    enabled,
    staleTime: FIVE_MINUTES_IN_MS,
  });
};
