import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { adminApi, blogPostKeys, type BlogPost } from "@/lib/adminApi";

export type { BlogPost };

const FIVE_MINUTES_IN_MS = 1000 * 60 * 5;
const EMPTY_BLOG_POST_ID_QUERY_KEY = [...blogPostKeys.all, "id", ""] as const;
const EMPTY_BLOG_POST_SLUG_QUERY_KEY = [...blogPostKeys.all, "slug", ""] as const;

export const useBlogPosts = (): UseQueryResult<BlogPost[], Error> =>
  useQuery<BlogPost[], Error>({
    queryKey: blogPostKeys.list(),
    queryFn: () => adminApi.listPosts(),
    staleTime: FIVE_MINUTES_IN_MS,
  });

export const useBlogPostById = (id: string | null | undefined): UseQueryResult<BlogPost, Error> => {
  const normalizedId = id?.trim() ?? "";
  const enabled = normalizedId.length > 0;

  return useQuery<BlogPost, Error>({
    queryKey: enabled ? blogPostKeys.detail(normalizedId) : EMPTY_BLOG_POST_ID_QUERY_KEY,
    queryFn: () => adminApi.getPostById(normalizedId),
    enabled,
    staleTime: FIVE_MINUTES_IN_MS,
  });
};

export const useBlogPostBySlug = (
  slug: string | null | undefined,
): UseQueryResult<BlogPost | undefined, Error> => {
  const normalizedSlug = slug?.trim() ?? "";
  const enabled = normalizedSlug.length > 0;

  return useQuery<BlogPost | undefined, Error>({
    queryKey: enabled ? blogPostKeys.detailBySlug(normalizedSlug) : EMPTY_BLOG_POST_SLUG_QUERY_KEY,
    queryFn: () => adminApi.getPostBySlug(normalizedSlug),
    enabled,
    staleTime: FIVE_MINUTES_IN_MS,
  });
};
