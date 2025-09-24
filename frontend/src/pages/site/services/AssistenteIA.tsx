import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Bot, MessageSquare, Zap, BarChart3, Clock, Shield, ArrowRight, CheckCircle } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useServiceBySlug } from "@/hooks/useServices";
import { Skeleton } from "@/components/ui/skeleton";
import { getGtag } from "@/lib/gtag";

const AssistenteIA = () => {
  const { data: service, isLoading: isServiceLoading, isError: isServiceError } = useServiceBySlug("assistente-ia");

  const fallbackFeatures = useMemo(
    () => [
      {
        icon: MessageSquare,
        title: "Processamento Natural de Linguagem",
        description: "Compreende e responde em linguagem natural, proporcionando conversas fluidas e naturais.",
      },
      {
        icon: Clock,
        title: "Disponibilidade 24/7",
        description: "Atendimento ininterrupto para seus clientes, mesmo fora do horário comercial.",
      },
      {
        icon: Zap,
        title: "Respostas Instantâneas",
        description: "Elimina o tempo de espera com respostas imediatas e precisas.",
      },
      {
        icon: BarChart3,
        title: "Análise de Dados",
        description: "Coleta e analisa dados das conversas para insights estratégicos.",
      },
      {
        icon: Shield,
        title: "Segurança Total",
        description: "Proteção completa dos dados com criptografia de ponta a ponta.",
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
        description:
          descriptionPart?.length ? descriptionPart : service.description ?? fallback.description,
      };
    });
  }, [fallbackFeatures, service]);

  const heroLabel = service?.title ?? "Assistente Virtual com IA";
  const heroHeadline = service?.summary ?? "Atendimento Inteligente e Automatizado";
  const heroDescription =
    service?.description ??
    "Revolucione o atendimento ao cliente com assistentes virtuais alimentados por IA. Conversas naturais, respostas precisas e disponibilidade total.";

  const benefits = [
    "Redução de até 70% no volume de atendimento humano",
    "Aumento de 45% na satisfação do cliente",
    "Economia de até R$ 15.000/mês em custos operacionais",
    "Resolução instantânea de 80% das dúvidas frequentes",
    "Integração completa com WhatsApp, Telegram e site",
    "Personalização total para seu tipo de negócio"
  ];

  const useCases = [
    {
      title: "E-commerce",
      description: "Suporte para dúvidas sobre produtos, pedidos, entregas e políticas de troca."
    },
    {
      title: "Serviços Financeiros", 
      description: "Consultas de saldo, extrato, investimentos e orientações sobre produtos."
    },
    {
      title: "Saúde",
      description: "Agendamento de consultas, lembretes de medicação e informações gerais."
    },
    {
      title: "Educação",
      description: "Suporte acadêmico, matrículas, cronogramas e recursos de aprendizagem."
    }
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
              <Bot className="h-4 w-4 mr-2" />
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
                  gtag?.('event', 'demo_request', {
                    service: 'assistente_ia',
                  });
                  document.getElementById('contato')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                Solicitar Demonstração
                <ArrowRight className="h-5 w-5 ml-2" />
              </Button>
              <Button
                variant="outline_quantum"
                size="xl"
                className="bg-white/20 border-white/30 text-white hover:bg-white hover:text-quantum-deep track-link"
                onClick={() => {
                  const gtag = getGtag();
                  gtag?.('event', 'whatsapp_click', {
                    service: 'assistente_ia',
                  });
                  window.open('https://wa.me/553193054200?text=Olá! Gostaria de saber mais sobre o Assistente Virtual com IA.', '_blank');
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
              Recursos Avançados
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Tecnologia de ponta para criar a melhor experiência de atendimento automatizado
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
                <Card
                  key={index}
                  className="bg-gradient-card border-quantum-light/20"
                >
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

      {/* Benefits Section */}
      <section className="py-20 bg-gradient-to-br from-quantum-light/30 to-background">
        <div className="container px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-quantum bg-clip-text text-transparent">
                Resultados Comprovados
              </h2>
              <p className="text-xl text-muted-foreground mb-8">
                Nossos clientes experimentam transformações significativas em seus negócios 
                com a implementação de assistentes virtuais inteligentes.
              </p>
              <div className="space-y-4">
                {benefits.map((benefit, index) => (
                  <div key={index} className="flex items-start space-x-3">
                    <CheckCircle className="h-6 w-6 text-quantum-bright flex-shrink-0 mt-0.5" />
                    <span className="text-foreground font-medium">{benefit}</span>
                  </div>
                ))}
              </div>
            </div>
            
            <Card className="bg-gradient-quantum text-white border-0 shadow-quantum">
              <CardContent className="p-8">
                <h3 className="text-2xl font-bold mb-6 text-center">
                  Casos de Uso Principais
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {useCases.map((useCase, index) => (
                    <div key={index} className="text-center">
                      <h4 className="font-semibold mb-2">{useCase.title}</h4>
                      <p className="text-sm text-white/80">{useCase.description}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-background">
        <div className="container px-4">
          <Card className="bg-gradient-quantum text-white border-0 shadow-quantum max-w-4xl mx-auto">
            <CardContent className="p-12 text-center">
              <h3 className="text-3xl md:text-4xl font-bold mb-6">
                Pronto para Automatizar seu Atendimento?
              </h3>
              <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto">
                Transforme a experiência dos seus clientes com um assistente virtual 
                inteligente e personalizado para seu negócio.
              </p>
              <div className="flex flex-wrap gap-4 justify-center">
                <Button
                  variant="outline_quantum"
                  size="xl"
                  className="bg-white/20 border-white/30 text-white hover:bg-white hover:text-quantum-deep track-link"
                  onClick={() => {
                    const gtag = getGtag();
                    gtag?.('event', 'contact_click', {
                      service: 'assistente_ia',
                      source: 'cta_section',
                    });
                    window.location.href = '/#contato';
                  }}
                >
                  Solicitar Orçamento
                  <ArrowRight className="h-5 w-5 ml-2" />
                </Button>
                <Button
                  variant="outline_quantum"
                  size="xl"
                  className="bg-white/20 border-white/30 text-white hover:bg-white hover:text-quantum-deep track-link"
                  onClick={() => {
                    const gtag = getGtag();
                    gtag?.('event', 'demo_request', {
                      service: 'assistente_ia',
                      source: 'cta_section',
                    });
                    window.open('https://wa.me/553193054200?text=Olá! Gostaria de agendar uma demonstração do Assistente Virtual com IA.', '_blank');
                  }}
                >
                  Ver Demonstração
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

export default AssistenteIA;