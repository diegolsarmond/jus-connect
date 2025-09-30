import { act } from "react-dom/test-utils";
import { createRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterAll, describe, expect, it, vi } from "vitest";

import {
  InformacoesProcesso as InformacoesProcessoComponent,
  TimelineMes,
  filtrarMovimentacoes,
  mapApiProcessoToViewModel,
  type ProcessoViewModel,
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
    expect(viewModel.dados.subjects).toHaveLength(0);
    expect(viewModel.dados.precatory).toBe("Não informado");
    expect(viewModel.anexos).toHaveLength(0);
    expect(viewModel.movimentacoes[0].stepType).toBe("Despacho");
    expect(viewModel.movimentacoes[0].privado).toBe(false);
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
    expect(viewModel.movimentacoes[0].stepType).toBe("Publicação");
    expect(viewModel.movimentacoes[0].conteudo).toBe("Conteúdo exibido pela nova API");
    expect(viewModel.movimentacoes[0].dataFormatada).toBe("12/04/2024");
  });

  it("ordena movimentações por data em ordem decrescente", () => {
    const resposta: ApiProcessoResponse = {
      steps: [
        {
          id: 1,
          step_date: "2024-05-02",
          step_type: "Publicação",
          content: "Primeira",
        },
        {
          id: 2,
          step_date: "2024-05-10",
          step_type: "Decisão",
          content: "Segunda",
        },
        {
          id: 3,
          step_type: "Sem data",
          content: "Sem data",
        },
      ],
    };

    const viewModel = mapApiProcessoToViewModel(resposta);

    expect(viewModel.movimentacoes.map((mov) => mov.id)).toEqual(["2", "1", "3"]);
    expect(viewModel.grupos[0].itens[0].stepType).toBe("Decisão");
    const ultimoGrupo = viewModel.grupos[viewModel.grupos.length - 1];
    expect(ultimoGrupo.itens[ultimoGrupo.itens.length - 1].stepType).toBe("Sem data");
  });

  it("organiza partes com novo formato de dados", () => {
    const resposta: ApiProcessoResponse = {
      code: "1234567-89.2024.1.00.0000",
      name: "Processo com partes",
      participants: [
        {
          name: "João da Silva",
          document: "12345678901",
          side: "plaintiff",
          person_type: "NATURAL_PERSON",
          lawyers: [
            { name: "Dra. Maria", document: "98765432100" },
            { name: "", document: "11122233344" },
          ],
        },
        {
          name: "Empresa XPTO",
          document: "00987654321000",
          side: "defendant",
          person_type: "LEGAL_ENTITY",
          lawyers: [],
        },
        {
          name: "Carlos Testemunha",
          document: "55566677788",
          side: "plaintiff",
          party_role: "TESTEMUNHA",
        },
        {
          name: "Observador",
          party_role: "TERCEIRO INTERESSADO",
          side: "outro",
        },
      ],
    };

    const viewModel = mapApiProcessoToViewModel(resposta);

    expect(viewModel.partes.total).toBe(4);
    expect(viewModel.partes.ativo).toHaveLength(1);
    expect(viewModel.partes.ativo[0].documento).toBe("*******8901");
    expect(viewModel.partes.ativo[0].tipoPessoa).toBe("Pessoa física");
    expect(viewModel.partes.ativo[0].advogados).toEqual([
      "Dra. Maria (*******2100)",
      "*******3344",
    ]);
    expect(viewModel.partes.passivo).toHaveLength(1);
    expect(viewModel.partes.passivo[0].tipoPessoa).toBe("Pessoa jurídica");
    expect(viewModel.partes.passivo[0].documento).toBe("**********1000");
    expect(viewModel.partes.testemunhas).toHaveLength(1);
    expect(viewModel.partes.testemunhas[0].papel).toBe("Testemunha");
    expect(viewModel.partes.testemunhas[0].polo).toBe("ativo");
    expect(viewModel.partes.testemunhas[0].documento).toBe("*******7788");
    expect(viewModel.partes.outros).toHaveLength(1);
    expect(viewModel.partes.outros[0].papel).toBe("Terceiro Interessado");
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
      <InformacoesProcessoComponent
        dados={viewModel.dados}
        partes={viewModel.partes}
        anexos={viewModel.anexos}
      />,
    );

    expect(html).toContain("Dados do processo");
    expect(html).toContain("Tribunal");
    expect(html).toContain("Sigla do tribunal");
    expect(html).toContain("Nenhum registro informado.");
    expect(html).toContain("Partes do processo");
    expect(html).toContain("Anexos");
  });

  it("mapeia anexos, classificações e indicadores de tags", () => {
    const resposta: ApiProcessoResponse = {
      code: "0001111-22.2024.1.00.0000",
      name: "Processo completo",
      attachments: [
        { id: 1, title: "Petição Inicial", date: "2024-05-10T12:30:00Z", url: "https://exemplo.com/1" },
        { title: "Documento sem link" },
      ],
      subjects: [
        { code: "001", name: "Direito Civil" },
        "002 - Direito Empresarial",
      ],
      classifications: [
        { code: "A123", name: "Classe A" },
      ],
      tags: {
        list: ["Urgente"],
        precatory: true,
        free_justice: "nao",
        secrecy_level: "Sigiloso",
      },
    };

    const viewModel = mapApiProcessoToViewModel(resposta);

    expect(viewModel.anexos).toHaveLength(2);
    expect(viewModel.anexos[0]).toMatchObject({ titulo: "Petição Inicial", url: "https://exemplo.com/1" });
    expect(viewModel.dados.subjects[0]).toEqual({ codigo: "001", nome: "Direito Civil" });
    expect(viewModel.dados.classifications[0]).toEqual({ codigo: "A123", nome: "Classe A" });
    expect(viewModel.dados.tags).toEqual(["Urgente"]);
    expect(viewModel.dados.precatory).toBe("Sim");
    expect(viewModel.dados.freeJustice).toBe("Não");
    expect(viewModel.dados.secrecyLevel).toBe("Sigiloso");
  });
});

