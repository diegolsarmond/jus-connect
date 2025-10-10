import { Request, Response } from 'express';
import pool from '../services/db';

type TokenRow = {
  access_token?: string | null;
};

const TOKEN_QUERY = `
  SELECT access_token
    FROM public.token_jusbr
   WHERE expired IS FALSE
     AND idusuario = $1
ORDER BY datatimerenewal DESC
   LIMIT 1
`;

const TOKEN_USER_ID = 3;
const PDPJ_BASE_URL = 'https://portaldeservicos.pdpj.jus.br/api/v2/processos';
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;

const buildRequestHeaders = (token: string): Record<string, string> => ({
  accept: 'application/json, text/plain, */*',
  'accept-language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
  authorization: `Bearer ${token}`,
  priority: 'u=1, i',
  referer: 'https://portaldeservicos.pdpj.jus.br/consulta',
  'sec-ch-ua': '"Chromium";v="140", "Not=A?Brand";v="24", "Google Chrome";v="140"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-origin',
  skiperrorinterceptor: 'true',
  'user-agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
});

const fetchActiveToken = async (): Promise<string> => {
  const result = await pool.query<TokenRow>(TOKEN_QUERY, [TOKEN_USER_ID]);

  if (!result.rows.length) {
    throw new Error('Token ativo não encontrado para consulta pública.');
  }

  const token = result.rows[0]?.access_token;

  if (!token) {
    throw new Error('Token de consulta pública inválido.');
  }

  return token;
};

const parseJsonSafely = (payload: string): unknown => {
  if (!payload) {
    return null;
  }

  try {
    return JSON.parse(payload);
  } catch (error) {
    console.error('Falha ao interpretar resposta da consulta pública', error);
    throw new Error('Resposta inválida recebida do serviço externo.');
  }
};

const fetchFromPdpj = async (url: URL): Promise<unknown> => {
  const token = await fetchActiveToken();
  const headers = buildRequestHeaders(token);
  const performRequest = async (target: URL | string) => {
    const response = await fetch(target, { headers });
    const rawBody = await response.text();
    const data = parseJsonSafely(rawBody);
    return { response, data } as const;
  };

  let { response, data } = await performRequest(url);

  if (
    !response.ok &&
    response.status === 502 &&
    data &&
    typeof data === 'object' &&
    'externalUrlService' in data &&
    typeof (data as { externalUrlService?: unknown }).externalUrlService === 'string'
  ) {
    try {
      const fallbackBase = String((data as { externalUrlService: string }).externalUrlService).replace(/\/+$/, '');
      const suffix = url.pathname.replace(/^\/?api\/v2\/processos\/?/, '');
      const fallbackUrl = new URL(`${fallbackBase}${suffix ? `/${suffix}` : ''}${url.search ?? ''}`);
      ({ response, data } = await performRequest(fallbackUrl));
    } catch (fallbackError) {
      console.error('Falha ao tentar URL alternativa do serviço externo', fallbackError);
    }
  }

  if (!response.ok) {
    const message = typeof data === 'object' && data && 'error' in data ? String((data as { error: unknown }).error) : null;
    const errorMessage =
      message && message.length > 0 ? message : `Falha ao consultar o serviço externo (${response.status}).`;

    throw Object.assign(new Error(errorMessage), {
      status: response.status,
      details: data,
    });
  }

  return data;
};

