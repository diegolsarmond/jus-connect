import { CheckCircle2, Scale } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface Feature {
  title: string;
  description: string;
}

const FEATURES: Feature[] = [
  {
    title: "Integração com WhatsApp e omnichannel",
    description: "Centralize atendimentos, notificações e follow-ups em tempo real com histórico completo por cliente.",
  },
  {
    title: "IA para resumir processos",
    description: "Receba sínteses automáticas dos andamentos e próximos passos priorizados para cada caso.",
  },
  {
    title: "Redação inteligente de documentos",
    description: "Gere petições, contratos e minutas com modelos dinâmicos alimentados pelos dados do CRM.",
  },
  {
    title: "Controle financeiro e cobranças",
    description: "Fluxos completos de faturamento, alertas de inadimplência e disparos automáticos de cobrança.",
  },
];

const CRMAdvogados = () => {
  return (
    <section id="crm" className="bg-gradient-to-b from-background via-primary/5 to-background">
      <div className="container grid gap-10 px-4 py-20 md:grid-cols-[1.2fr_1fr] md:items-center">
        <div className="space-y-6">
          <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium uppercase text-primary">
            <Scale className="h-4 w-4" aria-hidden />
            CRM Jus Connect
          </span>
          <h2 className="text-3xl font-semibold text-foreground md:text-4xl">
            CRM criado para acelerar escritórios jurídicos e departamentos legais
          </h2>
          <p className="max-w-2xl text-base text-muted-foreground">
            Estruture sua operação com atendimentos digitais, inteligência artificial aplicada ao jurídico, finanças conectadas
            e uma jornada completa do cliente em um único lugar.
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
              Visualize desde o primeiro contato até o pós-venda com insights inteligentes e fluxos automatizados.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <div className="rounded-lg border border-border/30 p-4">
              <p className="font-medium text-foreground">Captação conectada</p>
              <p>
                Capture leads de WhatsApp, formulários e indicações com roteamento automático para o time responsável.
              </p>
            </div>
            <div className="rounded-lg border border-border/30 p-4">
              <p className="font-medium text-foreground">Controle financeiro</p>
              <p>Planeje honorários, receba alertas de inadimplência e programe cobranças recorrentes sem planilhas.</p>
            </div>
            <div className="rounded-lg border border-border/30 p-4">
              <p className="font-medium text-foreground">Documentos com IA</p>
              <p>
                Geração automática de petições e resumos processuais com revisão assistida e envio direto para assinatura.
              </p>
            </div>
            <div className="rounded-lg border border-border/30 p-4">
              <p className="font-medium text-foreground">Operação guiada por dados</p>
              <p>Dashboards jurídicos, operacionais e financeiros para priorizar ações e medir performance do time.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
};

export default CRMAdvogados;
