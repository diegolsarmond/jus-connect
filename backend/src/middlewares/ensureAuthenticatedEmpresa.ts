import { NextFunction, Request, Response } from 'express';
import { fetchAuthenticatedUserEmpresa } from '../utils/authUser';

type EnsureAuthenticatedEmpresaOptions = {
  empresaNaoVinculadaStatus?: number;
};

const resolveEmpresaId = async (
  req: Request,
  res: Response,
  options?: EnsureAuthenticatedEmpresaOptions
): Promise<number | undefined> => {
  const locals = res.locals ?? ((res.locals = Object.create(null)) as Record<string, unknown>);
  if (Object.prototype.hasOwnProperty.call(locals, 'empresaId')) {
    const existingValue = (locals as { empresaId?: unknown }).empresaId;

    if (typeof existingValue === 'number') {
      return existingValue;
    }

    if (existingValue === null) {
      const status = options?.empresaNaoVinculadaStatus ?? 403;
      res
        .status(status)
        .json({ error: 'Usuário autenticado não possui empresa vinculada.' });
      return undefined;
    }
  }

  const { auth } = req;

  if (!auth) {
    res.status(401).json({ error: 'Token inválido.' });
    return undefined;
  }

  const empresaLookup = await fetchAuthenticatedUserEmpresa(auth.userId);

  if (!empresaLookup.success) {
    res.status(empresaLookup.status).json({ error: empresaLookup.message });
    return undefined;
  }

  const { empresaId } = empresaLookup;

  if (empresaId === null) {
    const status = options?.empresaNaoVinculadaStatus ?? 403;
    res
      .status(status)
      .json({ error: 'Usuário autenticado não possui empresa vinculada.' });
    return undefined;
  }

  res.locals.empresaId = empresaId;
  return empresaId;
};

const createEnsureAuthenticatedEmpresa = (
  options?: EnsureAuthenticatedEmpresaOptions
) =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const resolved = await resolveEmpresaId(req, res, options);
    if (resolved === undefined) {
      return;
    }

    next();
  };

export const ensureAuthenticatedEmpresa = createEnsureAuthenticatedEmpresa();

export const ensureAuthenticatedEmpresaWithOptions = (
  options?: EnsureAuthenticatedEmpresaOptions
) => createEnsureAuthenticatedEmpresa(options);

export const ensureAuthenticatedEmpresaId = (
  req: Request,
  res: Response,
  options?: EnsureAuthenticatedEmpresaOptions
) => resolveEmpresaId(req, res, options);
