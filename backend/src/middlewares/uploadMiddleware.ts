import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream, promises as fs } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';

const CRLF = Buffer.from('\r\n');
const HEADER_SEPARATOR = Buffer.from('\r\n\r\n');

export type UploadedFile = {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
  destination: string;
  filename: string;
  path: string;
  stream: NodeJS.ReadableStream;
};

const parseBoundary = (contentType: string): string | null => {
  const match = /boundary=([^;]+)/i.exec(contentType);
  if (!match) {
    return null;
  }

  return match[1].trim().replace(/^"|"$/g, '');
};


const startsWith = (buffer: Buffer, signature: Buffer): boolean => {
  if (buffer.length < signature.length) {
    return false;
  }

  return buffer.subarray(0, signature.length).equals(signature);
};

const isLikelyPlainText = (buffer: Buffer): boolean => {
  const sample = buffer.subarray(0, Math.min(buffer.length, 512));

  for (const byte of sample) {
    if (byte === 0) {
      return false;
    }

    if (byte < 0x09) {
      return false;
    }

    if (byte > 0x0d && byte < 0x20) {
      return false;
    }
  }

  return true;
};

const JPEG_SIGNATURE = Buffer.from([0xff, 0xd8, 0xff]);
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PDF_SIGNATURE = Buffer.from('%PDF', 'ascii');

