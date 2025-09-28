import type { PropsWithChildren } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react-dom/test-utils";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import BlogArticle from "./BlogArticle";
import { useBlogPostBySlug, useBlogPosts } from "@/hooks/useBlogPosts";

vi.mock("@/hooks/useBlogPosts", () => ({
  useBlogPostBySlug: vi.fn(),
  useBlogPosts: vi.fn(),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/components/Header", () => ({
  default: () => null,
}));

vi.mock("@/components/Footer", () => ({
  default: () => null,
}));

vi.mock("@/components/site/TypebotBubble", () => ({
  default: () => null,
}));

vi.mock("@/components/ui/SimpleBackground", () => ({
  default: () => null,
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: PropsWithChildren) => <span>{children}</span>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children }: PropsWithChildren) => <>{children}</>,
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: PropsWithChildren) => <div>{children}</div>,
  CardContent: ({ children }: PropsWithChildren) => <div>{children}</div>,
  CardDescription: ({ children }: PropsWithChildren) => <p>{children}</p>,
  CardHeader: ({ children }: PropsWithChildren) => <div>{children}</div>,
  CardTitle: ({ children }: PropsWithChildren) => <h3>{children}</h3>,
}));

vi.mock("@/components/ui/skeleton", () => ({
  Skeleton: () => <div data-testid="skeleton" />,
}));

describe("BlogArticle", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.clearAllMocks();
  });

  it("renders decoded HTML entities as markup", () => {
    vi.mocked(useBlogPostBySlug).mockReturnValue({
      data: {
        slug: "negrito",
        title: "Negrito",
        description: "Descrição",
        category: "Categoria",
        date: "2024-01-01",
        readTime: "1 min",
        author: "Autor",
        content: "&lt;strong&gt;negrito&lt;/strong&gt;",
        image: null,
        tags: [],
      },
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useBlogPostBySlug>);

    vi.mocked(useBlogPosts).mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof useBlogPosts>);

    act(() => {
      root.render(
        <MemoryRouter initialEntries={["/blog/negrito"]}>
          <Routes>
            <Route path="/blog/:slug" element={<BlogArticle />} />
          </Routes>
        </MemoryRouter>,
      );
    });

    const strongElement = container.querySelector("article strong");
    expect(strongElement).not.toBeNull();
    expect(strongElement?.textContent).toBe("negrito");
  });
});
