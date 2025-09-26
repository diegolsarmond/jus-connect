import { describe, expect, it } from "vitest";
import { act } from "react-dom/test-utils";
import { createRoot } from "react-dom/client";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ProcessosSyncAction, type Processo } from "./Processos";

const baseProcesso: Processo = {
  id: 1,
  numero: "12345678901234567890",
  dataDistribuicao: "01/01/2024",
  status: "Ativo",
  tipo: "Teste",
  cliente: { id: 10, nome: "Cliente", documento: "", papel: "" },
  advogados: [],
  classeJudicial: "Classe",
  assunto: "Assunto",
  jurisdicao: "Jurisdição",
  orgaoJulgador: "Órgão",
  proposta: null,
  ultimaSincronizacao: null,
  consultasApiCount: 0,
  movimentacoesCount: 0,
  juditTrackingId: null,
  juditTrackingHourRange: null,
  juditLastRequest: null,
  trackingSummary: null,
  responseData: null,
};

type RenderResult = {
  container: HTMLElement;
  unmount: () => void;
};

const renderWithTooltip = (element: React.ReactElement): RenderResult => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(<TooltipProvider>{element}</TooltipProvider>);
  });

  return {
    container,
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
};

describe("ProcessosSyncAction", () => {
  it("não renderiza o botão quando o plano bloqueia a sincronização", () => {
    const { container, unmount } = renderWithTooltip(
      <ProcessosSyncAction
        allowsSync={false}
        syncLimit={null}
        processo={baseProcesso}
        isSyncing={false}
        onSync={() => {}}
      />,
    );

    try {
      const button = container.querySelector("button");
      expect(button).toBeNull();
      expect(container.textContent).toContain("Sincronização indisponível");
    } finally {
      unmount();
    }
  });

  it("desabilita o botão quando o limite de sincronizações do plano é atingido", () => {
    const processoComLimite: Processo = {
      ...baseProcesso,
      consultasApiCount: 3,
    };

    const { container, unmount } = renderWithTooltip(
      <ProcessosSyncAction
        allowsSync
        syncLimit={3}
        processo={processoComLimite}
        isSyncing={false}
        onSync={() => {}}
      />,
    );

    try {
      const button = container.querySelector("button");
      expect(button).not.toBeNull();
      expect(button?.disabled).toBe(true);
    } finally {
      unmount();
    }
  });
});
