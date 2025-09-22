import test from 'node:test';
import assert from 'node:assert';
import { replaceVariables } from '../src/services/templateService';

test('replaceVariables replaces placeholders with provided values', () => {
  const content = 'Olá {{cliente}}';
  const result = replaceVariables(content, { cliente: 'Maria' });
  assert.strictEqual(result, 'Olá Maria');
});

test('replaceVariables leaves unknown placeholders untouched', () => {
  const content = 'Documento: {{ documento.numero }} e {{documento.data}}';
  const result = replaceVariables(content, { 'documento.numero': 123 });
  assert.strictEqual(result, 'Documento: 123 e {{documento.data}}');
});

test('replaceVariables keeps HTML documents well-formed when values are missing', () => {
  const content = '<div><span>{{ known }}</span><span>{{unknown}}</span></div>';
  const result = replaceVariables(content, { known: 'valor' });

  assert.strictEqual(
    result,
    '<div><span>valor</span><span>{{unknown}}</span></div>'
  );
  assert.ok(!result.includes('<unknown>'));
});

