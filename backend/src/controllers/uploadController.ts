import type { Request, Response } from 'express';
import {
  saveUploadedFile,
  StorageUnavailableError,
} from '../services/fileStorageService';
import { buildErrorResponse } from '../utils/errorResponse';

export const upload = async (req: Request, res: Response) => {
  const file = req.file;

  if (!file) {
    return res
      .status(400)
      .json({ error: 'Nenhum arquivo foi enviado ou o campo "file" está ausente.' });
  }

  try {
    const metadata = await saveUploadedFile(file);
    return res.status(201).json(metadata);
  } catch (error) {
    if (error instanceof StorageUnavailableError) {
      return res
        .status(501)
        .json(
          buildErrorResponse(error, 'Armazenamento temporariamente indisponível.')
        );
    }

    console.error('Falha ao realizar upload de arquivo', error);
    return res
      .status(500)
      .json({ error: 'Não foi possível processar o upload do arquivo.' });
  }
};
