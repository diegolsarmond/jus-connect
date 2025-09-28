import { Link } from "react-router-dom";
import { Bot, CircuitBoard, Database, Layers, ShieldCheck, Workflow } from "lucide-react";
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
      "Chatbots inteligentes que automatizam atendimento, qualificação de leads e suporte em múltiplos segmentos.",
    highlights: [
      "Fluxos personalizados",
      "Integração com WhatsApp, e-mail e CRMs com API aberta",
      "Analytics em tempo real",
    ],
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
    title: "CRM",
    description:
      "Plataforma única para gerir processos, tarefas, agendas, documentos padrão, finanças e relacionamento com clientes.",
    highlights: [
      "Gestão completa de processos e fluxos de trabalho",
      "Central de conversas com WhatsApp integrado",
      "Integração com PJe, PROJUDI e gateways de pagamento",
    ],
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
    title: "Consultoria em TI",
    description:
      "Planejamento e execução de projetos que exigem precisão, estratégia e resultados tangíveis para o seu negócio.",
    highlights: [
      "Descoberta e desenho de soluções sob medida",
      "Arquiteturas robustas e seguras",
      "Acompanhamento de ponta a ponta",
    ],
    icon: Database,
    href: "#contato",
  },
  {
    title: "Servidores personalizados",
    description:
      "Infraestrutura dedicada com monitoramento, segurança e escalabilidade alinhadas às demandas do seu projeto.",
    highlights: [
      "Configurações sob medida",
      "Monitoramento e suporte especializado",
      "Opções de alta disponibilidade",
    ],
    icon: Layers,
    href: "#contato",
  },
];

const Services = () => {
  return (
    <section id="servicos" className="bg-background">
      <div className="container space-y-12 px-4 py-20">
        <div className="space-y-4 text-center">
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium uppercase tracking-wide text-primary">
            Nossas Soluções
          </span>
          <h2 className="text-3xl font-semibold text-foreground md:text-4xl">
                      Sua aliada na jornada de transformação até a conquista de resultados.
          </h2>
          <p className="mx-auto max-w-2xl text-base text-muted-foreground">
                      Desenvolvemos soluções digitais que tornam os processos mais ágeis e fortalecem os resultados de nossos clientes.
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
