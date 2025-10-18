import assert from 'node:assert/strict';
import test from 'node:test';

class FlakyClient {
  public callCount = 0;

  async query(): Promise<void> {
    this.callCount += 1;

    if (this.callCount < 3) {
      const error = new Error('connection error') as NodeJS.ErrnoException;
      error.code = this.callCount === 1 ? 'ENOTFOUND' : 'ECONNREFUSED';
      throw error;
    }
  }
}

test('ensureSupportSchema retenta falhas de conexão até aplicar o esquema', async () => {
  const { ensureSupportSchema } = await import('../src/services/supportSchema');
  const client = new FlakyClient();
  const originalWarn = console.warn;
  const warnings: unknown[][] = [];
  const delayAttempts: number[] = [];

  console.warn = (...args: unknown[]) => {
    warnings.push(args);
  };

  try {
    await Promise.all([
      ensureSupportSchema(client as any, {
        delay: async (attempt) => {
          delayAttempts.push(attempt);
        },
      }),
      ensureSupportSchema(client as any, {
        delay: async (attempt) => {
          delayAttempts.push(attempt);
        },
      }),
    ]);
  } finally {
    console.warn = originalWarn;
  }

  assert.equal(client.callCount, 3);
  assert.deepEqual(delayAttempts, [0, 1]);
  assert.equal(warnings.length, 1);
  assert.equal(
    warnings[0]?.[0],
    'Ignorando a criação do esquema de suporte: falha ao conectar ao banco de dados. Retentando...'
  );
});
