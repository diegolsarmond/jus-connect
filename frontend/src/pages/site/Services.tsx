import { Link } from "react-router-dom";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  CircuitBoard,
  Database,
  Layers,
  MessageSquare,
  Server,
  Settings,
  ShieldCheck,
  Sparkles,
  Workflow,
} from "lucide-react";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const services = [
  {
    title: "Assistentes Virtuais com IA",
    description:
      "Chatbots inteligentes que entendem a linguagem natural, aprendem com cada conversa e garantem respostas instantâneas.",
    icon: Bot,
    highlights: ["Integração com WhatsApp, Web e Telegram", "Fluxos conversacionais sob medida", "Monitoramento em tempo real"],
    link: "/servicos/assistente-ia",
  },
  {
    title: "Automações Empresariais",
    description:
      "Digitalize processos repetitivos, orquestre fluxos de trabalho complexos e elimine gargalos entre sistemas e equipes.",
    icon: Settings,
    highlights: ["Integrações com APIs e ERPs", "Workflows inteligentes", "Alertas e relatórios automatizados"],
    link: "/servicos/automacoes",
  },
  {
    title: "CRM para Advogados",
    description:
      "Uma plataforma completa para escritórios jurídicos com gestão de clientes, prazos, documentos e indicadores estratégicos.",
    icon: ShieldCheck,
    highlights: ["Gestão de processos com SLA", "Organização de documentos sensíveis", "Visão 360º do relacionamento"],
    link: "/servicos/crm",
  },
  {
    title: "Desenvolvimento Sob Medida",
    description:
      "Aplicações web, portais e APIs criados do zero para suportar operações críticas e experiências digitais modernas.",
    icon: CircuitBoard,
    highlights: ["Arquiteturas escaláveis", "Design system proprietário", "Squad dedicado do discovery ao go-live"],
    link: "/servicos/desenvolvimento",
  },
  {
    title: "Consultoria em Dados & Analytics",
    description:
      "Planejamento, governança e visualização de dados para gerar insights confiáveis e acelerar a tomada de decisão.",
    icon: Database,
    highlights: ["Dashboards executivos", "Revisão de arquitetura de dados", "Estratégia de dados orientada ao negócio"],
    link: "#contato",
  },
  {
    title: "Infraestrutura & Cloud",
    description:
      "Provisionamento, monitoramento e otimização de ambientes em nuvem com segurança, escalabilidade e custos sob controle.",
    icon: Server,
    highlights: ["Observabilidade ponta a ponta", "Gestão de custos cloud", "Alta disponibilidade garantida"],
    link: "#contato",
  },
];

const differentiators = [
  {
    title: "Time especialista",
    description: "Profissionais certificados em IA, automação, cloud e desenvolvimento orientados a resultados mensuráveis.",
  },
  {
    title: "Entrega de ponta a ponta",
    description: "Da estratégia ao suporte contínuo, acompanhamos cada etapa com governança e indicadores claros.",
  },
  {
    title: "Velocidade com qualidade",
    description: "Sprints curtos, rituais ágeis e uma cultura orientada a dados para acelerar o ROI sem comprometer a segurança.",
  },
];

const processSteps = [
  {
    title: "Descoberta & Estratégia",
    description:
      "Mapeamos objetivos, desafios e oportunidades junto ao seu time para desenhar uma jornada digital sob medida.",
    result: "Roadmap validado com stakeholders",
  },
  {
    title: "Design da Solução",
    description:
      "Prototipamos fluxos, definimos integrações e estabelecemos a arquitetura tecnológica ideal para o seu contexto.",
    result: "Blueprint técnico e UX aprovados",
  },
  {
    title: "Implementação Ágil",
    description:
      "Sprints colaborativos com entregas frequentes, testes contínuos e monitoramento de indicadores chave.",
    result: "Funcionalidades prontas para produção",
  },
  {
    title: "Escala & Evolução",
    description:
      "Operação assistida, otimizações constantes e acompanhamento ativo dos resultados para manter o crescimento.",
    result: "Crescimento sustentado com dados",
  },
];

