import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import planUpgradeIllustration from "@/assets/plan-upgrade-illustration.svg";

export const planUpgradeIllustrationUrl = planUpgradeIllustration;

type ModuleCopy = {
  title: string;
  description: string;
};

const moduleCopyMap: Record<string, ModuleCopy> = {
  dashboard: {
    title: "Painel completo para acompanhar o escritório",
    description:
      "Ative o dashboard inteligente e monitore indicadores, atividades e resultados em um só lugar, com dados em tempo real.",
  },
  conversas: {
    title: "Centralize conversas com clientes",
    description:
      "Gerencie atendimentos, responda mais rápido e acompanhe históricos em todos os canais com o módulo de Conversas.",
  },
  clientes: {
    title: "Crie um CRM jurídico poderoso",
    description:
      "Cadastre clientes, organize dados sensíveis e mantenha relacionamentos saudáveis com automações feitas para o dia a dia jurídico.",
  },
  fornecedores: {
    title: "Organize seus parceiros em um só lugar",
    description:
      "Controle cadastros de fornecedores, contratos e pagamentos futuros com a visibilidade que o seu time precisa.",
  },
  pipeline: {
    title: "Ganhe previsibilidade com o pipeline comercial",
    description:
      "Estruture fluxos de oportunidades, acompanhe etapas e feche novos contratos com mais agilidade.",
  },
  agenda: {
    title: "Nunca mais perca um compromisso",
    description:
      "Sincronize compromissos, atribua responsáveis e acompanhe reuniões e audiências com notificações inteligentes.",
  },
  tarefas: {
    title: "Transforme tarefas em entregas",
    description:
      "Distribua atividades entre a equipe, acompanhe prazos e garanta que nada passe despercebido.",
  },
  processos: {
    title: "Controle o andamento dos processos",
    description:
      "Monitore prazos, publique movimentações e concentre documentos importantes em um só ambiente seguro.",
  },
  intimacoes: {
    title: "Automatize o acompanhamento de intimações",
    description:
      "Receba alertas instantâneos, organize responsáveis e reduza riscos com o monitoramento proativo de intimações.",
  },
  documentos: {
    title: "Padronize documentos em minutos",
    description:
      "Acesse modelos, edite contratos e colabore em tempo real com o módulo de Documentos avançado.",
  },
  financeiro: {
    title: "Domine os números do escritório",
    description:
      "Registre lançamentos, acompanhe entradas e saídas e projete resultados com o módulo Financeiro.",
  },
  relatorios: {
    title: "Tome decisões com dados confiáveis",
    description:
      "Gere relatórios personalizados, acompanhe indicadores chave e compartilhe insights com a liderança.",
  },
  suporte: {
    title: "Acesse o suporte premium do Jus Connect",
    description:
      "Priorize chamados, fale com especialistas e garanta que o time tenha a ajuda necessária em cada etapa.",
  },
  "configuracoes-usuarios": {
    title: "Gestão avançada de usuários",
    description:
      "Controle permissões, convites e níveis de acesso com workflows prontos para equipes em crescimento.",
  },
  configuracoes: {
    title: "Personalize o Jus Connect para o seu escritório",
    description:
      "Ative o módulo de configurações para adaptar fluxos, integrações e parametrizações ao seu jeito de trabalhar.",
  },
  "configuracoes-integracoes": {
    title: "Integre suas ferramentas preferidas",
    description:
      "Conecte softwares jurídicos, CRMs, plataformas de comunicação e muito mais em poucos cliques.",
  },
  "configuracoes-parametros": {
    title: "Parametrize processos e cadastros",
    description:
      "Defina campos, etiquetas e regras específicas para manter a base de dados organizada e atualizada.",
  },
  "meu-plano": {
    title: "Gerencie a assinatura do seu escritório",
    description:
      "Visualize informações de cobrança, atualize o plano atual e acompanhe limites diretamente na plataforma.",
  },
};

const fallbackCopy: ModuleCopy = {
  title: "Libere novos recursos no Jus Connect",
  description:
    "Conheça os planos disponíveis e ative funcionalidades que ajudam seu escritório a ganhar eficiência e resultados.",
};

const resolveCopy = (moduleId: string | string[] | undefined): ModuleCopy => {
  if (!moduleId) {
    return fallbackCopy;
  }

  const moduleIds = Array.isArray(moduleId) ? moduleId : [moduleId];

  for (const id of moduleIds) {
    const copy = moduleCopyMap[id];
    if (copy) {
      return copy;
    }
  }

  return fallbackCopy;
};

interface PlanUpgradePromptProps {
  module?: string | string[];
}

export const PlanUpgradePrompt = ({ module }: PlanUpgradePromptProps) => {
  const copy = resolveCopy(module);

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-10">
      <div className="flex w-full max-w-[420px] flex-col items-center gap-6 text-center">
        <img
          src={planUpgradeIllustration}
          alt="Ilustração de atualização de plano com destaque para recursos premium"
          className="w-full max-w-[280px]"
        />
        <div className="space-y-3">
          <h1 className="text-2xl font-semibold leading-snug text-foreground sm:text-3xl">{copy.title}</h1>
          <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">{copy.description}</p>
        </div>
        <Button asChild size="lg" className="w-full sm:w-auto">
          <Link to="/meu-plano">Conhecer planos</Link>
        </Button>
      </div>
    </div>
  );
};

export type { ModuleCopy };
export { moduleCopyMap };
