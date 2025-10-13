import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import TypebotBubble from "@/components/site/TypebotBubble";
import { getApiUrl } from "@/lib/api";
import {
    ArrowRight,
    BarChart3,
    Building2,
    Check,
    FileText,
    Layers,
    MessageSquare,
    Shield,
    Users,
    Workflow,
    Zap,
    Scale,
    Sparkle,
    CheckCircle2
} from "lucide-react";

// Optional helper types and functions (unused but kept for future extension)
type GtagFunction = (...args: unknown[]) => void;

interface PlanoDisponivel {
    id: number;
    nome: string;
    ativo: boolean;
    descricao: string | null;
    recursos: string[];
    valorMensal: number | null;
    valorAnual: number | null;
    precoMensal: string | null;
    precoAnual: string | null;
    descontoAnualPercentual: number | null;
    economiaAnualFormatada: string | null;
}

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
});

function normalizeApiRows(data: unknown): unknown[] {
    if (Array.isArray(data)) {
        return data;
    }

    if (Array.isArray((data as { rows?: unknown[] })?.rows)) {
        return (data as { rows: unknown[] }).rows;
    }

    const nestedData = (data as { data?: unknown })?.data;
    if (Array.isArray(nestedData)) {
        return nestedData;
    }

    if (Array.isArray((nestedData as { rows?: unknown[] })?.rows)) {
        return (nestedData as { rows: unknown[] }).rows;
    }

    return [];
}

function toNumber(value: unknown): number | null {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }

    if (typeof value === "string") {
        const trimmed = value.trim();
        if (!trimmed) {
            return null;
        }

        const sanitized = trimmed.replace(/[^\d,.-]/g, "").replace(/\.(?=.*\.)/g, "");
        const normalized = sanitized.replace(",", ".");
        const result = Number(normalized);
        return Number.isFinite(result) ? result : null;
    }

    if (typeof value === "boolean") {
        return value ? 1 : 0;
    }

    return null;
}

function parseBooleanFlag(value: unknown): boolean | null {
    if (typeof value === "boolean") {
        return value;
    }

    if (typeof value === "number") {
        return Number.isFinite(value) ? value !== 0 : null;
    }

    if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        if (!normalized) {
            return null;
        }
        if (["1", "true", "sim", "yes", "y", "ativo"].includes(normalized)) {
            return true;
        }
        if (["0", "false", "nao", "não", "no", "n", "inativo"].includes(normalized)) {
            return false;
        }
    }

    return null;
}

function parseRecursos(value: unknown): string[] {
    const seen = new Set<string>();
    const seenObjects = new Set<object>();
    const result: string[] = [];

    const add = (entry: string) => {
        const normalized = entry.trim();
        if (!normalized || seen.has(normalized)) {
            return;
        }
        seen.add(normalized);
        result.push(normalized);
    };

    const handleString = (input: string) => {
        input
            .split(/[\n;,]+/)
            .map((item) => item.trim())
            .filter(Boolean)
            .forEach(add);
    };

    const visit = (input: unknown): void => {
        if (input == null) {
            return;
        }

        if (typeof input === "string") {
            handleString(input);
            return;
        }

        if (typeof input === "number" || typeof input === "boolean") {
            add(String(input));
            return;
        }

        if (Array.isArray(input)) {
            input.forEach(visit);
            return;
        }

        if (typeof input === "object") {
            if (seenObjects.has(input as object)) {
                return;
            }

            seenObjects.add(input as object);

            const record = input as Record<string, unknown>;
            const candidateKeys = [
                "disponiveis",
                "disponiveisPersonalizados",
                "available",
                "availableFeatures",
                "inclusos",
                "incluidos",
                "lista",
                "items",
                "features",
                "recursosDisponiveis",
                "recursos_disponiveis",
                "recursos",
                "modulos",
                "modules",
                "rows",
                "data",
                "values",
                "value",
            ];

            const excludedPattern = /(indispon|unavailable|exclu|negad)/i;
            let matchedCandidate = false;

            for (const key of candidateKeys) {
                if (key in record) {
                    matchedCandidate = true;
                    visit(record[key]);
                }
            }

            if (!matchedCandidate) {
                for (const [key, entry] of Object.entries(record)) {
                    if (excludedPattern.test(key)) {
                        continue;
                    }

                    if (/^\d+$/.test(key)) {
                        visit(entry);
                    }
                }
            }
        }
    };

    visit(value);

    return result;
}

