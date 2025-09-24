import { Link } from "react-router-dom";
import {
  Bot,
  CircuitBoard,
  Database,
  Gauge,
  Layers,
  MessageSquare,
  ShieldCheck,
  Workflow,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface ServiceCard {
  title: string;
  description: string;
  highlights: string[];
  icon: LucideIcon;
  href: string;
}

const SERVICES: ServiceCard[] = [
  {
    title: "Assistentes virtuais com IA",
    description:
      "Chatbots jurídicos especializados que automatizam atendimento, triagem de demandas e coleta de documentos.",
    highlights: ["Fluxos personalizados", "Integração com WhatsApp e e-mail", "Analytics em tempo real"],
    icon: Bot,
    href: "/servicos/assistente-ia",
  },
  {
    title: "Automações de processos",
    description:
      "Workflows inteligentes que conectam sistemas legados, capturam dados públicos e notificam seu time automaticamente.",
    highlights: ["Orquestração ponta a ponta", "Monitoramento 24/7", "Alertas por canal preferido"],
    icon: Workflow,
    href: "/servicos/automacoes",
  },
  {
    title: "CRM para advocacia",
    description:
      "Pipeline completo para gestão de leads, propostas, contratos e fidelização de clientes jurídicos.",
    highlights: ["Visão 360º do cliente", "Gestão de tarefas e SLA", "KPIs financeiros e operacionais"],
    icon: ShieldCheck,
    href: "/servicos/crm",
  },
  {
    title: "Desenvolvimento sob medida",
    description:
      "Squads multidisciplinares para criar portais, integrações e produtos digitais alinhados à estratégia do seu negócio.",
    highlights: ["Time dedicado", "Arquitetura escalável", "Design system proprietário"],
    icon: CircuitBoard,
    href: "/servicos/desenvolvimento",
  },
  {
    title: "Analytics e dados",
    description:
      "Dashboards executivos, modelos preditivos e governança de dados conectados aos seus indicadores-chave.",
    highlights: ["Governança de dados", "Indicadores personalizados", "Modelos estatísticos"],
    icon: Database,
    href: "#contato",
  },
  {
    title: "Integrações avançadas",
    description:
      "Construção e manutenção de APIs, conectores com tribunais, ERPs e plataformas financeiras.",
    highlights: ["Integrações REST e SOAP", "Filas de mensagens", "Monitoramento proativo"],
    icon: Layers,
    href: "#contato",
  },
  {
    title: "Comunicação omnichannel",
    description:
      "Campanhas automatizadas, chat em tempo real e notificações personalizadas para cada etapa da jornada.",
    highlights: ["Segmentação inteligente", "Templates aprovados pela OAB", "Engajamento mensurável"],
    icon: MessageSquare,
    href: "#contato",
  },
  {
    title: "Performance jurídica",
    description:
      "Diagnóstico completo de operação com plano de ação para acelerar produtividade e rentabilidade.",
    highlights: ["KPIs acionáveis", "Benchmark jurídico", "Roadmap evolutivo"],
    icon: Gauge,
    href: "#contato",
  },
];

const Services = () => {
  return (
    <section id="servicos" className="bg-background">
      <div className="container space-y-12 px-4 py-20">
        <div className="space-y-4 text-center">
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium uppercase tracking-wide text-primary">
            Serviços Quantum
          </span>
          <h2 className="text-3xl font-semibold text-foreground md:text-4xl">Tudo o que seu escritório precisa para escalar</h2>
          <p className="mx-auto max-w-2xl text-base text-muted-foreground">
            Do atendimento à fidelização, conectamos pessoas, processos e tecnologia para garantir uma experiência
            contínua e mensurável.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {SERVICES.map((service) => (
            <Card key={service.title} className="relative flex flex-col border-border/40 bg-background/80">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <service.icon className="h-6 w-6 text-primary" aria-hidden />
                  <CardTitle className="text-xl">{service.title}</CardTitle>
                </div>
                <CardDescription className="pt-2 text-muted-foreground">{service.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col justify-between gap-4">
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {service.highlights.map((highlight) => (
                    <li key={highlight} className="flex items-center gap-2">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
                      {highlight}
                    </li>
                  ))}
                </ul>
                <Button asChild variant="ghost" className="justify-start px-0 text-sm font-semibold text-primary">
                  <Link to={service.href}>Saiba mais</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Services;
