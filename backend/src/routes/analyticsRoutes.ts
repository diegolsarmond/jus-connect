import { NextFunction, Request, Response, Router } from 'express';
import { getJuditSyncReport } from '../controllers/analyticsController';

const router = Router();

const requireAdminUser = (req: Request, res: Response, next: NextFunction) => {
  if (req.auth?.userId === 3) {
    next();
    return;
  }
  res.status(403).json({ error: 'Acesso restrito ao administrador.' });
};

router.get('/admin/judit-sync-report', requireAdminUser, getJuditSyncReport);

export default router;
