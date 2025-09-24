
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import TypebotBubble from "@/components/site/TypebotBubble";
import {
  ArrowRight,
  BarChart3,
  Building2,
  Check,
  FileText,
  Layers,
  MessageSquare,
  Shield,
  Users,
  Workflow,
  Zap,
  Scale,
  Sparkle,
  CheckCircle2
} from "lucide-react";
import { useServiceBySlug } from "@/hooks/useServices";
import { Skeleton } from "@/components/ui/skeleton";
import { getApiBaseUrl, joinUrl } from "@/lib/api";

type GtagFunction = (...args: unknown[]) => void;

type PlanoDisponivel = {
  id: number;
  nome: string;
  ativo: boolean;
  descricao: string | null;
  recursos: string[];
  valorMensal: number | null;
  valorAnual: number | null;
  precoMensal: string | null;
  precoAnual: string | null;
  descontoAnualPercentual: number | null;
  economiaAnualFormatada: string | null;
};

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
});

const normalizeApiRows = (data: unknown): unknown[] => {
  if (Array.isArray(data)) {
    return data;
  }

  if (data && typeof data === "object") {
    const rows = (data as { rows?: unknown[] }).rows;
    if (Array.isArray(rows)) {
      return rows;
    }

    const nested = (data as { data?: unknown }).data;
    if (Array.isArray(nested)) {
      return nested;
    }

    if (nested && typeof nested === "object") {
      const nestedRows = (nested as { rows?: unknown[] }).rows;
      if (Array.isArray(nestedRows)) {
        return nestedRows;
      }
    }
  }

  return [];
};

const toNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const sanitized = trimmed.replace(/[^\d,.-]/g, "").replace(/\.(?=.*\.)/g, "");
    const normalized = sanitized.replace(",", ".");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }

  return null;
};

const parseRecursos = (value: unknown): string[] => {
  const seen = new Set<string>();
  const seenObjects = new Set<object>();
  const result: string[] = [];

  const add = (entry: string) => {
    const normalized = entry.trim();
    if (!normalized) {
      return;
    }

    if (seen.has(normalized)) {
      return;
    }

    seen.add(normalized);
    result.push(normalized);
  };

  const visit = (input: unknown) => {
    if (!input) {
      return;
    }

    if (typeof input === "string") {
      if (!input.trim()) {
        return;
      }

      const segments = input
        .split(/[\n•·\-–;]+/)
        .map((segment) => segment.trim())
        .filter(Boolean);

      if (segments.length === 0) {
        add(input);
        return;
      }

      segments.forEach(add);
      return;
    }

    if (Array.isArray(input)) {
      input.forEach(visit);
      return;
    }

    if (typeof input === "object") {
      if (seenObjects.has(input as object)) {
        return;
      }

      seenObjects.add(input as object);
      const record = input as Record<string, unknown>;
      const candidateKeys = [
        "disponiveis",
        "disponiveisPersonalizados",
        "available",
        "availableFeatures",
        "inclusos",
        "incluidos",
        "lista",
        "items",
        "features",
        "recursosDisponiveis",
        "recursos_disponiveis",
        "recursos",
        "modulos",
        "modules",
        "rows",
        "data",
        "values",
        "value",
      ];

      const excludedPattern = /(indispon|unavailable|exclu|negad)/i;
      let matchedCandidate = false;

      for (const key of candidateKeys) {
        if (key in record) {
          matchedCandidate = true;
          visit(record[key]);
        }
      }

      if (!matchedCandidate) {
        for (const [key, entry] of Object.entries(record)) {
          if (excludedPattern.test(key)) {
            continue;
          }

          if (/^\d+$/.test(key)) {
            visit(entry);
          }
        }
      }
    }
  };

  visit(value);

  return result;
};

const getGtag = (): GtagFunction | undefined => {
  if (typeof window === "undefined") {
    return undefined;
  }

  return (window as typeof window & { gtag?: GtagFunction }).gtag;
};

