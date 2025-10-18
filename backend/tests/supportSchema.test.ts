import assert from 'node:assert/strict';
import test from 'node:test';

class FailingClient {
  public callCount = 0;

  async query(): Promise<never> {
    this.callCount += 1;
    const error = new Error('connection error') as NodeJS.ErrnoException;
    error.code = 'ENOTFOUND';
    throw error;
  }
}

test('ensureSupportSchema ignora falha de conexão sem lançar erro', async () => {
  const { ensureSupportSchema } = await import('../src/services/supportSchema');
  const client = new FailingClient();
  const originalWarn = console.warn;
  const warnings: unknown[][] = [];

  console.warn = (...args: unknown[]) => {
    warnings.push(args);
  };

  try {
    await ensureSupportSchema(client as any);
    await ensureSupportSchema(client as any);
  } finally {
    console.warn = originalWarn;
  }

  assert.equal(client.callCount, 2);
  assert.equal(warnings.length, 1);
  assert.equal(
    warnings[0]?.[0],
    'Ignorando a criação do esquema de suporte: falha ao conectar ao banco de dados.'
  );
});
