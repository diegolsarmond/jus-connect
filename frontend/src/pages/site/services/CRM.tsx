
import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import {
  ArrowRight,
  BarChart3,
  Building2,
  FileText,
  GraduationCap,
  Layers,
  MessageSquare,
  Shield,
  Stethoscope,
  Users,
  Workflow,
  Zap,
  Scale,
  Sparkle,
  CheckCircle2
} from "lucide-react";
import { useServiceBySlug } from "@/hooks/useServices";
import { Skeleton } from "@/components/ui/skeleton";

type GtagFunction = (...args: unknown[]) => void;

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

  const heroLabel = service?.title ?? "Suíte Completa de CRM Quantum";
  const heroHeadline = service?.summary ?? "Relacionamentos Inteligentes em Todos os Canais";
  const heroDescription =
    service?.description ??
    "Estruture jornadas personalizadas, automatize o contato com clientes e tenha visibilidade total do funil de vendas em uma plataforma moderna e segura.";

  const industries = [
    {
      icon: Scale,
      title: "Advocacia",
      description: "Gestão completa de processos, prazos e relacionamento com clientes e correspondentes.",
      highlights: ["Integração com tribunais", "Automação de prazos", "Geração de peças e contratos"]
    },
    {
      icon: Stethoscope,
      title: "Saúde",
      description: "Conecte atendimento, faturamento e equipes multidisciplinares em uma única visão do paciente.",
      highlights: ["Agenda unificada", "Protocolos personalizados", "Fluxos de autorização"]
    },
    {
      icon: GraduationCap,
      title: "Educação",
      description: "Acompanhe leads, matrículas e retenção em jornadas personalizadas por campus ou unidade.",
      highlights: ["Automação de onboarding", "Cobrança recorrente", "Comissão por turma"]
    },
    {
      icon: Building2,
      title: "Mercado Imobiliário",
      description: "Gestão de funil de vendas, propostas e pós-venda para construtoras e imobiliárias.",
      highlights: ["Integração com portais", "Controle de documentos", "Follow-up automático"]
    }
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
    window.open("https://wa.me/553193054200?text=Olá! Gostaria de saber mais sobre a suíte de CRMs da Quantum.", "_blank");
  };

  return (
    <div className="min-h-screen bg-background">
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
              Especializado em Diversos Segmentos
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Construímos experiências únicas para cada mercado com fluxos, integrações e relatórios sob medida.
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
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
                Solicite uma demonstração personalizada e conheça na prática como a Quantum pode conectar equipes, clientes e resultados.
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