function roundCurrency(value: number): number {
    return Math.round(value * 100) / 100;
}

function computePricingDetails(valorMensal: number | null, valorAnual: number | null) {
    const precoMensal = valorMensal !== null ? currencyFormatter.format(valorMensal) : null;
    const precoAnual = valorAnual !== null ? currencyFormatter.format(valorAnual) : null;

    if (valorMensal === null || valorAnual === null) {
        return {
            precoMensal,
            precoAnual,
            descontoPercentual: null,
            economiaAnual: null,
            economiaAnualFormatada: null,
        } as const;
    }

    const totalMensal = valorMensal * 12;
    const economiaBruta = roundCurrency(Math.max(0, totalMensal - valorAnual));
    const descontoPercentual =
        totalMensal > 0 && economiaBruta > 0 ? Math.round((economiaBruta / totalMensal) * 100) : null;

    return {
        precoMensal,
        precoAnual,
        descontoPercentual,
        economiaAnual: economiaBruta > 0 ? economiaBruta : null,
        economiaAnualFormatada: economiaBruta > 0 ? currencyFormatter.format(economiaBruta) : null,
    } as const;
}

// Este helper captura a função gtag, caso esteja disponível no navegador.
const getGtag = (): GtagFunction | undefined => {
    if (typeof window === "undefined") {
        return undefined;
    }
    return (window as typeof window & { gtag?: GtagFunction }).gtag;
};

