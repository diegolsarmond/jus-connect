import { Request, Response } from 'express';
import * as etiquetaService from '../services/etiquetaService';
import { fetchAuthenticatedUserEmpresa } from '../utils/authUser';

const getAuthenticatedUser = (
  req: Request,
  res: Response
): NonNullable<Request['auth']> | null => {
  if (!req.auth) {
    res.status(401).json({ error: 'Token inválido.' });
    return null;
  }

  return req.auth;
};

export const listEtiquetas = async (req: Request, res: Response) => {
  try {
    const auth = getAuthenticatedUser(req, res);
    if (!auth) {
      return;
    }

    const empresaLookup = await fetchAuthenticatedUserEmpresa(auth.userId);

    if (!empresaLookup.success) {
      res.status(empresaLookup.status).json({ error: empresaLookup.message });
      return;
    }

    const { empresaId } = empresaLookup;

    if (empresaId === null) {
      res
        .status(403)
        .json({ error: 'Usuário autenticado não possui empresa vinculada.' });
      return;
    }

    const etiquetas = await etiquetaService.findByEmpresa(empresaId);
    res.json(etiquetas);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const listEtiquetasByFluxoTrabalho = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const etiquetas = await etiquetaService.findByFluxoTrabalho(id);
    res.json(etiquetas);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createEtiqueta = async (req: Request, res: Response) => {
  const { nome, ativo, exibe_pipeline = true, ordem, id_fluxo_trabalho } = req.body;
  try {
    const auth = getAuthenticatedUser(req, res);
    if (!auth) {
      return;
    }

    const empresaLookup = await fetchAuthenticatedUserEmpresa(auth.userId);

    if (!empresaLookup.success) {
      res.status(empresaLookup.status).json({ error: empresaLookup.message });
      return;
    }

    const { empresaId } = empresaLookup;

    if (empresaId === null) {
      res
        .status(403)
        .json({ error: 'Usuário autenticado não possui empresa vinculada.' });
      return;
    }

    const etiqueta = await etiquetaService.createEtiqueta({
      nome,
      ativo,
      exibe_pipeline,
      ordem,
      id_fluxo_trabalho,
      empresaId,
    });
    res.status(201).json(etiqueta);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateEtiqueta = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { nome, ativo, exibe_pipeline = true, ordem, id_fluxo_trabalho } = req.body;
  try {
    const etiqueta = await etiquetaService.updateEtiqueta(id, {
      nome,
      ativo,
      exibe_pipeline,
      ordem,
      id_fluxo_trabalho,
    });
    if (!etiqueta) {
      return res.status(404).json({ error: 'Etiqueta não encontrada' });
    }
    res.json(etiqueta);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteEtiqueta = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const removed = await etiquetaService.deleteEtiqueta(id);
    if (!removed) {
      return res.status(404).json({ error: 'Etiqueta não encontrada' });
    }
    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

