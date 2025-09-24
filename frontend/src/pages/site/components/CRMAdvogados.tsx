import { CheckCircle2, Scale } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface Feature {
  title: string;
  description: string;
}

const FEATURES: Feature[] = [
  {
    title: "Gestão de casos completa",
    description: "Controle prazos, responsáveis, compromissos e documentos com alertas automáticos de SLA.",
  },
  {
    title: "Fluxos financeiros integrados",
    description: "Propostas, contratos, faturamento e inadimplência no mesmo pipeline com dashboards prontos.",
  },
  {
    title: "Atendimento omnichannel",
    description: "Histórico de interações em WhatsApp, e-mail e telefone centralizado para cada cliente.",
  },
  {
    title: "Templates e automações",
    description: "Minutas, notificações e tarefas criadas automaticamente conforme o estágio do processo.",
  },
];

const CRMAdvogados = () => {
  return (
    <section id="crm" className="bg-gradient-to-b from-background via-primary/5 to-background">
      <div className="container grid gap-10 px-4 py-20 md:grid-cols-[1.2fr_1fr] md:items-center">
        <div className="space-y-6">
          <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium uppercase text-primary">
            <Scale className="h-4 w-4" aria-hidden />
            CRM QuantumJUD
          </span>
          <h2 className="text-3xl font-semibold text-foreground md:text-4xl">
            CRM criado para acelerar escritórios jurídicos e departamentos legais
          </h2>
          <p className="max-w-2xl text-base text-muted-foreground">
            Estruture sua operação com automações, relatórios financeiros, captação de novos casos e acompanhamento jurídico
            em um único lugar.
          </p>
          <ul className="space-y-3 text-sm text-muted-foreground">
            {FEATURES.map((feature) => (
              <li key={feature.title} className="flex gap-3">
                <CheckCircle2 className="mt-1 h-4 w-4 text-primary" aria-hidden />
                <div>
                  <p className="font-medium text-foreground">{feature.title}</p>
                  <p>{feature.description}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <Card className="border-primary/20 bg-background/80 shadow-xl">
          <CardHeader>
            <CardTitle className="text-xl">Pipeline jurídico em tempo real</CardTitle>
            <CardDescription>
              Visualize todo o funil: captação, propostas, contratos, andamento de processos e fidelização.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <div className="rounded-lg border border-border/30 p-4">
              <p className="font-medium text-foreground">Captação com IA</p>
              <p>Identifique oportunidades prioritárias com scoring automático e qualificações guiadas.</p>
            </div>
            <div className="rounded-lg border border-border/30 p-4">
              <p className="font-medium text-foreground">Controle financeiro</p>
              <p>Emita contratos, gere cobranças recorrentes e concilie pagamentos em poucos cliques.</p>
            </div>
            <div className="rounded-lg border border-border/30 p-4">
              <p className="font-medium text-foreground">Documentos conectados</p>
              <p>
                Monte petições e peças jurídicas com templates inteligentes integrados ao repositório e assinatura digital.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
};

export default CRMAdvogados;