export const consultarProcessosPublicos = async (req: Request, res: Response) => {
  const rawCpf = typeof req.query.cpfCnpjParte === 'string' ? req.query.cpfCnpjParte.trim() : '';
  const rawNumero = typeof req.query.numeroProcesso === 'string' ? req.query.numeroProcesso.trim() : '';
  const rawOab = typeof req.query.oab === 'string' ? req.query.oab.trim() : '';
  const rawPage = typeof req.query.page === 'string' ? Number.parseInt(req.query.page, 10) : Number.NaN;
  const rawPageSize = typeof req.query.pageSize === 'string' ? Number.parseInt(req.query.pageSize, 10) : Number.NaN;

  const normalizedCpf = rawCpf ? rawCpf.replace(/\D/g, '').slice(0, 14) : '';
  const normalizedNumero = rawNumero ? rawNumero.replace(/\D/g, '').slice(0, 20) : '';
  const normalizedOabDigits = rawOab ? rawOab.replace(/\D/g, '').slice(0, 6) : '';
  const normalizedOabUf = rawOab ? rawOab.replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase() : '';
  const page = Number.isNaN(rawPage) || rawPage <= 0 ? 1 : rawPage;
  const parsedPageSize = Number.isNaN(rawPageSize) || rawPageSize <= 0 ? DEFAULT_PAGE_SIZE : rawPageSize;
  const pageSize = Math.min(parsedPageSize, MAX_PAGE_SIZE);

  if (!normalizedCpf && !normalizedNumero && !normalizedOabDigits) {
    res.status(400).json({ error: 'Informe o CPF/CNPJ da parte, o número do processo ou a OAB do advogado.' });
    return;
  }

  try {
    const requestUrl = normalizedNumero
      ? new URL(`${PDPJ_BASE_URL}/${encodeURIComponent(normalizedNumero)}`)
      : new URL(PDPJ_BASE_URL);

    if (normalizedCpf) {
      requestUrl.searchParams.set('cpfCnpjParte', normalizedCpf);
    }

    if (normalizedOabDigits) {
      requestUrl.searchParams.set('numeroOab', normalizedOabDigits);
      if (normalizedOabUf) {
        requestUrl.searchParams.set('ufOab', normalizedOabUf);
      }
    }

    const shouldPaginateUpstream = !normalizedNumero;

    if (shouldPaginateUpstream) {
      const upstreamPage = Math.max(0, page - 1);
      requestUrl.searchParams.set('page', String(upstreamPage));
      requestUrl.searchParams.set('pageSize', String(pageSize));
      requestUrl.searchParams.set('size', String(pageSize));
    }

    const data = await fetchFromPdpj(requestUrl);

    const applyLocalPagination = (items: unknown[]) => {
      const total = items.length;
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      const safePage = Math.max(1, Math.min(page, totalPages));
      const start = (safePage - 1) * pageSize;
      const content = items.slice(start, start + pageSize);
      return {
        content,
        total,
        page: safePage,
        pageSize,
        totalPages,
      };
    };

    const applyRemotePagination = (payload: {
      content: unknown[];
      totalElements?: unknown;
      number?: unknown;
      size?: unknown;
      totalPages?: unknown;
    }) => {
      const rawTotal = typeof payload.totalElements === 'number' ? payload.totalElements : null;
      const rawPage = typeof payload.number === 'number' ? payload.number : null;
      const rawSize = typeof payload.size === 'number' ? payload.size : null;
      const rawTotalPages = typeof payload.totalPages === 'number' ? payload.totalPages : null;

      const derivedPageSize = rawSize !== null && rawSize > 0 ? rawSize : pageSize;
      const derivedTotal = rawTotal !== null && rawTotal >= 0 ? rawTotal : payload.content.length;
      const derivedTotalPages =
        rawTotalPages !== null && rawTotalPages > 0
          ? rawTotalPages
          : Math.max(1, Math.ceil(derivedTotal / derivedPageSize));
      const derivedPage =
        rawPage !== null && rawPage >= 0
          ? rawPage + 1
          : Math.max(1, Math.min(page, derivedTotalPages));

      return {
        content: payload.content,
        total: derivedTotal,
        page: derivedPage,
        pageSize: derivedPageSize,
        totalPages: derivedTotalPages,
      };
    };

    if (Array.isArray(data)) {
      res.json(applyLocalPagination(data));
      return;
    }

    if (data && typeof data === 'object') {
      if ('content' in data && Array.isArray((data as { content?: unknown[] }).content)) {
        const pagination = applyRemotePagination(data as {
          content: unknown[];
          totalElements?: unknown;
          number?: unknown;
          size?: unknown;
          totalPages?: unknown;
        });
        res.json({
          ...data,
          ...pagination,
          content: pagination.content,
        });
        return;
      }

      if ('numeroProcesso' in data) {
        res.json({
          content: [data],
          total: 1,
          page: 1,
          pageSize,
          totalPages: 1,
        });
        return;
      }
    }

    res.json(data);
  } catch (error) {
    console.error('Erro ao consultar processos públicos', error);

    if (error && typeof error === 'object' && 'status' in error && typeof error.status === 'number') {
      res.status(error.status).json({ error: (error as { message?: string }).message ?? 'Falha ao consultar processos.' });
      return;
    }

    res.status(500).json({ error: 'Não foi possível consultar processos públicos.' });
  }
};

export const consultarProcessoPublicoPorNumero = async (req: Request, res: Response) => {
  const numero = typeof req.params.numeroProcesso === 'string' ? req.params.numeroProcesso.trim() : '';

  if (!numero) {
    res.status(400).json({ error: 'Informe o número do processo.' });
    return;
  }

  try {
    const requestUrl = new URL(`${PDPJ_BASE_URL}/${encodeURIComponent(numero)}`);
    const data = await fetchFromPdpj(requestUrl);
    res.json(data);
  } catch (error) {
    console.error('Erro ao consultar detalhes de processo público', error);

    if (error && typeof error === 'object' && 'status' in error && typeof error.status === 'number') {
      res.status(error.status).json({ error: (error as { message?: string }).message ?? 'Falha ao consultar processo.' });
      return;
    }

    res.status(500).json({ error: 'Não foi possível consultar o processo público informado.' });
  }
};
