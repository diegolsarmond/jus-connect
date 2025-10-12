import { useMemo } from "react";

export interface MovimentoComIdEData {
  id: string;
  data: Date | null;
}

export interface GrupoDeMovimentacoes<T extends MovimentoComIdEData> {
  chave: string;
  rotulo: string;
  ano: number | null;
  mes: number | null;
  itens: T[];
}

export interface MovimentacaoBruta {
  id?: string | number | null;
  data?: string | null;
  tipo?: string | null;
  tipo_andamento?: string | null;
  conteudo?: string | null;
  texto_categoria?: string | null;
}

const ENTITY_MAP: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#34;": '"',
  "&#39;": "'",
  "&#x27;": "'",
  "&#x2F;": "/",
};

let cachedDomDecoder: HTMLTextAreaElement | null = null;

function decodeWithDom(valor: string): string | null {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return null;
  }

  cachedDomDecoder = cachedDomDecoder ?? document.createElement("textarea");
  cachedDomDecoder.innerHTML = valor;
  const decoded = cachedDomDecoder.value;
  cachedDomDecoder.value = "";
  return decoded;
}

const NORMALIZE_TAG_REGEX = /<[^>]+>/gi;
const MULTIPLE_SPACES_REGEX = /[ \t]{2,}/g;
const HTML_ENTITY_DEC_REGEX = /&#(\d+);/g;
const HTML_ENTITY_HEX_REGEX = /&#x([0-9a-f]+);/gi;

function removerCssInline(texto: string): string {
  if (!texto.includes("{") || !texto.includes("}")) {
    return texto;
  }

  let resultado = "";
  let profundidade = 0;

  for (let index = 0; index < texto.length; index += 1) {
    const caractere = texto[index];

    if (caractere === "{") {
      profundidade += 1;

      while (resultado.endsWith(" ") || resultado.endsWith("\t")) {
        resultado = resultado.slice(0, -1);
      }

      while (resultado && !resultado.endsWith("\n")) {
        resultado = resultado.slice(0, -1);
      }

      continue;
    }

    if (caractere === "}") {
      if (profundidade > 0) {
        profundidade -= 1;
        continue;
      }
    }

    if (profundidade === 0) {
      resultado += caractere;
    }
  }

  return resultado;
}

export function decodificarHtml(valor: string): string {
  if (typeof valor !== "string" || !valor) {
    return "";
  }

  let resultado = valor;

  Object.entries(ENTITY_MAP).forEach(([entity, replacement]) => {
    resultado = resultado.replace(new RegExp(entity, "g"), replacement);
  });

  resultado = resultado
    .replace(HTML_ENTITY_DEC_REGEX, (_, codigo: string) => {
      const numero = Number.parseInt(codigo, 10);
      return Number.isFinite(numero) ? String.fromCharCode(numero) : "";
    })
    .replace(HTML_ENTITY_HEX_REGEX, (_, codigo: string) => {
      const numero = Number.parseInt(codigo, 16);
      return Number.isFinite(numero) ? String.fromCharCode(numero) : "";
    });

  const domDecoded = decodeWithDom(resultado);
  if (typeof domDecoded === "string" && domDecoded) {
    resultado = domDecoded;
  }

  return resultado;
}

export function normalizarTexto(valor?: string | null): string {
  if (typeof valor !== "string" || !valor.trim()) {
    return "";
  }

  let texto = decodificarHtml(valor)
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/?p>/gi, "\n")
    .replace(/\r\n/g, "\n")
    .replace(/\u00a0/g, " ");

  texto = removerCssInline(texto);
  texto = texto.replace(NORMALIZE_TAG_REGEX, " ");
  texto = texto.replace(/\*\*/g, "");
  texto = texto.replace(/\\/g, "");
  texto = texto.replace(MULTIPLE_SPACES_REGEX, " ");
  texto = texto
    .split("\n")
    .map((linha) => linha.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");

  return texto.trim();
}

