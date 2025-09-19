import { useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { routes } from "@/config/routes";
import { Check, ArrowRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

type PlanTemplate = {
  id: string;
  name: string;
  price: string;
  pricePeriod: string;
  activationFee: string;
  description: string;
  trialMessage: string;
  features: string[];
  highlight?: boolean;
  highlightLabel?: string;
};

const planTemplates: PlanTemplate[] = [
  {
    id: "essencial",
    name: "Essencial",
    price: "R$ 200,00",
    pricePeriod: "/mês",
    activationFee: "Taxa de ativação",
    description:
      "Ideal para escritórios em estruturação ou expansão com gestão padronizada.",
    trialMessage: "Experimente grátis por 7 dias.",
    features: [
      "Até 3 usuários",
      "1 advogado master + 2 usuários consultores",
      "Tarefas e fluxos de trabalho",
      "Prospecção 100x Station",
      "Gestão operacional com fluxos integrados",
      "Monitoramento de mídias e captura automatizada",
    ],
  },
  {
    id: "banca-juridica",
    name: "Banca Jurídica",
    price: "R$ 420,00",
    pricePeriod: "/mês",
    activationFee: "Taxa de ativação",
    description:
      "Ideal para escritórios em crescimento, com equipe híbrida e filiais.",
    trialMessage: "Experimente grátis por 7 dias.",
    features: [
      "Até 6 usuários",
      "2 advogados master + 4 usuários consultores",
      "Monitoramento de mídias e captura automatizada",
      "Gestão operacional 360°",
      "Integração com PJE, Projudi, e-SAJ e E-proc",
      "Aplicativo mobile para acompanhamento em tempo real",
    ],
  },
  {
    id: "banca-max",
    name: "Banca Max",
    price: "R$ 850,00",
    pricePeriod: "/mês",
    activationFee: "Taxa de ativação",
    description:
      "Automação avançada, IA e atendimento humanizado para bancas estruturadas.",
    trialMessage: "Experimente grátis por 7 dias.",
    features: [
      "Até 12 usuários",
      "4 advogados master + 8 usuários consultores",
      "Automação avançada com IA e fluxos inteligentes",
      "Atendimento omnichannel + captura de leads",
      "Business Intelligence com dashboards personalizados",
      "Integração com Google Agenda, Apple e Outlook",
    ],
    highlight: true,
    highlightLabel: "Mais Vendido",
  },
  {
    id: "elite",
    name: "Elite",
    price: "R$ 1.750,00",
    pricePeriod: "/mês",
    activationFee: "Taxa de ativação",
    description:
      "Experiência jurídica completa, com inteligência de dados e consultoria estratégica.",
    trialMessage: "Experimente grátis por 7 dias.",
    features: [
      "Usuários ilimitados",
      "8 advogados master + consultores ilimitados",
      "Consultoria estratégica com dados DriveIn",
      "Squad dedicado Jus Connect",
      "Integrações com BI externo e Data Driven",
      "Implantação sob medida e integrações customizadas",
    ],
  },
];

export default function NewPlan() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleCreatePlan = (template: PlanTemplate) => {
    toast({
      title: `Modelo ${template.name} criado!`,
      description:
        "O plano foi adicionado à sua base e pode ser ajustado nas configurações.",
    });
    navigate(routes.admin.plans);
  };

  const handleContact = (template: PlanTemplate) => {
    toast({
      title: "Contato registrado",
      description: `Nossa equipe comercial entrará em contato sobre o plano ${template.name}.`,
    });
  };

  return (
    <div className="space-y-10">
      <div className="text-center space-y-3">
        <Badge variant="outline" className="mx-auto border-sky-500/60 bg-sky-500/10 text-sky-200">
          Biblioteca de modelos
        </Badge>
        <div>
          <h1 className="text-3xl font-bold">Crie um novo plano</h1>
          <p className="text-muted-foreground">
            Escolha um modelo estratégico para acelerar a configuração do seu CRM
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        {planTemplates.map((template) => (
          <Card
            key={template.id}
            className={cn(
              "relative flex h-full flex-col overflow-hidden border border-white/10 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white shadow-xl",
              template.highlight &&
                "border-sky-500/60 shadow-[0_0_45px_rgba(56,189,248,0.35)]"
            )}
          >
            <div className="pointer-events-none absolute -top-20 right-0 h-48 w-48 rounded-full bg-sky-500/20 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-32 left-0 h-56 w-56 rounded-full bg-indigo-500/10 blur-3xl" />

            {template.highlight && (
              <div className="absolute left-1/2 top-4 -translate-x-1/2">
                <Badge className="flex items-center gap-2 border border-sky-400/60 bg-sky-500/20 text-sky-100">
                  <Sparkles className="h-3.5 w-3.5" />
                  {template.highlightLabel}
                </Badge>
              </div>
            )}

            <CardHeader className="space-y-5 pb-0">
              <div className="space-y-4 text-left">
                <div className="space-y-2">
                  <CardTitle className="text-3xl font-semibold text-white">
                    {template.name}
                  </CardTitle>
                  <div className="space-y-1">
                    <span className="text-xs uppercase tracking-[0.3em] text-slate-300">
                      A partir de
                    </span>
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-bold text-white">
                        {template.price}
                      </span>
                      <span className="text-base font-medium text-slate-300">
                        {template.pricePeriod}
                      </span>
                    </div>
                    <span className="text-xs font-medium uppercase tracking-[0.3em] text-slate-400">
                      {template.activationFee}
                    </span>
                  </div>
                </div>
                <CardDescription className="text-sm text-slate-200">
                  {template.description}
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent className="flex flex-col gap-5 text-slate-100">
              <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-sm text-slate-200">
                <span className="font-semibold text-sky-200">
                  {template.trialMessage}
                </span>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                  O que você terá
                </p>
                <ul className="space-y-2 text-sm text-slate-100">
                  {template.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-sky-300" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>

            <CardFooter className="mt-auto flex flex-col gap-3 p-6 pt-0 sm:flex-row">
              <Button
                className="w-full bg-sky-500 text-slate-950 hover:bg-sky-400 sm:flex-1"
                onClick={() => handleCreatePlan(template)}
              >
                Teste gratuito
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="w-full border-white/20 bg-white/10 text-white hover:bg-white/20 sm:flex-1"
                onClick={() => handleContact(template)}
              >
                Fale conosco
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}

