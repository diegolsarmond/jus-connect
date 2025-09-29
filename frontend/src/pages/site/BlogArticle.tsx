import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Calendar, Clock, Share2, Sparkles, Tag } from "lucide-react";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import TypebotBubble from "@/components/site/TypebotBubble";
import SimpleBackground from "@/components/ui/SimpleBackground";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { routes } from "@/config/routes";
import { useToast } from "@/hooks/use-toast";
import { useBlogPostBySlug, useBlogPosts } from "@/hooks/useBlogPosts";
import { formatPostDateTime } from "@/lib/date";

const allowedTags = new Set([
  "p",
  "br",
  "strong",
  "em",
  "b",
  "i",
  "u",
  "ul",
  "ol",
  "li",
  "blockquote",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "code",
  "pre",
  "hr",
  "a",
]);

const allowedAttributes = new Map<string, Set<string>>([
  [
    "a",
    new Set(["href", "title", "target", "rel"]),
  ],
]);

const htmlEntityMap: Record<string, string> = {
  "&lt;": "<",
  "&gt;": ">",
  "&amp;": "&",
  "&quot;": '"',
  "&#39;": "'",
};

const decodeHtmlEntities = (value: string): string => {
  if (!value) {
    return value;
  }

  if (typeof DOMParser !== "undefined") {
    try {
      const parser = new DOMParser();
      const documentFragment = parser.parseFromString(`<!doctype html><body>${value}`, "text/html");
      return documentFragment.body.innerHTML || value;
    } catch (error) {
      // Fallback to other strategies when DOMParser is unavailable or fails.
    }
  }

  if (typeof document !== "undefined") {
    const textarea = document.createElement("textarea");
    textarea.innerHTML = value;
    return textarea.value;
  }

  return value.replace(/&(lt|gt|amp|quot|#39);/g, (match) => htmlEntityMap[match] ?? match);
};

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const normalizeParagraphs = (text: string): string =>
  text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
    .join("");

const sanitizeBlogContent = (html: string): string | null => {
  if (typeof window === "undefined" || typeof DOMParser === "undefined") {
    return html;
  }

  const parser = new DOMParser();
  const parsedDocument = parser.parseFromString(html, "text/html");

  if (parsedDocument.querySelector("parsererror")) {
    return null;
  }

  const elements = Array.from(parsedDocument.body.querySelectorAll("*"));

  const unwrapElement = (element: Element) => {
    const parent = element.parentNode;
    if (!parent) {
      element.remove();
      return;
    }

    while (element.firstChild) {
      parent.insertBefore(element.firstChild, element);
    }
    parent.removeChild(element);
  };

  elements.forEach((element) => {
    const tagName = element.tagName.toLowerCase();

    if (!allowedTags.has(tagName)) {
      unwrapElement(element);
      return;
    }

    const allowedForTag = allowedAttributes.get(tagName);

    Array.from(element.attributes).forEach((attribute) => {
      const attributeName = attribute.name.toLowerCase();

      if (!allowedForTag || !allowedForTag.has(attributeName)) {
        element.removeAttribute(attribute.name);
        return;
      }

      if (tagName === "a" && attributeName === "href") {
        const value = attribute.value.trim();

        if (!value || /^(javascript:|data:)/i.test(value)) {
          element.removeAttribute(attribute.name);
          return;
        }

        if (/^https?:/i.test(value)) {
          element.setAttribute("target", "_blank");
          element.setAttribute("rel", "noopener noreferrer");
        }
      }

      if (tagName === "a" && attributeName === "target") {
        const value = attribute.value.trim();
        if (value !== "_blank" && value !== "_self") {
          element.setAttribute("target", "_blank");
        }
      }

      if (tagName === "a" && attributeName === "rel") {
        const tokens = attribute.value
          .split(/\s+/)
          .map((token) => token.trim())
          .filter(Boolean);
        const normalized = new Set(tokens);
        normalized.add("noopener");
        normalized.add("noreferrer");
        element.setAttribute("rel", Array.from(normalized).join(" "));
      }
    });
  });

  return parsedDocument.body.innerHTML;
};

const BlogArticle = () => {
  const { slug } = useParams<{ slug: string }>();
  const {
    data: post,
    isLoading,
    isError,
  } = useBlogPostBySlug(slug);
  const { data: allPosts = [], isLoading: isLoadingPosts } = useBlogPosts();
  const { toast } = useToast();

  const recommendedPosts = useMemo(() => {
    if (!post) {
      return [];
    }

    return allPosts.filter((item) => item.slug !== post.slug).slice(0, 3);
  }, [allPosts, post]);

  const formattedPostDate = useMemo(() => {
    if (!post) {
      return "";
    }

    return formatPostDateTime(post.date);
  }, [post]);

  const sanitizedContent = useMemo(() => {
    const rawContent = post?.content?.trim();
    if (rawContent) {
      const decodedContent = decodeHtmlEntities(rawContent);
      const sanitized = sanitizeBlogContent(decodedContent);
      if (sanitized && sanitized.trim()) {
        return sanitized;
      }
    }

    const fallback = post?.description?.trim();
    if (fallback) {
      return normalizeParagraphs(fallback);
    }

    return "";
  }, [post?.content, post?.description]);

  const hasArticleContent = sanitizedContent.trim().length > 0;

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <TypebotBubble />
      <Header />
      <main className="flex-1">
        <section className="relative overflow-hidden border-b border-border/50">
          <SimpleBackground className="opacity-80" />
          <div className="container relative z-10 space-y-8 px-4 py-16">
            <Button asChild variant="ghost" className="w-fit px-0 text-base font-medium text-primary">
              <Link to={routes.blog} className="inline-flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" aria-hidden />
                Voltar para o blog
              </Link>
            </Button>

            {isLoading ? (
              <div className="space-y-6">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-12 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            ) : isError ? (
              <div className="space-y-3">
                <Badge variant="destructive" className="w-fit">
                  Erro ao carregar artigo
                </Badge>
                <p className="max-w-2xl text-base text-muted-foreground">
                  Não foi possível carregar este conteúdo agora. Tente novamente em instantes.
                </p>
              </div>
            ) : post ? (
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1 text-sm font-medium text-primary">
                  <Sparkles className="h-4 w-4" aria-hidden />
                  {post.category}
                </div>

                <div className="space-y-4">
                  <h1 className="text-4xl font-bold leading-tight md:text-5xl">{post.title}</h1>
                  <p className="max-w-3xl text-lg text-muted-foreground">{post.description}</p>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-2">
                    <Calendar className="h-4 w-4" aria-hidden />
                    {formattedPostDate}
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <Clock className="h-4 w-4" aria-hidden />
                    {post.readTime}
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <Tag className="h-4 w-4" aria-hidden />
                    {post.author}
                  </span>
                </div>

                {post.image ? (
                  <div className="overflow-hidden rounded-3xl border border-white/10 bg-background/60 shadow-lg shadow-primary/10">
                    <img
                      src={post.image}
                      alt={post.title}
                      className="h-[360px] w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                ) : null}

                {post.tags?.length ? (
                  <div className="flex flex-wrap gap-2">
                    {post.tags.map((tag) => (
                      <Badge key={tag} variant="outline" className="border-primary/50 text-primary">
                        #{tag}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="space-y-3">
                <Badge variant="outline" className="w-fit border-muted-foreground/40 text-muted-foreground">
                  Artigo não encontrado
                </Badge>
                <p className="max-w-2xl text-base text-muted-foreground">
                  O conteúdo que você procura pode ter sido removido ou estar indisponível.
                </p>
              </div>
            )}
          </div>
        </section>

        <section className="container grid gap-12 px-4 py-16 lg:grid-cols-[minmax(0,3fr),minmax(0,1.4fr)]">
          <article className="space-y-6 text-lg leading-relaxed text-muted-foreground">
            {isLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 6 }).map((_, index) => (
                  <Skeleton key={index} className="h-4 w-full" />
                ))}
              </div>
            ) : post && hasArticleContent ? (
              <div
                className="prose prose-invert prose-headings:text-foreground prose-strong:text-foreground prose-em:text-foreground/90 prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-blockquote:border-l-primary/60 prose-blockquote:text-foreground/80 max-w-none"
                dangerouslySetInnerHTML={{ __html: sanitizedContent }}
              />
            ) : (
              <p className="text-base text-muted-foreground">
                Conteúdo em breve. Atualize a página para verificar novas informações.
              </p>
            )}
          </article>

          <aside className="space-y-8">
            <Card className="border-border/60 bg-background/80 backdrop-blur">
              <CardHeader className="space-y-3">
                <CardTitle className="text-lg">Compartilhe este artigo</CardTitle>
                <CardDescription>Leve estes insights para a sua equipe.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => {
                    const currentUrl = typeof window !== "undefined" ? window.location.href : "";

                    if (typeof navigator === "undefined" || !navigator.clipboard) {
                      toast({
                        title: "Copie o link manualmente",
                        description: currentUrl || "Compartilhe este endereço com sua equipe.",
                      });
                      return;
                    }

                    navigator.clipboard
                      .writeText(currentUrl)
                      .then(() => {
                        toast({
                          title: "Link copiado",
                          description: "Cole em uma conversa ou e-mail para compartilhar o conteúdo.",
                        });
                      })
                      .catch(() => {
                        toast({
                          title: "Não foi possível copiar automaticamente",
                          description: currentUrl,
                        });
                      });
                  }}
                >
                  <Share2 className="h-4 w-4" aria-hidden />
                  Copiar link
                </Button>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Outros artigos</h2>
                <Button variant="link" className="px-0 text-sm" asChild>
                  <Link to={routes.blog}>Ver todos</Link>
                </Button>
              </div>

              {isLoadingPosts ? (
                <div className="space-y-4">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <Card key={index} className="border-border/60">
                      <CardHeader>
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-5 w-3/4" />
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              ) : recommendedPosts.length ? (
                <div className="space-y-4">
                  {recommendedPosts.map((related) => (
                    <Card key={related.id} className="border-border/60 bg-background/70">
                      <CardHeader className="space-y-2">
                        <Badge variant="secondary" className="w-fit">
                          {related.category}
                        </Badge>
                        <CardTitle className="text-base leading-snug text-foreground">
                          {related.title}
                        </CardTitle>
                        <CardDescription>{related.description}</CardDescription>
                      </CardHeader>
                      <CardContent className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" aria-hidden /> {formatPostDateTime(related.date)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" aria-hidden /> {related.readTime}
                        </span>
                      </CardContent>
                      <CardContent className="pt-0">
                        <Button variant="ghost" className="px-0 text-sm font-medium" asChild>
                          <Link to={routes.blogPost(related.slug)}>Ler artigo</Link>
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="border-border/60 bg-background/70">
                  <CardHeader>
                    <CardTitle className="text-base">Sem recomendações no momento</CardTitle>
                    <CardDescription>
                      Explore o blog para descobrir mais conteúdos sobre tecnologia e transformação digital.
                    </CardDescription>
                  </CardHeader>
                </Card>
              )}
            </div>
          </aside>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default BlogArticle;
