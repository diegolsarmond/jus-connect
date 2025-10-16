import assert from 'node:assert/strict';
import test from 'node:test';
import type { Request, Response } from 'express';

import pool from '../src/services/db';

let createEmpresa: typeof import('../src/controllers/empresaController')['createEmpresa'];
let updateEmpresa: typeof import('../src/controllers/empresaController')['updateEmpresa'];

test.before(async () => {
  ({ createEmpresa, updateEmpresa } = await import('../src/controllers/empresaController'));
});

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

test('createEmpresa retorna 409 quando CNPJ ou e-mail já existe', async () => {
  const poolMock = test.mock.method(pool, 'query', async () => {
    const error = new Error('duplicate key value violates unique constraint');
    (error as { code?: string }).code = '23505';
    throw error;
  });

  const req = {
    body: {
      nome_empresa: 'Empresa Teste',
      cnpj: '12345678901234',
      telefone: '11999999999',
      email: 'contato@empresa.com',
      plano: 'premium',
      responsavel: 'Fulano',
      ativo: true,
    },
  } as unknown as Request;
  const res = createMockResponse();

  try {
    await createEmpresa(req, res);

    assert.equal(res.statusCode, 409);
    assert.deepEqual(res.body, { error: 'CNPJ ou e-mail já cadastrado.' });
    assert.equal(poolMock.mock.callCount(), 1);
  } finally {
    poolMock.mock.restore();
  }
});

test('updateEmpresa retorna 409 quando CNPJ ou e-mail já existe', async () => {
  const poolMock = test.mock.method(pool, 'query', async () => {
    const error = new Error('Duplicate key value violates unique constraint empresas_email_key');
    throw error;
  });

  const req = {
    params: { id: '1' },
    body: {
      nome_empresa: 'Empresa Teste',
      cnpj: '12345678901234',
      telefone: '11999999999',
      email: 'contato@empresa.com',
      plano: 'premium',
      responsavel: 'Fulano',
      ativo: true,
    },
  } as unknown as Request;
  const res = createMockResponse();

  try {
    await updateEmpresa(req, res);

    assert.equal(res.statusCode, 409);
    assert.deepEqual(res.body, { error: 'CNPJ ou e-mail já cadastrado.' });
    assert.equal(poolMock.mock.callCount(), 1);
  } finally {
    poolMock.mock.restore();
  }
});
