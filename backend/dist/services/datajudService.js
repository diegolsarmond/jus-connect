"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchDatajudMovimentacoes = void 0;
const DATAJUD_BASE_URL = 'https://api-publica.datajud.cnj.jus.br';
const DATAJUD_TIMEOUT_MS = 15000;
const isNonEmptyString = (value) => typeof value === 'string' && value.trim() !== '';
const resolveFetch = () => {
    const fetchImpl = globalThis.fetch;
    if (typeof fetchImpl !== 'function') {
        throw new Error('Fetch API não disponível no ambiente atual');
    }
    return fetchImpl;
};
const formatComplemento = (complemento) => {
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
const mapMovimento = (movimento) => {
    const codigoRaw = movimento?.codigo;
    let codigo = null;
    if (typeof codigoRaw === 'number' && Number.isFinite(codigoRaw)) {
        codigo = codigoRaw;
    }
    else if (typeof codigoRaw === 'string') {
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
            .filter((value) => Boolean(value))
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
const fetchDatajudMovimentacoes = async (alias, numeroProcesso) => {
    const apiKey = process.env.DATAJUD_API_KEY;
    if (!apiKey) {
        throw new Error('DATAJUD_API_KEY não configurada');
    }
    const normalizedAlias = alias
        .trim()
        .toLowerCase()
        .replace(/^\/+|\/+$/g, '')
        .replace(/\s+/g, '_');
    if (!normalizedAlias) {
        throw new Error('Alias do Datajud inválido para consulta');
    }
    const aliasWithPrefix = normalizedAlias.startsWith('api_publica_')
        ? normalizedAlias
        : `api_publica_${normalizedAlias.replace(/^api_publica_/, '')}`;
    const url = `${DATAJUD_BASE_URL}/${aliasWithPrefix}/_search`;
    const fetchImpl = resolveFetch();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DATAJUD_TIMEOUT_MS);
    try {
        const response = await fetchImpl(url, {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                Authorization: `APIKey ${apiKey}`,
            },
            body: JSON.stringify({
                query: { match: { numeroProcesso } },
                size: 1,
            }),
            signal: controller.signal,
        });
        if (!response.ok) {
            throw new Error(`Falha ao consultar Datajud (HTTP ${response.status})`);
        }
        const json = (await response.json());
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
    }
    catch (error) {
        if (error?.name === 'AbortError') {
            throw new Error('Tempo excedido ao consultar a API pública do Datajud');
        }
        throw error;
    }
    finally {
        clearTimeout(timeout);
    }
};
exports.fetchDatajudMovimentacoes = fetchDatajudMovimentacoes;
