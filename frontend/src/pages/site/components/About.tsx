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
    title: "Onboarding consultivo",
    description: "Especialistas acompanham cada etapa para adaptar o Quantum Jud à sua realidade jurídica.",
    icon: HandshakeIcon,
  },
  {
    title: "Resultados mensuráveis",
    description: "Metas compartilhadas, indicadores em tempo real e revisões contínuas de performance.",
    icon: Target,
  },
  {
    title: "Inovação pragmática",
    description: "IA generativa, automações e analytics aplicados a fluxos que aceleram decisões.",
    icon: Lightbulb,
  },
  {
    title: "Segurança comprovada",
    description: "Governança de dados, conformidade regulatória e monitoramento ativo da operação.",
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
              Sobre o Quantum Jud
            </span>
            <h2 className="text-3xl font-semibold text-foreground md:text-4xl">
              Plataforma completa para escritórios e departamentos jurídicos
            </h2>
            <p className="text-base text-muted-foreground">
              Nasceu dentro da Quantum Tecnologia para organizar equipes jurídicas de alto volume. Hoje o Quantum Jud integra
              relacionamento com clientes, contencioso, finanças e colaboração em uma única experiência digital.
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              <Card className="border-border/40 bg-background/80">
                <CardHeader className="pb-2">
                  <CardTitle className="text-3xl font-semibold text-foreground">120+</CardTitle>
                  <CardDescription>equipes jurídicas conectadas</CardDescription>
                </CardHeader>
              </Card>
              <Card className="border-border/40 bg-background/80">
                <CardHeader className="pb-2">
                  <CardTitle className="text-3xl font-semibold text-foreground">350+</CardTitle>
                  <CardDescription>fluxos automatizados em produção</CardDescription>
                </CardHeader>
              </Card>
              <Card className="border-border/40 bg-background/80">
                <CardHeader className="pb-2">
                  <CardTitle className="text-3xl font-semibold text-foreground">8</CardTitle>
                  <CardDescription>anos evoluindo com o setor jurídico</CardDescription>
                </CardHeader>
              </Card>
            </div>
          </div>

          <Card className="border-border/40 bg-background/70">
            <CardHeader>
            <CardTitle className="text-xl">Nossa filosofia</CardTitle>
            <CardDescription>Quatro pilares sustentam como entregamos valor de forma contínua.</CardDescription>
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
              Diagnóstico rápido, implantação guiada por especialistas e roadmap evolutivo revisado a cada ciclo.
            </p>
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-foreground">Time multidisciplinar</h3>
            <p className="text-sm text-muted-foreground">
              Estratégia, dados, UX e operações atuam juntos para suportar missões críticas do jurídico.
            </p>
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-foreground">Cultura orientada a dados</h3>
            <p className="text-sm text-muted-foreground">
              Dashboards unificados, análises recorrentes e planos de ação compartilhados com o cliente.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default About;