const CRM = () => {
    // Títulos e textos do cabeçalho configurados para serem claros e convidativos
    const heroLabel = "Suíte Completa de CRM Quantum Jud";
    const heroHeadline = "Gerencie seus clientes de forma simples e eficiente";
    const heroDescription =
        "Centralize suas interações, automatize tarefas repetitivas e acompanhe suas vendas em uma plataforma fácil de usar.";

    // Lista de recursos apresentados de forma simples e acessível
    const generalFeatures = useMemo(
        () => [
            {
                icon: Zap,
                title: "Automação de Tarefas",
                description:
                    "Deixe o sistema cuidar de cadastros, lembretes e atualizações automaticamente.",
            },
            {
                icon: MessageSquare,
                title: "Centralização de Contatos",
                description:
                    "Converse com clientes por e-mail, WhatsApp e telefone em um só lugar.",
            },
            {
                icon: BarChart3,
                title: "Relatórios Claros",
                description:
                    "Visualize indicadores de desempenho em relatórios simples e intuitivos.",
            },
            {
                icon: Shield,
                title: "Segurança e Privacidade",
                description:
                    "Seus dados protegidos com criptografia e controle de acesso.",
            },
            {
                icon: FileText,
                title: "Gestão de Documentos",
                description:
                    "Organize contratos, processos e arquivos de forma prática.",
            },
            {
                icon: Workflow,
                title: "Integração Fácil",
                description:
                    "Conecte o CRM com outros sistemas e aplicativos do seu negócio.",
            },
        ],
        [],
    );

    // Como estamos usando dados mockados, as features são estáticas
    const featureCards = useMemo(() => generalFeatures, [generalFeatures]);

    // Segmentos atendidos com exemplos e destaques
    const industries = [
        {
            icon: Scale,
            title: "Advocacia",
            description: "Gestão completa de processos, prazos e relacionamento com clientes e correspondentes.",
            highlights: ["Integração com tribunais", "Automação de prazos", "Geração de peças e contratos"],
        },
        {
            icon: Building2,
            title: "Mercado Imobiliário",
            description: "Gestão de funil de vendas, propostas e pós-venda para construtoras e imobiliárias.",
            highlights: ["Integração com portais", "Controle de documentos", "Follow-up automático"],
        },
    ];

    // Diferenciais específicos para escritórios de advocacia
    const lawDifferentials = [
        {
            icon: Users,
            title: "Gestão de Clientes e Casos",
            description: "Dossiês completos com histórico de atendimento, honorários e documentos vinculados.",
        },
        {
            icon: FileText,
            title: "Automação de Peças",
            description: "Modelos inteligentes que preenchem dados de processos e geram peças em poucos cliques.",
        },
        {
            icon: Workflow,
            title: "Fluxos de Prazos",
            description: "Alertas automáticos e redistribuição de tarefas conforme SLA e especialidade jurídica.",
        },
        {
            icon: Layers,
            title: "Controle Financeiro",
            description: "Painéis de receitas recorrentes, adiantamentos e divisão de honorários por sócio.",
        },
    ];

    const successMetrics = [
        "Redução média de 45% no tempo de atualização de processos",
        "Aumento de 60% na taxa de conversão de leads jurídicos",
        "Visão 360º da carteira com relatórios executivos semanais",
        "Suporte especializado com onboarding em até 14 dias",
    ];

    const includedInAllPlans = [
        {
            icon: Sparkle,
            title: "Onboarding estratégico guiado",
            description: "Migração assistida, parametrização de fluxos e acompanhamento dedicado durante os primeiros 90 dias.",
        },
        {
            icon: MessageSquare,
            title: "Suporte humano multicanal",
            description: "Especialistas disponíveis por WhatsApp, chat e e-mail com SLA de respostas em minutos.",
        },
        {
            icon: Shield,
            title: "Segurança jurídica e LGPD",
            description: "Criptografia de ponta a ponta, trilhas de auditoria e hospedagem em nuvem certificada no Brasil.",
        },
        {
            icon: BarChart3,
            title: "Dashboards executivos",
            description: "Painéis personalizados com previsibilidade de receitas, produtividade e margens por unidade de negócio.",
        },
    ];

    const [planosDisponiveis, setPlanosDisponiveis] = useState<PlanoDisponivel[]>([]);
    const [planosLoading, setPlanosLoading] = useState(true);
    const [planosError, setPlanosError] = useState<string | null>(null);

    useEffect(() => {
        let disposed = false;
        const controller = new AbortController();

        const loadPlans = async () => {
            setPlanosLoading(true);
            setPlanosError(null);

            try {
                const response = await fetch(getApiUrl("planos"), {
                    headers: { Accept: "application/json" },
                    signal: controller.signal,
                });

                if (!response.ok) {
                    throw new Error(`Falha ao carregar planos (HTTP ${response.status})`);
                }

                const payload = await response.json();
                const rows = normalizeApiRows(payload);
                const parsed = rows
                    .map((entry) => {
                        if (!entry || typeof entry !== "object") {
                            return null;
                        }

                        const record = entry as Record<string, unknown>;
                        const id = toNumber(record["id"]);
                        if (id === null) {
                            return null;
                        }

                        const nomeCandidate = typeof record["nome"] === "string" ? record["nome"].trim() : null;
                        const ativo = parseBooleanFlag(record["ativo"]) ?? true;
                        const descricaoRaw =
                            typeof record["descricao"] === "string"
                                ? record["descricao"].trim()
                                : typeof record["detalhes"] === "string"
                                  ? record["detalhes"].trim()
                                  : null;
                        const recursos = parseRecursos([
                            record["recursos"],
                            record["recursosDisponiveis"],
                            record["recursos_disponiveis"],
                            record["features"],
                            record["items"],
                            record["modules"],
                            record["modulos"],
                        ]);

                        const rawValorMensal =
                            (record["valor_mensal"] ??
                                record["valorMensal"] ??
                                record["preco_mensal"] ??
                                record["precoMensal"]) as unknown;
                        const rawValorAnual =
                            (record["valor_anual"] ??
                                record["valorAnual"] ??
                                record["preco_anual"] ??
                                record["precoAnual"]) as unknown;

                        const valorMensal = toNumber(rawValorMensal);
                        const valorAnual = toNumber(rawValorAnual);
                        const pricing = computePricingDetails(valorMensal, valorAnual);

                        const precoMensal =
                            pricing.precoMensal ??
                            (typeof rawValorMensal === "string" && rawValorMensal.trim() ? rawValorMensal.trim() : null);
                        const precoAnual =
                            pricing.precoAnual ??
                            (typeof rawValorAnual === "string" && rawValorAnual.trim() ? rawValorAnual.trim() : null);

                        return {
                            id,
                            nome: nomeCandidate && nomeCandidate.length > 0 ? nomeCandidate : `Plano ${id}`,
                            ativo,
                            descricao: descricaoRaw && descricaoRaw.length > 0 ? descricaoRaw : null,
                            recursos,
                            valorMensal,
                            valorAnual,
                            precoMensal,
                            precoAnual,
                            descontoAnualPercentual: pricing.descontoPercentual,
                            economiaAnualFormatada: pricing.economiaAnualFormatada,
                        } satisfies PlanoDisponivel;
                    })
                    .filter((item): item is PlanoDisponivel => item !== null);

                if (!disposed) {
                    setPlanosDisponiveis(parsed);
                }
            } catch (error) {
                if (error instanceof DOMException && error.name === "AbortError") {
                    return;
                }
                console.error(error);
                if (!disposed) {
                    setPlanosError("Não foi possível carregar os planos disponíveis no momento.");
                    setPlanosDisponiveis([]);
                }
            } finally {
                if (!disposed) {
                    setPlanosLoading(false);
                }
            }
        };

        void loadPlans();

        return () => {
            disposed = true;
            controller.abort();
        };
    }, []);

    const planosAtivos = useMemo(() => planosDisponiveis.filter((plan) => plan.ativo), [planosDisponiveis]);

    const planosOrdenados = useMemo(() => {
        if (planosAtivos.length === 0) {
            return [];
        }

        return [...planosAtivos].sort((a, b) => {
            const valorA = a.valorMensal ?? (a.valorAnual !== null ? a.valorAnual / 12 : Number.POSITIVE_INFINITY);
            const valorB = b.valorMensal ?? (b.valorAnual !== null ? b.valorAnual / 12 : Number.POSITIVE_INFINITY);
            return valorA - valorB;
        });
    }, [planosAtivos]);

    const destaquePlanoId = useMemo(() => {
        if (planosOrdenados.length === 0) {
            return null;
        }

        const destaque = planosOrdenados.reduce((acc, plan) => {
            const accValor = acc.valorMensal ?? (acc.valorAnual !== null ? acc.valorAnual / 12 : 0);
            const planValor = plan.valorMensal ?? (plan.valorAnual !== null ? plan.valorAnual / 12 : 0);
            return planValor > accValor ? plan : acc;
        }, planosOrdenados[0]);

        return destaque.id;
    }, [planosOrdenados]);

    const handleDemoClick = (source: string) => {
        const gtag = getGtag();
        gtag?.("event", "crm_demo_click", {
            service: "crm",
            source,
        });
        document.getElementById("contato")?.scrollIntoView({ behavior: "smooth" });
    };

    const handleWhatsappClick = (source: string) => {
        const gtag = getGtag();
        gtag?.("event", "crm_whatsapp_click", {
            service: "crm",
            source,
        });
        window.open("https://wa.me/553193054200?text=Olá! Gostaria de saber mais sobre a suíte de CRMs do Quantum Jud.", "_blank");
    };

    return (
        <div className="min-h-screen bg-background">
            <TypebotBubble />
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
                </div>
            </section>

            {/* Industries Section */}
            <section className="py-20 bg-gradient-to-br from-quantum-light/20 to-background">
                <div className="container px-4">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-quantum bg-clip-text text-transparent">
                            Especializado em Segmentos Estratégicos
                        </h2>
                        <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                            Operações jurídicas e imobiliárias contam com fluxos prontos, integrações profundas e relatórios sob medida para
                            acelerar resultados desde o primeiro mês.
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
                            <div className="space-y-12 mb-10">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {lawDifferentials.map((item) => (
                                        <Card key={item.title} className="border-quantum-light/20 hover:border-quantum-bright/40 transition-all duration-300 hover:-translate-y-1">
                                            <CardHeader className="pb-3">
                                                <div className="p-3 rounded-full bg-gradient-quantum w-fit mb-3">
                                                    <item.icon className="h-5 w-5 text-white" />
                                                </div>
                                                <CardTitle className="text-lg">{item.title}</CardTitle>
                                                <CardDescription className="text-muted-foreground text-sm">{item.description}</CardDescription>
                                            </CardHeader>
                                        </Card>
                                    ))}
                                </div>

                                <div className="space-y-8">

                                    <div className="space-y-4">
                                        <span className="inline-flex items-center gap-2 rounded-full border border-quantum-light/40 bg-background/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-quantum-bright">
                                            Planos Quantum
                                        </span>
                                        <h3 className="text-3xl font-semibold leading-tight">
                                            <span className="bg-gradient-to-r from-quantum-bright via-quantum-cyan to-quantum-light bg-clip-text text-transparent">
                                                Planos que evoluem com o seu escritório
                                            </span>
                                        </h3>
                                        <p className="text-base text-muted-foreground">
                                            Compare modalidades, desbloqueie funcionalidades avançadas e garanta que cada etapa da operação jurídica esteja coberta com automação, inteligência e atendimento consultivo.
                                        </p>
                                    </div>

                                    <div className="space-y-6">
                                        {planosLoading ? (
                                            <Card className="border-quantum-light/40 bg-background/70 backdrop-blur">
                                                <CardContent className="flex items-center justify-center p-8">
                                                    <p className="text-sm text-muted-foreground animate-pulse">Carregando opções de planos...</p>
                                                </CardContent>
                                            </Card>
                                        ) : planosError ? (
                                            <Card className="border-destructive/40 bg-destructive/5">
                                                <CardContent className="space-y-4 p-6">
                                                    <p className="text-sm text-destructive">{planosError}</p>
                                                    <div className="flex flex-wrap gap-3">
                                                        <Button
                                                            variant="quantum"
                                                            className="track-link"
                                                            onClick={() => handleDemoClick("planos_erro")}
                                                        >
                                                            Solicitar atendimento
                                                            <ArrowRight className="h-5 w-5 ml-2" />
                                                        </Button>
                                                        <Button
                                                            variant="outline_quantum"
                                                            className="track-link"
                                                            onClick={() => handleWhatsappClick("planos_erro")}
                                                        >
                                                            Falar no WhatsApp
                                                        </Button>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ) : planosOrdenados.length > 0 ? (
                                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                                {planosOrdenados.map((plan) => (
                                                    <Card
                                                        key={plan.id}
                                                        className={`relative flex h-full flex-col overflow-hidden border bg-background/70 backdrop-blur transition-all duration-300 hover:-translate-y-2 hover:shadow-quantum ${
                                                            destaquePlanoId === plan.id
                                                                ? "border-transparent shadow-quantum ring-2 ring-quantum-bright/60"
                                                                : "border-quantum-light/20"
                                                        }`}
                                                    >
                                                        {destaquePlanoId === plan.id && (
                                                            <span className="absolute top-4 right-4 rounded-full bg-gradient-quantum px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
                                                                Mais completo
                                                            </span>
                                                        )}
                                                        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-quantum-bright/60 to-transparent"></div>
                                                        <CardHeader className="space-y-4">
                                                            <div className="space-y-2">
                                                                <CardTitle className="text-2xl">{plan.nome}</CardTitle>
                                                                {plan.descricao && (
                                                                    <CardDescription className="text-muted-foreground leading-relaxed">
                                                                        {plan.descricao}
                                                                    </CardDescription>
                                                                )}
                                                            </div>
                                                            <div className="space-y-2">
                                                                {plan.precoMensal && (
                                                                    <div className="flex items-baseline gap-2">
                                                                        <span className="text-3xl font-bold text-quantum-bright">{plan.precoMensal}</span>
                                                                        <span className="text-sm text-muted-foreground">/mês</span>
                                                                    </div>
                                                                )}
                                                                {plan.precoAnual && (
                                                                    <p className="text-sm text-muted-foreground">
                                                                        Plano anual: {plan.precoAnual}
                                                                        {plan.descontoAnualPercentual !== null
                                                                            ? ` • até ${plan.descontoAnualPercentual}% de economia`
                                                                            : plan.economiaAnualFormatada
                                                                                ? ` • Economize ${plan.economiaAnualFormatada}`
                                                                                : ""}
                                                                    </p>
                                                                )}
                                                                {!plan.precoMensal && !plan.precoAnual && (
                                                                    <p className="text-sm text-muted-foreground">Investimento sob consulta.</p>
                                                                )}
                                                            </div>
                                                        </CardHeader>
                                                        <CardContent className="flex flex-1 flex-col gap-4">
                                                            <div className="space-y-3">
                                                                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-quantum-light">Principais benefícios</p>
                                                                <ul className="space-y-2">
                                                                    {plan.recursos.length > 0 ? (
                                                                        plan.recursos.slice(0, 6).map((feature) => (
                                                                            <li key={feature} className="flex items-start gap-3 text-sm text-muted-foreground">
                                                                                <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-quantum-bright" />
                                                                                <span>{feature}</span>
                                                                            </li>
                                                                        ))
                                                                    ) : (
                                                                        <li className="text-sm text-muted-foreground">
                                                                            Personalize o pacote com nossos especialistas para incluir os recursos desejados.
                                                                        </li>
                                                                    )}
                                                                </ul>
                                                            </div>
                                                        </CardContent>
                                                        <CardFooter className="mt-auto flex flex-col gap-3">
                                                            <Button
                                                                variant="quantum"
                                                                className="w-full track-link"
                                                                onClick={() => handleDemoClick(`plan_${plan.id}`)}
                                                            >
                                                                Solicitar proposta
                                                                <ArrowRight className="h-5 w-5 ml-2" />
                                                            </Button>
                                                            <Button
                                                                variant="outline_quantum"
                                                                className="w-full track-link"
                                                                onClick={() => handleWhatsappClick(`plan_${plan.id}`)}
                                                            >
                                                                Falar no WhatsApp
                                                            </Button>
                                                        </CardFooter>
                                                    </Card>
                                                ))}
                                            </div>
                                        ) : (
                                            <Card className="border-dashed border-quantum-light/40 bg-background/60 backdrop-blur">
                                                <CardContent className="p-6 space-y-4">
                                                    <p className="text-sm text-muted-foreground">
                                                        Nenhum plano disponível no momento. Entre em contato para receber uma proposta personalizada.
                                                    </p>
                                                    <div className="flex flex-wrap gap-3">
                                                        <Button
                                                            variant="quantum"
                                                            className="track-link"
                                                            onClick={() => handleDemoClick("planos_vazios")}
                                                        >
                                                            Solicitar atendimento
                                                            <ArrowRight className="h-5 w-5 ml-2" />
                                                        </Button>
                                                        <Button
                                                            variant="outline_quantum"
                                                            className="track-link"
                                                            onClick={() => handleWhatsappClick("planos_vazios")}
                                                        >
                                                            Falar no WhatsApp
                                                        </Button>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        )}

                                        <div className="rounded-3xl border border-quantum-light/30 bg-background/70 p-6 shadow-sm backdrop-blur">
                                            <div className="mb-6 flex items-center gap-3">
                                                <div className="rounded-full bg-gradient-quantum p-3 text-white">
                                                    <Layers className="h-5 w-5" />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-quantum-light">Tudo incluso</p>
                                                    <h4 className="text-lg font-semibold">Recursos presentes em todos os planos</h4>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                {includedInAllPlans.map((item) => (
                                                    <div
                                                        key={item.title}
                                                        className="group flex items-start gap-3 rounded-2xl border border-transparent bg-white/5 p-4 transition-all duration-300 hover:border-quantum-bright/40 hover:bg-quantum-bright/5"
                                                    >
                                                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-quantum text-white shadow-inner transition-transform duration-300 group-hover:scale-105">
                                                            <item.icon className="h-5 w-5" />
                                                        </div>
                                                        <div>
                                                            <p className="font-semibold text-foreground">{item.title}</p>
                                                            <p className="text-sm text-muted-foreground">{item.description}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>

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
                                    <a href="/produtos/crm-advocacia">Conheça o CRM para Advocacia</a>
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
                                Solicite uma demonstração personalizada e conheça na prática como o Quantum Jud pode conectar equipes, clientes e resultados.
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
