import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings, Workflow, Timer, TrendingUp, ArrowRight, CheckCircle, Cog, Database } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import TypebotBubble from "@/components/site/TypebotBubble";
import { getGtag } from "@/lib/gtag";
import { buildAppPath } from "@/config/app-config";

const Automacoes = () => {
    // Features fixos (mockados)
    const fallbackFeatures = useMemo(
        () => [
            {
                icon: Workflow,
                title: "Fluxos Inteligentes",
                description: "Criamos rotinas automáticas que fazem tarefas repetitivas de forma rápida e sem erro.",
            },
            {
                icon: Timer,
                title: "Mais Tempo Livre",
                description: "A automação cuida do operacional e libera sua equipe para atividades mais importantes.",
            },
            {
                icon: Database,
                title: "Integração Simples",
                description: "Conectamos diferentes sistemas para que trabalhem juntos sem complicação.",
            },
            {
                icon: TrendingUp,
                title: "Produtividade em Alta",
                description: "Sua operação ganha velocidade, reduz falhas e melhora a experiência do cliente.",
            },
            {
                icon: Cog,
                title: "Sob Medida",
                description: "Desenhamos soluções personalizadas que se encaixam na realidade da sua empresa.",
            },
        ],
        [],
    );

    const heroLabel = "Automações Empresariais";
    const heroHeadline = "Deixe a tecnologia trabalhar por você";
    const heroDescription =
        "Automação é como ter um time extra dentro da sua empresa, cuidando das tarefas repetitivas todos os dias. Você ganha eficiência, reduz custos e pode focar no crescimento do negócio.";

    const automationTypes = [
        {
            title: "Marketing",
            description: "Campanhas automáticas que falam com o cliente na hora certa.",
            benefits: ["Envio programado de e-mails", "Mensagens personalizadas", "Acompanhamento pós-venda", "Relatórios claros"],
        },
        {
            title: "Gestão de Leads",
            description: "Organize e distribua seus contatos automaticamente.",
            benefits: ["Classificação por prioridade", "Envio automático de conteúdos", "Distribuição entre vendedores", "Medição de resultados"],
        },
        {
            title: "Financeiro",
            description: "Cobranças, faturas e relatórios sem esforço manual.",
            benefits: ["Cobrança automática", "Conciliação bancária", "Alertas de inadimplência", "Redução de erros"],
        },
        {
            title: "Atendimento",
            description: "Automatize parte do suporte ao cliente e acelere respostas.",
            benefits: ["Respostas rápidas", "Triagem automática", "Escalonamento inteligente", "Histórico centralizado"],
        },
    ];

    const results = [
        "Redução de até 60% do tempo em tarefas repetitivas",
        "Aumento médio de 40% na produtividade da equipe",
        "Diminuição de 80% nos erros manuais",
        "Retorno sobre investimento em poucos meses",
        "Funcionários mais satisfeitos por focarem no estratégico",
        "Economia financeira significativa mês a mês",
    ];

    return (
        <div className="min-h-screen bg-background">
            <TypebotBubble />
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
                                    gtag?.("event", "automation_analysis_click", { service: "automacoes" });
                                    document.getElementById("contato")?.scrollIntoView({ behavior: "smooth" });
                                }}
                            >
                                Solicitar Análise Gratuita
                                <ArrowRight className="h-5 w-5 ml-2" />
                            </Button>
                            <Button
                                variant="outline_quantum"
                                size="xl"
                                className="bg-white/20 border-white/30 text-white hover:bg-white hover:text-quantum-deep track-link"
                                onClick={() => {
                                    const gtag = getGtag();
                                    gtag?.("event", "whatsapp_click", { service: "automacoes" });
                                    window.open("https://wa.me/553193054200?text=Olá! Gostaria de saber mais sobre Automações Empresariais.", "_blank");
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
                            Como a Automação Ajuda sua Empresa
                        </h2>
                        <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                            A automação tira das suas mãos atividades que não precisam de esforço humano.
                            Assim, você e seu time podem focar em pensar no futuro e atender melhor os clientes.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {fallbackFeatures.map((feature, index) => (
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
                                    <CardDescription className="text-muted-foreground">{feature.description}</CardDescription>
                                </CardHeader>
                            </Card>
                        ))}
                    </div>
                </div>
            </section>

            {/* Automation Types Section */}
            <section className="py-20 bg-gradient-to-br from-quantum-light/30 to-background">
                <div className="container px-4">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-quantum bg-clip-text text-transparent">
                            Exemplos Práticos de Automação
                        </h2>
                        <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                            Veja onde a automação pode trazer resultado imediato para sua operação.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {automationTypes.map((type, index) => (
                            <Card key={index} className="bg-gradient-card border-quantum-light/20 hover:shadow-quantum transition-all duration-300 group hover:-translate-y-2">
                                <CardHeader>
                                    <CardTitle className="text-xl group-hover:text-quantum-bright transition-colors">
                                        {type.title}
                                    </CardTitle>
                                    <CardDescription className="text-muted-foreground">{type.description}</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <ul className="space-y-2">
                                        {type.benefits.map((benefit, i) => (
                                            <li key={i} className="flex items-center space-x-2">
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
                                Resultados que Fazem Diferença
                            </h2>
                            <p className="text-xl text-muted-foreground mb-8">
                                Empresas que adotam automação relatam economias reais e mais qualidade no dia a dia.
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
                                <h3 className="text-2xl font-bold mb-6 text-center">Como Implantamos</h3>
                                <div className="space-y-6">
                                    {["Análise de processos", "Planejamento", "Implementação", "Treinamento"].map((etapa, idx) => (
                                        <div key={idx} className="flex items-start space-x-4">
                                            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                                                <span className="text-sm font-bold">{idx + 1}</span>
                                            </div>
                                            <div>
                                                <h4 className="font-semibold mb-1">{etapa}</h4>
                                                <p className="text-sm text-white/80">
                                                    {idx === 0 && "Entendemos como sua empresa funciona hoje"}
                                                    {idx === 1 && "Desenhamos a solução que melhor atende sua realidade"}
                                                    {idx === 2 && "Configuramos e colocamos em prática as automações"}
                                                    {idx === 3 && "Preparamos sua equipe para usar e acompanhar os resultados"}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
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
                            <h3 className="text-3xl md:text-4xl font-bold mb-6">Quer descobrir o que pode ser automatizado no seu negócio?</h3>
                            <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto">
                                Comece com uma análise gratuita. Vamos mostrar onde a automação pode trazer mais economia, rapidez e qualidade para sua operação.
                            </p>
                            <div className="flex flex-wrap gap-4 justify-center">
                                <Button
                                    variant="outline_quantum"
                                    size="xl"
                                    className="bg-white/20 border-white/30 text-white hover:bg-white hover:text-quantum-deep track-link"
                                    onClick={() => {
                                        const gtag = getGtag();
                                        gtag?.("event", "contact_click", { service: "automacoes", source: "cta_section" });
                                        window.location.assign(buildAppPath("#contato"));
                                    }}
                                >
                                    Solicitar Análise Gratuita
                                    <ArrowRight className="h-5 w-5 ml-2" />
                                </Button>
                                <Button
                                    variant="outline_quantum"
                                    size="xl"
                                    className="bg-white/20 border-white/30 text-white hover:bg-white hover:text-quantum-deep track-link"
                                    onClick={() => {
                                        const gtag = getGtag();
                                        gtag?.("event", "case_study_request", { service: "automacoes" });
                                        window.open("https://wa.me/553193054200?text=Olá! Gostaria de ver cases de automação do Quantum Jud.", "_blank");
                                    }}
                                >
                                    Ver Cases Reais
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
