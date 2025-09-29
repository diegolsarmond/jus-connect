import type { Express, NextFunction, Request, Response } from 'express';
import { Readable } from 'node:stream';

const CRLF = Buffer.from('\r\n');
const HEADER_SEPARATOR = Buffer.from('\r\n\r\n');

const parseBoundary = (contentType: string): string | null => {
  const match = /boundary=([^;]+)/i.exec(contentType);
  if (!match) {
    return null;
  }

  return match[1].trim().replace(/^"|"$/g, '');
};

type ParsedPart = {
  fieldname: string;
  filename?: string;
  contentType?: string;
  contentTransferEncoding?: string;
  content: Buffer;
};

const parseHeaders = (buffer: Buffer): Record<string, string> => {
  const lines = buffer.toString('utf8').split('\r\n').filter(Boolean);
  const headers: Record<string, string> = {};

  for (const line of lines) {
    const [rawName, ...rest] = line.split(':');
    const name = rawName?.trim().toLowerCase();
    if (!name) {
      continue;
    }
    headers[name] = rest.join(':').trim();
  }

  return headers;
};

const parseContentDisposition = (value: string | undefined) => {
  if (!value) {
    return { fieldname: undefined, filename: undefined };
  }

  const segments = value.split(';').map((segment) => segment.trim());
  const params: Record<string, string> = {};

  for (const segment of segments) {
    const [key, rawValue] = segment.split('=');
    if (!rawValue) {
      continue;
    }
    params[key.toLowerCase()] = rawValue.replace(/^"|"$/g, '');
  }

  return {
    fieldname: params.name,
    filename: params.filename,
  };
};

const extractParts = (body: Buffer, boundary: string): ParsedPart[] => {
  const boundaryBuffer = Buffer.from(`--${boundary}`);
  const parts: ParsedPart[] = [];
  let searchIndex = 0;

  while (searchIndex < body.length) {
    const boundaryIndex = body.indexOf(boundaryBuffer, searchIndex);
    if (boundaryIndex === -1) {
      break;
    }

    let partStart = boundaryIndex + boundaryBuffer.length;

    if (body[partStart] === 45 && body[partStart + 1] === 45) {
      // Encontramos o boundary final "--boundary--"
      break;
    }

    if (body[partStart] === CRLF[0] && body[partStart + 1] === CRLF[1]) {
      partStart += CRLF.length;
    } else if (body[partStart] === CRLF[1]) {
      partStart += 1;
    }

    const headerEndIndex = body.indexOf(HEADER_SEPARATOR, partStart);
    if (headerEndIndex === -1) {
      break;
    }

    const headersBuffer = body.slice(partStart, headerEndIndex);
    const headers = parseHeaders(headersBuffer);
    const { fieldname, filename } = parseContentDisposition(
      headers['content-disposition']
    );

    const contentStart = headerEndIndex + HEADER_SEPARATOR.length;
    let nextBoundaryIndex = body.indexOf(boundaryBuffer, contentStart);

    if (nextBoundaryIndex === -1) {
      nextBoundaryIndex = body.length;
    }

    let contentEnd = nextBoundaryIndex;

    if (
      body[nextBoundaryIndex - 2] === CRLF[0] &&
      body[nextBoundaryIndex - 1] === CRLF[1]
    ) {
      contentEnd -= CRLF.length;
    } else if (body[nextBoundaryIndex - 1] === CRLF[1]) {
      contentEnd -= 1;
    }

    const content = body.slice(contentStart, contentEnd);

    parts.push({
      fieldname: fieldname ?? '',
      filename: filename ?? undefined,
      contentType: headers['content-type'],
      contentTransferEncoding: headers['content-transfer-encoding'],
      content,
    });

    searchIndex = nextBoundaryIndex;
  }

  return parts;
};

const toReadableStream = (buffer: Buffer) => {
  return Readable.from(buffer);
};

const parseAllowedMimeTypes = (): Set<string> => {
  const raw = process.env.UPLOAD_ALLOWED_MIME_TYPES;
  if (!raw) {
    return new Set([
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/pdf',
      'text/plain',
    ]);
  }

  return new Set(
    raw
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  );
};

const resolveMaxFileSize = (): number => {
  const configured = Number.parseInt(process.env.UPLOAD_MAX_SIZE_MB ?? '10', 10);
  const sizeInMb = Number.isNaN(configured) || configured <= 0 ? 10 : configured;
  return sizeInMb * 1024 * 1024;
};

declare module 'express-serve-static-core' {
  interface Request {
    file?: Express.Multer.File;
  }
}

export const singleFileUpload = (req: Request, res: Response, next: NextFunction) => {
  const contentType = req.headers['content-type'];
  if (!contentType || !contentType.includes('multipart/form-data')) {
    return res
      .status(400)
      .json({ error: 'Envie o arquivo usando multipart/form-data.' });
  }

  const boundary = parseBoundary(contentType);

  if (!boundary) {
    return res
      .status(400)
      .json({ error: 'Não foi possível identificar o boundary do upload.' });
  }

  const maxFileSize = resolveMaxFileSize();
  const allowedMimeTypes = parseAllowedMimeTypes();
  const chunks: Buffer[] = [];
  let totalSize = 0;
  let limitExceeded = false;

  req.on('data', (chunk: Buffer) => {
    if (limitExceeded) {
      return;
    }

    totalSize += chunk.length;

    if (totalSize > maxFileSize) {
      limitExceeded = true;
      return;
    }

    chunks.push(chunk);
  });

  req.on('end', () => {
    if (limitExceeded) {
      return res.status(413).json({
        error: `Arquivo maior que o limite permitido de ${Math.round(
          maxFileSize / 1024 / 1024
        )}MB.`,
      });
    }

    try {
      const body = Buffer.concat(chunks);
      const parts = extractParts(body, boundary);
      const filePart = parts.find((part) => part.fieldname === 'file');

      if (!filePart || !filePart.filename) {
        return res
          .status(400)
          .json({ error: 'Campo de arquivo "file" não encontrado.' });
      }

      const mimeType = filePart.contentType ?? 'application/octet-stream';

      if (allowedMimeTypes.size > 0 && !allowedMimeTypes.has(mimeType)) {
        return res.status(400).json({
          error: `Tipo de arquivo não suportado. Permitidos: ${Array.from(
            allowedMimeTypes
          ).join(', ')}`,
        });
      }

      const buffer = filePart.content;

      req.file = {
        fieldname: 'file',
        originalname: filePart.filename,
        encoding: filePart.contentTransferEncoding ?? '7bit',
        mimetype: mimeType,
        size: buffer.length,
        buffer,
        destination: '',
        filename: filePart.filename,
        path: '',
        stream: toReadableStream(buffer),
      } satisfies Express.Multer.File;

      next();
    } catch (error) {
      next(error);
    }
  });

  req.on('error', (error) => {
    next(error);
  });
};
