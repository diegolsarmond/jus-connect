import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import {
  fetchIntimacoesOverview,
  triggerProjudiSync,
  type ProjudiSyncStatus,
  type ProjudiSyncTriggerResponse,
} from "./intimacoes";

const createJsonResponse = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("intimações service", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-15T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("aggregates notifications and projudi status into dashboard data", async () => {
    const notifications = [
      {
        id: "ntf-1",
        category: "projudi",
        type: "deadline",
        read: true,
        createdAt: "2024-06-10T12:00:00Z",
        readAt: "2024-06-12T12:00:00Z",
        metadata: { alertType: "deadline", status: "Concluída" },
      },
      {
        id: "ntf-2",
        category: "projudi",
        type: "hearing",
        read: false,
        createdAt: "2024-05-05T09:00:00Z",
        metadata: { alertType: "hearing", status: "Em andamento" },
      },
    ];

    const projudiStatus: ProjudiSyncStatus = {
      enabled: true,
      running: false,
      intervalMs: 60_000,
      lastRunAt: "2024-06-15T10:00:00Z",
      lastSuccessAt: "2024-06-15T10:00:00Z",
      lastErrorAt: null,
      lastErrorMessage: undefined,
      lastResult: {
        source: "projudi",
        startedAt: "2024-06-15T09:59:00Z",
        finishedAt: "2024-06-15T10:00:00Z",
        requestedFrom: "2024-06-14T10:00:00Z",
        totalFetched: 1,
        totalProcessed: 1,
        inserted: 1,
        updated: 0,
        latestSourceTimestamp: "2024-06-10T00:00:00Z",
        items: [
          {
            id: 10,
            origem: "projudi",
            externalId: "ext-123",
            numeroProcesso: "0001234-56.2024.8.26.0100",
            orgao: "São Paulo/SP",
            assunto: "Audiência marcada",
            status: "Em andamento",
            prazo: "2024-06-20T00:00:00Z",
            recebidaEm: "2024-06-10T00:00:00Z",
            fonteCriadaEm: "2024-06-10T00:00:00Z",
            fonteAtualizadaEm: "2024-06-11T00:00:00Z",
            payload: {
              descricao: "Descrição da intimação",
              comarca: "São Paulo",
              vara: "2ª Vara Cível",
              cliente: "Cliente Exemplo",
              juiz: "Juiz Exemplo",
              advogado: "Advogado Exemplo",
              area: "Cível",
              tags: ["prazo"],
            },
            createdAt: "2024-06-10T00:00:00Z",
            updatedAt: "2024-06-11T00:00:00Z",
            operation: "inserted",
          },
        ],
      },
      lastReferenceUsed: "2024-06-14T10:00:00Z",
      nextReference: "2024-06-15T10:05:00Z",
      nextRunAt: "2024-06-15T10:05:00Z",
      lastManualTriggerAt: null,
    };

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse(notifications))
      .mockResolvedValueOnce(createJsonResponse({ unread: 1 }))
      .mockResolvedValueOnce(createJsonResponse({ triggered: false, status: projudiStatus }));

    vi.stubGlobal("fetch", fetchMock);

    const overview = await fetchIntimacoesOverview();

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0]?.[0]).toContain("notifications");
    expect(fetchMock.mock.calls[0]?.[0]).toContain("category=projudi");

    expect(overview.summary.totalEnviadas).toBe(2);
    expect(overview.summary.totalCumpridas).toBe(1);
    expect(overview.summary.totalPendentes).toBe(1);
    expect(overview.summary.taxaCumprimento).toBeCloseTo(50);
    expect(overview.summary.prazoMedioResposta).toBeCloseTo(2);

    const currentMonth = overview.intimacoesMensais.at(-1);
    expect(currentMonth).toMatchObject({ enviadas: 1, cumpridas: 1, pendentes: 0 });

    const previousMonth = overview.intimacoesMensais.at(-2);
    expect(previousMonth).toMatchObject({ enviadas: 1, pendentes: 1, emAndamento: 1 });

    expect(overview.intimacoesPorStatus).toEqual([
      { status: "Cumpridas", value: 1 },
      { status: "Em andamento", value: 1 },
      { status: "Pendentes", value: 0 },
    ]);

    expect(overview.intimacoesPorTipo).toEqual(
      expect.arrayContaining([
        { tipo: "Prazos", value: 1 },
        { tipo: "Audiências", value: 1 },
      ]),
    );

    expect(overview.modelos).toHaveLength(1);
    const modelo = overview.modelos[0];
    expect(modelo).toMatchObject({
      id: "ext-123",
      titulo: "Audiência marcada",
      numeroProcesso: "0001234-56.2024.8.26.0100",
      comarca: "São Paulo",
      area: "Cível",
    });
    expect(modelo.tags).toEqual(expect.arrayContaining(["Prazo", "Projudi", "Nova"]));

    expect(overview.syncStatus?.lastResult?.items[0]?.externalId).toBe("ext-123");
  });

  it("triggers a manual projudi sync", async () => {
    const payload: ProjudiSyncTriggerResponse = {
      triggered: true,
      status: {
        enabled: true,
        running: true,
        intervalMs: 60_000,
        lastRunAt: "2024-06-15T10:00:00Z",
        lastSuccessAt: "2024-06-15T09:55:00Z",
        lastErrorAt: null,
        lastErrorMessage: undefined,
        lastResult: undefined,
        lastReferenceUsed: null,
        nextReference: null,
        nextRunAt: null,
        lastManualTriggerAt: "2024-06-15T12:00:00Z",
      },
    };

    const fetchMock = vi.fn().mockResolvedValue(createJsonResponse(payload));
    vi.stubGlobal("fetch", fetchMock);

    const result = await triggerProjudiSync();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.triggered).toBe(true);
    expect(result.status.running).toBe(true);
  });
});
