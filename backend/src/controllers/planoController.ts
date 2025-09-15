import { Request, Response } from 'express';
import pool from '../services/db';

const RECORRENCIAS_PERMITIDAS = ['mensal', 'anual', 'nenhuma'] as const;
type Recorrencia = (typeof RECORRENCIAS_PERMITIDAS)[number];

const isRecorrenciaValida = (value: unknown): value is Recorrencia =>
  typeof value === 'string' && RECORRENCIAS_PERMITIDAS.includes(value as Recorrencia);

type PlanoRow = {
  id: number;
  nome: string;
  valor: number;
  ativo: boolean;
  datacadastro: Date;
  descricao: string;
  recorrencia: Recorrencia | null;
  qtde_usuarios: number | null;
  recursos: string | null;
};

export const listPlanos = async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT id, nome, valor, ativo, datacadastro, descricao, recorrencia, qtde_usuarios, recursos FROM public.planos'
    );
    res.json(result.rows);
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
  } = req.body;

  const descricaoValue: string = descricao ?? '';
  const ativoValue: boolean = ativo ?? true;
  const qtdeUsuariosValue = qtde_usuarios ?? null;
  const recursosValue = recursos ?? null;

  if (recorrencia !== null && !isRecorrenciaValida(recorrencia)) {
    return res.status(400).json({ error: 'Recorrência inválida' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO public.planos (nome, valor, ativo, datacadastro, descricao, recorrencia, qtde_usuarios, recursos) VALUES ($1, $2, $3, NOW(), $4, $5, $6, $7) RETURNING id, nome, valor, ativo, datacadastro, descricao, recorrencia, qtde_usuarios, recursos',
      [nome, valor, ativoValue, descricaoValue, recorrencia, qtdeUsuariosValue, recursosValue]
    );
    res.status(201).json(result.rows[0]);
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
  } = req.body;

  try {
    const existingResult = await pool.query(
      'SELECT id, nome, valor, ativo, datacadastro, descricao, recorrencia, qtde_usuarios, recursos FROM public.planos WHERE id = $1',
      [id]
    );

    if (existingResult.rowCount === 0) {
      return res.status(404).json({ error: 'Plano não encontrado' });
    }

    const currentPlano = existingResult.rows[0] as PlanoRow;

    const hasQtdeUsuarios = Object.prototype.hasOwnProperty.call(req.body, 'qtde_usuarios');
    const hasRecursos = Object.prototype.hasOwnProperty.call(req.body, 'recursos');
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

    const updatedRecursos = hasRecursos ? recursos ?? null : currentPlano.recursos;

    const result = await pool.query(
      'UPDATE public.planos SET nome = $1, valor = $2, ativo = $3, descricao = $4, recorrencia = $5, qtde_usuarios = $6, recursos = $7 WHERE id = $8 RETURNING id, nome, valor, ativo, datacadastro, descricao, recorrencia, qtde_usuarios, recursos',
      [
        nome ?? currentPlano.nome,
        valor ?? currentPlano.valor,
        ativo ?? currentPlano.ativo,
        (descricao ?? currentPlano.descricao) ?? '',
        updatedRecorrencia,
        updatedQtdeUsuarios,
        updatedRecursos,
        id,
      ]
    );

    res.json(result.rows[0]);
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

