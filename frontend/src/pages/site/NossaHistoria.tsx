import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SimpleBackground from "@/components/ui/SimpleBackground";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lightbulb, Rocket, ShieldCheck, Target, Users } from "lucide-react";

const milestones = [
  {
    period: "2017",
    title: "Fundação da Quantum",
    description:
      "Nasce a Quantum Tecnologia com a missão de acelerar a transformação digital de empresas brasileiras.",
  },
  {
    period: "2019",
    title: "Primeiras automações e IA",
    description:
      "Implementamos nossos primeiros projetos de automação em escala e assistentes inteligentes baseados em IA.",
  },
  {
    period: "2021",
    title: "Expansão Nacional",
    description:
      "Atingimos clientes em todo o território nacional com squads dedicados e uma operação 100% remota.",
  },
  {
    period: "2023",
    title: "Soluções Proprietárias",
    description:
      "Lançamos produtos próprios como o QuantumJUD, combinando dados jurídicos, automações e analytics avançado.",
  },
  {
    period: "2024+",
    title: "Futuro Colaborativo",
    description:
      "Seguimos co-criando com nossos clientes experiências digitais centradas em dados, IA e hiperautomação.",
  },
];

const pillars = [
  {
    icon: Target,
    title: "Foco em Resultado",
    description:
      "Projetos orientados a métricas de negócio, com sprints curtos, entregas contínuas e governança compartilhada.",
  },
  {
    icon: Users,
    title: "Parceria de Longo Prazo",
    description:
      "Trabalhamos lado a lado com times internos, capacitando pessoas e garantindo adoção plena das soluções.",
  },
  {
    icon: Lightbulb,
    title: "Inovação Aplicada",
    description:
      "Aplicamos IA generativa, automações e design centrado no usuário para resolver desafios reais do dia a dia.",
  },
  {
    icon: ShieldCheck,
    title: "Confiança e Segurança",
    description:
      "Estruturas robustas de segurança, compliance e privacidade em cada projeto entregue pela Quantum.",
  },
];

const recognitions = [
  {
    title: "+50 projetos digitais",
    description: "Transformações conduzidas para setores jurídico, financeiro, varejo e indústria.",
  },
  {
    title: "+5 anos de jornada",
    description: "Experiência acumulada com squads multidisciplinares atuando em escala nacional.",
  },
  {
    title: "+200 automações ativas",
    description: "Workflows monitorados 24/7 garantindo eficiência operacional para nossos clientes.",
  },
];

const NossaHistoria = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />

      <main>
        <section className="relative overflow-hidden bg-gradient-to-b from-quantum-deep/90 via-quantum-deep/60 to-background pt-28 pb-24 text-white">
          <SimpleBackground className="opacity-20" />
          <div className="container relative z-10 px-4">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-medium backdrop-blur">
                <Rocket className="h-4 w-4" />
                Nossa trajetória
              </div>
              <h1 className="mt-6 text-4xl md:text-6xl font-bold leading-tight">
                Uma história de evolução contínua guiada por tecnologia, pessoas e propósito
              </h1>
              <p className="mt-6 text-lg md:text-xl text-white/85">
                Desde 2017, a Quantum Tecnologia combina estratégia, design e engenharia para construir soluções que aceleram negócios e criam experiências digitais memoráveis.
              </p>
              <div className="mt-10 grid gap-6 sm:grid-cols-3">
                <Card className="border-white/20 bg-white/10 backdrop-blur">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-3xl font-bold text-white">50+</CardTitle>
                  </CardHeader>
                  <CardContent className="text-white/80 text-sm">
                    Projetos entregues com foco em ROI e adoção completa pelos usuários.
                  </CardContent>
                </Card>
                <Card className="border-white/20 bg-white/10 backdrop-blur">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-3xl font-bold text-white">200+</CardTitle>
                  </CardHeader>
                  <CardContent className="text-white/80 text-sm">
                    Automações e integrações mantidas em operação para diferentes setores.
                  </CardContent>
                </Card>
                <Card className="border-white/20 bg-white/10 backdrop-blur">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-3xl font-bold text-white">24/7</CardTitle>
                  </CardHeader>
                  <CardContent className="text-white/80 text-sm">
                    Suporte especializado e squads dedicados acompanhando cada cliente.
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>

        <section className="relative py-20">
          <div className="absolute inset-0">
            <SimpleBackground className="opacity-40" />
          </div>
          <div className="container relative z-10 px-4">
            <div className="mb-12 max-w-2xl">
              <h2 className="text-3xl md:text-5xl font-bold mb-4 bg-gradient-quantum bg-clip-text text-transparent">
                Marcos da nossa jornada
              </h2>
              <p className="text-lg text-muted-foreground">
                Crescemos conectando tecnologia e estratégia para gerar resultados sustentáveis em organizações de todos os portes.
              </p>
            </div>

            <div className="space-y-8 border-l border-quantum-light/30 pl-8">
              {milestones.map((milestone) => (
                <div key={milestone.period} className="relative pl-8">
                  <span className="absolute -left-11 flex h-10 w-10 items-center justify-center rounded-full bg-gradient-quantum text-white shadow-glow">
                    {milestone.period}
                  </span>
                  <h3 className="text-2xl font-semibold text-foreground">{milestone.title}</h3>
                  <p className="mt-2 text-muted-foreground">{milestone.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20 bg-background">
          <div className="container px-4">
            <div className="mb-12 max-w-2xl">
              <h2 className="text-3xl md:text-5xl font-bold mb-4 bg-gradient-quantum bg-clip-text text-transparent">
                O que nos move
              </h2>
              <p className="text-lg text-muted-foreground">
                Nossa cultura é orientada por pilares que garantem impacto real para os clientes e evolução contínua para o nosso time.
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              {pillars.map((pillar) => (
                <Card key={pillar.title} className="border-quantum-light/30 bg-gradient-card hover:shadow-quantum transition-all duration-300">
                  <CardHeader className="flex flex-row items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-quantum text-white shadow-glow">
                      <pillar.icon className="h-6 w-6" />
                    </div>
                    <CardTitle className="text-xl text-foreground">{pillar.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-muted-foreground text-base">
                    {pillar.description}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20 bg-muted/40">
          <div className="container px-4">
            <div className="mb-12 max-w-2xl">
              <h2 className="text-3xl md:text-5xl font-bold mb-4 text-foreground">Reconhecimentos dos nossos clientes</h2>
              <p className="text-lg text-muted-foreground">
                Cada projeto concluído fortalece nossa parceria com empresas que confiam na Quantum para liderar seus movimentos digitais.
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              {recognitions.map((item) => (
                <Card key={item.title} className="border-quantum-light/20 bg-background shadow-card">
                  <CardHeader>
                    <CardTitle className="text-2xl font-semibold text-foreground">{item.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-muted-foreground text-base">{item.description}</CardContent>
                </Card>
              ))}
            </div>
            <div className="mt-16 flex flex-col gap-4 rounded-3xl bg-gradient-quantum px-8 py-12 text-white shadow-quantum md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-3xl font-bold">Pronto para escrever os próximos capítulos com a gente?</h3>
                <p className="mt-2 text-white/80 text-lg">
                  Vamos explorar como a Quantum pode impulsionar seus resultados com tecnologia e estratégia.
                </p>
              </div>
              <Button
                variant="outline_quantum"
                size="lg"
                className="bg-white/15 border-white/40 text-white hover:bg-white hover:text-quantum-deep"
                onClick={() => document.getElementById("contato")?.scrollIntoView({ behavior: "smooth" })}
              >
                Fale com nosso time
              </Button>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default NossaHistoria;