export function diasDesde(data: Date | string | null | undefined): number | null {
  if (!data) {
    return null;
  }

  const objetoData = data instanceof Date ? data : new Date(data);

  if (Number.isNaN(objetoData.getTime())) {
    return null;
  }

  const hoje = new Date();
  const inicio = Date.UTC(
    objetoData.getFullYear(),
    objetoData.getMonth(),
    objetoData.getDate(),
  );
  const hojeUtc = Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());

  return Math.max(0, Math.floor((hojeUtc - inicio) / 86_400_000));
}

const MESES_PT_BR = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

const CHAVE_DESCONHECIDA = "desconhecido";

export function agruparPorMes<T extends MovimentoComIdEData>(
  movimentacoes: T[],
): GrupoDeMovimentacoes<T>[] {
  if (!Array.isArray(movimentacoes) || movimentacoes.length === 0) {
    return [];
  }

  const copiado = [...movimentacoes].sort((a, b) => {
    const dataA = a.data ? a.data.getTime() : Number.NEGATIVE_INFINITY;
    const dataB = b.data ? b.data.getTime() : Number.NEGATIVE_INFINITY;

    if (dataA === dataB) {
      return a.id.localeCompare(b.id);
    }

    return dataB - dataA;
  });

  const grupos = new Map<string, GrupoDeMovimentacoes<T>>();
  const desconhecidos: T[] = [];

  copiado.forEach((item) => {
    if (!item.data) {
      desconhecidos.push(item);
      return;
    }

    const ano = item.data.getFullYear();
    const mes = item.data.getMonth();
    const chave = `${ano}-${String(mes + 1).padStart(2, "0")}`;

    if (!grupos.has(chave)) {
      const rotuloMes = MESES_PT_BR[mes] ?? item.data.toLocaleString("pt-BR", {
        month: "long",
      });
      const rotuloCapitalizado =
        rotuloMes.charAt(0).toUpperCase() + rotuloMes.slice(1).toLowerCase();

      grupos.set(chave, {
        chave,
        rotulo: `${rotuloCapitalizado} de ${ano}`,
        ano,
        mes: mes + 1,
        itens: [],
      });
    }

    grupos.get(chave)?.itens.push(item);
  });

  const resultado = Array.from(grupos.values());

  resultado.forEach((grupo) => {
    grupo.itens.sort((a, b) => {
      const dataA = a.data ? a.data.getTime() : Number.NEGATIVE_INFINITY;
      const dataB = b.data ? b.data.getTime() : Number.NEGATIVE_INFINITY;

      if (dataA === dataB) {
        return a.id.localeCompare(b.id);
      }

      return dataB - dataA;
    });
  });

  if (desconhecidos.length > 0) {
    resultado.push({
      chave: CHAVE_DESCONHECIDA,
      rotulo: "Data desconhecida",
      ano: null,
      mes: null,
      itens: desconhecidos,
    });
  }

  return resultado;
}

export function deduplicarMovimentacoes<T extends MovimentacaoBruta>(
  movimentacoes: T[],
): T[] {
  if (!Array.isArray(movimentacoes) || movimentacoes.length === 0) {
    return [];
  }

  const resultado: T[] = [];
  const ids = new Set<string>();
  const hashes = new Set<string>();

  movimentacoes.forEach((mov) => {
    const id =
      mov.id !== null && mov.id !== undefined ? String(mov.id) : undefined;

    if (id && ids.has(id)) {
      return;
    }

    const hash = [
      mov.data ? mov.data.slice(0, 10) : "",
      normalizarTexto(mov.tipo),
      normalizarTexto(mov.conteudo),
      normalizarTexto(mov.texto_categoria),
    ]
      .join("|")
      .toLowerCase();

    if (!id && hash && hashes.has(hash)) {
      return;
    }

    if (id) {
      ids.add(id);
    }

    if (hash) {
      hashes.add(hash);
    }

    resultado.push({
      ...mov,
      id: id ?? mov.id ?? null,
    });
  });

  return resultado;
}

export function useMemorizedGroups<T extends MovimentoComIdEData>(
  movimentacoes: T[],
): GrupoDeMovimentacoes<T>[] {
  return useMemo(() => agruparPorMes(movimentacoes), [movimentacoes]);
}
