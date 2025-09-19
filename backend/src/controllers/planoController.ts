import { Request, Response } from 'express';
import pool from '../services/db';

const RECORRENCIAS_PERMITIDAS = ['mensal', 'anual', 'nenhuma'] as const;
type Recorrencia = (typeof RECORRENCIAS_PERMITIDAS)[number];

const isRecorrenciaValida = (value: unknown): value is Recorrencia =>
  typeof value === 'string' && RECORRENCIAS_PERMITIDAS.includes(value as Recorrencia);

type PlanoRow = {
  id: number;
  nome: string;
  valor: number | string | null;
  ativo: boolean | null;
  datacadastro: Date | string | null;
  descricao: string | null;
  recorrencia: Recorrencia | null;
  qtde_usuarios: number | string | null;
  recursos: unknown;
  max_casos?: number | string | null;
  maxCases?: number | string | null;
};

type PlanoResponseRow = Omit<PlanoRow, 'recursos' | 'max_casos' | 'maxCases'> & {
  recursos: string[];
  max_casos: number | null;
  maxCases: number | null;
};

type RecursosDetails = {
  recursos: string[];
  maxCasos: number | null;
};

const FEATURE_KEYS = [
  'features',
  'recursos',
  'items',
  'itens',
  'lista',
  'listaRecursos',
  'lista_recursos',
  'values',
  'value',
  'feature',
  'recurso',
] as const;

const MAX_CASES_KEYS = [
  'maxCases',
  'max_casos',
  'maxProcessos',
  'max_processos',
  'limiteCasos',
  'limite_casos',
  'limiteProcessos',
  'limite_processos',
  'maximoCasos',
  'maximo_casos',
  'maximoProcessos',
  'maximo_processos',
] as const;

const toInteger = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const normalized = Number(trimmed.replace(/[^\d-]/g, ''));
    if (Number.isFinite(normalized)) {
      return Math.trunc(normalized);
    }
  }

  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }

  return null;
};

const pushFeature = (features: string[], entry: unknown) => {
  if (entry === null || entry === undefined) {
    return;
  }

  const text =
    typeof entry === 'string'
      ? entry.trim()
      : typeof entry === 'number' || typeof entry === 'boolean'
        ? String(entry)
        : '';

  if (text) {
    features.push(text);
  }
};

const parseRecursosDetails = (value: unknown): RecursosDetails => {
  const features: string[] = [];
  let maxCasos: number | null = null;

  const visit = (input: unknown): void => {
    if (input === null || input === undefined) {
      return;
    }

    if (typeof input === 'string') {
      const trimmed = input.trim();
      if (!trimmed) {
        return;
      }

      try {
        const parsed = JSON.parse(trimmed);
        visit(parsed);
        return;
      } catch {
        // Ignored – fallback to splitting by common separators
      }

      trimmed
        .split(/[\n;,]+/)
        .map((item) => item.trim())
        .filter(Boolean)
        .forEach((item) => pushFeature(features, item));

      return;
    }

    if (typeof input === 'number' || typeof input === 'boolean') {
      pushFeature(features, input);
      return;
    }

    if (Array.isArray(input)) {
      input.forEach((item) => visit(item));
      return;
    }

    if (typeof input === 'object') {
      const obj = input as Record<string, unknown>;

      FEATURE_KEYS.forEach((key) => {
        if (key in obj) {
          visit(obj[key]);
        }
      });

      for (const key of MAX_CASES_KEYS) {
        if (key in obj) {
          const parsed = toInteger(obj[key]);
          if (parsed !== null) {
            maxCasos = parsed;
            break;
          }
        }
      }

      return;
    }
  };

  visit(value);

  const uniqueFeatures = Array.from(new Set(features));

  return {
    recursos: uniqueFeatures,
    maxCasos,
  };
};

const prepareRecursosForStorage = (
  recursosInput: unknown,
  maxCasosInput: unknown,
  fallback: RecursosDetails | null = null
): string | null => {
  const fallbackDetails = fallback ?? { recursos: [], maxCasos: null };

  const sourceFeatures = recursosInput === undefined ? fallbackDetails.recursos : recursosInput;
  const sourceMaxCasos = maxCasosInput === undefined ? fallbackDetails.maxCasos : maxCasosInput;

  const normalized = parseRecursosDetails({
    features: sourceFeatures,
    maxCases: sourceMaxCasos,
  });

  if (!normalized.recursos.length && normalized.maxCasos === null) {
    return null;
  }

  const payload: Record<string, unknown> = {};

  if (normalized.recursos.length) {
    payload.features = normalized.recursos;
  }

  if (normalized.maxCasos !== null) {
    payload.maxCases = normalized.maxCasos;
  }

  return JSON.stringify(payload);
};

const formatPlanoRow = (row: PlanoRow): PlanoResponseRow => {
  const recursosDetalhes = parseRecursosDetails(row.recursos);
  const explicitMaxCasos =
    toInteger((row as { max_casos?: unknown }).max_casos) ??
    toInteger((row as { maxCases?: unknown }).maxCases);

  const maxCasos = explicitMaxCasos ?? recursosDetalhes.maxCasos ?? null;

  return {
    ...row,
    ativo: row.ativo ?? true,
    recursos: recursosDetalhes.recursos,
    max_casos: maxCasos,
    maxCases: maxCasos,
  };
};

