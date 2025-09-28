import { Link } from "react-router-dom";
import {
    ArrowRight,
    Bot,
    CheckCircle2,
    CircuitBoard,
    Database,
    MessageSquare,
    Server,
    Settings,
    Sparkles,
    Workflow,
    Layers,
    ShieldCheck,
} from "lucide-react";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import TypebotBubble from "@/components/site/TypebotBubble";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buildAppPath } from "@/config/app-config";

const services = [
    {
        title: "Assistentes Virtuais com IA",
        description:
            "Chatbots que entendem a conversa e respondem de forma natural, ajudando sua equipe a ganhar tempo e eficiência.",
        icon: Bot,
        highlights: ["WhatsApp, Web e Telegram", "Roteiros personalizados", "Acompanhamento em tempo real"],
        link: "/servicos/assistente-ia",
    },
    {
        title: "Automações Empresariais",
        description:
            "Elimine tarefas repetitivas e conecte sistemas para que sua equipe foque no que realmente importa.",
        icon: Settings,
        highlights: ["Integrações com sistemas já usados", "Fluxos automáticos de trabalho", "Alertas e relatórios prontos"],
        link: "/servicos/automacoes",
    },
    {
        title: "Desenvolvimento Sob Medida",
        description:
            "Criamos soluções digitais sob encomenda para apoiar suas operações e melhorar a experiência dos seus clientes.",
        icon: CircuitBoard,
        highlights: ["Projetos escaláveis", "Design intuitivo", "Equipe dedicada do início ao fim"],
        link: "/servicos/desenvolvimento",
    },
    {
        title: "Consultoria em Dados & Analytics",
        description:
            "Organizamos e transformamos dados em informações úteis para apoiar decisões do dia a dia.",
        icon: Database,
        highlights: ["Painéis de acompanhamento", "Revisão de estrutura de dados", "Estratégias alinhadas ao negócio"],
        link: "#contato",
    },
    {
        title: "Infraestrutura & Cloud",
        description:
            "Cuidamos da sua operação em nuvem para que seja segura, estável e com custos sob controle.",
        icon: Server,
        highlights: ["Monitoramento completo", "Gestão de custos", "Alta disponibilidade"],
        link: "#contato",
    },
];

const differentiators = [
    {
        title: "Equipe experiente",
        description: "Profissionais de diferentes áreas trabalhando juntos para entregar valor real.",
    },
    {
        title: "Acompanhamento próximo",
        description: "Estamos presentes em todas as etapas, da ideia inicial ao suporte contínuo.",
    },
    {
        title: "Agilidade com qualidade",
        description: "Entregas rápidas e seguras, sempre com foco no que gera resultado para o seu negócio.",
    },
];

const processSteps = [
    {
        title: "Entendimento",
        description:
            "Conversamos com seu time para entender os desafios e definir o caminho mais adequado.",
        result: "Plano de ação validado",
    },
    {
        title: "Desenho da Solução",
        description:
            "Criamos protótipos e mostramos como a solução vai funcionar na prática.",
        result: "Modelo aprovado",
    },
    {
        title: "Implementação",
        description:
            "Executamos em ciclos curtos, com entregas frequentes e ajustes sempre que necessário.",
        result: "Funcionalidades prontas para uso",
    },
    {
        title: "Crescimento",
        description:
            "Apoiamos a operação, ajustamos e melhoramos continuamente para garantir evolução.",
        result: "Resultados sustentados ao longo do tempo",
    },
];

const ServicesPage = () => {
    return (
        <div className="min-h-screen bg-background">
            <TypebotBubble />
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
                                Serviços digitais personalizados
                            </div>
                            <h1 className="mt-6 text-4xl md:text-6xl font-bold leading-tight">
                                Serviços completos para impulsionar seu negócio
                            </h1>
                            <p className="mt-6 text-lg md:text-xl text-white/85 max-w-3xl">
                                Juntamos inteligência artificial, automação, desenvolvimento sob medida e cloud para construir soluções
                                práticas e de impacto.
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
                                    onClick={() =>
                                        window.open(
                                            "https://wa.me/553193054200?text=Olá! Quero conhecer os serviços da Quantum Tecnologia.",
                                            "_blank",
                                        )
                                    }
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
                                Serviços criados para o seu desafio
                            </h2>
                            <p className="text-lg text-muted-foreground">
                                Cada serviço é adaptado ao momento e às necessidades da sua empresa. Da primeira automação à transformação completa,
                                caminhamos junto com você.
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
                                    Como colocamos projetos em prática
                                </h2>
                                <p className="text-lg text-muted-foreground">
                                    Trabalhamos de forma colaborativa e ágil, com entregas frequentes e foco em resultados claros.
                                </p>
                            </div>
                            <div className="rounded-2xl border border-quantum-light/60 bg-white/60 px-6 py-4 text-sm text-foreground shadow-card backdrop-blur">
                                <div className="flex items-center gap-3">
                                    <Workflow className="h-5 w-5 text-quantum-bright" />
                                    <span>
                                        +120 projetos entregues em áreas como varejo, saúde, indústria e serviços.
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
                                    Parceria para crescer com confiança
                                </h2>
                                <p className="text-lg text-muted-foreground mb-8">
                                    Trabalhamos junto com você e sua equipe para garantir soluções simples, seguras e que realmente façam diferença.
                                </p>
                                <div className="space-y-4">
                                    {["Equipe multidisciplinar", "Métricas claras e acompanhamento próximo", "Suporte constante", "Segurança desde o início"].map((item) => (
                                        <div key={item} className="flex items-start gap-3">
                                            <MessageSquare className="mt-1 h-5 w-5 text-quantum-bright" />
                                            <p className="text-foreground">{item}</p>
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-10 flex flex-wrap gap-4">
                                    <Button
                                        variant="quantum"
                                        size="xl"
                                        className="track-link"
                                        onClick={() => window.location.assign(buildAppPath("#contato"))}
                                    >
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
                                            <p className="text-sm text-muted-foreground">anos de experiência combinada</p>
                                        </div>
                                        <div className="rounded-xl border border-quantum-light/60 bg-white/80 p-4">
                                            <p className="text-3xl font-bold text-quantum-medium">24/7</p>
                                            <p className="text-sm text-muted-foreground">suporte para operações críticas</p>
                                        </div>
                                    </div>
                                    <div className="rounded-xl border border-quantum-light/60 bg-white/80 p-4">
                                        <p className="text-lg font-semibold text-foreground">Transforme sua operação com tecnologia feita para você.</p>
                                        <p className="text-sm text-muted-foreground">
                                            Agende uma conversa estratégica gratuita com nosso time de especialistas.
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
