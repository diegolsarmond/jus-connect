import { Request, Response } from 'express';
import { fetchProcessSyncReport } from '../services/juditSyncReportService';

export const getJuditSyncReport = async (req: Request, res: Response) => {
  try {
    const report = await fetchProcessSyncReport();
    res.json(report);
  } catch (error) {
    console.error('Failed to build Judit sync report', error);
    res.status(500).json({ error: 'Não foi possível gerar o relatório de sincronização da Judit.' });
  }
};
