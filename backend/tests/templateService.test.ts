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

test('replaceVariables swaps span data-variable placeholders and keeps fallback text when missing', () => {
  const content =
    '<p>Cliente: <span data-variable="cliente.nome">[Nome]</span></p>' +
    '<p>Email: <span class="variable" data-variable="cliente.email">cliente@email.com</span></p>' +
    '<p>Telefone: <span data-variable="cliente.telefone"></span></p>';
  const result = replaceVariables(content, {
    'cliente.nome': 'Maria',
    'cliente.telefone': '(11) 9999-9999',
  });

  assert.strictEqual(
    result,
    '<p>Cliente: Maria</p><p>Email: cliente@email.com</p><p>Telefone: (11) 9999-9999</p>',
  );
});

test('replaceVariables handles nested markup inside span placeholders', () => {
  const content =
    '<p><span data-variable="cliente.nome"><strong>{{cliente.apelido}}</strong></span> recebeu o aviso.</p>';
  const result = replaceVariables(content, {
    'cliente.apelido': 'Mari',
  });

  assert.strictEqual(result, '<p>Mari recebeu o aviso.</p>');
});