const ServicesPage = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main>
        {/* Hero Section */}
        <section className="relative overflow-hidden bg-gradient-hero text-white pt-28 pb-24">
          <div className="absolute inset-0 bg-grid-pattern opacity-10" aria-hidden="true" />
          <div className="absolute -top-32 -right-32 w-72 h-72 rounded-full bg-white/10 blur-3xl animate-pulse-smooth" />
          <div className="container px-4 relative z-10">
            <div className="max-w-4xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-2 text-sm font-medium backdrop-blur">
                <Sparkles className="h-4 w-4" />
                Soluções digitais de alta performance
              </div>
              <h1 className="mt-6 text-4xl md:text-6xl font-bold leading-tight">
                Serviços completos para acelerar a transformação do seu negócio
              </h1>
              <p className="mt-6 text-lg md:text-xl text-white/85 max-w-3xl">
                Combinamos inteligência artificial, automações, desenvolvimento personalizado e infraestrutura cloud para
                construir experiências digitais que geram valor desde o primeiro sprint.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <Button
                  variant="outline_quantum"
                  size="xl"
                  className="bg-white/15 border-white/40 text-white hover:bg-white hover:text-quantum-deep"
                  onClick={() => document.getElementById("contato")?.scrollIntoView({ behavior: "smooth" })}
                >
                  Fale com especialistas
                  <ArrowRight className="h-5 w-5" />
                </Button>
                <Button
                  variant="outline_quantum"
                  size="xl"
                  className="bg-white/10 border-white/30 text-white hover:bg-white/80 hover:text-quantum-deep"
                  onClick={() => window.open("https://wa.me/553193054200?text=Olá! Quero transformar minha operação com a Quantum.", "_blank")}
                >
                  Conversar no WhatsApp
                </Button>
              </div>
              <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-3">
                {differentiators.map((item) => (
                  <Card key={item.title} className="bg-white/10 border-white/15 backdrop-blur">
                    <CardHeader className="space-y-2">
                      <CardTitle className="text-white text-lg">{item.title}</CardTitle>
                      <CardDescription className="text-white/80">{item.description}</CardDescription>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Services Grid */}
        <section className="py-20 bg-background relative overflow-hidden">
          <div className="absolute inset-0 bg-quantum-light/20" aria-hidden="true" />
          <div className="container relative z-10 px-4">
            <div className="mb-12 max-w-3xl">
              <h2 className="text-3xl md:text-5xl font-bold mb-4 bg-gradient-quantum bg-clip-text text-transparent">
                Soluções desenhadas para cada desafio
              </h2>
              <p className="text-lg text-muted-foreground">
                Personalizamos cada serviço para atender o momento da sua empresa. Desde a primeira automação até plataformas
                completas, entregamos evolução contínua com governança.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-3">
              {services.map((service) => (
                <Card
                  key={service.title}
                  className="relative flex h-full flex-col border-quantum-light/40 bg-gradient-card transition-all duration-300 hover:-translate-y-2 hover:shadow-quantum"
                >
                  <CardHeader>
                    <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-full bg-gradient-quantum text-white shadow-glow">
                      <service.icon className="h-6 w-6" />
                    </div>
                    <CardTitle className="text-2xl text-foreground">{service.title}</CardTitle>
                    <CardDescription className="text-muted-foreground text-base">
                      {service.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="mt-auto flex flex-col gap-4">
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      {service.highlights.map((highlight) => (
                        <li key={highlight} className="flex items-start gap-2">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 text-quantum-bright" />
                          <span>{highlight}</span>
                        </li>
                      ))}
                    </ul>
                    {service.link.startsWith("#") ? (
                      <Button
                        variant="outline_quantum"
                        className="track-link"
                        onClick={() =>
                          document.getElementById(service.link.replace("#", ""))?.scrollIntoView({ behavior: "smooth" })
                        }
                      >
                        Falar com o time
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button variant="outline_quantum" className="track-link" asChild>
                        <Link to={service.link}>
                          Explorar detalhes
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Process Section */}
        <section className="py-20 bg-gradient-to-b from-background via-quantum-light/40 to-background">
          <div className="container px-4">
            <div className="mb-12 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-2xl">
                <h2 className="text-3xl md:text-5xl font-bold mb-4 bg-gradient-quantum bg-clip-text text-transparent">
                  Como conduzimos projetos transformadores
                </h2>
                <p className="text-lg text-muted-foreground">
                  Combinamos metodologias ágeis e gestão orientada a dados para garantir previsibilidade, transparência e alto
                  impacto desde a descoberta até a operação.
                </p>
              </div>
              <div className="rounded-2xl border border-quantum-light/60 bg-white/60 px-6 py-4 text-sm text-foreground shadow-card backdrop-blur">
                <div className="flex items-center gap-3">
                  <Workflow className="h-5 w-5 text-quantum-bright" />
                  <span>
                    +120 projetos entregues com NPS médio de 92 em segmentos como jurídico, varejo, saúde e financeiro.
                  </span>
                </div>
              </div>
            </div>

            <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-4">
              {processSteps.map((step, index) => (
                <Card key={step.title} className="relative h-full border-quantum-light/40 bg-card/80 backdrop-blur">
                  <CardHeader className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-quantum text-white font-semibold">
                        {index + 1}
                      </div>
                      <Layers className="h-5 w-5 text-quantum-bright" />
                    </div>
                    <CardTitle className="text-xl">{step.title}</CardTitle>
                    <CardDescription className="text-muted-foreground">{step.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-xl bg-quantum-light/70 p-4 text-sm text-foreground">
                      <p className="font-semibold text-quantum-medium">Resultado esperado</p>
                      <p>{step.result}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Partnership Section */}
        <section className="py-20 bg-background">
          <div className="container px-4">
            <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
              <div>
                <h2 className="text-3xl md:text-5xl font-bold mb-6 bg-gradient-quantum bg-clip-text text-transparent">
                  Parceria estratégica para crescer com confiança
                </h2>
                <p className="text-lg text-muted-foreground mb-8">
                  Atuamos lado a lado com lideranças e times operacionais para garantir que cada solução gere eficiência,
                  escalabilidade e novas oportunidades de receita.
                </p>
                <div className="space-y-4">
                  {["Squads multidisciplinares", "Governança e métricas claras", "Suporte contínuo e proativo", "Segurança e compliance desde o planejamento"].map((item) => (
                    <div key={item} className="flex items-start gap-3">
                      <MessageSquare className="mt-1 h-5 w-5 text-quantum-bright" />
                      <p className="text-foreground">{item}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-10 flex flex-wrap gap-4">
                  <Button variant="quantum" size="xl" className="track-link" onClick={() => (window.location.href = "/#contato")}> 
                    Planejar projeto
                  </Button>
                  <Button variant="outline_quantum" size="xl" className="track-link" asChild>
                    <Link to="/blog">
                      Conhecer insights
                    </Link>
                  </Button>
                </div>
              </div>

              <Card className="border-quantum-light/40 bg-gradient-to-br from-quantum-light/80 via-card to-white shadow-quantum">
                <CardContent className="p-8 space-y-6">
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="h-6 w-6 text-quantum-bright" />
                    <div>
                      <p className="text-sm uppercase tracking-wide text-muted-foreground">Confiança</p>
                      <p className="text-2xl font-bold text-foreground">+98% de renovação de contratos</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="rounded-xl border border-quantum-light/60 bg-white/80 p-4">
                      <p className="text-3xl font-bold text-quantum-medium">15+</p>
                      <p className="text-sm text-muted-foreground">anos de experiência combinada do time</p>
                    </div>
                    <div className="rounded-xl border border-quantum-light/60 bg-white/80 p-4">
                      <p className="text-3xl font-bold text-quantum-medium">24/7</p>
                      <p className="text-sm text-muted-foreground">monitoramento e suporte para operações críticas</p>
                    </div>
                  </div>
                  <div className="rounded-xl border border-quantum-light/60 bg-white/80 p-4">
                    <p className="text-lg font-semibold text-foreground">Transforme sua operação com tecnologia sob medida.</p>
                    <p className="text-sm text-muted-foreground">
                      Agenda estratégica gratuita para mapear oportunidades com especialistas Quantum.
                    </p>
                    <Button
                      variant="quantum"
                      size="lg"
                      className="mt-4 w-full track-link"
                      onClick={() => document.getElementById("contato")?.scrollIntoView({ behavior: "smooth" })}
                    >
                      Agendar conversa
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default ServicesPage;
