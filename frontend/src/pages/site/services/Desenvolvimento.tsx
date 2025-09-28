import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    ArrowRight,
    BadgeCheck,
    BarChart3,
    CheckCircle,
    ClipboardList,
    Code2,
    Cpu,
    Database,
    Gauge,
    Globe,
    Layers,
    LayoutDashboard,
    LifeBuoy,
    Lightbulb,
    PenTool,
    Puzzle,
    Rocket,
    ServerCog,
    ShieldCheck,
    Smartphone,
    Sparkles,
    Target,
    Timer,
    Users2,
    Workflow,
} from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import TypebotBubble from "@/components/site/TypebotBubble";
import { useServiceBySlug } from "@/hooks/useServices";
import { Skeleton } from "@/components/ui/skeleton";
import { getGtag } from "@/lib/gtag";
import { buildAppPath } from "@/config/app-config";
import devSquadIllustration from "@/assets/dev-squad-illustration.svg";
import productJourneyIllustration from "@/assets/product-journey-illustration.svg";
import integrationMapIllustration from "@/assets/integration-map-illustration.svg";
import planUpgradeIllustration from "@/assets/plan-upgrade-illustration.svg";

const Desenvolvimento = () => {
    const { data: service, isLoading: isServiceLoading } = useServiceBySlug("desenvolvimento");

    const heroLabel = service?.title ?? "Fábrica de Software Quantum Jud";
    const heroHeadline = service?.summary ?? "Times especializados para acelerar sua transformação digital";
    const heroDescription =
        service?.description ??
        "Reunimos squads multidisciplinares para desenhar, desenvolver e evoluir plataformas digitais sob medida para o seu negócio.";

    const heroHighlights = [
        {
            title: "Discovery profundo com o negócio",
            description: "Workshops colaborativos para mapear desafios, oportunidades e priorizar entregas com clareza.",
        },
        {
            title: "Arquitetura escalável desde o primeiro sprint",
            description: "Projetos cloud-native, seguros e prontos para crescer com integração a sistemas legados.",
        },
        {
            title: "Transparência sprint a sprint",
            description: "Rituais ágeis, indicadores e board compartilhado para acompanhar evolução em tempo real.",
        },
    ];

    const heroStats = [
        {
            value: "120+",
            label: "produtos digitais lançados",
            description: "Portais, aplicativos e plataformas corporativas entregues ponta a ponta.",
        },
        {
            value: "40%",
            label: "redução média de time-to-market",
            description: "Squads dedicados, pipelines CI/CD e governança orientada a valor.",
        },
        {
            value: "98%",
            label: "de satisfação dos stakeholders",
            description: "Métricas de NPS, SLAs definidos e acompanhamento executivo contínuo.",
        },
    ];

    const discoveryHighlights = [
        {
            icon: Lightbulb,
            title: "Blueprint estratégico",
            description: "Vision sprints, mapa de oportunidades e definição de KPIs de negócio.",
        },
        {
            icon: Target,
            title: "Jornadas priorizadas",
            description: "Service blueprint e prototipação de fluxos críticos com validação rápida.",
        },
        {
            icon: PenTool,
            title: "UX research contínuo",
            description: "Testes com usuários, insights qualitativos e design system evolutivo.",
        },
        {
            icon: Workflow,
            title: "Roadmap acionável",
            description: "Backlog organizado por valor, riscos mapeados e plano de releases iterativo.",
        },
    ];

    const deliveryMetrics = [
        {
            value: "2x",
            label: "mais velocidade de entrega",
            detail: "Sprints quinzenais, ritos ágeis e automações garantem incremento constante.",
        },
        {
            value: "99,9%",
            label: "de disponibilidade",
            detail: "Arquitetura cloud observável, esteira automatizada e testes a cada release.",
        },
        {
            value: "24h",
            label: "para resposta a incidentes críticos",
            detail: "Runbooks, monitoramento 24/7 e squad de sustentação dedicado.",
        },
        {
            value: "+60",
            label: "especialistas envolvidos",
            detail: "Engenheiros, product managers, designers, cientistas de dados e QAs.",
        },
    ];

    const acceleratorServices = [
        {
            icon: PenTool,
            title: "Design Ops & UX Research",
            description: "Labs de experimentação contínua para garantir experiências consistentes.",
            items: [
                "Design system vivo com guidelines e componentes reutilizáveis",
                "Testes de usabilidade e entrevistas recorrentes",
                "Workshop de co-criação com stakeholders e usuários finais",
            ],
        },
        {
            icon: Workflow,
            title: "Playbooks ágeis Quantum Jud",
            description: "Roteiros e cerimônias que estruturam planejamento, execução e governança.",
            items: [
                "Discovery, inception e product framing facilitados",
                "Gestão de backlog e roadmaps integrados a OKRs",
                "Dashboards operacionais para medir velocidade e qualidade",
            ],
        },
        {
            icon: BarChart3,
            title: "Data & Product Analytics",
            description: "Coleta, tratamento e análise de dados para orientar evolução contínua.",
            items: [
                "Implementação de product analytics e customer data platform",
                "Modelos de previsão e segmentação com machine learning",
                "KPIs e relatórios executivos em tempo real",
            ],
        },
    ];

    const caseStudies = [
        {
            image: productJourneyIllustration,
            segment: "Saúde corporativa",
            title: "Plataforma integrada de benefícios",
            result: "37% menos tempo para onboard de novos clientes com jornadas digitais.",
            metrics: [
                "Onboarding digital lançado em 6 semanas",
                "Integração com 12 parceiros e sistemas legados",
                "NPS 74 após o go-live com 40 mil usuários",
            ],
        },
        {
            image: integrationMapIllustration,
            segment: "Serviços financeiros",
            title: "Hub de crédito e compliance",
            result: "Redução de 52% no retrabalho com automação e rastreabilidade completa.",
            metrics: [
                "Arquitetura de microsserviços com filas e eventos",
                "Auditoria em tempo real e trilhas de decisão",
                "Painéis executivos com indicadores diários",
            ],
        },
        {
            image: planUpgradeIllustration,
            segment: "Educação corporativa",
            title: "Ecossistema de aprendizagem contínua",
            result: "Engajamento 3x maior com conteúdo personalizado por perfis.",
            metrics: [
                "Aplicativos web e mobile integrados",
                "Recomendações inteligentes com IA embarcada",
                "Medição de impacto por trilha, squad e unidade de negócio",
            ],
        },
    ];

    const qaApproach = [
        {
            icon: ShieldCheck,
            title: "Qualidade contínua",
            description: "Testes unitários, integração, contrato e performance automatizados em cada pipeline.",
        },
        {
            icon: Cpu,
            title: "Observabilidade inteligente",
            description: "Monitoramento de logs, métricas e traces com alertas inteligentes e AIOps.",
        },
        {
            icon: LifeBuoy,
            title: "Suporte orientado a SLAs",
            description: "Runbooks, gestão de incidentes e squads de sustentação para evolução contínua.",
        },
    ];

    const capabilityHighlights = [
        {
            icon: Code2,
            title: "Produtos digitais completos",
            description: "Concepção ponta a ponta de plataformas, portais e aplicativos com foco em experiência e resultado.",
            bullets: [
                "Workshops de discovery e mapeamento de processos",
                "UX/UI centrado no usuário com design system reutilizável",
                "Arquitetura orientada a microsserviços e APIs escaláveis",
            ],
        },
        {
            icon: Puzzle,
            title: "Integrações e modernização",
            description: "Modernize sistemas legados, conecte plataformas e automatize operações críticas do negócio.",
            bullets: [
                "Integração com ERPs, CRMs, gateways e plataformas proprietárias",
                "Estratégias de refatoração gradual sem paradas na operação",
                "APIs, mensageria e automações que conectam toda a jornada",
            ],
        },
        {
            icon: Sparkles,
            title: "Inovação guiada por dados",
            description: "Implante produtos digitais inteligentes com analítica, automação e inteligência artificial aplicada.",
            bullets: [
                "Prototipação rápida para validar hipóteses de negócio",
                "Dashboards e relatórios com dados em tempo real",
                "Machine Learning e IA embarcada para personalizar experiências",
            ],
        },
    ];

    const fallbackSolutions = useMemo(
        () => [
            {
                title: "Plataformas de Gestão e Operações",
                description: "Sistemas complexos que conectam equipes, processos e indicadores em uma única solução.",
                features: [
                    "Portais corporativos, intranets e gestão de documentos",
                    "Fluxos de aprovação, compliance e governança",
                    "Integrações com ERPs, CRMs e ferramentas de BI",
                    "Arquitetura modular preparada para crescimento",
                ],
            },
            {
                title: "Ecossistemas de Relacionamento",
                description: "Experiências digitais completas para relacionamento com clientes, parceiros e fornecedores.",
                features: [
                    "Onboarding digital com automações de jornada",
                    "Aplicativos mobile e web responsivos",
                    "Comunicação omnichannel e notificações inteligentes",
                    "Analytics e painéis executivos integrados",
                ],
            },
            {
                title: "E-commerce e Marketplaces B2B/B2C",
                description: "Plataformas de vendas escaláveis com foco em performance e integração com todo o backoffice.",
                features: [
                    "Gestão de catálogos complexos e regras comerciais",
                    "Integração com meios de pagamento e fiscal",
                    "Ferramentas de marketing, promoções e fidelização",
                    "Monitoramento e observabilidade fim a fim",
                ],
            },
            {
                title: "Soluções Data-Driven",
                description: "Produtos que centralizam dados, automatizam decisões e aumentam a inteligência do negócio.",
                features: [
                    "Data lakes, pipelines e engenharia de dados",
                    "Dashboards e relatórios executivos personalizados",
                    "Modelos preditivos e algoritmos de recomendação",
                    "Governança e segurança da informação aderentes à LGPD",
                ],
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

    const engagementModels = [
        {
            icon: Users2,
            title: "Squad dedicada",
            description: "Equipe multidisciplinar exclusiva com governança ágil Quantum Jud e foco em indicadores de negócio.",
            highlights: [
                "Product Manager Quantum Jud como ponto focal",
                "Desenvolvedores full-stack, UX/UI e QA integrados",
                "Backlog priorizado em conjunto a cada sprint",
            ],
        },
        {
            icon: ClipboardList,
            title: "Projetos fechados",
            description: "Escopo definido, roadmap e entregas com previsão clara de prazo e investimento.",
            highlights: [
                "Discovery colaborativo e alinhamento de objetivos",
                "Marcos de validação e homologação assistida",
                "Implantação, treinamento e handover estruturado",
            ],
        },
        {
            icon: Timer,
            title: "Sustentação e evolução",
            description: "Time sob demanda para manter, monitorar e evoluir sistemas críticos em produção.",
            highlights: [
                "SLA alinhado à criticidade do negócio",
                "Squad enxuta para correções e novas demandas",
                "Observabilidade, monitoramento e gestão de incidentes",
            ],
        },
    ];

    const methodology = [
        {
            step: "1",
            title: "Discovery Imersivo",
            description: "Workshops, entrevistas e mapeamento de processos para alinhar objetivos e priorizar entregas.",
            detail: "Mapeamos a jornada dos usuários, regras de negócio e definimos o backlog inicial orientado a valor.",
        },
        {
            step: "2",
            title: "Arquitetura & Design",
            description: "Protótipos navegáveis, design system e definição da arquitetura técnica ideal.",
            detail: "UX research, testes de usabilidade e arquitetura cloud escalável preparada para integração.",
        },
        {
            step: "3",
            title: "Desenvolvimento Ágil",
            description: "Sprints curtas com entregas incrementais, acompanhamento e ritos ágeis semanais.",
            detail: "Pipelines CI/CD, code review contínuo e indicadores de performance compartilhados.",
        },
        {
            step: "4",
            title: "Qualidade & Segurança",
            description: "Testes automatizados, QA funcional e validações de segurança em cada release.",
            detail: "Testes unitários, integração, performance e análise de vulnerabilidades garantindo estabilidade.",
        },
        {
            step: "5",
            title: "Lançamento & Evolução",
            description: "Go-live assistido, monitoramento 24/7 e roadmap de evolução contínua.",
            detail: "Treinamento, dashboards de acompanhamento e squad dedicada à sustentação.",
        },
    ];

    const differentiators = [
        {
            icon: ShieldCheck,
            title: "Governança e compliance",
            description: "Processos aderentes à LGPD, auditoria de acessos, versionamento e rastreabilidade de decisões.",
        },
        {
            icon: ServerCog,
            title: "Infraestrutura preparada",
            description: "Automação de deploy, monitoramento, observabilidade e gestão de incidentes pró-ativa.",
        },
        {
            icon: Layers,
            title: "Co-criação contínua",
            description: "Participação ativa do cliente em ritos ágeis, backlog colaborativo e transparência total.",
        },
        {
            icon: Rocket,
            title: "Foco em resultados",
            description: "OKRs e KPIs definidos em conjunto para medir impacto real no negócio.",
        },
    ];

    const segments = [
        "Jurídico, escritórios e lawtechs",
        "Serviços financeiros, fintechs e seguros",
        "Educação corporativa e edtechs",
        "Indústria, logística e operações complexas",
        "Saúde, bem-estar e planos de benefícios",
        "Setor público, entidades e organizações reguladas",
    ];

    const technologies = [
        {
            icon: LayoutDashboard,
            title: "Frontend moderno",
            description: "React, Next.js, Vue, TypeScript e design systems reutilizáveis.",
        },
        {
            icon: ServerCog,
            title: "APIs e microsserviços",
            description: "Node.js, NestJS, Python, .NET, GraphQL e arquiteturas orientadas a eventos.",
        },
        {
            icon: Smartphone,
            title: "Mobile & Multiplataforma",
            description: "React Native, Flutter, Swift e Kotlin com publicação assistida nas stores.",
        },
        {
            icon: Database,
            title: "Dados & Integrações",
            description: "PostgreSQL, MongoDB, Redis, mensageria, data lakes e integrações com ERPs/CRMs.",
        },
    ];

    const benefits = [
        "Planejamento orientado a OKRs e indicadores de negócio",
        "Pipelines de CI/CD com testes automatizados e code review",
        "Documentação funcional e técnica disponível em tempo real",
        "Squad de sustentação com monitoramento e alertas 24/7",
        "Treinamento das equipes usuárias e handover estruturado",
        "Evolução contínua guiada por dados e feedback dos usuários",
    ];

    return (
        <div className="min-h-screen bg-background text-foreground">
            <TypebotBubble />
            <Header />

            {/* Hero Section */}
            {/* ... mantém igual ao seu original ... */}

            {/* Solutions Section */}
            <section className="py-20 bg-gradient-to-br from-quantum-light/30 to-background">
                <div className="container px-4">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-quantum bg-clip-text text-transparent">
                            Produtos e plataformas que desenvolvemos
                        </h2>
                        <p className="text-xl text-foreground/80 max-w-3xl mx-auto">
                            Construímos soluções completas para diferentes segmentos, sempre com foco em gerar impacto real nos resultados.
                        </p>
                    </div>

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
                                        <CardTitle className="text-xl group-hover:text-quantum-bright transition-colors">{solution.title}</CardTitle>
                                        <CardDescription className="text-foreground/80">{solution.description}</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <ul className="space-y-2">
                                            {solution.features.map((feature) => (
                                                <li key={feature} className="flex items-center space-x-2">
                                                    <CheckCircle className="h-4 w-4 text-quantum-bright flex-shrink-0" />
                                                    <span className="text-sm text-foreground/80">{feature}</span>
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

      {/* Case Studies Section */}

      <section className="py-20 bg-background">
        <div className="container px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-quantum bg-clip-text text-transparent">
              Resultados que transformam operações
            </h2>
            <p className="text-xl text-foreground/80 max-w-3xl mx-auto">
              Conheça alguns exemplos de plataformas entregues pelo time do Quantum Jud, combinando design centrado no usuário, integrações complexas e métricas de negócio.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {caseStudies.map((caseStudy) => (
              <Card
                key={caseStudy.title}
                className="relative overflow-hidden border-quantum-light/30 bg-card/80 backdrop-blur transition-all duration-300 hover:-translate-y-2 hover:border-quantum-bright/40 hover:shadow-quantum"
              >
                <div className="relative h-48 rounded-3xl bg-gradient-to-br from-quantum-light/20 via-background to-card">
                  <img
                    src={caseStudy.image}
                    alt={caseStudy.title}
                    className="absolute inset-6 h-[calc(100%-3rem)] w-[calc(100%-3rem)] object-contain"
                    loading="lazy"
                  />
                  <span className="absolute left-6 top-6 inline-flex items-center rounded-full bg-gradient-quantum px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
                    {caseStudy.segment}
                  </span>
                </div>
                <CardHeader className="space-y-2">
                  <CardTitle className="text-xl">{caseStudy.title}</CardTitle>
                  <CardDescription className="text-foreground/80">{caseStudy.result}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-foreground/80">
                    {caseStudy.metrics.map((metric) => (
                      <li key={metric} className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-quantum-bright mt-0.5 flex-shrink-0" />
                        <span>{metric}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Engagement Models Section */}
      <section className="py-20 bg-background">
        <div className="container px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-quantum bg-clip-text text-transparent">

              Modelos de parceria sob medida
            </h2>
            <p className="text-xl text-foreground/80 max-w-3xl mx-auto">
              Escolha a abordagem que melhor se adapta ao momento da sua organização. Ajustamos processos, squad e governança conforme a sua necessidade.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {engagementModels.map((model) => (
              <Card
                key={model.title}
                className="bg-gradient-card border-quantum-light/20 hover:shadow-quantum transition-all duration-300 group hover:-translate-y-2"
              >
                <CardHeader>
                  <div className="p-4 rounded-full bg-gradient-quantum w-fit mb-4 group-hover:scale-110 transition-transform duration-300">
                    <model.icon className="h-6 w-6 text-white" />
                  </div>
                  <CardTitle className="text-xl group-hover:text-quantum-bright transition-colors">{model.title}</CardTitle>
                  <CardDescription className="text-foreground/80">{model.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {model.highlights.map((highlight) => (
                      <li key={highlight} className="flex items-start space-x-2 text-sm text-foreground/80">
                        <ArrowRight className="h-4 w-4 text-quantum-bright mt-1 flex-shrink-0" />
                        <span>{highlight}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Accelerators Section */}
      <section className="py-20 bg-gradient-to-br from-quantum-light/15 to-background">
        <div className="container px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-quantum bg-clip-text text-transparent">
              Aceleradores para evoluir continuamente
            </h2>
            <p className="text-xl text-foreground/80 max-w-4xl mx-auto">
              Frameworks, ferramentas e times especializados que potencializam a entrega desde o discovery até a operação do produto.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            {acceleratorServices.map((service) => (
              <Card
                key={service.title}
                className="h-full border-quantum-light/30 bg-card/80 backdrop-blur transition-all duration-300 hover:-translate-y-2 hover:border-quantum-bright/40 hover:shadow-quantum"
              >
                <CardHeader>
                  <div className="p-4 rounded-full bg-gradient-quantum w-fit mb-4">
                    <service.icon className="h-6 w-6 text-white" />
                  </div>
                  <CardTitle className="text-xl">{service.title}</CardTitle>
                  <CardDescription className="text-foreground/80">{service.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3 text-sm text-foreground/80">
                    {service.items.map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <ArrowRight className="mt-1 h-4 w-4 text-quantum-bright flex-shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>


      {/* Methodology Section */}
      <section className="py-20 bg-gradient-to-br from-quantum-light/20 to-background">
        <div className="container px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-quantum bg-clip-text text-transparent">
              Metodologia ágil e colaborativa
            </h2>
            <p className="text-xl text-foreground/80 max-w-3xl mx-auto">
              Da descoberta ao go-live, conduzimos cada etapa com transparência, governança e foco no valor entregue ao usuário final.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
            {methodology.map((item, index) => (
              <Card
                key={item.title}
                className="bg-gradient-card border-quantum-light/20 hover:shadow-quantum transition-all duration-300 group hover:-translate-y-2 relative"
              >
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 rounded-full bg-gradient-quantum text-white flex items-center justify-center mx-auto mb-4 text-lg font-bold group-hover:scale-110 transition-transform duration-300">
                    {item.step}
                  </div>
                  <h3 className="font-semibold mb-2 group-hover:text-quantum-bright transition-colors">{item.title}</h3>
                  <p className="text-sm text-foreground/80 mb-3">{item.description}</p>
                  <p className="text-sm text-foreground/70">{item.detail}</p>
                </CardContent>
                {index < methodology.length - 1 && (
                  <div className="hidden md:block absolute top-1/2 -right-4 transform -translate-y-1/2">
                    <ArrowRight className="h-6 w-6 text-quantum-bright" />
                  </div>
                )}
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1.1fr,0.9fr] gap-12 mt-16">
            <Card className="bg-gradient-card border-quantum-light/20">
              <CardHeader>
                <CardTitle className="text-2xl">Diferenciais da nossa operação</CardTitle>
                <CardDescription className="text-foreground/80">
                  Estrutura, processos e governança pensados para garantir segurança, qualidade e escalabilidade em cada projeto.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {differentiators.map((item) => (
                    <li key={item.title} className="flex items-start space-x-3">
                      <item.icon className="h-5 w-5 text-quantum-bright flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-foreground">{item.title}</p>
                        <p className="text-sm text-foreground/80">{item.description}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <div className="space-y-8">
              <Card className="bg-gradient-card border-quantum-light/20">
                <CardHeader>
                  <CardTitle className="text-xl">Segmentos em que atuamos</CardTitle>
                  <CardDescription className="text-foreground/80">
                    Conhecimento acumulado em setores regulados e operações complexas para acelerar a curva de aprendizado.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {segments.map((segment) => (
                      <li key={segment} className="flex items-center space-x-2">
                        <Globe className="h-4 w-4 text-quantum-bright flex-shrink-0" />
                        <span className="text-sm text-foreground/80">{segment}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <Card className="bg-gradient-card border-quantum-light/20">
                <CardHeader>
                  <CardTitle className="text-xl">Qualidade e sustentação contínua</CardTitle>
                  <CardDescription className="text-foreground/80">
                    Garantimos estabilidade, segurança e evolução permanente com processos e tecnologia dedicados.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {qaApproach.map((item) => (
                      <li key={item.title} className="flex items-start gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-quantum text-white">
                          <item.icon className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{item.title}</p>
                          <p className="text-sm text-foreground/80">{item.description}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>


              <Card className="bg-gradient-quantum text-white border-0 shadow-quantum">
                <CardHeader>
                  <CardTitle className="text-xl">Garantias e suporte</CardTitle>
                  <CardDescription className="text-white/80">
                    Compromisso com a continuidade, evolução e qualidade das soluções entregues.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {benefits.map((benefit) => (
                      <li key={benefit} className="flex items-start space-x-3">
                        <CheckCircle className="h-5 w-5 text-white flex-shrink-0 mt-0.5" />
                        <span>{benefit}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Technologies Section */}
      <section className="py-20 bg-background">
        <div className="container px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-quantum bg-clip-text text-transparent">
              Tecnologia, stack e integrações
            </h2>
            <p className="text-xl text-foreground/80 max-w-3xl mx-auto">
              Trabalhamos com um ecossistema tecnológico robusto para garantir escalabilidade, segurança e experiências digitais marcantes.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
            {technologies.map((tech, index) => (
              <Card
                key={tech.title}
                className="bg-gradient-card border-quantum-light/20 hover:shadow-quantum transition-all duration-300 group hover:-translate-y-2"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <CardHeader className="text-center">
                  <div className="p-4 rounded-full bg-gradient-quantum w-fit mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                    <tech.icon className="h-6 w-6 text-white" />
                  </div>
                  <CardTitle className="text-xl group-hover:text-quantum-bright transition-colors">{tech.title}</CardTitle>
                  <CardDescription className="text-foreground/80">{tech.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>

          <Card className="bg-gradient-quantum text-white border-0 shadow-quantum">
            <CardContent className="p-8">
              <h3 className="text-2xl font-bold mb-6 text-center">Stack tecnológico e boas práticas</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
                <div>
                  <h4 className="font-semibold mb-2">Frontend</h4>
                  <p className="text-sm text-white/80">React, Next.js, Vue, TypeScript</p>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Backend</h4>
                  <p className="text-sm text-white/80">Node.js, Python, .NET, NestJS</p>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Mobile</h4>
                  <p className="text-sm text-white/80">React Native, Flutter, Swift, Kotlin</p>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">DevOps & Cloud</h4>
                  <p className="text-sm text-white/80">AWS, Azure, GCP, Docker, Kubernetes</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-br from-quantum-light/30 to-background">
        <div className="container px-4">
          <Card className="bg-gradient-quantum text-white border-0 shadow-quantum max-w-4xl mx-auto">
            <CardContent className="p-12 text-center">
              <h3 className="text-3xl md:text-4xl font-bold mb-6">Pronto para construir o próximo produto da sua empresa?</h3>
              <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto">
                Compartilhe seus desafios e receba um plano detalhado com roadmap, time recomendado e investimento para iniciar sua jornada de transformação digital.
              </p>
              <div className="flex flex-wrap gap-4 justify-center">
                <Button
                  variant="outline_quantum"
                  size="xl"
                  className="bg-white/20 border-white/30 text-white hover:bg-white hover:text-quantum-deep track-link"
                  onClick={() => {
                    const gtag = getGtag();
                    gtag?.("event", "contact_click", {
                      service: "desenvolvimento",
                      source: "cta_section",
                    });
                    window.location.assign(buildAppPath("#contato"));
                  }}
                >
                  Solicitar proposta personalizada
                  <ArrowRight className="h-5 w-5 ml-2" />
                </Button>
                <Button
                  variant="outline_quantum"
                  size="xl"
                  className="bg-white/20 border-white/30 text-white hover:bg-white hover:text-quantum-deep track-link"
                  onClick={() => {
                    const gtag = getGtag();
                    gtag?.("event", "portfolio_request", {
                      service: "desenvolvimento",
                    });
                    window.open(
                      "https://wa.me/553193054200?text=Ol\u00e1! Gostaria de ver o portf\u00f3lio de projetos desenvolvidos pelo Quantum Jud.",
                      "_blank",
                    );
                  }}
                >
                  Conhecer cases relevantes
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
