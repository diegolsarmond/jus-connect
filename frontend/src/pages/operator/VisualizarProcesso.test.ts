import { renderToString } from "react-dom/server";
import { afterAll, describe, expect, it, vi } from "vitest";

import {
  InformacoesProcesso as InformacoesProcessoComponent,
  mapApiProcessoToViewModel,
  type ApiProcessoResponse,
} from "./VisualizarProcesso";
import {
  agruparPorMes,
  deduplicarMovimentacoes,
  diasDesde,
  type MovimentoComIdEData,
} from "./utils/processo-ui";

vi.useFakeTimers();

afterAll(() => {
  vi.useRealTimers();
});

describe("processo-ui utils", () => {
  it("agruparPorMes organiza por ordem decrescente e separa desconhecidos", () => {
    const itens: MovimentoComIdEData[] = [
      { id: "1", data: new Date("2024-09-15") },
      { id: "2", data: new Date("2024-09-01") },
      { id: "3", data: new Date("2023-12-20") },
      { id: "4", data: null },
    ];

    const grupos = agruparPorMes(itens);

    expect(grupos).toHaveLength(3);
    expect(grupos[0].rotulo).toBe("Setembro de 2024");
    expect(grupos[0].itens.map((item) => item.id)).toEqual(["1", "2"]);
    expect(grupos[1].rotulo).toBe("Dezembro de 2023");
    expect(grupos[2].rotulo).toBe("Data desconhecida");
    expect(grupos[2].itens[0].id).toBe("4");
  });

  it("diasDesde calcula diferença em dias corridos", () => {
    vi.setSystemTime(new Date("2024-05-20T12:00:00Z"));

    expect(diasDesde(new Date("2024-05-18T03:00:00Z"))).toBe(2);
    expect(diasDesde("2024-05-19")).toBe(1);
    expect(diasDesde(null)).toBeNull();
  });

  it("deduplicarMovimentacoes remove itens com mesmo id ou mesmo conteúdo", () => {
    const lista = [
      { id: 1, data: "2024-05-01", tipo: "Despacho", conteudo: "Texto" },
      { id: 1, data: "2024-05-01", tipo: "Despacho", conteudo: "Texto" },
      { id: null, data: "2024-05-02", tipo: "Decisão", conteudo: "Outro" },
      { id: undefined, data: "2024-05-02", tipo: "Decisão", conteudo: "Outro" },
    ];

    const resultado = deduplicarMovimentacoes(lista);

    expect(resultado).toHaveLength(2);
    expect(resultado[0].id).toBe(1);
    expect(resultado[1].tipo).toBe("Decisão");
  });
});

describe("mapApiProcessoToViewModel", () => {
  it("fornece dados com fallbacks e partes vazias", () => {
    const resposta: ApiProcessoResponse = {
      code: null,
      name: null,
      status: null,
      phase: null,
      area: null,
      steps: [
        { id: 10, date: "2024-03-10", title: "Despacho" },
        { id: 10, date: "2024-03-10", title: "Despacho" },
      ],
      participants: [],
    };

    const viewModel = mapApiProcessoToViewModel(resposta);

    expect(viewModel.cabecalho.codigo).toBe("Não informado");
    expect(viewModel.cabecalho.nome).toBe("Não informado");
    expect(viewModel.partes.total).toBe(0);
    expect(viewModel.dados.amount).toBe("Não informado");
    expect(viewModel.movimentacoes).toHaveLength(1);
  });

  it("mapeia passos da nova API quando não há dados adicionais", () => {
    const resposta: ApiProcessoResponse = {
      code: "0000000-00.0000.0.00.0000",
      name: "Processo de Exemplo",
      steps: [
        {
          id: null,
          date: "2024-04-12T10:00:00Z",
          title: "Publicação",
          description: "Conteúdo exibido pela nova API",
        },
      ],
    };

    const viewModel = mapApiProcessoToViewModel(resposta);

    expect(viewModel.movimentacoes).toHaveLength(1);
    expect(viewModel.movimentacoes[0].linhas[0].texto).toBe("Publicação");
  });

  it("renderiza Informações e Partes com dados faltantes", () => {
    const resposta: ApiProcessoResponse = {
      code: "0001111-22.2024.1.00.0000",
      name: "Processo sem dados",
      participants: [],
      steps: [],
    };

    const viewModel = mapApiProcessoToViewModel(resposta);

    const html = renderToString(
      <InformacoesProcessoComponent dados={viewModel.dados} partes={viewModel.partes} />,
    );

    expect(html).toContain("Dados do processo");
    expect(html).toContain("Tribunal");
    expect(html).toContain("Sigla do tribunal");
    expect(html).toContain("Nenhum registro informado.");
    expect(html).toContain("Partes do processo");
  });
});
