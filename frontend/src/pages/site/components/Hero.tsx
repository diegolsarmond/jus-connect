import { Link } from "react-router-dom";
import { ShieldCheck, Sparkles, Workflow } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import SimpleBackground from "@/components/ui/SimpleBackground";
import { Button } from "@/components/ui/button";
import { routes } from "@/config/routes";

interface Highlight {
  icon: LucideIcon;
  title: string;
  description: string;
}

const HIGHLIGHTS: Highlight[] = [
  {
    icon: Sparkles,
    title: "IA aplicada",
    description: "Assistentes digitais e automações inteligentes em toda a jornada do cliente.",
  },
  {
    icon: Workflow,
    title: "Operações integradas",
    description: "Conectamos CRM, financeiro, documentos e comunicação em um único fluxo.",
  },
  {
    icon: ShieldCheck,
    title: "Segurança e compliance",
    description: "Arquitetura confiável com governança de dados e monitoramento contínuo.",
  },
];

const Hero = () => {
  return (
    <section id="hero" className="relative overflow-hidden bg-gradient-to-br from-background via-primary/5 to-accent/10">
      <div className="absolute inset-0" aria-hidden>
        <SimpleBackground className="opacity-80" />
      </div>
      <div className="container relative z-10 grid gap-12 px-4 pb-24 pt-28 md:grid-cols-[1.4fr_1fr] md:items-center">
        <div className="space-y-8">
          <span className="inline-flex items-center rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
            Plataforma para equipes de alta performance
          </span>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight text-foreground md:text-5xl">
            Tecnologia, dados e automação para impulsionar a operação da sua empresa
          </h1>
          <p className="max-w-2xl text-lg text-muted-foreground">
            Centralize clientes, projetos, finanças e comunicação em uma experiência completa. A Quantum conecta IA generativa e
            fluxo de trabalho para que seu time entregue valor desde o primeiro dia.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <Button asChild size="lg" className="text-base font-semibold">
              <Link to={routes.register}>Começar agora</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="text-base">
              <Link to="/#contato">Solicitar demonstração</Link>
            </Button>
          </div>
          <dl className="grid gap-4 sm:grid-cols-3">
            {HIGHLIGHTS.map((highlight) => (
              <div
                key={highlight.title}
                className="rounded-xl border border-border/40 bg-background/60 p-4 shadow-sm backdrop-blur"
              >
                <highlight.icon className="h-5 w-5 text-primary" aria-hidden />
                <dt className="mt-4 text-sm font-medium text-foreground">{highlight.title}</dt>
                <dd className="mt-2 text-sm text-muted-foreground">{highlight.description}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="relative flex justify-center">
          <div className="relative rounded-3xl border border-border/30 bg-background/70 p-6 shadow-xl backdrop-blur">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-muted-foreground">Visão do cliente</span>
                <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">Tempo real</span>
              </div>
              <div className="space-y-3">
                <div className="rounded-lg border border-border/30 p-3">
                  <p className="text-sm font-semibold text-foreground">Lead qualificado</p>
                  <p className="text-xs text-muted-foreground">Fluxo automatizado: captação → qualificação → proposta</p>
                </div>
                <div className="rounded-lg border border-border/30 p-3">
                  <p className="text-sm font-semibold text-foreground">Agenda inteligente</p>
                  <p className="text-xs text-muted-foreground">IA sugere priorização de compromissos e tarefas críticas</p>
                </div>
                <div className="rounded-lg border border-border/30 p-3">
                  <p className="text-sm font-semibold text-foreground">Alertas financeiros</p>
                  <p className="text-xs text-muted-foreground">Receitas recorrentes, inadimplências e KPIs atualizados</p>
                </div>
              </div>
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm text-primary">
                "Com a Quantum, a gente conseguiu reduzir em 45% o tempo gasto com follow-up e gestão de demandas."
                <p className="mt-2 text-xs text-muted-foreground">— Cliente Quantum</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
