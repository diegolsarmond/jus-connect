import { ShieldCheck, Sparkles, Workflow } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import SimpleBackground from "@/components/ui/SimpleBackground";

interface Highlight {
  icon: LucideIcon;
  title: string;
  description: string;
}

const HIGHLIGHTS: Highlight[] = [
  {
    icon: Sparkles,
    title: "Dados confiáveis",
    description: "Centralize processos, publicações e documentos em um painel único.",
  },
  {
    icon: Workflow,
    title: "Fluxos automatizados",
    description: "Padronize tarefas críticas com automações e playbooks jurídicos.",
  },
  {
    icon: ShieldCheck,
    title: "Conformidade total",
    description: "Governança, rastreabilidade e controles alinhados à LGPD.",
  },
];

const Hero = () => {
  return (
    <section id="hero" className="relative overflow-hidden bg-gradient-to-br from-background via-primary/5 to-accent/10">
      <div className="absolute inset-0" aria-hidden>
        <SimpleBackground className="opacity-80" />
      </div>
      <div className="container relative z-10 grid gap-12 px-4 pb-24 pt-28">
        <div className="space-y-8">
          <span className="inline-flex items-center rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
            Plataforma jurídica inteligente
          </span>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight text-foreground md:text-5xl">
            Jus Connect organiza o contencioso e o relacionamento com clientes em um só lugar
          </h1>
          <p className="max-w-2xl text-lg text-muted-foreground">
            Elimine planilhas paralelas, acompanhe indicadores em tempo real e ofereça experiências digitais modernas para o
            seu escritório ou departamento jurídico.
          </p>
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

      </div>
    </section>
  );
};

export default Hero;
