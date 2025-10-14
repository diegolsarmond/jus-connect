import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

const storageKey = "jus-connect-system-tutorial";

type TutorialStep = {
  title: string;
  description: string;
  highlights?: string[];
};

export function SystemTutorial() {
  const steps = useMemo<TutorialStep[]>(
    () => [
      {
        title: "Dashboard",
        description:
          "Visualize o resumo do desempenho do escritório, acompanhe indicadores principais e identifique pendências em tempo real.",
        highlights: [
          "Indicadores de produtividade",
          "Alertas de tarefas e compromissos",
          "Atalhos para as áreas mais acessadas",
        ],
      },
      {
        title: "Clientes",
        description:
          "Gerencie o cadastro completo dos clientes, acompanhando dados, contatos, histórico de atendimento e documentos compartilhados.",
        highlights: [
          "Cadastro centralizado",
          "Linha do tempo de interações",
          "Envio rápido de documentos",
        ],
      },
      {
        title: "Processos",
        description:
          "Organize processos por situação, fluxo de trabalho e responsáveis, controlando prazos, movimentações e peças vinculadas.",
        highlights: [
          "Visão por fases e status",
          "Controle de prazos automáticos",
          "Integração com documentos e tarefas",
        ],
      },
      {
        title: "Agenda e Tarefas",
        description:
          "Planeje compromissos, audiências e atividades da equipe com sincronização entre agenda, tarefas e notificações.",
        highlights: [
          "Agenda compartilhada",
          "Delegação de tarefas",
          "Alertas configuráveis",
        ],
      },
      {
        title: "Financeiro",
        description:
          "Monitore fluxos de recebimentos e pagamentos, gerando previsões, faturas e acompanhando inadimplências.",
        highlights: [
          "Fluxo de caixa",
          "Emissão de cobranças",
          "Relatórios financeiros",
        ],
      },
      {
        title: "Relatórios e Configurações",
        description:
          "Extraia relatórios personalizados por módulo e ajuste permissões, integrações e parâmetros do sistema.",
        highlights: [
          "Relatórios analíticos",
          "Gestão de usuários e acessos",
          "Integrações com parceiros",
        ],
      },
    ],
    [],
  );

  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(storageKey);
    if (stored !== "hidden") {
      setOpen(true);
    }
  }, []);

  const closeTutorial = useCallback(() => {
    if (typeof window !== "undefined") {
      if (dontShowAgain) {
        window.localStorage.setItem(storageKey, "hidden");
      } else {
        window.localStorage.removeItem(storageKey);
      }
    }
    setOpen(false);
    setStepIndex(0);
  }, [dontShowAgain]);

  const handleOpenChange = useCallback(
    (value: boolean) => {
      if (!value) {
        closeTutorial();
      } else {
        setOpen(true);
      }
    },
    [closeTutorial],
  );

  const handleNext = useCallback(() => {
    if (stepIndex < steps.length - 1) {
      setStepIndex((current) => current + 1);
    } else {
      closeTutorial();
    }
  }, [closeTutorial, stepIndex, steps.length]);

  const currentStep = steps[stepIndex];
  const isLastStep = stepIndex === steps.length - 1;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{currentStep.title}</DialogTitle>
          <DialogDescription>
            Etapa {stepIndex + 1} de {steps.length}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{currentStep.description}</p>
          {currentStep.highlights && (
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {currentStep.highlights.map((highlight) => (
                <li key={highlight}>{highlight}</li>
              ))}
            </ul>
          )}
        </div>
        <DialogFooter className="items-center justify-between gap-4 sm:flex">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground" htmlFor="tutorial-hide">
            <Checkbox
              id="tutorial-hide"
              checked={dontShowAgain}
              onCheckedChange={(checked) => setDontShowAgain(checked === true)}
            />
            Não mostrar novamente
          </label>
          <div className="flex w-full justify-end gap-2 sm:w-auto">
            <Button variant="outline" onClick={closeTutorial}>
              Fechar
            </Button>
            <Button onClick={handleNext}>{isLastStep ? "Concluir" : "Próximo"}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
