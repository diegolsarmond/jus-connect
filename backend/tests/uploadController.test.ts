import assert from 'node:assert/strict';
import type { Express, Request, Response } from 'express';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import test from 'node:test';

type UploadResponse = {
  key: string;
  url: string;
  name: string;
  size: number;
  mimeType: string;
};

const createMockResponse = () => {
  const response: Partial<Response> & { statusCode: number; body: unknown } = {
    statusCode: 200,
    body: undefined,
    status(code: number) {
      this.statusCode = code;
      return this as Response;
    },
    json(payload: unknown) {
      this.body = payload;
      return this as Response;
    },
  };

  return response as Response & { statusCode: number; body: unknown };
};

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

test('upload retorna 400 quando nenhum arquivo é enviado', async () => {
  const { upload } = await import('../src/controllers/uploadController');
  const req = { file: undefined } as unknown as Request;
  const res = createMockResponse();

  await upload(req, res);

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, {
    error: 'Nenhum arquivo foi enviado ou o campo "file" está ausente.',
  });
});

test('upload persiste o arquivo e retorna metadados reais', async () => {
  process.env.FILE_STORAGE_DRIVER = 'local';
  process.env.FILE_STORAGE_PUBLIC_BASE_URL = '/arquivos/';
  const uploadsDir = await mkdtemp(path.join(tmpdir(), 'upload-controller-'));
  process.env.FILE_STORAGE_LOCAL_ROOT = uploadsDir;

  const { upload } = await import('../src/controllers/uploadController');
  const res = createMockResponse();
  const payload = Buffer.from('conteúdo gerado em teste', 'utf8');
  const req = { file: createFakeFile('documento.txt', payload) } as unknown as Request;

  try {
    await upload(req, res);

    assert.equal(res.statusCode, 201);
    const body = res.body as UploadResponse;
    assert.equal(body.name, 'documento.txt');
    assert.equal(body.size, payload.length);
    assert.equal(body.mimeType, 'text/plain');
    assert.ok(body.key.endsWith('.txt'));
    assert.ok(body.url.startsWith('/arquivos/'));

    await stat(path.join(uploadsDir, body.key));
  } finally {
    await rm(uploadsDir, { recursive: true, force: true });
  }
});

test('upload responde 501 quando o armazenamento está desabilitado', async () => {
  process.env.FILE_STORAGE_DRIVER = 'disabled';

  const { upload } = await import('../src/controllers/uploadController');
  const req = { file: createFakeFile('arquivo.txt', Buffer.from('dados')) } as unknown as Request;
  const res = createMockResponse();

  await upload(req, res);

  assert.equal(res.statusCode, 501);
  assert.deepEqual(res.body, {
    error: 'O armazenamento de arquivos não está habilitado. Entre em contato com o administrador.',
  });
});

test('upload responde 500 quando o serviço falha inesperadamente', async () => {
  process.env.FILE_STORAGE_DRIVER = 'local';
  process.env.FILE_STORAGE_LOCAL_ROOT = '/proc/1/mem';

  const { upload } = await import('../src/controllers/uploadController');
  const req = { file: createFakeFile('falha.txt', Buffer.from('erro')) } as unknown as Request;
  const res = createMockResponse();

  await upload(req, res);

  assert.equal(res.statusCode, 500);
  assert.deepEqual(res.body, {
    error: 'Não foi possível processar o upload do arquivo.',
  });
});
