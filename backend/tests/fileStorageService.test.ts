import assert from 'node:assert/strict';
import type { Express } from 'express';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import test from 'node:test';

const createFakeFile = (name: string, content: Buffer): Express.Multer.File => ({
  fieldname: 'file',
  originalname: name,
  encoding: '7bit',
  mimetype: 'text/plain',
  size: content.length,
  buffer: content,
  destination: '',
  filename: name,
  path: '',
  stream: Readable.from(content),
});

test('saveUploadedFile persiste o arquivo no diretório local configurado', async () => {
  const tmpDir = await mkdtemp(path.join(tmpdir(), 'uploads-'));
  const content = Buffer.from('conteúdo de teste', 'utf8');

  process.env.FILE_STORAGE_DRIVER = 'local';
  process.env.FILE_STORAGE_LOCAL_ROOT = tmpDir;
  process.env.FILE_STORAGE_PUBLIC_BASE_URL = 'https://cdn.example.com/uploads/';
  process.env.FILE_STORAGE_ENABLE_PUBLIC_URLS = 'true';

  const service = await import('../src/services/fileStorageService');
  const metadata = await service.saveUploadedFile(createFakeFile('exemplo.txt', content));

  assert.equal(path.extname(metadata.key), '.txt');
  assert.equal(metadata.name, 'exemplo.txt');
  assert.equal(metadata.mimeType, 'text/plain');
  assert.equal(metadata.size, content.length);
  assert.equal(metadata.url, `https://cdn.example.com/uploads/${metadata.key}`);

  const stored = await readFile(path.join(tmpDir, metadata.key));
  assert.deepEqual(stored, content);

  await rm(tmpDir, { recursive: true, force: true });
});

test('saveUploadedFile lança erro quando o armazenamento está desabilitado', async () => {
  process.env.FILE_STORAGE_DRIVER = 'disabled';
  delete process.env.FILE_STORAGE_LOCAL_ROOT;

  const service = await import('../src/services/fileStorageService');

  await assert.rejects(
    () =>
      service.saveUploadedFile(
        createFakeFile('arquivo.txt', Buffer.from('dados', 'utf8'))
      ),
    (error: unknown) => {
      assert(error instanceof service.StorageUnavailableError);
      assert.match(
        error.message,
        /armazenamento de arquivos não está habilitado/i
      );
      return true;
    }
  );
});
