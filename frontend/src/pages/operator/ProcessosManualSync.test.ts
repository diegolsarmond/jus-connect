import { describe, expect, it } from "vitest";
import {
  planManualSyncRequest,
  type ManualSyncFlags,
  type Processo,
} from "./Processos";

const createBaseProcesso = (): Processo => ({
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
});

describe("planManualSyncRequest", () => {
  it("planeja a primeira solicitação manual com POST", () => {
    const processo = createBaseProcesso();
    const flags: ManualSyncFlags = { withAttachments: true, onDemand: true };

    const plan = planManualSyncRequest(processo, flags);

    expect(plan.path).toBe(`processos/${processo.id}/judit/sync`);
    expect(plan.method).toBe("POST");
    expect(plan.isStatusCheck).toBe(false);
    expect(plan.requestId).toBeNull();
    expect(plan.body).toMatchObject({ withAttachments: true, onDemand: true });
  });

  it("reutiliza a solicitação existente quando há um requestId", () => {
    const processo = {
      ...createBaseProcesso(),
      id: 42,
      juditLastRequest: {
        requestId: "abc-123",
        status: "pending",
        source: "manual",
        result: null,
        createdAt: null,
        updatedAt: null,
      },
    } satisfies Processo;

    const plan = planManualSyncRequest(processo, {
      withAttachments: false,
      onDemand: true,
    });

    expect(plan.path).toBe(`processos/${processo.id}/judit/requests/abc-123`);
    expect(plan.method).toBe("GET");
    expect(plan.isStatusCheck).toBe(true);
    expect(plan.requestId).toBe("abc-123");
    expect(plan.body).toBeNull();
  });
});
