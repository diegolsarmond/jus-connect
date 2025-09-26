import { describe, expect, it } from "vitest";

import {
  type ApiProcessoResponse,
  mapApiProcessoToDetalhes,
} from "./VisualizarProcesso";

const createMockResponse = (): ApiProcessoResponse => ({
  id: 42,
  numero: "0001234-56.2024.1.00.0000",
  status: "Ativo",
  tipo: "Cível",
  classe_judicial: "Ação de Teste",
  assunto: "Cobrança",
  jurisdicao: "São Paulo - SP",
  orgao_julgador: "1ª Vara Cível",
  advogado_responsavel: "Dra. Teste",
  data_distribuicao: "2024-01-15T12:30:00Z",
  criado_em: "2024-01-16T09:00:00Z",
  atualizado_em: "2024-01-20T10:15:00Z",
  cliente: {
    id: 10,
    nome: "Cliente Exemplo",
    documento: "123.456.789-00",
    tipo: "PF",
  },
  movimentacoes: [],
  movimentacoes_count: 0,
  consultas_api_count: 0,
  judit_last_request: {
    request_id: "req-123",
    status: "completed",
    source: "automatic",
    criado_em: "2024-01-21T11:00:00Z",
    atualizado_em: "2024-01-21T11:30:00Z",
    result: {
      status: "completed",
      response_data: {
        cover: {
          numero: "0001234-56.2024.1.00.0000",
          classe: "Ação de Teste",
        },
        partes: [
          {
            nome: "Autor Exemplo",
            documento: "12345678900",
            tipo: "Autor",
          },
        ],
        movimentacoes: [
          {
            titulo: "Distribuição",
            data: "2024-01-15",
            conteudo: "Processo distribuído",
          },
        ],
        anexos: [
          {
            titulo: "Petição Inicial",
            url: "https://exemplo.com/peticao.pdf",
          },
        ],
        metadata: {
          tribunal: "TJSP",
          grau: "1º Grau",
        },
      },
    },
  },
});

describe("mapApiProcessoToDetalhes", () => {
  it("normaliza dados da Judit quando a resposta foi concluída", () => {
    const detalhes = mapApiProcessoToDetalhes(createMockResponse(), "42");

    expect(detalhes.juditLastRequest).not.toBeNull();
    expect(detalhes.juditLastRequest?.status).toBe("completed");
    expect(detalhes.responseData).not.toBeNull();
    expect(detalhes.responseData?.cover).toMatchObject({
      numero: "0001234-56.2024.1.00.0000",
      classe: "Ação de Teste",
    });
    expect(detalhes.responseData?.partes).toHaveLength(1);
    expect(detalhes.responseData?.movimentacoes).toHaveLength(1);
    expect(detalhes.responseData?.anexos).toHaveLength(1);
    expect(detalhes.responseData?.metadata).toMatchObject({
      tribunal: "TJSP",
      grau: "1º Grau",
    });
  });
});
