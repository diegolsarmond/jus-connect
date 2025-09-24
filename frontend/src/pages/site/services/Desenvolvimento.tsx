import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Code2, Smartphone, Globe, Database, ArrowRight, CheckCircle, Layers, Zap } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useServiceBySlug } from "@/hooks/useServices";
import { Skeleton } from "@/components/ui/skeleton";

const Desenvolvimento = () => {
  const { data: service, isLoading: isServiceLoading, isError: isServiceError } = useServiceBySlug("desenvolvimento");

  const technologies = [
    {
      icon: Globe,
      title: "Aplicações Web",
      description: "Sistemas web modernos e responsivos utilizando React, Vue.js e tecnologias de ponta."
    },
    {
      icon: Smartphone,
      title: "Apps Mobile",
      description: "Aplicativos nativos e híbridos para iOS e Android com performance otimizada."
    },
    {
      icon: Database,
      title: "APIs e Backend",
      description: "Desenvolvimento de APIs robustas e escaláveis com arquitetura moderna."
    },
    {
      icon: Layers,
      title: "Arquitetura Cloud",
      description: "Soluções em nuvem com AWS, Azure e Google Cloud para máxima disponibilidade."
    }
  ];

  const fallbackSolutions = useMemo(
    () => [
    {
      title: "Sistemas de Gestão (ERP/CRM)",
      description: "Plataformas completas para gestão empresarial",
      features: ["Módulos personalizados", "Integrações complexas", "Relatórios avançados", "Multi-tenant"]
    },
    {
      title: "E-commerce Personalizado",
      description: "Lojas virtuais com funcionalidades exclusivas",
      features: ["Gateway de pagamento", "Gestão de estoque", "Marketing automation", "Analytics avançado"]
    },
    {
      title: "Plataformas Educacionais",
      description: "LMS e sistemas de ensino à distância",
      features: ["Gestão de cursos", "Videoconferência", "Gamificação", "Certificações"]
    },
    {
      title: "Fintech e Payments",
      description: "Soluções financeiras e sistemas de pagamento",
      features: ["Open Banking", "PIX integrado", "Compliance", "Segurança bancária"]
    },
  ],
    [],
  );

  const solutionCards = useMemo(() => {
    if (!service?.features?.length) {
      return fallbackSolutions;
    }

    return service.features.map((featureText, index) => {
      const parts = featureText.split("|").map((part) => part.trim());
      const [titlePart, descriptionPart, featuresPart] = parts;
      const fallback = fallbackSolutions[index % fallbackSolutions.length];
      const parsedFeatures = featuresPart
        ? featuresPart.split(";").map((feature) => feature.trim()).filter(Boolean)
        : fallback.features;
      return {
        title: titlePart?.length ? titlePart : fallback.title,
        description: descriptionPart?.length ? descriptionPart : service.description ?? fallback.description,
        features: parsedFeatures.length ? parsedFeatures : fallback.features,
      };
    });
  }, [fallbackSolutions, service]);

  const heroLabel = service?.title ?? "Desenvolvimento Sob Medida";
  const heroHeadline = service?.summary ?? "Software Personalizado para seu Negócio";
  const heroDescription =
    service?.description ??
    "Desenvolvemos soluções de software únicas e escaláveis, perfeitamente alinhadas com seus processos e objetivos de negócio.";

  const process = [
    {
      step: "1",
      title: "Descoberta e Planejamento",
      description: "Análise detalhada dos requisitos e definição da arquitetura"
    },
    {
      step: "2", 
      title: "Design e Prototipação",
      description: "Criação de wireframes, protótipos e design da interface"
    },
    {
      step: "3",
      title: "Desenvolvimento Ágil",
      description: "Desenvolvimento iterativo com entregas frequentes"
    },
    {
      step: "4",
      title: "Testes e Deploy",
      description: "Testes automatizados, homologação e lançamento"
    },
    {
      step: "5",
      title: "Manutenção e Evolução",
      description: "Suporte contínuo e novas funcionalidades"
    }
  ];

  const benefits = [
    "Código limpo e documentado seguindo best practices",
    "Arquitetura escalável preparada para crescimento",
    "Testes automatizados garantindo qualidade",
    "Deploy automatizado com CI/CD",
    "Monitoramento e observabilidade integrados",
    "Suporte técnico especializado",
    "Documentação técnica completa",
    "Treinamento da equipe interna"
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
              <Code2 className="h-4 w-4 mr-2" />
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
                  gtag?.('event', 'project_consultation_click', {
                    service: 'desenvolvimento',
                  });
                  document.getElementById('contato')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                Consultoria de Projeto
                <ArrowRight className="h-5 w-5 ml-2" />
              </Button>
              <Button
                variant="outline_quantum"
                size="xl"
                className="bg-white/20 border-white/30 text-white hover:bg-white hover:text-quantum-deep track-link"
                onClick={() => {
                  const gtag = getGtag();
                  gtag?.('event', 'whatsapp_click', {
                    service: 'desenvolvimento',
                  });
                  window.open('https://wa.me/553193054200?text=Olá! Gostaria de saber mais sobre Desenvolvimento Sob Medida.', '_blank');
                }}
              >
                Falar no WhatsApp
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Technologies Section */}
      <section className="py-20 bg-background">
        <div className="container px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-quantum bg-clip-text text-transparent">
              Tecnologias de Ponta
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Utilizamos as melhores tecnologias do mercado para criar soluções robustas e modernas
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
            {technologies.map((tech, index) => (
              <Card 
                key={index} 
                className="bg-gradient-card border-quantum-light/20 hover:shadow-quantum transition-all duration-300 group hover:-translate-y-2 animate-float"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <CardHeader className="text-center">
                  <div className="p-4 rounded-full bg-gradient-quantum w-fit mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                    <tech.icon className="h-6 w-6 text-white" />
                  </div>
                  <CardTitle className="text-xl group-hover:text-quantum-bright transition-colors">
                    {tech.title}
                  </CardTitle>
                  <CardDescription className="text-muted-foreground">
                    {tech.description}
                  </CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>

          {/* Tech Stack */}
          <Card className="bg-gradient-quantum text-white border-0 shadow-quantum">
            <CardContent className="p-8">
              <h3 className="text-2xl font-bold mb-6 text-center">
                Stack Tecnológico
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
                <div>
                  <h4 className="font-semibold mb-2">Frontend</h4>
                  <p className="text-sm text-white/80">React, Vue.js, Angular, TypeScript</p>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Backend</h4>
                  <p className="text-sm text-white/80">Node.js, Python, .NET, PHP</p>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Mobile</h4>
                  <p className="text-sm text-white/80">React Native, Flutter, Swift, Kotlin</p>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Cloud</h4>
                  <p className="text-sm text-white/80">AWS, Azure, Google Cloud, Docker</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Services Section */}
      <section className="py-20 bg-gradient-to-br from-quantum-light/30 to-background">
        <div className="container px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-quantum bg-clip-text text-transparent">
              Soluções Especializadas
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Desenvolvemos sistemas complexos para diversos segmentos de mercado
            </p>
          </div>

          {isServiceError && (
            <div className="mb-8 rounded-lg border border-amber-200/60 bg-amber-50/10 p-4 text-sm text-amber-700">
              Não foi possível carregar as soluções configuradas. Exibindo a versão padrão.
            </div>
          )}

          {isServiceLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {Array.from({ length: 4 }).map((_, index) => (
                <Card key={index} className="bg-gradient-card border-quantum-light/20">
                  <CardHeader>
                    <Skeleton className="h-6 w-2/3" />
                    <Skeleton className="h-4 w-full" />
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {Array.from({ length: 4 }).map((__, idx) => (
                        <Skeleton key={idx} className="h-3 w-full" />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {solutionCards.map((solution, index) => (
                <Card
                  key={solution.title + index}
                  className="bg-gradient-card border-quantum-light/20 hover:shadow-quantum transition-all duration-300 group hover:-translate-y-2"
                >
                  <CardHeader>
                    <CardTitle className="text-xl group-hover:text-quantum-bright transition-colors">
                      {solution.title}
                    </CardTitle>
                    <CardDescription className="text-muted-foreground">
                      {solution.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {solution.features.map((feature) => (
                        <li key={feature} className="flex items-center space-x-2">
                          <CheckCircle className="h-4 w-4 text-quantum-bright flex-shrink-0" />
                          <span className="text-sm text-muted-foreground">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Process Section */}
      <section className="py-20 bg-background">
        <div className="container px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-quantum bg-clip-text text-transparent">
              Nosso Processo
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Metodologia ágil e transparente para garantir o sucesso do seu projeto
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-8 mb-16">
            {process.map((item, index) => (
              <Card 
                key={index} 
                className="bg-gradient-card border-quantum-light/20 hover:shadow-quantum transition-all duration-300 group hover:-translate-y-2 relative"
              >
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 rounded-full bg-gradient-quantum text-white flex items-center justify-center mx-auto mb-4 text-lg font-bold group-hover:scale-110 transition-transform duration-300">
                    {item.step}
                  </div>
                  <h3 className="font-semibold mb-2 group-hover:text-quantum-bright transition-colors">
                    {item.title}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {item.description}
                  </p>
                </CardContent>
                {index < process.length - 1 && (
                  <div className="hidden md:block absolute top-1/2 -right-4 transform -translate-y-1/2">
                    <ArrowRight className="h-6 w-6 text-quantum-bright" />
                  </div>
                )}
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h3 className="text-3xl font-bold mb-6 bg-gradient-quantum bg-clip-text text-transparent">
                Por que Escolher Desenvolvimento Personalizado?
              </h3>
              <div className="space-y-4">
                {benefits.map((benefit, index) => (
                  <div key={index} className="flex items-start space-x-3">
                    <CheckCircle className="h-6 w-6 text-quantum-bright flex-shrink-0 mt-0.5" />
                    <span className="text-foreground">{benefit}</span>
                  </div>
                ))}
              </div>
            </div>
            
            <Card className="bg-gradient-quantum text-white border-0 shadow-quantum">
              <CardContent className="p-8">
                <h3 className="text-2xl font-bold mb-6 text-center">
                  Garantias Incluídas
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <Zap className="h-5 w-5 text-white" />
                    <span>Entrega no prazo acordado</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <CheckCircle className="h-5 w-5 text-white" />
                    <span>Garantia de 6 meses</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Layers className="h-5 w-5 text-white" />
                    <span>Código fonte documentado</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Database className="h-5 w-5 text-white" />
                    <span>Backup e versionamento</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Globe className="h-5 w-5 text-white" />
                    <span>Suporte técnico incluso</span>
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
                Vamos Transformar sua Ideia em Realidade?
              </h3>
              <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto">
                Conte-nos sobre seu projeto e receba uma proposta detalhada 
                com prazo e investimento personalizados.
              </p>
              <div className="flex flex-wrap gap-4 justify-center">
                <Button
                  variant="outline_quantum"
                  size="xl"
                  className="bg-white/20 border-white/30 text-white hover:bg-white hover:text-quantum-deep track-link"
                  onClick={() => {
                    const gtag = getGtag();
                    gtag?.('event', 'contact_click', {
                      service: 'desenvolvimento',
                      source: 'cta_section',
                    });
                    window.location.href = '/#contato';
                  }}
                >
                  Solicitar Proposta
                  <ArrowRight className="h-5 w-5 ml-2" />
                </Button>
                <Button
                  variant="outline_quantum"
                  size="xl"
                  className="bg-white/20 border-white/30 text-white hover:bg-white hover:text-quantum-deep track-link"
                  onClick={() => {
                    const gtag = getGtag();
                    gtag?.('event', 'portfolio_request', {
                      service: 'desenvolvimento',
                    });
                    window.open('https://wa.me/553193054200?text=Olá! Gostaria de ver o portfólio de projetos da Quantum Tecnologia.', '_blank');
                  }}
                >
                  Ver Portfólio
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

export default Desenvolvimento;