const CRM = () => {
  const { data: service, isLoading: isServiceLoading, isError: isServiceError } = useServiceBySlug("crm");

  const generalFeatures = useMemo(
    () => [
      {
        icon: Zap,
        title: "Automação Inteligente",
        description:
          "Automatize cadastros, follow-ups e fluxos de relacionamento com regras configuráveis e integrações nativas.",
      },
      {
        icon: MessageSquare,
        title: "Atendimento Omnicanal",
        description:
          "Converse com clientes por e-mail, telefone, WhatsApp e chatbots em uma visão unificada da jornada.",
      },
      {
        icon: BarChart3,
        title: "BI & Insights",
        description:
          "Dashboards em tempo real com indicadores de performance comercial, produtividade e previsibilidade de receita.",
      },
      {
        icon: Shield,
        title: "Segurança Corporativa",
        description:
          "Criptografia ponta a ponta, controles de acesso granulares e infraestrutura hospedada em nuvem brasileira.",
      },
    ],
    [],
  );

  const featureCards = useMemo(() => {
    if (!service?.features?.length) {
      return generalFeatures;
    }

    return service.features.map((featureText, index) => {
      const [titlePart, descriptionPart] = featureText.split("|").map((part) => part.trim());
      const fallback = generalFeatures[index % generalFeatures.length];
      return {
        icon: fallback.icon,
        title: titlePart?.length ? titlePart : fallback.title,
        description: descriptionPart?.length ? descriptionPart : service.description ?? fallback.description,
      };
    });
  }, [generalFeatures, service]);

  const heroLabel = service?.title ?? "Suíte Completa de CRM Jus Connect";
  const heroHeadline = service?.summary ?? "Relacionamentos Inteligentes em Todos os Canais";
  const heroDescription =
    service?.description ??
    "Estruture jornadas personalizadas, automatize o contato com clientes e tenha visibilidade total do funil de vendas em uma plataforma moderna e segura.";

  const industries = [
    {
      icon: Scale,
      title: "Advocacia",
      description: "Gestão completa de processos, prazos e relacionamento com clientes e correspondentes.",
      highlights: ["Integração com tribunais", "Automação de prazos", "Geração de peças e contratos"],
    },
    {
      icon: Building2,
      title: "Mercado Imobiliário",
      description: "Gestão de funil de vendas, propostas e pós-venda para construtoras e imobiliárias.",
      highlights: ["Integração com portais", "Controle de documentos", "Follow-up automático"],
    },
  ];

  const lawDifferentials = [
    {
      icon: Users,
      title: "Gestão de Clientes e Casos",
      description: "Dossiês completos com histórico de atendimento, honorários e documentos vinculados."
    },
    {
      icon: FileText,
      title: "Automação de Peças",
      description: "Modelos inteligentes que preenchem dados de processos e geram peças em poucos cliques."
    },
    {
      icon: Workflow,
      title: "Fluxos de Prazos",
      description: "Alertas automáticos e redistribuição de tarefas conforme SLA e especialidade jurídica."
    },
    {
      icon: Layers,
      title: "Controle Financeiro",
      description: "Painéis de receitas recorrentes, adiantamentos e divisão de honorários por sócio."
    }
  ];

  const successMetrics = [
    "Redução média de 45% no tempo de atualização de processos",
    "Aumento de 60% na taxa de conversão de leads jurídicos",
    "Visão 360º da carteira com relatórios executivos semanais",
    "Suporte especializado com onboarding em até 14 dias"
  ];

  const apiBaseUrl = getApiBaseUrl();
  const [planosDisponiveis, setPlanosDisponiveis] = useState<PlanoDisponivel[]>([]);
  const [planosLoading, setPlanosLoading] = useState(true);
  const [planosError, setPlanosError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadPlans = async () => {
      setPlanosLoading(true);
      setPlanosError(null);

      try {
        const response = await fetch(joinUrl(apiBaseUrl, "/api/planos"), {
          headers: { Accept: "application/json" },
        });

        if (!response.ok) {
          throw new Error(`Falha ao carregar planos (HTTP ${response.status})`);
        }

        const payload = await response.json();
        const rows = normalizeApiRows(payload);

        const parsed = rows
          .map((entry) => {
            const raw = entry as Record<string, unknown>;
            const id = toNumber(raw.id);
            if (id === null) {
              return null;
            }

            const nome = typeof raw.nome === "string" ? raw.nome.trim() : null;
            const ativo = typeof raw.ativo === "boolean" ? raw.ativo : true;
            const descricaoRaw =
              typeof raw.descricao === "string"
                ? raw.descricao.trim()
                : typeof raw.detalhes === "string"
                  ? raw.detalhes.trim()
                  : null;

            const recursos = parseRecursos([
              raw.recursos,
              raw.recursosDisponiveis,
              raw.recursos_disponiveis,
              raw.features,
              raw.items,
              raw.lista,
              raw.modulos,
              raw.modules,
              raw.recursosPersonalizados,
              raw.customResources,
            ]);

            const valorMensal = toNumber(
              raw.valor_mensal ?? raw.valorMensal ?? raw.preco_mensal ?? raw.precoMensal,
            );
            const valorAnual = toNumber(
              raw.valor_anual ?? raw.valorAnual ?? raw.preco_anual ?? raw.precoAnual,
            );

            const precoMensal =
              typeof raw.preco_mensal === "string" && raw.preco_mensal.trim()
                ? raw.preco_mensal.trim()
                : typeof raw.precoMensal === "string" && raw.precoMensal.trim()
                  ? raw.precoMensal.trim()
                  : valorMensal !== null
                    ? currencyFormatter.format(valorMensal)
                    : null;

            const precoAnual =
              typeof raw.preco_anual === "string" && raw.preco_anual.trim()
                ? raw.preco_anual.trim()
                : typeof raw.precoAnual === "string" && raw.precoAnual.trim()
                  ? raw.precoAnual.trim()
                  : valorAnual !== null
                    ? currencyFormatter.format(valorAnual)
                    : null;

            let descontoPercentual: number | null = null;
            let economiaAnualFormatada: string | null = null;

            if (valorMensal !== null && valorAnual !== null) {
              const totalMensal = valorMensal * 12;
              if (totalMensal > 0) {
                const economia = Math.max(0, totalMensal - valorAnual);
                if (economia > 0) {
                  const roundedEconomia = Math.round(economia * 100) / 100;
                  economiaAnualFormatada = currencyFormatter.format(roundedEconomia);
                  const percentual = Math.round((roundedEconomia / totalMensal) * 100);
                  descontoPercentual = Number.isFinite(percentual) && percentual > 0 ? percentual : null;
                }
              }
            }

            const plan: PlanoDisponivel = {
              id,
              nome: nome ?? `Plano ${id}`,
              ativo,
              descricao: descricaoRaw,
              recursos,
              valorMensal,
              valorAnual,
              precoMensal,
              precoAnual,
              descontoAnualPercentual: descontoPercentual,
              economiaAnualFormatada,
            };

            return plan;
          })
          .filter((plan): plan is PlanoDisponivel => plan !== null);

        if (!cancelled) {
          setPlanosDisponiveis(parsed);
        }
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setPlanosError(error instanceof Error ? error.message : "Não foi possível carregar os planos.");
          setPlanosDisponiveis([]);
        }
      } finally {
        if (!cancelled) {
          setPlanosLoading(false);
        }
      }
    };

    void loadPlans();

    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl]);

  const planosAtivos = useMemo(() => planosDisponiveis.filter((plan) => plan.ativo), [planosDisponiveis]);

  const planosOrdenados = useMemo(() => {
    if (planosAtivos.length === 0) {
      return [];
    }

    return [...planosAtivos].sort((a, b) => {
      const valorA = a.valorMensal ?? (a.valorAnual !== null ? a.valorAnual / 12 : Number.POSITIVE_INFINITY);
      const valorB = b.valorMensal ?? (b.valorAnual !== null ? b.valorAnual / 12 : Number.POSITIVE_INFINITY);
      return valorA - valorB;
    });
  }, [planosAtivos]);

  const destaquePlanoId = useMemo(() => {
    if (planosOrdenados.length === 0) {
      return null;
    }

    const destaque = planosOrdenados.reduce((acc, plan) => {
      const accValor = acc.valorMensal ?? (acc.valorAnual !== null ? acc.valorAnual / 12 : 0);
      const planValor = plan.valorMensal ?? (plan.valorAnual !== null ? plan.valorAnual / 12 : 0);
      return planValor > accValor ? plan : acc;
    }, planosOrdenados[0]);

    return destaque.id;
  }, [planosOrdenados]);

  const handleDemoClick = (source: string) => {
    const gtag = getGtag();
    gtag?.("event", "crm_demo_click", {
      service: "crm",
      source
    });
    document.getElementById("contato")?.scrollIntoView({ behavior: "smooth" });
  };

  const handleWhatsappClick = (source: string) => {
    const gtag = getGtag();
    gtag?.("event", "crm_whatsapp_click", {
      service: "crm",
      source
    });
    window.open("https://wa.me/553193054200?text=Olá! Gostaria de saber mais sobre a suíte de CRMs do Jus Connect.", "_blank");
  };

  return (
    <div className="min-h-screen bg-background">
      <TypebotBubble />
      <Header />

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-24 pb-20 bg-gradient-hero text-white">
        <div className="absolute inset-0 bg-grid-pattern opacity-20"></div>
        <div className="absolute -top-32 -left-32 w-72 h-72 bg-quantum-cyan/30 blur-3xl rounded-full animate-pulse-slow"></div>
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-quantum-bright/20 blur-3xl rounded-full animate-float-slow"></div>
        <div className="container px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center px-4 py-2 mb-6 text-sm font-medium rounded-full bg-white/15 backdrop-blur animate-pulse-glow">
              <Sparkle className="h-4 w-4 mr-2" />
              {heroLabel}
            </div>
            <h1 className="text-5xl md:text-7xl font-bold mb-6 animate-fade-in">{heroHeadline}</h1>
            <p className="text-xl md:text-2xl text-white/90 mb-8 leading-relaxed">{heroDescription}</p>
            <div className="flex flex-wrap justify-center gap-4">
              <Button
                variant="quantum"
                size="xl"
                className="track-link shadow-quantum"
                onClick={() => handleDemoClick("hero")}
              >
                Solicitar Demonstração
                <ArrowRight className="h-5 w-5 ml-2" />
              </Button>
              <Button
                variant="outline_quantum"
                size="xl"
                className="bg-white/15 border-white/30 text-white hover:bg-white hover:text-quantum-deep track-link"
                onClick={() => handleWhatsappClick("hero")}
              >
                Falar no WhatsApp
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* General Features */}
      <section className="py-20 bg-background">
        <div className="container px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-quantum bg-clip-text text-transparent">
              Recursos que Potencializam seu Time
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Operações modernas precisam de automação, dados confiáveis e atendimento conectado. Nossa suíte de CRM entrega isso desde o primeiro dia.
            </p>
          </div>
          {isServiceError && (
            <div className="mb-8 rounded-lg border border-amber-200/60 bg-amber-50/10 p-4 text-sm text-amber-200 text-center">
              Não foi possível carregar os recursos personalizados do CRM. Exibindo a versão padrão.
            </div>
          )}

          {isServiceLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {Array.from({ length: 4 }).map((_, index) => (
                <Card key={index} className="bg-gradient-card border-quantum-light/20">
                  <CardHeader>
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <Skeleton className="h-6 w-2/3" />
                    <Skeleton className="h-4 w-full" />
                  </CardHeader>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {featureCards.map((feature, index) => (
                <Card
                  key={feature.title + index}
                  className="bg-gradient-card border-quantum-light/20 hover:shadow-quantum transition-all duration-300 group hover:-translate-y-2 animate-float"
                  style={{ animationDelay: `${index * 0.15}s` }}
                >
                  <CardHeader>
                    <div className="p-4 rounded-full bg-gradient-quantum w-fit mb-4 group-hover:scale-110 transition-transform duration-300">
                      <feature.icon className="h-6 w-6 text-white" />
                    </div>
                    <CardTitle className="text-xl group-hover:text-quantum-bright transition-colors">
                      {feature.title}
                    </CardTitle>
                    <CardDescription className="text-muted-foreground">
                      {feature.description}
                    </CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Industries Section */}
      <section className="py-20 bg-gradient-to-br from-quantum-light/20 to-background">
        <div className="container px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-quantum bg-clip-text text-transparent">
              Especializado em Segmentos Estratégicos
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Operações jurídicas e imobiliárias contam com fluxos prontos, integrações profundas e relatórios sob medida para
              acelerar resultados desde o primeiro mês.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {industries.map((industry) => (
              <Card
                key={industry.title}
                className="border-quantum-light/20 bg-background/60 backdrop-blur hover:border-quantum-bright/40 transition-all duration-300 hover:-translate-y-2 hover:shadow-quantum"
              >
                <CardHeader>
                  <div className="p-4 rounded-full bg-gradient-quantum w-fit mb-4">
                    <industry.icon className="h-6 w-6 text-white" />
                  </div>
                  <CardTitle className="text-2xl">{industry.title}</CardTitle>
                  <CardDescription className="text-muted-foreground">
                    {industry.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {industry.highlights.map((item) => (
                      <div key={item} className="flex items-start space-x-3">
                        <CheckCircle2 className="h-5 w-5 text-quantum-bright flex-shrink-0 mt-0.5" />
                        <span className="text-sm text-muted-foreground">{item}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Highlight Section for Legal CRM */}
      <section className="py-20 bg-background relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
        <div className="container px-4 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center px-4 py-2 mb-6 text-sm font-medium rounded-full bg-gradient-quantum text-white animate-pulse-glow">
                <Scale className="h-4 w-4 mr-2" />
                CRM para Escritórios de Advocacia
              </div>
              <h2 className="text-4xl md:text-5xl font-bold mb-6">
                Especialistas em Gestão Jurídica Digital
              </h2>
              <p className="text-lg text-muted-foreground mb-8">
                Com mais de uma década acompanhando escritórios de diferentes portes, desenvolvemos um CRM que une gestão de processos, atendimento consultivo e inteligência financeira em uma única plataforma.
              </p>
              <div className="space-y-10 mb-10">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {lawDifferentials.map((item) => (
                    <Card key={item.title} className="border-quantum-light/20 hover:border-quantum-bright/40 transition-all duration-300 hover:-translate-y-1">
                      <CardHeader className="pb-3">
                        <div className="p-3 rounded-full bg-gradient-quantum w-fit mb-3">
                          <item.icon className="h-5 w-5 text-white" />
                        </div>
                        <CardTitle className="text-lg">{item.title}</CardTitle>
                        <CardDescription className="text-muted-foreground text-sm">
                          {item.description}
                        </CardDescription>
                      </CardHeader>
                    </Card>
                  ))}
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <h3 className="text-2xl font-semibold">Planos disponíveis para escritórios</h3>
                    <p className="text-sm text-muted-foreground">
                      Compare modalidades, benefícios e encontre o pacote ideal para o seu time jurídico.
                    </p>
                  </div>

                  {planosLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {[0, 1].map((index) => (
                        <Card
                          key={index}
                          className="border-quantum-light/20 bg-background/60 backdrop-blur"
                        >
                          <CardHeader className="space-y-4">
                            <Skeleton className="h-5 w-1/3" />
                            <Skeleton className="h-8 w-1/2" />
                            <Skeleton className="h-4 w-full" />
                          </CardHeader>
                          <CardContent className="space-y-4">
                            {[0, 1, 2].map((item) => (
                              <div key={item} className="flex items-start gap-3">
                                <Skeleton className="h-4 w-4 rounded-full" />
                                <Skeleton className="h-4 w-full" />
                              </div>
                            ))}
                          </CardContent>
                          <CardFooter>
                            <Skeleton className="h-10 w-full rounded-full" />
                          </CardFooter>
                        </Card>
                      ))}
                    </div>
                  ) : planosOrdenados.length > 0 ? (
                    <Carousel className="relative">
                      <CarouselContent>
                        {planosOrdenados.map((plan) => (
                          <CarouselItem key={plan.id} className="md:basis-1/2 lg:basis-1/3">
                            <Card
                              className={`relative flex h-full flex-col border-quantum-light/20 bg-background/70 backdrop-blur transition-all duration-300 hover:-translate-y-2 hover:border-quantum-bright/40 hover:shadow-quantum ${
                                destaquePlanoId === plan.id ? "border-quantum-bright/60 shadow-quantum" : ""
                              }`}
                            >
                              {destaquePlanoId === plan.id && (
                                <span className="absolute top-4 right-4 rounded-full bg-gradient-quantum px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
                                  Mais completo
                                </span>
                              )}
                              <CardHeader className="space-y-4">
                                <div className="space-y-2">
                                  <CardTitle className="text-2xl">{plan.nome}</CardTitle>
                                  {plan.descricao && (
                                    <CardDescription className="text-muted-foreground leading-relaxed">
                                      {plan.descricao}
                                    </CardDescription>
                                  )}
                                </div>
                                <div className="space-y-2">
                                  {plan.precoMensal && (
                                    <div className="flex items-baseline gap-2">
                                      <span className="text-3xl font-bold text-quantum-bright">
                                        {plan.precoMensal}
                                      </span>
                                      <span className="text-sm text-muted-foreground">/mês</span>
                                    </div>
                                  )}
                                  {plan.precoAnual && (
                                    <p className="text-sm text-muted-foreground">
                                      Plano anual: {plan.precoAnual}
                                      {plan.descontoAnualPercentual !== null
                                        ? ` • até ${plan.descontoAnualPercentual}% de economia`
                                        : plan.economiaAnualFormatada
                                          ? ` • Economize ${plan.economiaAnualFormatada}`
                                          : ""}
                                    </p>
                                  )}
                                  {!plan.precoMensal && !plan.precoAnual && (
                                    <p className="text-sm text-muted-foreground">Investimento sob consulta.</p>
                                  )}
                                </div>
                              </CardHeader>
                              <CardContent className="flex flex-1 flex-col gap-4">
                                <div className="space-y-3">
                                  <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                                    Principais benefícios
                                  </p>
                                  <ul className="space-y-2">
                                    {plan.recursos.length > 0 ? (
                                      plan.recursos.slice(0, 6).map((feature) => (
                                        <li key={feature} className="flex items-start gap-3 text-sm text-muted-foreground">
                                          <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-quantum-bright" />
                                          <span>{feature}</span>
                                        </li>
                                      ))
                                    ) : (
                                      <li className="text-sm text-muted-foreground">
                                        Personalize o pacote com nossos especialistas para incluir os recursos desejados.
                                      </li>
                                    )}
                                  </ul>
                                </div>
                              </CardContent>
                              <CardFooter className="mt-auto flex flex-col gap-3">
                                <Button
                                  variant="quantum"
                                  className="w-full track-link"
                                  onClick={() => handleDemoClick(`plan_${plan.id}`)}
                                >
                                  Solicitar proposta
                                  <ArrowRight className="h-5 w-5 ml-2" />
                                </Button>
                                <Button
                                  variant="outline_quantum"
                                  className="w-full track-link"
                                  onClick={() => handleWhatsappClick(`plan_${plan.id}`)}
                                >
                                  Falar no WhatsApp
                                </Button>
                              </CardFooter>
                            </Card>
                          </CarouselItem>
                        ))}
                      </CarouselContent>
                      <CarouselPrevious className="hidden md:flex" />
                      <CarouselNext className="hidden md:flex" />
                    </Carousel>
                  ) : (
                    <Card className="border-dashed border-quantum-light/40 bg-background/60 backdrop-blur">
                      <CardContent className="p-6 space-y-4">
                        <p className="text-sm text-muted-foreground">
                          {planosError ??
                            "Nenhum plano público cadastrado no momento. Entre em contato para receber uma proposta personalizada."}
                        </p>
                        <div className="flex flex-wrap gap-3">
                          <Button
                            variant="quantum"
                            className="track-link"
                            onClick={() => handleDemoClick("planos_vazios")}
                          >
                            Solicitar atendimento
                            <ArrowRight className="h-5 w-5 ml-2" />
                          </Button>
                          <Button
                            variant="outline_quantum"
                            className="track-link"
                            onClick={() => handleWhatsappClick("planos_vazios")}
                          >
                            Falar no WhatsApp
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-4">
                <Button variant="quantum" size="lg" className="track-link" onClick={() => handleDemoClick("legal_section")}>
                  Solicitar Demonstração
                  <ArrowRight className="h-5 w-5 ml-2" />
                </Button>
                <Button
                  variant="outline_quantum"
                  size="lg"
                  className="track-link"
                  onClick={() => handleWhatsappClick("legal_section")}
                >
                  Falar no WhatsApp
                </Button>
                <Button variant="outline_quantum" size="lg" className="track-link" asChild>
                  <a href="/servicos/crm/advocacia">Conheça o CRM para Advocacia</a>
                </Button>
              </div>
            </div>
            <Card className="bg-gradient-quantum text-white border-0 shadow-quantum">
              <CardContent className="p-8 space-y-6">
                <h3 className="text-2xl font-bold">Principais ganhos para seu escritório</h3>
                <div className="space-y-4">
                  {successMetrics.map((metric) => (
                    <div key={metric} className="flex items-start space-x-3">
                      <CheckCircle2 className="h-5 w-5 text-white flex-shrink-0 mt-0.5" />
                      <span className="text-white/90">{metric}</span>
                    </div>
                  ))}
                </div>
                <div className="rounded-lg bg-white/15 p-6">
                  <h4 className="text-lg font-semibold mb-3">Implementação guiada</h4>
                  <p className="text-white/80">
                    Nossa equipe acompanha todas as etapas: migração de dados, personalização de fluxos, treinamento e indicadores estratégicos para a diretoria.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-br from-quantum-light/20 via-background to-background">
        <div className="container px-4">
          <Card className="bg-gradient-quantum text-white border-0 shadow-quantum max-w-4xl mx-auto">
            <CardContent className="p-12 text-center space-y-8">
              <h3 className="text-3xl md:text-4xl font-bold">
                Pronto para transformar a gestão de relacionamento da sua empresa?
              </h3>
              <p className="text-xl text-white/90 max-w-3xl mx-auto">
                Solicite uma demonstração personalizada e conheça na prática como o Jus Connect pode conectar equipes, clientes e resultados.
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <Button
                  variant="outline_quantum"
                  size="xl"
                  className="bg-white/20 border-white/30 text-white hover:bg-white hover:text-quantum-deep track-link"
                  onClick={() => handleDemoClick("cta_section")}
                >
                  Solicitar Demonstração
                  <ArrowRight className="h-5 w-5 ml-2" />
                </Button>
                <Button
                  variant="outline_quantum"
                  size="xl"
                  className="bg-white/20 border-white/30 text-white hover:bg-white hover:text-quantum-deep track-link"
                  onClick={() => handleWhatsappClick("cta_section")}
                >
                  Falar no WhatsApp
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default CRM;