const detectMimeType = (buffer: Buffer): string | null => {
  if (startsWith(buffer, JPEG_SIGNATURE)) {
    return 'image/jpeg';
  }

  if (startsWith(buffer, PNG_SIGNATURE)) {
    return 'image/png';
  }

  if (buffer.length >= 12) {
    const riffHeader = buffer.subarray(0, 4).toString('ascii');
    const webpHeader = buffer.subarray(8, 12).toString('ascii');
    if (riffHeader === 'RIFF' && webpHeader === 'WEBP') {
      return 'image/webp';
    }
  }

  if (startsWith(buffer, PDF_SIGNATURE)) {
    return 'application/pdf';
  }

  if (isLikelyPlainText(buffer)) {
    return 'text/plain';
  }

  return null;
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

const parseAllowedMimeTypes = (): Set<string> => {
  const raw = process.env.UPLOAD_ALLOWED_MIME_TYPES;
  if (!raw) {
    return new Set(
      [
        'image/jpeg',
        'image/png',
        'image/webp',
        'application/pdf',
        'text/plain',
      ].map((item) => item.toLowerCase())
    );
  }

  return new Set(
    raw
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
  );
};

const resolveMaxFileSize = (): number => {
  const configured = Number.parseInt(process.env.UPLOAD_MAX_SIZE_MB ?? '10', 10);
  const sizeInMb = Number.isNaN(configured) || configured <= 0 ? 10 : configured;
  return sizeInMb * 1024 * 1024;
};

const removeFileIfExists = async (filePath: string) => {
  await fs.unlink(filePath).catch(() => undefined);
};

declare module 'express-serve-static-core' {
  interface Request {
    file?: UploadedFile;
  }
}

type SingleFileUploadRequest = Request & { file?: UploadedFile };

export const singleFileUpload = (
  req: SingleFileUploadRequest,
  res: Response,
  next: NextFunction,
) => {
  const contentType = req.headers['content-type'];
  if (!contentType || !contentType.includes('multipart/form-data')) {
    return res
      .status(400)
      .json({ error: 'Envie o arquivo usando multipart/form-data.' });
  }

  const boundaryValue = parseBoundary(contentType);

  if (!boundaryValue) {
    return res
      .status(400)
      .json({ error: 'Não foi possível identificar o boundary do upload.' });
  }

  const maxFileSize = resolveMaxFileSize();
  const allowedMimeTypes = parseAllowedMimeTypes();
  const allowedMimeTypesList = Array.from(allowedMimeTypes).join(', ');

  const boundaryPrefix = Buffer.from(`--${boundaryValue}`);
  const boundarySeparator = Buffer.from(`\r\n--${boundaryValue}`);
  const closingBoundary = Buffer.from(`\r\n--${boundaryValue}--`);
  const boundaryPadding = Math.max(boundarySeparator.length, closingBoundary.length);

  const tempFilePath = path.join(tmpdir(), `jus-connect-upload-${randomUUID()}`);
  const tempFileStream = createWriteStream(tempFilePath);

  let buffer = Buffer.alloc(0);
  let initialBoundaryConsumed = false;
  let headersParsed = false;
  let uploadFinished = false;
  let requestEnded = false;
  let streamFinished = false;
  let limitExceeded = false;
  let responseSent = false;

  let fileSize = 0;
  let fileName: string | undefined;
  let fileEncoding = '7bit';
  let mimeType = 'application/octet-stream';

  const finalizeRequest = () => {
    if (responseSent || !requestEnded || !streamFinished) {
      return;
    }

    if (!uploadFinished || !fileName) {
      responseSent = true;
      void removeFileIfExists(tempFilePath).finally(() => {
        res.status(400).json({ error: 'Campo de arquivo "file" não encontrado.' });
      });
      return;
    }

    req.file = {
      fieldname: 'file',
      originalname: fileName,
      encoding: fileEncoding,
      mimetype: mimeType,
      size: fileSize,
      buffer: Buffer.alloc(0),
      destination: path.dirname(tempFilePath),
      filename: path.basename(tempFilePath),
      path: tempFilePath,
      stream: createReadStream(tempFilePath),
    } satisfies UploadedFile;

    next();
  };

  const abortUpload = (status: number, message: string) => {
    if (responseSent) {
      return;
    }

    responseSent = true;
    tempFileStream.destroy();
    void removeFileIfExists(tempFilePath).finally(() => {
      if (!res.headersSent) {
        res.status(status).json({ error: message });
      }
    });
  };

  const writeChunk = (chunk: Buffer): boolean => {
    if (chunk.length === 0 || limitExceeded) {
      return !limitExceeded;
    }

    const remaining = maxFileSize - fileSize;

    if (remaining <= 0) {
      limitExceeded = true;
      return false;
    }

    if (chunk.length > remaining) {
      tempFileStream.write(chunk.slice(0, remaining));
      fileSize += remaining;
      limitExceeded = true;
      return false;
    }

    tempFileStream.write(chunk);
    fileSize += chunk.length;
    return true;
  };

  const processBuffer = () => {
    while (!responseSent) {
      if (!initialBoundaryConsumed) {
        const index = buffer.indexOf(boundaryPrefix);
        if (index === -1) {
          break;
        }

        const expectedLength = index + boundaryPrefix.length + CRLF.length;
        if (buffer.length < expectedLength) {
          break;
        }

        if (
          buffer[index + boundaryPrefix.length] !== CRLF[0] ||
          buffer[index + boundaryPrefix.length + 1] !== CRLF[1]
        ) {
          abortUpload(400, 'Conteúdo de upload inválido.');
          return;
        }

        buffer = buffer.slice(index + boundaryPrefix.length + CRLF.length);
        initialBoundaryConsumed = true;
        continue;
      }

      if (!headersParsed) {
        const headerEndIndex = buffer.indexOf(HEADER_SEPARATOR);
        if (headerEndIndex === -1) {
          break;
        }

        const headersBuffer = buffer.slice(0, headerEndIndex);
        const headers = parseHeaders(headersBuffer);
        const { fieldname, filename } = parseContentDisposition(
          headers['content-disposition']
        );

        if (!fieldname || fieldname !== 'file' || !filename) {
          abortUpload(400, 'Campo de arquivo "file" não encontrado.');
          return;
        }

        fileName = filename;
        fileEncoding = headers['content-transfer-encoding'] ?? '7bit';
        mimeType = headers['content-type'] ?? 'application/octet-stream';

        if (allowedMimeTypes.size > 0 && !allowedMimeTypes.has(mimeType)) {
          abortUpload(
            400,
            `Tipo de arquivo não suportado. Permitidos: ${allowedMimeTypesList}`
          );
          return;
        }

        buffer = buffer.slice(headerEndIndex + HEADER_SEPARATOR.length);
        headersParsed = true;
        continue;
      }

      if (uploadFinished) {
        break;
      }

      const closingIndex = buffer.indexOf(closingBoundary);
      const separatorIndex = buffer.indexOf(boundarySeparator);

      let boundaryIndex = -1;
      let boundaryLength = 0;

      if (closingIndex !== -1 && (separatorIndex === -1 || closingIndex <= separatorIndex)) {
        boundaryIndex = closingIndex;
        boundaryLength = closingBoundary.length;
      } else if (separatorIndex !== -1) {
        boundaryIndex = separatorIndex;
        boundaryLength = boundarySeparator.length;
      }

      if (boundaryIndex === -1) {
        const safeLength = Math.max(0, buffer.length - boundaryPadding);
        if (safeLength === 0) {
          break;
        }

        const chunk = buffer.slice(0, safeLength);
        if (!writeChunk(chunk)) {
          break;
        }

        buffer = buffer.slice(safeLength);
        continue;
      }

      let contentEnd = boundaryIndex;

      if (
        contentEnd >= CRLF.length &&
        buffer[contentEnd - 2] === CRLF[0] &&
        buffer[contentEnd - 1] === CRLF[1]
      ) {
        contentEnd -= CRLF.length;
      }

      const content = buffer.slice(0, Math.max(0, contentEnd));
      if (!writeChunk(content)) {
        break;
      }

      buffer = buffer.slice(boundaryIndex + boundaryLength);
      uploadFinished = true;
      tempFileStream.end();
      break;
    }
  };

  tempFileStream.on('finish', () => {
    streamFinished = true;
    finalizeRequest();
  });

  tempFileStream.on('error', (error) => {
    if (responseSent) {
      return;
    }

    responseSent = true;
    removeFileIfExists(tempFilePath)
      .catch(() => undefined)
      .finally(() => {
        next(error);
      });
  });

  req.on('data', (chunk: Buffer) => {
    if (responseSent) {
      return;
    }

    buffer = Buffer.concat([buffer, chunk]);
    processBuffer();

    if (limitExceeded) {
      abortUpload(
        413,
        `Arquivo maior que o limite permitido de ${Math.round(
          maxFileSize / 1024 / 1024
        )}MB.`
      );
      req.destroy();
    }
  });

  req.on('end', () => {
    requestEnded = true;

    if (responseSent) {
      finalizeRequest();
      return;
    }

    processBuffer();

    if (!uploadFinished) {
      abortUpload(400, 'Não foi possível concluir o upload do arquivo.');
      return;
    }

    finalizeRequest();
  });

  req.on('error', (error) => {
    if (responseSent) {
      return;
    }

    responseSent = true;
    tempFileStream.destroy(error);
    removeFileIfExists(tempFilePath)
      .catch(() => undefined)
      .finally(() => {
        next(error);
      });
  });

  req.on('aborted', () => {
    if (responseSent) {
      return;
    }

    responseSent = true;
    tempFileStream.destroy();
    void removeFileIfExists(tempFilePath);
  });
};
