import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildHtmlFromGeminiStructuredResponse,
  convertPlainTextToHtml,
  parseGeminiStructuredResponse,
} from '../src/services/aiProviders/geminiProvider';

test('parseGeminiStructuredResponse removes code fences and parses JSON', () => {
  const raw = `\n\n\n\u0060\u0060\u0060json\n{\n  "intro": "Resumo",\n  "sections": [\n    {\n      "title": "Seção 1",\n      "paragraphs": ["Primeiro parágrafo"]\n    }\n  ],\n  "highlights": ["Ponto A"],\n  "conclusion": "Final"\n}\n\u0060\u0060\u0060`;
  const parsed = parseGeminiStructuredResponse(raw);

  assert(parsed);
  assert.equal(typeof parsed?.intro, 'string');
  assert.ok(Array.isArray(parsed?.sections));
});

test('buildHtmlFromGeminiStructuredResponse renders headings, paragraphs and lists', () => {
  const html = buildHtmlFromGeminiStructuredResponse('Petição Inicial', {
    intro: 'Introdução do documento.',
    sections: [
      {
        title: 'Fatos Relevantes',
        paragraphs: ['Descrição do caso em questão.'],
        bullets: ['Parte autora', 'Parte ré'],
      },
    ],
    highlights: ['Prazo de contestação', 'Requerimentos principais'],
    conclusion: 'Solicita-se deferimento conforme fundamentos apresentados.',
  });

  assert.match(html, /<strong>Petição Inicial<\/strong>/);
  assert.match(html, /<p>Introdução do documento\.<\/p>/);
  assert.match(html, /<p><strong>Fatos Relevantes<\/strong><\/p>/);
  assert.match(html, /<li>Parte autora<\/li>/);
  assert.match(html, /<li>Requerimentos principais<\/li>/);
  assert.match(html, /Solicita-se deferimento/);
});

test('convertPlainTextToHtml converts bullet lists and paragraphs safely', () => {
  const html = convertPlainTextToHtml(
    'Contrato de Prestação de Serviços',
    'Cláusulas principais:\n- Prazo de 12 meses\n- Renegociação automática\n\nAs partes concordam com os termos.',
  );

  assert.match(html, /<strong>Contrato de Prestação de Serviços<\/strong>/);
  assert.match(html, /<li>Prazo de 12 meses<\/li>/);
  assert.match(html, /<li>Renegociação automática<\/li>/);
  assert.match(html, /As partes concordam com os termos\./);
});