export const listPlanos = async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT id, nome, valor, ativo, datacadastro, descricao, recorrencia, qtde_usuarios, recursos FROM public.planos'
    );
    const formatted = result.rows.map((row) => formatPlanoRow(row as PlanoRow));
    res.json(formatted);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createPlano = async (req: Request, res: Response) => {
  const {
    nome,
    valor,
    ativo = true,
    descricao,
    recorrencia = 'nenhuma',
    qtde_usuarios,
    recursos,
    max_casos,
    maxCases,
  } = req.body;

  const descricaoValue: string = descricao ?? '';
  const ativoValue: boolean = ativo ?? true;
  const qtdeUsuariosValue = qtde_usuarios ?? null;
  const recursosValue = prepareRecursosForStorage(recursos, max_casos ?? maxCases);

  if (recorrencia !== null && !isRecorrenciaValida(recorrencia)) {
    return res.status(400).json({ error: 'Recorrência inválida' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO public.planos (nome, valor, ativo, datacadastro, descricao, recorrencia, qtde_usuarios, recursos) VALUES ($1, $2, $3, NOW(), $4, $5, $6, $7) RETURNING id, nome, valor, ativo, datacadastro, descricao, recorrencia, qtde_usuarios, recursos',
      [nome, valor, ativoValue, descricaoValue, recorrencia, qtdeUsuariosValue, recursosValue]
    );
    const payload = formatPlanoRow(result.rows[0] as PlanoRow);
    res.status(201).json(payload);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updatePlano = async (req: Request, res: Response) => {
  const { id } = req.params;
  const {
    nome,
    valor,
    ativo,
    descricao,
    recorrencia,
    qtde_usuarios,
    recursos,
    max_casos,
    maxCases,
  } = req.body;

  try {
    const existingResult = await pool.query(
      'SELECT id, nome, valor, ativo, datacadastro, descricao, recorrencia, qtde_usuarios, recursos FROM public.planos WHERE id = $1',
      [id]
    );

    if (existingResult.rowCount === 0) {
      return res.status(404).json({ error: 'Plano não encontrado' });
    }

    const currentPlanoRow = existingResult.rows[0] as PlanoRow;
    const currentPlano = formatPlanoRow(currentPlanoRow);
    const currentRecursos = parseRecursosDetails(currentPlanoRow.recursos);

    const hasQtdeUsuarios = Object.prototype.hasOwnProperty.call(req.body, 'qtde_usuarios');
    const hasRecursos = Object.prototype.hasOwnProperty.call(req.body, 'recursos');
    const hasMaxCasos =
      Object.prototype.hasOwnProperty.call(req.body, 'max_casos') ||
      Object.prototype.hasOwnProperty.call(req.body, 'maxCases');
    const hasRecorrencia = Object.prototype.hasOwnProperty.call(req.body, 'recorrencia');

    let updatedRecorrencia: Recorrencia | null;
    if (hasRecorrencia) {
      if (recorrencia === null) {
        updatedRecorrencia = null;
      } else if (recorrencia === undefined) {
        updatedRecorrencia = currentPlano.recorrencia;
      } else {
        updatedRecorrencia = recorrencia;
      }
    } else {
      updatedRecorrencia = currentPlano.recorrencia;
    }

    if (updatedRecorrencia !== null && !isRecorrenciaValida(updatedRecorrencia)) {
      return res.status(400).json({ error: 'Recorrência inválida' });
    }

    const updatedQtdeUsuarios = hasQtdeUsuarios
      ? qtde_usuarios ?? null
      : currentPlano.qtde_usuarios;

    const recursosValue = hasRecursos || hasMaxCasos
      ? prepareRecursosForStorage(
          hasRecursos ? recursos : currentPlano.recursos,
          hasMaxCasos ? max_casos ?? maxCases : currentPlano.max_casos,
          currentRecursos
        )
      : ((currentPlanoRow.recursos ?? null) as string | null);

    const result = await pool.query(
      'UPDATE public.planos SET nome = $1, valor = $2, ativo = $3, descricao = $4, recorrencia = $5, qtde_usuarios = $6, recursos = $7 WHERE id = $8 RETURNING id, nome, valor, ativo, datacadastro, descricao, recorrencia, qtde_usuarios, recursos',
      [
        nome ?? currentPlano.nome,
        valor ?? currentPlano.valor,
        ativo ?? currentPlano.ativo,
        (descricao ?? currentPlano.descricao) ?? '',
        updatedRecorrencia,
        updatedQtdeUsuarios,
        recursosValue,
        id,
      ]
    );

    const payload = formatPlanoRow(result.rows[0] as PlanoRow);
    res.json(payload);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deletePlano = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'DELETE FROM public.planos WHERE id = $1',
      [id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Plano não encontrado' });
    }
    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

