import { ArrowRight, Calendar, Clock, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

import SimpleBackground from "@/components/ui/SimpleBackground";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface BlogPreview {
  title: string;
  description: string;
  category: string;
  readTime: string;
  date: string;
  href: string;
}

const BLOG_POSTS: BlogPreview[] = [
  {
    title: "Como implementar automações jurídicas com governança",
    description: "Roadmap para mapear processos, definir integrações críticas e medir impacto em indicadores.",
    category: "Operações",
    readTime: "6 min",
    date: "Out 2024",
    href: "/blog/automacoes-juridicas",
  },
  {
    title: "Guia completo de CRM para escritórios",
    description: "Principais pilares para estruturar pipeline, atendimento e fidelização no segmento jurídico.",
    category: "CRM",
    readTime: "8 min",
    date: "Set 2024",
    href: "/blog/crm-advocacia",
  },
  {
    title: "IA generativa aplicada ao contencioso",
    description: "Casos reais de uso de IA para síntese de processos, minutas e suporte a audiências.",
    category: "Inteligência Artificial",
    readTime: "5 min",
    date: "Ago 2024",
    href: "/blog/ia-contencioso",
  },
];

const Blog = () => {
  return (
    <section id="blog" className="relative overflow-hidden bg-background">
      <div className="absolute inset-0" aria-hidden>
        <SimpleBackground className="opacity-60" />
      </div>
      <div className="container relative z-10 space-y-10 px-4 py-20">
        <div className="flex flex-col gap-4 text-center">
          <span className="mx-auto inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium uppercase tracking-wide text-primary">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            Conteúdo especializado
          </span>
          <h2 className="text-3xl font-semibold text-foreground md:text-4xl">Insights para acelerar sua transformação</h2>
          <p className="mx-auto max-w-3xl text-base text-muted-foreground">
            Artigos, cases e melhores práticas sobre automações, CRM jurídico, experiência do cliente e operação orientada a
            dados.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {BLOG_POSTS.map((post) => (
            <Card key={post.href} className="flex h-full flex-col border-border/40 bg-background/80 backdrop-blur">
              <CardHeader className="space-y-3">
                <Badge variant="secondary" className="w-fit">
                  {post.category}
                </Badge>
                <CardTitle className="text-xl text-foreground">{post.title}</CardTitle>
                <CardDescription>{post.description}</CardDescription>
              </CardHeader>
              <CardContent className="mt-auto space-y-3 text-sm text-muted-foreground">
                <div className="flex items-center justify-between text-xs text-muted-foreground/90">
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" aria-hidden /> {post.date}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" aria-hidden /> {post.readTime}
                  </span>
                </div>
                <Button asChild variant="ghost" className="justify-start gap-2 px-0 text-sm font-semibold text-primary">
                  <Link to={post.href}>
                    Ler artigo
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Blog;
