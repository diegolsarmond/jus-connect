import test from 'node:test';
import assert from 'node:assert';
import { replaceVariables } from '../src/services/templateService';

test('replaceVariables replaces placeholders with provided values', () => {
  const content = 'Olá {{cliente}}';
  const result = replaceVariables(content, { cliente: 'Maria' });
  assert.strictEqual(result, 'Olá Maria');
});

