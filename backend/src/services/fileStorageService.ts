import crypto from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { UploadedFile } from '../middlewares/uploadMiddleware';

export type StoredFileMetadata = {
  key: string;
  url: string | null;
  name: string;
  size: number;
  mimeType: string;
};

export class StorageUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageUnavailableError';
  }
}

const DEFAULT_LOCAL_ROOT = path.resolve(process.cwd(), 'uploads');

const ensureDirectoryExists = async (targetPath: string) => {
  await fs.mkdir(targetPath, { recursive: true });
};

const sanitizeBaseUrl = (baseUrl: string): string => {
  if (!baseUrl) {
    return '';
  }

  if (/^https?:\/\//i.test(baseUrl)) {
    return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  }

  const normalized = baseUrl.startsWith('/') ? baseUrl : `/${baseUrl}`;
  return normalized.endsWith('/') ? normalized : `${normalized}/`;
};

const resolveLocalRoot = (): string => {
  const configuredRoot = process.env.FILE_STORAGE_LOCAL_ROOT;
  return configuredRoot ? path.resolve(configuredRoot) : DEFAULT_LOCAL_ROOT;
};

const getPublicBaseUrl = (): string =>
  sanitizeBaseUrl(process.env.FILE_STORAGE_PUBLIC_BASE_URL ?? '/uploads/');

const arePublicUrlsEnabled = (): boolean =>
  (process.env.FILE_STORAGE_ENABLE_PUBLIC_URLS ?? '').toLowerCase() === 'true';

const resolveDriver = (): string =>
  (process.env.FILE_STORAGE_DRIVER ?? 'local').trim().toLowerCase();

const createFileKey = (originalName: string): string => {
  const extension = path.extname(originalName ?? '').replace(/[^\w.]/g, '');
  return `${crypto.randomUUID()}${extension}`;
};

const buildPublicUrl = (key: string): string | null => {
  if (!arePublicUrlsEnabled()) {
    return null;
  }

  const baseUrl = getPublicBaseUrl();

  if (!baseUrl) {
    return null;
  }

  if (/^https?:\/\//i.test(baseUrl)) {
    const url = new URL(key, baseUrl);
    return url.toString();
  }

  return `${baseUrl}${key}`.replace(/\/{2,}/g, '/');
};

export const getFileStorageDriver = (): string => resolveDriver();

export const getLocalStorageRoot = (): string => resolveLocalRoot();

export const getPublicUploadsBasePath = (): string => getPublicBaseUrl();

export const isPublicFileAccessEnabled = (): boolean => arePublicUrlsEnabled();

export const saveUploadedFile = async (
  file: UploadedFile
): Promise<StoredFileMetadata> => {
  const driver = resolveDriver();

  if (driver === 'disabled' || driver === 'none') {
    throw new StorageUnavailableError(
      'O armazenamento de arquivos não está habilitado. Entre em contato com o administrador.'
    );
  }

  if (driver !== 'local') {
    throw new StorageUnavailableError(
      `Driver de armazenamento não suportado: ${driver}`
    );
  }

  const destinationRoot = resolveLocalRoot();
  await ensureDirectoryExists(destinationRoot);

  const key = createFileKey(file.originalname);
  const targetPath = path.join(destinationRoot, key);

  if (file.buffer.length > 0) {
    await fs.writeFile(targetPath, file.buffer);
  } else if (file.path) {
    await fs.copyFile(file.path, targetPath);
    await fs.unlink(file.path).catch(() => undefined);
  } else {
    throw new StorageUnavailableError(
      'Arquivo recebido é inválido ou está vazio. Entre em contato com o administrador.'
    );
  }

  return {
    key,
    url: buildPublicUrl(key),
    name: file.originalname,
    size:
      file.size ??
      (file.buffer.length > 0 ? file.buffer.length : (await fs.stat(targetPath)).size),
    mimeType: file.mimetype,
  } satisfies StoredFileMetadata;
};
