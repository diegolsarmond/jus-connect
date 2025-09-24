import type { SVGProps } from "react";

import { Lightbulb, Rocket, Target } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface Pillar {
  title: string;
  description: string;
  icon: (props: SVGProps<SVGSVGElement>) => JSX.Element;
}

const PILLARS: Pillar[] = [
  {
    title: "Parceria estratégica",
    description: "Co-criamos soluções com o seu time, da imersão inicial ao acompanhamento pós-go live.",
    icon: HandshakeIcon,
  },
  {
    title: "Foco em resultado",
    description: "Metas claras, indicadores acompanhados semanalmente e entregas incrementais.",
    icon: Target,
  },
  {
    title: "Inovação aplicada",
    description: "IA generativa, automações e analytics a serviço de problemas reais do dia a dia.",
    icon: Lightbulb,
  },
  {
    title: "Escala com qualidade",
    description: "Processos, governança e segurança preparados para operações críticas.",
    icon: Rocket,
  },
];

function HandshakeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={props.className}
    >
      <path
        d="M3 10.5 7.5 6l4 4 4-4L21 10.5l-4 4-4-4-4 4-4-4Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7 14.5 9 16.5M15 16.5l2-2M11 18.5l2-2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const About = () => {
  return (
    <section id="sobre" className="bg-background">
      <div className="container space-y-12 px-4 py-20">
        <div className="grid gap-8 md:grid-cols-[1.1fr_1fr] md:items-start">
          <div className="space-y-4">
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium uppercase tracking-wide text-primary">
              Sobre a Quantum
            </span>
            <h2 className="text-3xl font-semibold text-foreground md:text-4xl">
              Especialistas em transformação digital para operações complexas
            </h2>
            <p className="text-base text-muted-foreground">
              Desde 2017, atuamos com squads multidisciplinares combinando estratégia, design e engenharia de software para
              entregar jornadas digitais que impactam indicadores de crescimento e eficiência operacional.
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              <Card className="border-border/40 bg-background/80">
                <CardHeader className="pb-2">
                  <CardTitle className="text-3xl font-semibold text-foreground">50+</CardTitle>
                  <CardDescription>projetos digitais entregues</CardDescription>
                </CardHeader>
              </Card>
              <Card className="border-border/40 bg-background/80">
                <CardHeader className="pb-2">
                  <CardTitle className="text-3xl font-semibold text-foreground">200+</CardTitle>
                  <CardDescription>automações monitoradas</CardDescription>
                </CardHeader>
              </Card>
              <Card className="border-border/40 bg-background/80">
                <CardHeader className="pb-2">
                  <CardTitle className="text-3xl font-semibold text-foreground">7</CardTitle>
                  <CardDescription>anos de evolução contínua</CardDescription>
                </CardHeader>
              </Card>
            </div>
          </div>

          <Card className="border-border/40 bg-background/70">
            <CardHeader>
              <CardTitle className="text-xl">Nossa filosofia</CardTitle>
              <CardDescription>Quatro pilares sustentam nossa forma de trabalhar e entregar valor.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {PILLARS.map((pillar) => (
                <div key={pillar.title} className="flex gap-3">
                  <pillar.icon className="mt-1 h-5 w-5 text-primary" aria-hidden />
                  <div>
                    <p className="font-medium text-foreground">{pillar.title}</p>
                    <p className="text-sm text-muted-foreground">{pillar.description}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 rounded-2xl border border-border/40 bg-background/70 p-8 md:grid-cols-3">
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-foreground">Como trabalhamos</h3>
            <p className="text-sm text-muted-foreground">
              Kick-off imersivo, discovery colaborativo, desenvolvimento ágil com demos quinzenais e operação assistida após
              o lançamento.
            </p>
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-foreground">Time multidisciplinar</h3>
            <p className="text-sm text-muted-foreground">
              Profissionais de estratégia, engenharia de dados, UX e operações garantem visão 360º da solução.
            </p>
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-foreground">Cultura orientada a dados</h3>
            <p className="text-sm text-muted-foreground">
              Indicadores claros, análises contínuas e rituais de melhoria para sustentar crescimento previsível.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default About;
