import { useMemo } from "react";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  FileText,
  FolderCog,
  Gauge,
  Gavel,
  Layers,
  Link,
  MessageSquare,
  Scale,
  ShieldCheck,
  Users,
  Workflow
} from "lucide-react";
import { useServiceBySlug } from "@/hooks/useServices";
import { Skeleton } from "@/components/ui/skeleton";

const getGtag = () => {
  if (typeof window === "undefined") {
    return undefined;
  }

  return (window as typeof window & { gtag?: (...args: unknown[]) => void }).gtag;
};

const CRMAdvocacia = () => {
  const { data: service, isLoading: isServiceLoading, isError: isServiceError } = useServiceBySlug("crm/advocacia");

  const heroHighlights = useMemo(
    () => [
      {
        icon: ShieldCheck,
        title: "Compliance Automatizado",
        description: "Controle prazos, prorrogações e publicações com alertas inteligentes e trilhas de auditoria.",
      },
      {
        icon: Link,
        title: "Integração com Tribunais",
        description: "Sincronização diária com PJe, Eproc, Projudi e principais sistemas estaduais.",
      },
      {
        icon: Users,
        title: "Experiência do Cliente",
        description: "Portal exclusivo com atualização de casos, documentos e pagamentos em tempo real.",
      },
    ],
    [],
  );

  const highlightCards = useMemo(() => {
    if (!service?.features?.length) {
      return heroHighlights;
    }

    return service.features.map((featureText, index) => {
      const [titlePart, descriptionPart] = featureText.split("|").map((part) => part.trim());
      const fallback = heroHighlights[index % heroHighlights.length];
      return {
        icon: fallback.icon,
        title: titlePart?.length ? titlePart : fallback.title,
        description: descriptionPart?.length ? descriptionPart : service.description ?? fallback.description,
      };
    });
  }, [heroHighlights, service]);

  const heroLabel = service?.title ?? "CRM Especializado para Escritórios de Advocacia";
  const heroHeadline = service?.summary ?? "Controle absoluto dos seus processos, clientes e resultados";
  const heroDescription =
    service?.description ??
    "Uma plataforma criada por especialistas jurídicos para garantir produtividade, conformidade e excelência no relacionamento com o cliente.";

  const productivityMetrics = [
    {
      value: "-45%",
      label: "tempo na atualização de andamentos",
      description: "Robôs jurídicos capturam movimentações automaticamente e notificam o time responsável."
    },
    {
      value: "+60%",
      label: "taxa de conversão de novos clientes",
      description: "Funis dedicados para prospecção, onboarding e fidelização com follow-up automatizado."
    },
    {
      value: "14 dias",
      label: "para go-live completo",
      description: "Metodologia de implementação guiada por especialistas em operações jurídicas."
    }
  ];

  const modules = [
    {
      icon: FolderCog,
      title: "Gestão de Processos",
      description:
        "Organize processos cíveis, trabalhistas, tributários e consultivos com visões por fase, responsável e status.",
      features: ["Timeline com publicações", "Controle de tarefas", "Modelos de peças e contratos"]
    },
    {
      icon: MessageSquare,
      title: "Atendimento Omnicanal",
      description:
        "Integre WhatsApp, e-mail e telefone em conversas registradas automaticamente no dossiê do cliente.",
      features: ["Respostas assistidas por IA", "Scripts personalizados", "Portal do cliente"]
    },
    {
      icon: FileText,
      title: "Documentos Inteligentes",
      description:
        "Geração de petições, contratos e relatórios com dados dinâmicos, assinatura eletrônica e versionamento.",
      features: ["Modelos parametrizados", "Assinatura integrada", "Organização por pastas"]
    },
    {
      icon: Gauge,
      title: "Performance Financeira",
      description:
        "Acompanhe honorários, provisões, adiantamentos e repasses com dashboards prontos para sócios.",
      features: ["Fluxo de caixa jurídico", "Rateio por centro de custo", "Alertas de inadimplência"]
    }
  ];

  const automationFlows = [
    {
      icon: Workflow,
      title: "Fluxos Processuais Automatizados",
      description:
        "Dispare tarefas e notificações com base em eventos processuais, prazos e metas estratégicas do escritório."
    },
    {
      icon: CalendarClock,
      title: "Agenda e Prazos Integrados",
      description:
        "Visualize audiências, compromissos e prazos críticos em uma agenda compartilhada com alertas multicanal."
    },
    {
      icon: Layers,
      title: "Gestão por Áreas e Filiais",
      description:
        "Defina fluxos específicos por área de atuação, controlando permissões e indicadores de cada unidade."
    }
  ];

  const plans = [
    {
      name: "Starter Jurídico",
      price: "A partir de R$ 499/mês",
      description: "Ideal para escritórios boutique e equipes enxutas em fase de estruturação digital.",
      features: [
        "Até 10 usuários inclusos",
        "Integração com PJe e Projudi",
        "Automação básica de prazos",
        "Suporte via chat comercial"
      ]
    },
    {
      name: "Professional",
      price: "A partir de R$ 899/mês",
      description: "Para bancas em crescimento que precisam de eficiência operacional e previsibilidade.",
      featured: true,
      features: [
        "Usuários ilimitados",
        "Fluxos automatizados avançados",
        "BI jurídico com dashboards executivos",
        "Suporte prioritário e onboarding assistido"
      ]
    },
    {
      name: "Enterprise",
      price: "Sob consulta",
      description: "Projetado para departamentos jurídicos e redes com múltiplas unidades pelo país.",
      features: [
        "Arquitetura dedicada e SSO",
        "Integração com ERPs e SAP",
        "SLA sob medida",
        "Consultoria estratégica contínua"
      ]
    }
  ];

  const implementationSteps = [
    {
      title: "Diagnóstico Jurídico",
      description:
        "Mapeamos áreas de atuação, sistemas existentes e indicadores estratégicos para configurar o CRM sob medida."
    },
    {
      title: "Configuração Guiada",
      description:
        "Parametrização de pipelines, prazos, templates e automações com treinamento por núcleo jurídico."
    },
    {
      title: "Adoção e Performance",
      description:
        "Acompanhamento pós-go-live com revisão de indicadores, comitês de melhoria contínua e suporte especializado."
    }
  ];

  const supportHighlights = [
    "Especialistas em operações jurídicas disponíveis em horário estendido",
    "Central de conhecimento com playbooks por área de atuação",
    "Comunidade de clientes com benchmark exclusivo de indicadores"
  ];

  const handleDemoClick = (source: string) => {
    const gtag = getGtag();
    gtag?.("event", "crm_advocacia_demo_click", {
      service: "crm_advocacia",
      source
    });
    document.getElementById("contato")?.scrollIntoView({ behavior: "smooth" });
  };

  const handleWhatsappClick = (source: string) => {
    const gtag = getGtag();
    gtag?.("event", "crm_advocacia_whatsapp_click", {
      service: "crm_advocacia",
      source
    });
    window.open(
      "https://wa.me/553193054200?text=Olá! Gostaria de conhecer o CRM da Quantum para escritórios de advocacia.",
      "_blank"
    );
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />

      <section className="relative overflow-hidden pt-24 pb-20 bg-gradient-hero text-white">
        <div className="absolute inset-0 bg-grid-pattern opacity-10"></div>
        <div className="absolute -top-24 -left-24 w-72 h-72 bg-quantum-cyan/30 blur-3xl rounded-full animate-pulse-slow"></div>
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-quantum-bright/20 blur-3xl rounded-full animate-float-slow"></div>
        <div className="container px-4 relative z-10">
          <div className="max-w-5xl mx-auto text-center">
            <div className="inline-flex items-center px-4 py-2 mb-6 text-sm font-medium rounded-full bg-white/15 backdrop-blur animate-pulse-glow">
              <Gavel className="h-4 w-4 mr-2" />
              {heroLabel}
            </div>
            <h1 className="text-5xl md:text-7xl font-bold mb-6">{heroHeadline}</h1>
            <p className="text-xl md:text-2xl text-white/90 mb-10 leading-relaxed">{heroDescription}</p>
            <div className="flex flex-wrap justify-center gap-4">
              <Button variant="quantum" size="xl" className="track-link shadow-quantum" onClick={() => handleDemoClick("hero")}
              >
                Solicitar demonstração
                <ArrowRight className="h-5 w-5 ml-2" />
              </Button>
              <Button
                variant="outline_quantum"
                size="xl"
                className="bg-white/15 border-white/30 text-white hover:bg-white hover:text-quantum-deep track-link"
                onClick={() => handleWhatsappClick("hero")}
              >
                Falar com um especialista
              </Button>
            </div>
            {isServiceError && (
              <div className="mt-8 rounded-lg border border-amber-200/60 bg-amber-50/10 p-4 text-sm text-amber-100">
                Não foi possível carregar os destaques personalizados deste serviço. Exibindo a versão padrão.
              </div>
            )}

            {isServiceLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
                {Array.from({ length: 3 }).map((_, index) => (
                  <Card key={index} className="bg-white/10 border-white/20 backdrop-blur-sm">
                    <CardHeader className="space-y-3">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <Skeleton className="h-5 w-1/2" />
                      <Skeleton className="h-4 w-full" />
                    </CardHeader>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
                {highlightCards.map((item, index) => (
                  <Card key={item.title + index} className="bg-white/10 border-white/20 backdrop-blur-sm text-left">
                    <CardHeader className="space-y-3">
                      <div className="p-3 rounded-full bg-white/20 w-fit">
                        <item.icon className="h-5 w-5 text-white" />
                      </div>
                      <CardTitle className="text-lg text-white">{item.title}</CardTitle>
                      <CardDescription className="text-white/80 text-sm leading-relaxed">
                        {item.description}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="py-20 bg-background">
        <div className="container px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-quantum bg-clip-text text-transparent">
              Resultados reais para bancas jurídicas
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              O CRM da Quantum combina automação, dados e atendimento consultivo para acelerar o crescimento do seu escritório.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {productivityMetrics.map((metric) => (
              <Card key={metric.label} className="bg-gradient-card border-quantum-light/20 hover:shadow-quantum transition-all duration-300 group">
                <CardHeader>
                  <CardTitle className="text-4xl font-bold text-quantum-bright">{metric.value}</CardTitle>
                  <CardDescription className="text-lg text-foreground/80">
                    {metric.label}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground leading-relaxed">{metric.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-gradient-to-br from-quantum-light/30 to-background">
        <div className="container px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-quantum bg-clip-text text-transparent">
              Módulos especializados para a advocacia
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Configure fluxos para contencioso, consultivo, societário, tributário e todas as áreas que compõem sua operação.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {modules.map((module) => (
              <Card key={module.title} className="border-quantum-light/20 bg-background/70 backdrop-blur hover:border-quantum-bright/40 transition-all duration-300 hover:-translate-y-2">
                <CardHeader>
                  <div className="p-4 rounded-full bg-gradient-quantum w-fit mb-4">
                    <module.icon className="h-6 w-6 text-white" />
                  </div>
                  <CardTitle className="text-2xl">{module.title}</CardTitle>
                  <CardDescription className="text-muted-foreground leading-relaxed">
                    {module.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {module.features.map((feature) => (
                      <div key={feature} className="flex items-start space-x-3">
                        <CheckCircle2 className="h-5 w-5 text-quantum-bright flex-shrink-0 mt-0.5" />
                        <span className="text-sm text-muted-foreground">{feature}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-background">
        <div className="container px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center px-4 py-2 mb-6 text-sm font-medium rounded-full bg-gradient-quantum text-white">
                <Workflow className="h-4 w-4 mr-2" />
                Automação centrada no cliente jurídico
              </div>
              <h2 className="text-4xl md:text-5xl font-bold mb-6">
                Orquestração completa dos fluxos do escritório
              </h2>
              <p className="text-lg text-muted-foreground mb-8">
                Do primeiro contato ao encerramento do caso, a plataforma garante visibilidade e colaboração em todas as etapas.
              </p>
              <div className="space-y-6">
                {automationFlows.map((flow) => (
                  <Card key={flow.title} className="border-quantum-light/20 bg-gradient-card/70">
                    <CardHeader className="pb-3">
                      <div className="p-3 rounded-full bg-gradient-quantum w-fit mb-3">
                        <flow.icon className="h-5 w-5 text-white" />
                      </div>
                      <CardTitle className="text-xl">{flow.title}</CardTitle>
                      <CardDescription className="text-muted-foreground leading-relaxed">
                        {flow.description}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            </div>
            <Card className="bg-gradient-quantum text-white border-0 shadow-quantum">
              <CardContent className="p-8 space-y-6">
                <h3 className="text-2xl font-semibold">Painel executivo jurídico</h3>
                <p className="text-white/80">
                  Consolide indicadores de produção, receita, satisfação dos clientes e riscos em um cockpit desenhado para sócios e diretoria.
                </p>
                <ul className="space-y-3 text-white/80 text-sm">
                  <li className="flex items-start space-x-3">
                    <CheckCircle2 className="h-5 w-5 text-white flex-shrink-0 mt-0.5" />
                    <span>Relatórios automáticos por área, cliente, time e responsável</span>
                  </li>
                  <li className="flex items-start space-x-3">
                    <CheckCircle2 className="h-5 w-5 text-white flex-shrink-0 mt-0.5" />
                    <span>Comparativos de metas x realizado com projeção de honorários</span>
                  </li>
                  <li className="flex items-start space-x-3">
                    <CheckCircle2 className="h-5 w-5 text-white flex-shrink-0 mt-0.5" />
                    <span>Alertas proativos de riscos, prescrições e alçadas</span>
                  </li>
                </ul>
                <Button
                  variant="outline_quantum"
                  size="lg"
                  className="bg-white/15 border-white/30 text-white hover:bg-white hover:text-quantum-deep track-link"
                  onClick={() => handleDemoClick("automation_panel")}
                >
                  Receber apresentação guiada
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section id="planos" className="py-20 bg-gradient-to-br from-quantum-light/20 via-background to-background">
        <div className="container px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-quantum bg-clip-text text-transparent">
              Planos que evoluem com o seu escritório
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Escolha o modelo que melhor se adapta à sua estrutura e conte com nossa equipe para personalizar fluxos e integrações.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {plans.map((plan) => (
              <Card
                key={plan.name}
                className={`relative overflow-hidden border-quantum-light/20 bg-background/70 backdrop-blur hover:border-quantum-bright/40 transition-all duration-300 ${
                  plan.featured ? "shadow-quantum ring-2 ring-quantum-bright" : ""
                }`}
              >
                {plan.featured && (
                  <div className="absolute top-4 right-4 px-3 py-1 text-xs font-semibold uppercase tracking-wide bg-gradient-quantum text-white rounded-full">
                    Mais escolhido
                  </div>
                )}
                <CardHeader className="space-y-3">
                  <CardTitle className="text-2xl">{plan.name}</CardTitle>
                  <p className="text-quantum-bright text-xl font-semibold">{plan.price}</p>
                  <CardDescription className="text-muted-foreground leading-relaxed">
                    {plan.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-3">
                    {plan.features.map((feature) => (
                      <div key={feature} className="flex items-start space-x-3">
                        <CheckCircle2 className="h-5 w-5 text-quantum-bright flex-shrink-0 mt-0.5" />
                        <span className="text-sm text-muted-foreground">{feature}</span>
                      </div>
                    ))}
                  </div>
                  <Button
                    variant={plan.featured ? "quantum" : "outline_quantum"}
                    size="lg"
                    className="w-full track-link"
                    onClick={() => handleDemoClick(`plan_${plan.name.toLowerCase().replace(/\s+/g, "_")}`)}
                  >
                    Falar com consultor
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-background">
        <div className="container px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center px-4 py-2 mb-6 text-sm font-medium rounded-full bg-gradient-quantum text-white">
                <Scale className="h-4 w-4 mr-2" />
                Implementação apoiada por especialistas
              </div>
              <h2 className="text-4xl md:text-5xl font-bold mb-6">
                Metodologia própria para adoção rápida e sem riscos
              </h2>
              <p className="text-lg text-muted-foreground mb-8">
                Nossa equipe atua ao lado dos sócios e gestores para acelerar o go-live, garantir a aderência do time e medir resultados desde o primeiro mês.
              </p>
              <div className="space-y-4">
                {implementationSteps.map((step, index) => (
                  <Card key={step.title} className="border-quantum-light/20">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg">
                        {String(index + 1).padStart(2, "0")} • {step.title}
                      </CardTitle>
                      <CardDescription className="text-muted-foreground leading-relaxed">
                        {step.description}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            </div>
            <Card className="bg-gradient-card border-quantum-light/20">
              <CardContent className="p-8 space-y-6">
                <h3 className="text-2xl font-semibold">Suporte consultivo contínuo</h3>
                <div className="space-y-4">
                  {supportHighlights.map((item) => (
                    <div key={item} className="flex items-start space-x-3">
                      <CheckCircle2 className="h-5 w-5 text-quantum-bright flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-muted-foreground leading-relaxed">{item}</span>
                    </div>
                  ))}
                </div>
                <Button variant="quantum" size="lg" className="track-link" onClick={() => handleWhatsappClick("support_section")}>
                  Conversar com especialista
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="py-20 bg-gradient-to-br from-quantum-light/30 via-background to-background">
        <div className="container px-4">
          <Card className="bg-gradient-quantum text-white border-0 shadow-quantum max-w-5xl mx-auto">
            <CardContent className="p-12 text-center space-y-8">
              <h3 className="text-3xl md:text-4xl font-bold">
                Pronto para elevar a gestão do seu escritório?
              </h3>
              <p className="text-xl text-white/90 max-w-3xl mx-auto leading-relaxed">
                Agende uma demonstração personalizada e descubra como nossos especialistas podem acelerar a transformação digital da sua operação jurídica.
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <Button
                  variant="outline_quantum"
                  size="xl"
                  className="bg-white/20 border-white/30 text-white hover:bg-white hover:text-quantum-deep track-link"
                  onClick={() => handleDemoClick("final_cta")}
                >
                  Solicitar demonstração
                  <ArrowRight className="h-5 w-5 ml-2" />
                </Button>
                <Button
                  variant="outline_quantum"
                  size="xl"
                  className="bg-white/20 border-white/30 text-white hover:bg-white hover:text-quantum-deep track-link"
                  onClick={() => handleWhatsappClick("final_cta")}
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

export default CRMAdvocacia;
