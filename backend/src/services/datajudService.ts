import { canonicalizeDatajudAlias } from '../utils/datajud';

const DATAJUD_BASE_URL = 'https://api-publica.datajud.cnj.jus.br';
const DATAJUD_TIMEOUT_MS = 15000;

type FetchFn = (input: any, init?: any) => Promise<any>;

type DatajudComplemento = {
  nome?: unknown;
  descricao?: unknown;
};

type DatajudMovimentoRaw = {
  codigo?: unknown;
  nome?: unknown;
  dataHora?: unknown;
  descricao?: unknown;
  complementosTabelados?: DatajudComplemento[];
};

type DatajudHit = {
  _source?: {
    movimentos?: DatajudMovimentoRaw[];
  };
};

type DatajudResponse = {
  hits?: {
    hits?: DatajudHit[];
  };
};

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim() !== '';

const resolveFetch = (): FetchFn => {
  const fetchImpl = (globalThis as { fetch?: FetchFn }).fetch;
  if (typeof fetchImpl !== 'function') {
    throw new Error('Fetch API não disponível no ambiente atual');
  }

  return fetchImpl;
};

const formatComplemento = (complemento: DatajudComplemento): string | null => {
  const nome = isNonEmptyString(complemento?.nome) ? complemento.nome.trim() : '';
  const descricao = isNonEmptyString(complemento?.descricao)
    ? complemento.descricao.trim()
    : '';

  if (nome && descricao) {
    return `${nome} (${descricao})`;
  }

  if (nome) {
    return nome;
  }

  if (descricao) {
    return descricao;
  }

  return null;
};

const mapMovimento = (movimento: DatajudMovimentoRaw) => {
  const codigoRaw = movimento?.codigo;
  let codigo: number | null = null;

  if (typeof codigoRaw === 'number' && Number.isFinite(codigoRaw)) {
    codigo = codigoRaw;
  } else if (typeof codigoRaw === 'string') {
    const parsed = Number.parseInt(codigoRaw, 10);
    codigo = Number.isNaN(parsed) ? null : parsed;
  }

  const nome = isNonEmptyString(movimento?.nome)
    ? movimento.nome.trim()
    : 'Movimentação';

  const descricaoPreferida = isNonEmptyString(movimento?.descricao)
    ? movimento.descricao.trim()
    : null;

  const complementos = Array.isArray(movimento?.complementosTabelados)
    ? movimento.complementosTabelados
        .map((item) => formatComplemento(item))
        .filter((value): value is string => Boolean(value))
    : [];

  const descricao = descricaoPreferida
    ? descricaoPreferida
    : complementos.length > 0
      ? `${nome} · ${complementos.join(', ')}`
      : nome;

  const dataHora = isNonEmptyString(movimento?.dataHora)
    ? movimento.dataHora
    : null;

  return {
    codigo,
    nome,
    descricao,
    dataHora,
  };
};

export interface DatajudMovimentacao {
  codigo: number | null;
  nome: string;
  descricao: string;
  dataHora: string | null;
}

export const fetchDatajudMovimentacoes = async (
  alias: string,
  numeroProcesso: string,
): Promise<DatajudMovimentacao[]> => {
  const apiKey = process.env.DATAJUD_API_KEY;
  if (!apiKey) {
    throw new Error('DATAJUD_API_KEY não configurada');
  }

  const normalizedAlias = canonicalizeDatajudAlias(alias);


  if (!normalizedAlias) {
    throw new Error('Alias do Datajud inválido para consulta');
  }

  const url = `${DATAJUD_BASE_URL}/${normalizedAlias}/_search`;

  const numeroForQuery = numeroProcesso.replace(/\D+/g, '');
  const numeroNormalizado = numeroForQuery.length > 0 ? numeroForQuery : numeroProcesso;

  const numeroForQueryDigits = numeroProcesso.replace(/\D/g, '').trim();
  const numeroForQuery = numeroForQueryDigits || numeroProcesso.trim();

  if (!numeroForQuery) {
    throw new Error('Número do processo inválido para consulta');
  }


  const fetchImpl = resolveFetch();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DATAJUD_TIMEOUT_MS);
  const numeroForQuery = numeroProcesso;

  try {
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `APIKey ${apiKey}`,
      },
      body: JSON.stringify({
        query: { match: { numeroProcesso: numeroNormalizado } },
        size: 1,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Falha ao consultar Datajud (HTTP ${response.status})`);
    }

    const json = (await response.json()) as DatajudResponse;
    const hits = Array.isArray(json?.hits?.hits) ? json.hits?.hits : [];

    const movimentos = hits
      ?.map((hit) => hit?._source?.movimentos)
      .find((collection) => Array.isArray(collection));

    if (!Array.isArray(movimentos)) {
      return [];
    }

    return movimentos
      .map((movimento) => mapMovimento(movimento))
      .sort((a, b) => {
        const timeA = a.dataHora ? new Date(a.dataHora).getTime() : 0;
        const timeB = b.dataHora ? new Date(b.dataHora).getTime() : 0;
        return timeB - timeA;
      });
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      throw new Error('Tempo excedido ao consultar a API pública do Datajud');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};
