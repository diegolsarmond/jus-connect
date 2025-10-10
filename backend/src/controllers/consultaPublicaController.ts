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

const PDPJ_BASE_URL = 'https://portaldeservicos.pdpj.jus.br/api/v2/processos';

const ensureAuthenticatedUserId = (req: Request): number | null => {
  if (!req.auth || !Number.isInteger(req.auth.userId)) {
    return null;
  }

  return req.auth.userId;
};

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

const fetchActiveToken = async (userId: number): Promise<string> => {
  const result = await pool.query<TokenRow>(TOKEN_QUERY, [userId]);

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

const fetchFromPdpj = async (url: URL, userId: number): Promise<unknown> => {
  const token = await fetchActiveToken(userId);
  const response = await fetch(url, { headers: buildRequestHeaders(token) });
  const rawBody = await response.text();
  const data = parseJsonSafely(rawBody);

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
  const userId = ensureAuthenticatedUserId(req);

  if (!userId) {
    res.status(401).json({ error: 'Usuário não autenticado.' });
    return;
  }

  const rawCpf = typeof req.query.cpfCnpjParte === 'string' ? req.query.cpfCnpjParte.trim() : '';
  const rawNumero = typeof req.query.numeroProcesso === 'string' ? req.query.numeroProcesso.trim() : '';

  if (!rawCpf && !rawNumero) {
    res.status(400).json({ error: 'Informe o CPF/CNPJ da parte ou o número do processo.' });
    return;
  }

  try {
    const requestUrl = rawCpf
      ? new URL(PDPJ_BASE_URL)
      : new URL(`${PDPJ_BASE_URL}/${encodeURIComponent(rawNumero)}`);

    if (rawCpf) {
      requestUrl.searchParams.set('cpfCnpjParte', rawCpf);
    }

    const data = await fetchFromPdpj(requestUrl, userId);
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
  const userId = ensureAuthenticatedUserId(req);

  if (!userId) {
    res.status(401).json({ error: 'Usuário não autenticado.' });
    return;
  }

  const numero = typeof req.params.numeroProcesso === 'string' ? req.params.numeroProcesso.trim() : '';

  if (!numero) {
    res.status(400).json({ error: 'Informe o número do processo.' });
    return;
  }

  try {
    const requestUrl = new URL(`${PDPJ_BASE_URL}/${encodeURIComponent(numero)}`);
    const data = await fetchFromPdpj(requestUrl, userId);
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