describe("filtrarMovimentacoes", () => {
  it("aplica filtros de tipo e intervalo de datas", () => {
    type Item = ProcessoViewModel["movimentacoes"][number];

    const itens: Item[] = [
      {
        id: "1",
        data: new Date("2024-05-02"),
        dataOriginal: "2024-05-02",
        dataFormatada: "02/05/2024",
        stepType: "Decisão",
        conteudo: "Decisão publicada",
        privado: false,
        tags: null,
      },
      {
        id: "2",
        data: new Date("2024-05-10"),
        dataOriginal: "2024-05-10",
        dataFormatada: "10/05/2024",
        stepType: "Publicação",
        conteudo: "Publicação no diário",
        privado: false,
        tags: { formatted: "md" },
      },
      {
        id: "3",
        data: null,
        dataOriginal: null,
        dataFormatada: null,
        stepType: "Sem data",
        conteudo: "Sem data disponível",
        privado: false,
        tags: null,
      },
    ];

    const somenteDecisao = filtrarMovimentacoes(itens, {
      tipo: "decisão",
      inicio: "2024-05-01",
      fim: "2024-05-05",
    });

    expect(somenteDecisao).toHaveLength(1);
    expect(somenteDecisao[0].id).toBe("1");

    const apenasPublicacao = filtrarMovimentacoes(itens, { tipo: "publicação" });
    expect(apenasPublicacao).toHaveLength(1);
    expect(apenasPublicacao[0].id).toBe("2");

    const comIntervalo = filtrarMovimentacoes(itens, { inicio: "2024-05-01", fim: "2024-05-30" });
    expect(comIntervalo.map((item) => item.id)).toEqual(["1", "2"]);
  });
});

describe("TimelineMes", () => {
  it("renderiza markdown e permite expandir conteúdo longo", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    const conteudoLongo = `**Negrito**\n\n- Item 1\n- Item 2\n\n${"Texto adicional ".repeat(40)}`;

    act(() => {
      root.render(
        <TimelineMes
          grupo={{
            chave: "2024-05",
            rotulo: "Maio de 2024",
            ano: 2024,
            mes: 5,
            itens: [
              {
                id: "1",
                data: new Date("2024-05-10"),
                dataOriginal: "2024-05-10",
                dataFormatada: "10/05/2024",
                stepType: "Decisão",
                conteudo: conteudoLongo,
                privado: true,
                tags: { formatted: "md" },
              },
            ],
          }}
          aberto
          onToggle={() => {}}
          movimentacoesVisiveis={5}
          onVerMais={() => {}}
          virtualizado={false}
        />,
      );
    });

    const strong = container.querySelector("strong");
    expect(strong?.textContent).toBe("Negrito");
    expect(container.querySelectorAll("li").length).toBeGreaterThan(0);

    const botao = container.querySelector('[data-testid="expandir-1"]') as HTMLButtonElement | null;
    expect(botao).not.toBeNull();
    expect(botao?.textContent).toContain("Expandir");

    act(() => {
      botao?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(botao?.getAttribute("aria-expanded")).toBe("true");

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
