import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSemanticChunks, detectLanguage, estimateTokens } from '../../src/utils/chunking';

test('estimateTokens aproxima 4 caracteres por token', () => {
  assert.equal(estimateTokens(''), 0);
  assert.equal(estimateTokens('abcd'), 1);
  assert.equal(estimateTokens('abcde'), 2);
});

test('detectLanguage distingue español, inglés y mezcla', () => {
  assert.equal(detectLanguage('Hola, ¿cuál es el horario de la tienda para los clientes?'), 'es');
  assert.equal(detectLanguage('Hello, what are the opening hours of the store for customers?'), 'en');
  assert.equal(detectLanguage(''), 'mixed');
  assert.equal(detectLanguage('12345'), 'mixed');
});

test('createSemanticChunks antepone documento y sección a cada chunk', () => {
  const text = '# Horarios\nAbrimos de lunes a viernes.\n\n# Precios\nEl corte cuesta 20 euros.';
  const chunks = createSemanticChunks(text, { title: 'Guía' });
  assert.equal(chunks.length, 2);
  assert.ok(chunks[0].content.startsWith('Document: Guía | Section: Horarios\n'));
  assert.equal(chunks[1].metadata.section_heading, 'Precios');
  assert.equal(chunks[1].metadata.chunk_id, 2);
  assert.equal(chunks[1].metadata.total_chunks, 2);
});

test('createSemanticChunks conserva una tabla como un único chunk', () => {
  const table = ['| Servicio | Precio |', '| --- | --- |', '| Corte | 20 |', '| Tinte | 45 |'].join('\n');
  const chunks = createSemanticChunks(`# Tarifas\n${table}`, { title: 'Tarifas' });
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0].metadata.is_table, true);
});

test('createSemanticChunks divide el texto que supera el tamaño de chunk', () => {
  const paragraphs = Array.from({ length: 20 }, (_, i) => `Párrafo ${i} con información del servicio y de los clientes.`.repeat(5));
  const chunks = createSemanticChunks(paragraphs.join('\n\n'), { chunkSize: 100, overlap: 10 });
  assert.ok(chunks.length > 1);
  for (const chunk of chunks) {
    assert.ok(estimateTokens(chunk.content) <= 100 + 40, `chunk demasiado grande: ${estimateTokens(chunk.content)}`);
  }
});
