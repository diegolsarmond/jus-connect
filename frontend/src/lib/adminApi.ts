import { z } from "zod";

const baseUrl = (import.meta.env.VITE_ADMIN_API_BASE_URL as string | undefined) ?? "http://localhost:3001";

const ensureBaseUrl = () => {
  if (!baseUrl) {
    throw new Error("VITE_ADMIN_API_BASE_URL is not defined");
  }
  return baseUrl.replace(/\/$/, "");
};

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

interface RequestOptions extends RequestInit {
  method?: HttpMethod;
  body?: unknown;
}

const jsonHeaders = {
  Accept: "application/json",
  "Content-Type": "application/json",
} as const;

async function request<TResponse>(endpoint: string, options: RequestOptions = {}): Promise<TResponse> {
  const url = `${ensureBaseUrl()}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
  const { method = "GET", body, headers, ...rest } = options;

  const response = await fetch(url, {
    method,
    headers: {
      ...jsonHeaders,
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
    ...rest,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => response.statusText);
    throw new Error(errorText || `Request failed with status ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as TResponse;
  }

  return (await response.json()) as TResponse;
}

export const blogPostSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  author: z.string().min(1),
  date: z.string().min(1),
  readTime: z.string().min(1),
  category: z.string().min(1),
  image: z.string().url().optional().or(z.literal("")),
  slug: z.string().min(1),
  tags: z.array(z.string()),
  featured: z.boolean().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export type BlogPost = z.infer<typeof blogPostSchema>;

export const blogPostInputSchema = blogPostSchema.partial({
  id: true,
  createdAt: true,
  updatedAt: true,
}).required({
  title: true,
  description: true,
  author: true,
  date: true,
  readTime: true,
  category: true,
  slug: true,
  tags: true,
});

export type BlogPostInput = z.input<typeof blogPostInputSchema>;

export const serviceSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  slug: z.string().min(1),
  category: z.string().min(1),
  summary: z.string().min(1),
  description: z.string().min(1),
  icon: z.string().min(1),
  features: z.array(z.string()),
  updatedAt: z.string().optional(),
});

export type Service = z.infer<typeof serviceSchema>;

export const serviceInputSchema = serviceSchema.partial({
  id: true,
  updatedAt: true,
}).required({
  title: true,
  slug: true,
  category: true,
  summary: true,
  description: true,
  icon: true,
  features: true,
});

export type ServiceInput = z.input<typeof serviceInputSchema>;

const parseCollection = <T>(data: unknown, schema: z.ZodSchema<T>): T => {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw result.error;
  }
  return result.data;
};

const parseArray = <T>(data: unknown, schema: z.ZodSchema<T>): T[] => {
  if (!Array.isArray(data)) {
    throw new Error("Expected an array response");
  }
  return data.map((item) => parseCollection(item, schema));
};

export const adminApi = {
  async listPosts(): Promise<BlogPost[]> {
    const data = await request<unknown>("/posts");
    return parseArray(data, blogPostSchema);
  },
  async getPostById(id: string): Promise<BlogPost> {
    const data = await request<unknown>(`/posts/${id}`);
    return parseCollection(data, blogPostSchema);
  },
  async getPostBySlug(slug: string): Promise<BlogPost | undefined> {
    const data = await request<unknown>(`/posts?slug=${encodeURIComponent(slug)}`);
    if (Array.isArray(data)) {
      const parsed = parseArray(data, blogPostSchema);
      return parsed[0];
    }
    return parseCollection(data, blogPostSchema);
  },
  async createPost(input: BlogPostInput): Promise<BlogPost> {
    const data = await request<unknown>("/posts", {
      method: "POST",
      body: input,
    });
    return parseCollection(data, blogPostSchema);
  },
  async updatePost(id: string, input: BlogPostInput): Promise<BlogPost> {
    const data = await request<unknown>(`/posts/${id}`, {
      method: "PUT",
      body: input,
    });
    return parseCollection(data, blogPostSchema);
  },
  async deletePost(id: string): Promise<void> {
    await request(`/posts/${id}`, {
      method: "DELETE",
    });
  },
  async listServices(): Promise<Service[]> {
    const data = await request<unknown>("/services");
    return parseArray(data, serviceSchema);
  },
  async getServiceById(id: string): Promise<Service> {
    const data = await request<unknown>(`/services/${id}`);
    return parseCollection(data, serviceSchema);
  },
  async getServiceBySlug(slug: string): Promise<Service | undefined> {
    const data = await request<unknown>(`/services?slug=${encodeURIComponent(slug)}`);
    if (Array.isArray(data)) {
      const parsed = parseArray(data, serviceSchema);
      return parsed[0];
    }
    return parseCollection(data, serviceSchema);
  },
  async createService(input: ServiceInput): Promise<Service> {
    const data = await request<unknown>("/services", {
      method: "POST",
      body: input,
    });
    return parseCollection(data, serviceSchema);
  },
  async updateService(id: string, input: ServiceInput): Promise<Service> {
    const data = await request<unknown>(`/services/${id}`, {
      method: "PUT",
      body: input,
    });
    return parseCollection(data, serviceSchema);
  },
  async deleteService(id: string): Promise<void> {
    await request(`/services/${id}`, {
      method: "DELETE",
    });
  },
};

export const blogPostKeys = {
  all: ["blog-posts"] as const,
  list: () => [...blogPostKeys.all],
  detail: (id: string) => [...blogPostKeys.all, id] as const,
  detailBySlug: (slug: string) => [...blogPostKeys.all, "slug", slug] as const,
};

export const serviceKeys = {
  all: ["services"] as const,
  list: () => [...serviceKeys.all],
  detail: (id: string) => [...serviceKeys.all, id] as const,
  detailBySlug: (slug: string) => [...serviceKeys.all, "slug", slug] as const,
};
