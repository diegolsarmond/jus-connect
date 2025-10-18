import pool from './db';

type Etiqueta = {
  id: number;
  nome: string;
  ativo: boolean;
  datacriacao: Date;
  exibe_pipeline: boolean;
  ordem: number | null;
  id_fluxo_trabalho: number | null;
  idempresa: number | null;
};

type EtiquetaAtualizada = {
  id: number;
  nome: string;
  ativo: boolean;
  datacriacao: Date;
  exibe_pipeline: boolean;
  ordem: number | null;
  id_fluxo_trabalho: number | null;
};

type EtiquetaFluxo = {
  id: number;
  nome: string;
};

const wrapServiceError = (message: string, error: unknown): never => {
  if (error instanceof Error) {
    throw Object.assign(new Error(message), { cause: error });
  }
  const err = new Error(message);
  (err as { cause?: unknown }).cause = error;
  throw err;
};

export const findByEmpresa = async (
  empresaId: number | null
): Promise<Etiqueta[]> => {
  try {
    const result = await pool.query<Etiqueta>(
      'SELECT id, nome, ativo, datacriacao, exibe_pipeline, ordem, id_fluxo_trabalho, idempresa FROM public.etiquetas WHERE idempresa IS NOT DISTINCT FROM $1',
      [empresaId]
    );
    return result.rows;
  } catch (error) {
    throw wrapServiceError('Erro ao buscar etiquetas da empresa.', error);
  }
};

export const findByFluxoTrabalho = async (
  fluxoTrabalhoId: string
): Promise<EtiquetaFluxo[]> => {
  try {
    const result = await pool.query<EtiquetaFluxo>(
      'SELECT id, nome FROM public.etiquetas WHERE id_fluxo_trabalho = $1',
      [fluxoTrabalhoId]
    );
    return result.rows;
  } catch (error) {
    throw wrapServiceError('Erro ao buscar etiquetas do fluxo de trabalho.', error);
  }
};

type CreateEtiquetaInput = {
  nome: string;
  ativo: boolean;
  exibe_pipeline: boolean;
  ordem: number | null | undefined;
  id_fluxo_trabalho: number | null | undefined;
  empresaId: number;
};

export const createEtiqueta = async (
  input: CreateEtiquetaInput
): Promise<Etiqueta> => {
  const { nome, ativo, exibe_pipeline, ordem, id_fluxo_trabalho, empresaId } = input;
  try {
    const result = await pool.query<Etiqueta>(
      'INSERT INTO public.etiquetas (nome, ativo, datacriacao, exibe_pipeline, ordem, id_fluxo_trabalho, idempresa) VALUES ($1, $2, NOW(), $3, $4, $5, $6) RETURNING id, nome, ativo, datacriacao, exibe_pipeline, ordem, id_fluxo_trabalho, idempresa',
      [nome, ativo, exibe_pipeline, ordem, id_fluxo_trabalho, empresaId]
    );
    const [row] = result.rows;
    if (!row) {
      throw new Error('Nenhuma etiqueta retornada pela inserção.');
    }
    return row;
  } catch (error) {
    throw wrapServiceError('Erro ao criar etiqueta.', error);
  }
};

type UpdateEtiquetaInput = {
  nome: string;
  ativo: boolean;
  exibe_pipeline: boolean;
  ordem: number | null | undefined;
  id_fluxo_trabalho: number | null | undefined;
};

export const updateEtiqueta = async (
  id: string,
  input: UpdateEtiquetaInput
): Promise<EtiquetaAtualizada | null> => {
  const { nome, ativo, exibe_pipeline, ordem, id_fluxo_trabalho } = input;
  try {
    const result = await pool.query<EtiquetaAtualizada>(
      'UPDATE public.etiquetas SET nome = $1, ativo = $2, exibe_pipeline = $3, ordem = $4, id_fluxo_trabalho = $5 WHERE id = $6 RETURNING id, nome, ativo, datacriacao, exibe_pipeline, ordem, id_fluxo_trabalho',
      [nome, ativo, exibe_pipeline, ordem, id_fluxo_trabalho, id]
    );
    const rowCount = result.rowCount ?? 0;
    if (rowCount === 0) {
      return null;
    }
    const [row] = result.rows;
    if (!row) {
      throw new Error('Nenhuma etiqueta retornada pela atualização.');
    }
    return row;
  } catch (error) {
    throw wrapServiceError('Erro ao atualizar etiqueta.', error);
  }
};

export const deleteEtiqueta = async (id: string): Promise<boolean> => {
  try {
    const result = await pool.query(
      'DELETE FROM public.etiquetas WHERE id = $1',
      [id]
    );
    const rowCount = result.rowCount ?? 0;
    return rowCount > 0;
  } catch (error) {
    throw wrapServiceError('Erro ao remover etiqueta.', error);
  }
};
