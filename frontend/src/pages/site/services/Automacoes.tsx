import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings, Workflow, Timer, TrendingUp, ArrowRight, CheckCircle, Cog, Database } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useServiceBySlug } from "@/hooks/useServices";
import { Skeleton } from "@/components/ui/skeleton";
import { getGtag } from "@/lib/gtag";

const Automacoes = () => {
  const { data: service, isLoading: isServiceLoading, isError: isServiceError } = useServiceBySlug("automacoes");

  const fallbackFeatures = useMemo(
    () => [
      {
        icon: Workflow,
        title: "Workflows Inteligentes",
        description: "Criação de fluxos automatizados que se adaptam às necessidades do seu negócio.",
      },
      {
        icon: Timer,
        title: "Economia de Tempo",
        description: "Automatize tarefas repetitivas e libere sua equipe para atividades estratégicas.",
      },
      {
        icon: Database,
        title: "Integração de Sistemas",
        description: "Conecte diferentes plataformas e sistemas para uma operação unificada.",
      },
      {
        icon: TrendingUp,
        title: "Aumento de Produtividade",
        description: "Melhore a eficiência operacional com processos otimizados e automatizados.",
      },
      {
        icon: Cog,
        title: "Customização Total",
        description: "Soluções personalizadas que se adaptam perfeitamente ao seu modelo de negócio.",
      },
    ],
    [],
  );

  const featureCards = useMemo(() => {
    if (!service?.features?.length) {
      return fallbackFeatures;
    }

    return service.features.map((featureText, index) => {
      const [titlePart, descriptionPart] = featureText.split("|").map((part) => part.trim());
      const fallback = fallbackFeatures[index % fallbackFeatures.length];
      return {
        icon: fallback.icon,
        title: titlePart?.length ? titlePart : fallback.title,
        description: descriptionPart?.length ? descriptionPart : service.description ?? fallback.description,
      };
    });
  }, [fallbackFeatures, service]);

  const heroLabel = service?.title ?? "Automações Empresariais";
  const heroHeadline = service?.summary ?? "Automatize para Crescer";
  const heroDescription =
    service?.description ??
    "Transforme processos manuais em fluxos automatizados inteligentes. Aumente a eficiência, reduza custos e acelere o crescimento do seu negócio.";

  const automationTypes = [
    {
      title: "Automação de Email Marketing",
      description: "Campanhas automáticas baseadas no comportamento do cliente",
      benefits: ["Segmentação inteligente", "Envios programados", "Follow-up automático", "Análise de performance"]
    },
    {
      title: "Gestão de Leads",
      description: "Qualificação e distribuição automática de prospects", 
      benefits: ["Scoring automático", "Distribuição por regras", "Nutrição de leads", "Relatórios em tempo real"]
    },
    {
      title: "Processos Financeiros",
      description: "Automação de cobrança, faturamento e reconciliação",
      benefits: ["Cobrança automática", "Geração de relatórios", "Conciliação bancária", "Controle de inadimplência"]
    },
    {
      title: "Atendimento ao Cliente",
      description: "Fluxos automatizados para suporte e relacionamento",
      benefits: ["Triagem automática", "Respostas padronizadas", "Escalação inteligente", "Histórico unificado"]
    }
  ];

  const results = [
    "Redução de 60% no tempo gasto em tarefas manuais",
    "Aumento de 40% na produtividade da equipe", 
    "Diminuição de 80% nos erros operacionais",
    "ROI médio de 300% em 6 meses",
    "Melhoria de 50% na satisfação dos funcionários",
    "Economia média de R$ 25.000/mês por empresa"
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {/* Hero Section */}
      <section className="pt-24 pb-16 bg-gradient-hero relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern opacity-10"></div>
        <div className="container px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center text-white">
            <div className="inline-flex items-center px-4 py-2 rounded-full bg-white/20 text-sm font-medium mb-6 animate-pulse-glow">
              <Settings className="h-4 w-4 mr-2" />
              {heroLabel}
            </div>
            <h1 className="text-5xl md:text-7xl font-bold mb-6 animate-fade-in">{heroHeadline}</h1>
            <p className="text-xl md:text-2xl mb-8 text-white/90 max-w-3xl mx-auto leading-relaxed">{heroDescription}</p>
            <div className="flex flex-wrap gap-4 justify-center">
              <Button
                variant="outline_quantum"
                size="xl"
                className="bg-white/20 border-white/30 text-white hover:bg-white hover:text-quantum-deep track-link"
                onClick={() => {
                  const gtag = getGtag();
                  gtag?.('event', 'automation_analysis_click', {
                    service: 'automacoes',
                  });
                  document.getElementById('contato')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                Análise Gratuita de Processos
                <ArrowRight className="h-5 w-5 ml-2" />
              </Button>
              <Button
                variant="outline_quantum"
                size="xl"
                className="bg-white/20 border-white/30 text-white hover:bg-white hover:text-quantum-deep track-link"
                onClick={() => {
                  const gtag = getGtag();
                  gtag?.('event', 'whatsapp_click', {
                    service: 'automacoes',
                  });
                  window.open('https://wa.me/553193054200?text=Olá! Gostaria de saber mais sobre Automações Empresariais.', '_blank');
                }}
              >
                Falar no WhatsApp
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-background">
        <div className="container px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-quantum bg-clip-text text-transparent">
              Por que Automatizar?
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Liberte sua equipe de tarefas repetitivas e foque no que realmente importa para o crescimento
            </p>
          </div>

          {isServiceError && (
            <div className="mb-8 rounded-lg border border-amber-200/60 bg-amber-50/10 p-4 text-sm text-amber-200">
              Não foi possível carregar os destaques personalizados deste serviço. Exibindo a versão padrão.
            </div>
          )}

          {isServiceLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {Array.from({ length: 3 }).map((_, index) => (
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {featureCards.map((feature, index) => (
                <Card
                  key={feature.title + index}
                  className="bg-gradient-card border-quantum-light/20 hover:shadow-quantum transition-all duration-300 group hover:-translate-y-2 animate-float"
                  style={{ animationDelay: `${index * 0.1}s` }}
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

      {/* Automation Types Section */}
      <section className="py-20 bg-gradient-to-br from-quantum-light/30 to-background">
        <div className="container px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-quantum bg-clip-text text-transparent">
              Tipos de Automação
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Soluções personalizadas para cada área do seu negócio
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {automationTypes.map((type, index) => (
              <Card 
                key={index} 
                className="bg-gradient-card border-quantum-light/20 hover:shadow-quantum transition-all duration-300 group hover:-translate-y-2"
              >
                <CardHeader>
                  <CardTitle className="text-xl group-hover:text-quantum-bright transition-colors">
                    {type.title}
                  </CardTitle>
                  <CardDescription className="text-muted-foreground">
                    {type.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {type.benefits.map((benefit, benefitIndex) => (
                      <li key={benefitIndex} className="flex items-center space-x-2">
                        <CheckCircle className="h-4 w-4 text-quantum-bright flex-shrink-0" />
                        <span className="text-sm text-muted-foreground">{benefit}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Results Section */}
      <section className="py-20 bg-background">
        <div className="container px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-quantum bg-clip-text text-transparent">
                Resultados Garantidos
              </h2>
              <p className="text-xl text-muted-foreground mb-8">
                Nossos clientes experimentam transformações significativas com a 
                implementação de automações inteligentes.
              </p>
              <div className="space-y-4">
                {results.map((result, index) => (
                  <div key={index} className="flex items-start space-x-3">
                    <CheckCircle className="h-6 w-6 text-quantum-bright flex-shrink-0 mt-0.5" />
                    <span className="text-foreground font-medium">{result}</span>
                  </div>
                ))}
              </div>
            </div>
            
            <Card className="bg-gradient-quantum text-white border-0 shadow-quantum">
              <CardContent className="p-8">
                <h3 className="text-2xl font-bold mb-6 text-center">
                  Processo de Implementação
                </h3>
                <div className="space-y-6">
                  <div className="flex items-start space-x-4">
                    <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold">1</span>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-1">Análise de Processos</h4>
                      <p className="text-sm text-white/80">Mapeamento completo dos processos atuais</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-4">
                    <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold">2</span>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-1">Planejamento</h4>
                      <p className="text-sm text-white/80">Desenho da solução personalizada</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-4">
                    <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold">3</span>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-1">Implementação</h4>
                      <p className="text-sm text-white/80">Desenvolvimento e configuração das automações</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-4">
                    <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold">4</span>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-1">Treinamento</h4>
                      <p className="text-sm text-white/80">Capacitação da equipe e monitoramento</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-br from-quantum-light/30 to-background">
        <div className="container px-4">
          <Card className="bg-gradient-quantum text-white border-0 shadow-quantum max-w-4xl mx-auto">
            <CardContent className="p-12 text-center">
              <h3 className="text-3xl md:text-4xl font-bold mb-6">
                Pronto para Automatizar seus Processos?
              </h3>
              <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto">
                Comece com uma análise gratuita dos seus processos atuais e 
                descubra o potencial de automação do seu negócio.
              </p>
              <div className="flex flex-wrap gap-4 justify-center">
                <Button
                  variant="outline_quantum"
                  size="xl"
                  className="bg-white/20 border-white/30 text-white hover:bg-white hover:text-quantum-deep track-link"
                  onClick={() => {
                    const gtag = getGtag();
                    gtag?.('event', 'contact_click', {
                      service: 'automacoes',
                      source: 'cta_section',
                    });
                    window.location.href = '/#contato';
                  }}
                >
                  Análise Gratuita
                  <ArrowRight className="h-5 w-5 ml-2" />
                </Button>
                <Button
                  variant="outline_quantum"
                  size="xl"
                  className="bg-white/20 border-white/30 text-white hover:bg-white hover:text-quantum-deep track-link"
                  onClick={() => {
                    const gtag = getGtag();
                    gtag?.('event', 'case_study_request', {
                      service: 'automacoes',
                    });
                    window.open('https://wa.me/553193054200?text=Olá! Gostaria de ver cases de automação da Quantum Tecnologia.', '_blank');
                  }}
                >
                  Ver Cases de Sucesso
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

export default Automacoes;