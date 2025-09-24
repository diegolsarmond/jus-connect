import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Calendar, Clock, Filter, Search, Sparkles, Tag, User } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SimpleBackground from "@/components/ui/SimpleBackground";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useBlogPosts, type BlogPost } from "@/hooks/useBlogPosts";
import { cn } from "@/lib/utils";
import { trackEvent } from "@/lib/analytics";

const BlogPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeCategory, setActiveCategory] = useState<string>("Todos");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const { data: blogPosts = [], isLoading, isError } = useBlogPosts();

  const categories = useMemo(() => {
    return ["Todos", ...new Set(blogPosts.map((post) => post.category))];
  }, [blogPosts]);

  const filteredPosts = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return blogPosts.filter((post) => {
      const matchesCategory = activeCategory === "Todos" || post.category === activeCategory;
      if (!matchesCategory) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return (
        post.title.toLowerCase().includes(normalizedSearch) ||
        post.description.toLowerCase().includes(normalizedSearch) ||
        post.tags.some((tag) => tag.toLowerCase().includes(normalizedSearch))
      );
    });
  }, [activeCategory, blogPosts, searchTerm]);

  const featuredPost = useMemo(() => {
    if (filteredPosts.length === 0) {
      return undefined;
    }

    return filteredPosts.find((post) => post.featured) ?? filteredPosts[0];
  }, [filteredPosts]);

  const remainingPosts = useMemo(() => {
    if (!featuredPost) {
      return [];
    }

    return filteredPosts.filter((post) => post.slug !== featuredPost.slug);
  }, [filteredPosts, featuredPost]);

  const trendingPosts = useMemo(() => {
    return blogPosts.filter((post) => post.slug !== featuredPost?.slug).slice(0, 3);
  }, [blogPosts, featuredPost]);

  const topTags = useMemo(() => {
    const counts = new Map<string, number>();

    blogPosts.forEach((post) => {
      post.tags.forEach((tag) => {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      });
    });

    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([tag]) => tag);
  }, [blogPosts]);

  const handleNavigateToPost = (post: BlogPost) => {
    trackEvent("blog_post_click", {
      post_title: post.title,
      post_category: post.category,
    });
    navigate({ pathname: location.pathname, hash: post.slug });
  };

  useEffect(() => {
    if (typeof window === "undefined" || !location.hash) {
      return;
    }

    const slug = location.hash.replace("#", "");
    const element = document.getElementById(slug);

    if (!element) {
      return;
    }

    window.requestAnimationFrame(() => {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
      element.classList.add("ring-2", "ring-quantum-bright", "ring-offset-2", "ring-offset-background");

      window.setTimeout(() => {
        element.classList.remove("ring-2", "ring-quantum-bright", "ring-offset-2", "ring-offset-background");
      }, 1600);
    });
  }, [location.hash]);

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <Header />
      <main className="flex-1">
        <section className="relative overflow-hidden border-b border-border/50">
          <SimpleBackground className="opacity-80" />
          <div className="container relative z-10 px-4 py-24">
            <div className="flex flex-col gap-6 max-w-3xl">
              <Badge variant="outline" className="w-fit border-quantum-bright/60 text-quantum-bright">
                Blog Quantum
              </Badge>
              <h1 className="text-4xl md:text-5xl font-bold leading-tight">
                Insights que conectam tecnologia, estratégia e resultados
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground">
                Explore análises profundas, guias práticos e tendências sobre inteligência artificial, automação e transformação
                digital para empresas que querem liderar o futuro.
              </p>
            </div>

            <div className="mt-10 grid gap-4 md:grid-cols-[minmax(0,1fr),auto] items-center">
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-background/90 px-4 py-3 shadow-lg shadow-quantum-deep/10 backdrop-blur">
                <Search className="h-5 w-5 text-quantum-bright" />
                <Input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Busque por IA, automação, CRM..."
                  className="border-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                />
              </div>
              <Button
                variant="quantum"
                size="lg"
                onClick={() => navigate("/#contato")}
                className="justify-self-start md:justify-self-end"
              >
                Fale com um especialista
                <ArrowRight className="h-5 w-5" />
              </Button>
            </div>

            <div className="mt-12 space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Filter className="h-4 w-4" />
                Filtre por temas em destaque
              </div>
              <div className="flex flex-wrap gap-3">
                {categories.map((category) => (
                  <Button
                    key={category}
                    type="button"
                    variant={activeCategory === category ? "quantum" : "outline_quantum"}
                    size="sm"
                    className={cn(
                      "rounded-full px-5",
                      activeCategory === category
                        ? "shadow-glow"
                        : "border-quantum-bright/30 text-foreground hover:border-quantum-bright"
                    )}
                    onClick={() => setActiveCategory(category)}
                    disabled={isLoading}
                  >
                    {category}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="container px-4 py-16 space-y-16">
          {isLoading ? (
            <div className="grid gap-10 lg:grid-cols-[2fr,1fr]">
              <Card className="relative overflow-hidden rounded-3xl border-0 bg-background/80">
                <Skeleton className="h-72 w-full" />
                <CardHeader className="space-y-3">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-8 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                </CardHeader>
              </Card>
              <aside className="space-y-6">
                <Card className="rounded-3xl">
                  <CardHeader>
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {Array.from({ length: 3 }).map((_, index) => (
                      <Skeleton key={index} className="h-12 w-full" />
                    ))}
                  </CardContent>
                </Card>
                <Card className="rounded-3xl">
                  <CardHeader>
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-40" />
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-3">
                    {Array.from({ length: 6 }).map((_, index) => (
                      <Skeleton key={index} className="h-7 w-16 rounded-full" />
                    ))}
                  </CardContent>
                </Card>
              </aside>
            </div>
          ) : isError ? (
            <Card className="rounded-3xl border-destructive/40 bg-destructive/10">
              <CardHeader className="space-y-4 text-destructive">
                <CardTitle className="text-2xl">Não foi possível carregar os artigos</CardTitle>
                <CardDescription>
                  Houve um erro ao buscar o conteúdo do blog. Atualize a página ou tente novamente mais tarde.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : featuredPost ? (
            <div className="grid gap-10 lg:grid-cols-[2fr,1fr]">
              <Card
                id={featuredPost.slug}
                className="group relative overflow-hidden rounded-3xl border-0 bg-gradient-to-br from-background via-background/95 to-quantum-deep/30 shadow-2xl"
              >
                <div className="absolute inset-0 overflow-hidden">
                  <img
                    src={featuredPost.image}
                    alt={featuredPost.title}
                    className="h-full w-full object-cover opacity-60 transition-all duration-700 group-hover:scale-105"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
                </div>
                <div className="relative z-10 p-8 md:p-12 flex flex-col gap-6 text-white">
                  <div className="flex flex-wrap items-center gap-4 text-sm text-white/80">
                    <Badge className="bg-white/15 text-white backdrop-blur">
                      <Sparkles className="mr-2 h-3.5 w-3.5" /> Destaque do mês
                    </Badge>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      {featuredPost.date}
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      {featuredPost.readTime}
                    </div>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      {featuredPost.author}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h2 className="text-3xl md:text-4xl font-bold leading-tight">
                      {featuredPost.title}
                    </h2>
                    <p className="max-w-3xl text-base md:text-lg text-white/90">
                      {featuredPost.description}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    {featuredPost.tags.map((tag) => (
                      <Badge key={tag} variant="outline" className="border-white/40 text-white/90 backdrop-blur">
                        #{tag}
                      </Badge>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-4 pt-4">
                    <Button variant="hero" size="lg" onClick={() => handleNavigateToPost(featuredPost)}>
                      Ler artigo completo
                      <ArrowRight className="h-5 w-5" />
                    </Button>
                    <Button
                      variant="outline_quantum"
                      size="lg"
                      onClick={() => navigate("/#contato")}
                      className="border-white/40 text-white hover:text-white hover:bg-white/10"
                    >
                      Falar com especialistas
                    </Button>
                  </div>
                </div>
              </Card>

              <aside className="space-y-6">
                <Card className="rounded-3xl border-border/60 bg-background/80 backdrop-blur">
                  <CardHeader className="border-b border-border/60">
                    <CardTitle className="flex items-center gap-2 text-base font-semibold">
                      <Sparkles className="h-4 w-4 text-quantum-bright" /> Tendências da semana
                    </CardTitle>
                    <CardDescription>
                      Leituras rápidas para acompanhar o que está movimentando o mercado.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-4">
                    {trendingPosts.map((post) => (
                      <button
                        key={post.slug}
                        type="button"
                        onClick={() => handleNavigateToPost(post)}
                        className="group flex w-full items-start gap-3 rounded-2xl border border-transparent px-4 py-3 text-left transition-all hover:border-quantum-bright/40 hover:bg-quantum-bright/5"
                      >
                        <div className="mt-1 h-2 w-2 rounded-full bg-quantum-bright/70 group-hover:bg-quantum-bright" />
                        <div className="flex-1 space-y-2">
                          <p className="text-sm font-semibold text-foreground group-hover:text-quantum-bright">
                            {post.title}
                          </p>
                          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            <span>{post.category}</span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {post.readTime}
                            </span>
                          </div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-quantum-bright/60 group-hover:translate-x-1 group-hover:text-quantum-bright transition-transform" />
                      </button>
                    ))}
                  </CardContent>
                </Card>

                <Card className="rounded-3xl border-dashed border-quantum-bright/40 bg-gradient-to-br from-background to-quantum-bright/5">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base font-semibold text-quantum-bright">
                      <Tag className="h-4 w-4" /> Tags em alta
                    </CardTitle>
                    <CardDescription>
                      Temas mais buscados pelos nossos leitores nos últimos dias.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-3">
                    {topTags.map((tag) => (
                      <Badge key={tag} variant="outline" className="rounded-full border-quantum-bright/40 text-quantum-bright">
                        #{tag}
                      </Badge>
                    ))}
                  </CardContent>
                </Card>
              </aside>
            </div>
          ) : (
            <Card className="rounded-3xl border-dashed border-quantum-bright/40 bg-background/80 text-center py-16">
              <CardHeader className="space-y-4">
                <CardTitle className="text-2xl">Nenhum artigo encontrado</CardTitle>
                <CardDescription>
                  Ajuste os filtros ou busque por outro termo para encontrar novos conteúdos.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant="quantum"
                  onClick={() => {
                    setSearchTerm("");
                    setActiveCategory("Todos");
                  }}
                >
                  Limpar filtros
                </Button>
              </CardContent>
            </Card>
          )}

          {remainingPosts.length > 0 && (
            <div className="space-y-8">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-2xl font-semibold">Mais artigos para você</h3>
                  <p className="text-muted-foreground">
                    Continue explorando nossos conteúdos selecionados por especialistas.
                  </p>
                </div>
                <Button variant="outline_quantum" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
                  Voltar ao topo
                </Button>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                {remainingPosts.map((post) => (
                  <Card
                    key={post.slug}
                    id={post.slug}
                    className="group relative overflow-hidden rounded-2xl border-border/60 bg-background/90 backdrop-blur"
                  >
                    <div className="relative h-48 overflow-hidden">
                      <img
                        src={post.image}
                        alt={post.title}
                        className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                        loading="lazy"
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background via-background/40 to-transparent p-4">
                        <Badge className="bg-quantum-deep/70 text-white">{post.category}</Badge>
                      </div>
                    </div>
                    <CardHeader className="space-y-3">
                      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {post.date}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {post.readTime}
                        </span>
                        <span className="flex items-center gap-1">
                          <User className="h-3.5 w-3.5" />
                          {post.author}
                        </span>
                      </div>
                      <CardTitle className="text-xl leading-snug group-hover:text-quantum-bright transition-colors">
                        {post.title}
                      </CardTitle>
                      <CardDescription className="text-sm text-muted-foreground">
                        {post.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap gap-2">
                        {post.tags.map((tag) => (
                          <Badge key={tag} variant="outline" className="rounded-full border-border text-muted-foreground">
                            #{tag}
                          </Badge>
                        ))}
                      </div>
                      <Button variant="outline_quantum" size="sm" onClick={() => handleNavigateToPost(post)}>
                        Ler artigo
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default BlogPage;
