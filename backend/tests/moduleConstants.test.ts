import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeModuleId } from '../src/constants/modules';

test('normalizeModuleId reconhece identificadores com acentos e espaços', () => {
  assert.equal(
    normalizeModuleId('Configurações - Parâmetros'),
    'configuracoes-parametros'
  );
});

test('normalizeModuleId reconhece identificadores com múltiplos separadores', () => {
  assert.equal(
    normalizeModuleId('Configurações__Parâmetros'),
    'configuracoes-parametros'
  );
});

test('normalizeModuleId mantém valores já normalizados', () => {
  assert.equal(normalizeModuleId('tarefas'), 'tarefas');
});

test('normalizeModuleId retorna null para módulos desconhecidos', () => {
  assert.equal(normalizeModuleId('modulo-inexistente'), null);
});
