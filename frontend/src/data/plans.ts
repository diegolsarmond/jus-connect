export type BillingCycle = "monthly" | "yearly";

export type Plan = {
  id: string;
  name: string;
  description: string;
  monthlyPrice: number;
  yearlyPrice: number;
  features: string[];
  popular?: boolean;
};

export const plans: Plan[] = [
  {
    id: "starter",
    name: "Essencial",
    description: "Recursos fundamentais para escritórios iniciantes",
    monthlyPrice: 149,
    yearlyPrice: 1490,
    features: [
      "Gestão de processos ilimitada",
      "Cadastro de clientes e partes",
      "Agenda integrada com notificações",
      "Modelos de documentos personalizados",
    ],
  },
  {
    id: "professional",
    name: "Profissional",
    description: "A escolha ideal para escritórios em crescimento",
    monthlyPrice: 249,
    yearlyPrice: 2490,
    popular: true,
    features: [
      "Todos os recursos do Essencial",
      "Automação de tarefas e fluxos",
      "Time tracking e gestão financeira",
      "Integração com WhatsApp e e-mail",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    description: "Soluções avançadas para equipes de alta performance",
    monthlyPrice: 449,
    yearlyPrice: 4490,
    features: [
      "Todos os recursos do Profissional",
      "Dashboards personalizados",
      "Integrações sob medida",
      "Suporte prioritário 24/7",
    ],
  },
];
