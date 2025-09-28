import { useMemo } from "react";
import { ArrowRight, Calendar, Clock, Sparkles, User } from "lucide-react";
import { Link } from "react-router-dom";

import SimpleBackground from "@/components/ui/SimpleBackground";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { routes } from "@/config/routes";
import { useBlogPosts } from "@/hooks/useBlogPosts";

const formatPostDateTime = (dateString: string): string => {
  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return dateString;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
};

const Blog = () => {
  const {
    data: posts = [],
    isLoading,
    isError,
  } = useBlogPosts();

  const highlightedPosts = useMemo(
    () =>
      posts.slice(0, 3).map((post) => ({
        ...post,
        formattedDate: formatPostDateTime(post.date),
      })),
    [posts],
  );

  return (
    <section id="blog" className="relative overflow-hidden bg-background">
      <div className="absolute inset-0" aria-hidden>
        <SimpleBackground className="opacity-60" />
      </div>
      <div className="container relative z-10 space-y-10 px-4 py-20">
        <div className="flex flex-col gap-4 text-center">
          <span className="mx-auto inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium uppercase tracking-wide text-primary">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            BLOG
          </span>
                  <h2 className="text-3xl font-semibold text-foreground md:text-4xl">Acompanhe as novidades e conteúdos exclusivos da Quantum</h2>
          <p className="mx-auto max-w-3xl text-base text-muted-foreground">
            Artigos, cases e melhores práticas sobre automações, CRM, experiência do cliente e operação orientada a dados.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, index) => (
              <Card key={index} className="border-border/40 bg-background/60">
                <CardHeader className="space-y-3">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-4 w-1/2" />
                </CardContent>
              </Card>
            ))
          ) : isError ? (
            <Card className="md:col-span-3 border-border/40 bg-background/70">
              <CardHeader>
                <CardTitle className="text-lg">Não foi possível carregar os artigos</CardTitle>
                <CardDescription>
                  Atualize a página para tentar novamente ou acesse o blog completo para ver os conteúdos.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="quantum">
                  <Link to={routes.blog}>Ir para o blog</Link>
                </Button>
              </CardContent>
            </Card>
          ) : highlightedPosts.length ? (
            highlightedPosts.map((post) => (
              <Card key={post.id} className="flex h-full flex-col border-border/40 bg-background/80 backdrop-blur">
                <CardHeader className="space-y-3">
                  <Badge variant="secondary" className="w-fit">
                    {post.category}
                  </Badge>
                  <CardTitle className="text-xl text-foreground">{post.title}</CardTitle>
                  <CardDescription className="text-foreground/80">
                    {post.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="mt-auto space-y-3 text-sm text-muted-foreground">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground/90">
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" aria-hidden /> {post.formattedDate}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" aria-hidden /> {post.readTime}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-medium text-foreground/80">
                    <User className="h-3.5 w-3.5 text-primary" aria-hidden />
                    <span>{post.author}</span>
                  </div>
                  <Button asChild variant="ghost" className="justify-start gap-2 px-0 text-sm font-semibold text-primary">
                    <Link to={routes.blogPost(post.slug)}>
                      Ler artigo
                      <ArrowRight className="h-4 w-4" aria-hidden />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card className="md:col-span-3 border-border/40 bg-background/70">
              <CardHeader>
                <CardTitle className="text-lg">Nenhum artigo publicado ainda</CardTitle>
                <CardDescription>
                  Nossa equipe está preparando conteúdos especiais. Enquanto isso, acompanhe as novidades em nossas redes.
                </CardDescription>
              </CardHeader>
            </Card>
          )}
        </div>
      </div>
    </section>
  );
};

export default Blog;
