import assert from 'node:assert/strict';
import test from 'node:test';
import { parseActiveValue } from '../src/controllers/webhookController';

test('parseActiveValue aceita números inteiros 0 e 1', () => {
  assert.equal(parseActiveValue(1), true);
  assert.equal(parseActiveValue(0), false);
});

test('parseActiveValue aceita strings equivalentes a verdadeiro e falso', () => {
  assert.equal(parseActiveValue('1'), true);
  assert.equal(parseActiveValue('true'), true);
  assert.equal(parseActiveValue('on'), true);
  assert.equal(parseActiveValue('sim'), true);
  assert.equal(parseActiveValue('0'), false);
  assert.equal(parseActiveValue('false'), false);
  assert.equal(parseActiveValue('off'), false);
  assert.equal(parseActiveValue('nao'), false);
});

test('parseActiveValue rejeita valores inválidos', () => {
  assert.throws(() => parseActiveValue('talvez'));
  assert.throws(() => parseActiveValue(2));
  assert.throws(() => parseActiveValue(null));
});
