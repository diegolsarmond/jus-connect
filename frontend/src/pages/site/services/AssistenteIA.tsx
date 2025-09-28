import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Bot, MessageSquare, Zap, BarChart3, Clock, Shield, ArrowRight, CheckCircle } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import TypebotBubble from "@/components/site/TypebotBubble";
import { getGtag } from "@/lib/gtag";
import { buildAppPath } from "@/config/app-config";

const AssistenteIA = () => {
    const fallbackFeatures = useMemo(
        () => [
            {
                icon: MessageSquare,
                title: "Entendimento de Conversa",
                description: "O assistente entende perguntas em linguagem natural, como se fosse uma pessoa real.",
            },
            {
                icon: Clock,
                title: "Disponível 24 horas",
                description: "Funciona o tempo todo, inclusive à noite, finais de semana e feriados.",
            },
            {
                icon: Zap,
                title: "Respostas Rápidas",
                description: "Sem filas de espera: o cliente recebe retorno imediato para suas dúvidas.",
            },
            {
                icon: BarChart3,
                title: "Aprendizado Contínuo",
                description: "Cada conversa gera dados que ajudam sua empresa a melhorar o atendimento.",
            },
            {
                icon: Shield,
                title: "Segurança dos Dados",
                description: "Todas as informações trocadas ficam protegidas com criptografia.",
            },
        ],
        [],
    );

    const heroLabel = "Assistente Virtual com IA";
    const heroHeadline = "Atendimento Inteligente e Personalizado";
    const heroDescription =
        "Um atendente virtual que conversa como uma pessoa, responde dúvidas de forma imediata e nunca sai de férias. Ideal para empresas que querem melhorar a experiência do cliente e reduzir custos.";

    const benefits = [
        "Atende várias pessoas ao mesmo tempo sem perder qualidade",
        "Reduz em até 70% o volume de atendimentos manuais",
        "Aumenta a satisfação do cliente em mais de 40%",
        "Economia significativa em tempo e custos de operação",
        "Resolve instantaneamente dúvidas comuns",
        "Funciona em canais como WhatsApp, Telegram e site",
        "Pode ser personalizado para qualquer área ou negócio",
    ];

    const useCases = [
        {
            title: "E-commerce",
            description: "Responde perguntas sobre produtos, prazos de entrega e políticas de troca.",
        },
        {
            title: "Serviços Financeiros",
            description: "Ajuda com informações de saldo, extratos, pagamentos e orientações.",
        },
        {
            title: "Saúde",
            description: "Permite agendamento de consultas, lembretes de medicação e tira dúvidas rápidas.",
        },
        {
            title: "Educação",
            description: "Apoia alunos em dúvidas sobre matrículas, cronogramas e conteúdos de estudo.",
        },
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
                            Como o Assistente Funciona
                        </h2>
                        <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                            Ele conversa com seus clientes de forma natural, entende as perguntas e entrega respostas rápidas e seguras.
                            É como ter alguém sempre disponível para atender, mas sem custos extras de pessoal.
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

            {/* Benefits Section */}
            <section className="py-20 bg-gradient-to-br from-quantum-light/30 to-background">
                <div className="container px-4">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                        <div>
                            <h2 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-quantum bg-clip-text text-transparent">
                                Benefícios Reais
                            </h2>
                            <p className="text-xl text-muted-foreground mb-8">
                                Mais do que tecnologia, o Assistente Virtual é um apoio prático para sua empresa crescer sem aumentar custos.
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
                                <h3 className="text-2xl font-bold mb-6 text-center">Onde Usar</h3>
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
                            <h3 className="text-3xl md:text-4xl font-bold mb-6">Quer ter um assistente sempre disponível?</h3>
                            <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto">
                                Com um Assistente Virtual com IA, sua empresa melhora o atendimento, reduz custos e ganha eficiência
                                sem complicação. Ele cuida das perguntas do dia a dia e libera sua equipe para o que realmente importa.
                            </p>
                            <div className="flex flex-wrap gap-4 justify-center">
                                <Button
                                    variant="outline_quantum"
                                    size="xl"
                                    className="bg-white/20 border-white/30 text-white hover:bg-white hover:text-quantum-deep track-link"
                                    onClick={() => {
                                        const gtag = getGtag();
                                        gtag?.("event", "contact_click", {
                                            service: "assistente_ia",
                                            source: "cta_section",
                                        });
                                        window.location.assign(buildAppPath("#contato"));
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
                                        gtag?.("event", "demo_request", {
                                            service: "assistente_ia",
                                            source: "cta_section",
                                        });
                                        window.open(
                                            "https://wa.me/553193054200?text=Olá! Gostaria de agendar uma demonstração do Assistente Virtual com IA.",
                                            "_blank"
                                        );
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
