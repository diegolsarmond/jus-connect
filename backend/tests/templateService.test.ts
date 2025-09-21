import test from 'node:test';
import assert from 'node:assert';
import { replaceVariables } from '../src/services/templateService';

test('replaceVariables replaces placeholders with provided values', () => {
  const content = 'Olá {{cliente}}';
  const result = replaceVariables(content, { cliente: 'Maria' });
  assert.strictEqual(result, 'Olá Maria');
});

test('replaceVariables falls back to the tag name within angle brackets when value is missing', () => {
  const content = 'Documento: {{ documento.numero }} e {{documento.data}}';
  const result = replaceVariables(content, { 'documento.numero': 123 });
  assert.strictEqual(result, 'Documento: 123 e <documento.data>');
});

