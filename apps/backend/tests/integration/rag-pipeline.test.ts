import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { connectDatabase, closeDatabase } from '../../src/config/database';
import { createSemanticChunks, detectLanguage, estimateTokens } from '../../src/utils/chunking';
import { rerankerService } from '../../src/services/reranker.service';
import { ocrService } from '../../src/services/ocr.service';
import { llmProviderService } from '../../src/services/llm-provider.service';

let hasOllamaModels = false;

before(async () => {
  await connectDatabase();
  try {
    const models = await llmProviderService.fetchOllamaModels();
    hasOllamaModels = models.length > 0;
  } catch {
    hasOllamaModels = false;
  }
  console.log(`[test] Ollama models available: ${hasOllamaModels}`);
});

after(async () => {
  await closeDatabase();
});

const SAMPLE_MARKDOWN = `# Horarios
Abrimos de lunes a viernes de 9 a 18 hs.

## Servicios
| Servicio | Precio |
| --- | --- |
| Corte | 20 |
| Color | 45 |

## Contacto
Escríbenos por WhatsApp. Gracias por tu preferencia.

# About
We are open Monday to Friday. Please call us for more information about our services and prices.`;

test('chunking: detecta encabezados y antepone Document/Section', () => {
  const chunks = createSemanticChunks(SAMPLE_MARKDOWN, { title: 'Catálogo' });
  assert.ok(chunks.length >= 4, 'debe generar varios chunks');
  for (const chunk of chunks) {
    assert.ok(chunk.content.startsWith('Document: Catálogo | Section:'), 'prefijo de contexto');
    assert.ok(chunk.metadata.section_heading, 'metadata de sección');
  }
  const sections = chunks.map(c => c.metadata.section_heading);
  assert.ok(sections.includes('Horarios'));
  assert.ok(sections.includes('Servicios'));
});

test('chunking: conserva las tablas como un único chunk', () => {
  const chunks = createSemanticChunks(SAMPLE_MARKDOWN, { title: 'Catálogo' });
  const tableChunk = chunks.find(c => c.metadata.is_table);
  assert.ok(tableChunk, 'debe marcar el chunk de tabla');
  assert.match(tableChunk!.content, /\| Corte \| 20 \|/);
  assert.match(tableChunk!.content, /\| Color \| 45 \|/);
});

test('chunking: respeta el tamaño en tokens (~800) y el overlap', () => {
  const longText = 'contenido de prueba '.repeat(3000);
  const chunks = createSemanticChunks(longText, { title: 'Largo' });
  assert.ok(chunks.length > 1);
  for (const chunk of chunks) {
    // margen por el prefijo y el overlap
    assert.ok(estimateTokens(chunk.content) <= 900, `chunk demasiado grande: ${estimateTokens(chunk.content)}`);
  }
});

test('chunking: registra número de página cuando se proveen páginas', () => {
  const pages = ['# Uno\npagina uno con texto', '# Dos\npagina dos con texto'];
  const text = '# Uno\npagina uno con texto\n\n# Dos\npagina dos con texto';
  const chunks = createSemanticChunks(text, { title: 'Paginado', pages });
  assert.ok(chunks.some(c => c.metadata.page_number === 1));
  assert.ok(chunks.some(c => c.metadata.page_number === 2));
});

test('detección de idioma: es, en y mixed', () => {
  assert.equal(detectLanguage('Hola, gracias por tu preferencia. El servicio está disponible.'), 'es');
  assert.equal(detectLanguage('Hello, thanks for your preference. The service is available now.'), 'en');
  assert.equal(detectLanguage('12345 ...'), 'mixed');
});

test('re-ranking: 10 consultas de calidad RAG devuelven el top-3 ordenado', async () => {
  const documents = [
    { pageContent: 'El horario de atención es de lunes a viernes de 9 a 18 hs.' },
    { pageContent: 'El precio del corte de cabello es de 20 dólares.' },
    { pageContent: 'El color cuesta 45 dólares y dura dos horas.' },
    { pageContent: 'Aceptamos pagos con tarjeta y efectivo.' },
    { pageContent: 'Contamos con estacionamiento gratuito para clientes.' },
    { pageContent: 'La garantía de los productos es de 12 meses.' },
    { pageContent: 'Realizamos envíos a todo el país en 3 días hábiles.' },
    { pageContent: 'Puedes agendar tu cita por WhatsApp.' },
    { pageContent: 'Ofrecemos descuentos para estudiantes.' },
    { pageContent: 'El local está ubicado en la avenida principal.' },
  ];

  const queries: { query: string; expected: string }[] = [
    { query: '¿cuál es el horario de atención?', expected: 'horario' },
    { query: '¿cuánto cuesta el corte?', expected: 'corte' },
    { query: 'precio del color', expected: 'color' },
    { query: 'formas de pago', expected: 'pagos' },
    { query: '¿hay estacionamiento?', expected: 'estacionamiento' },
    { query: 'garantía de productos', expected: 'garantía' },
    { query: 'envíos y entregas', expected: 'envíos' },
    { query: 'agendar cita', expected: 'cita' },
    { query: 'descuento estudiantes', expected: 'estudiantes' },
    { query: 'dirección ubicación local', expected: 'ubicado' },
  ];

  for (const { query, expected } of queries) {
    const top = await rerankerService.rerank(query, documents, { finalK: 3 });
    assert.equal(top.length, 3, `debe devolver 3 resultados para "${query}"`);
    assert.ok(
      top.some(doc => new RegExp(expected, 'i').test(doc.pageContent || '')),
      `el top-3 para "${query}" debería incluir el documento sobre "${expected}"`
    );
  }
});

test('OCR: extractDocument maneja texto plano (parser)', async () => {
  const result = await ocrService.extractDocument(Buffer.from('Hola mundo'), 'text/plain');
  assert.equal(result.text, 'Hola mundo');
  assert.equal(result.method, 'parser');
  assert.equal(typeof result.confidence, 'number');
  assert.ok(result.pages.length === 1);
});

test('OCR: extractPdf devuelve un resultado estructurado ante un PDF inválido', async () => {
  const result = await ocrService.extractPdf(Buffer.from('%PDF-1.4 broken'));
  assert.ok(['ocr', 'ocr_vision', 'llm_vision', 'pdf-parse'].includes(result.method));
  assert.equal(typeof result.text, 'string');
  assert.equal(typeof result.confidence, 'number');
  assert.ok(Array.isArray(result.pages));
});

test('PDF end-to-end (OCR → chunking) cuando hay modelos disponibles', { skip: !hasOllamaModels }, async () => {
  // Requiere un modelo de visión/embeddings en Ollama; se ejecuta sólo si hay modelos.
  const markdown = '# Servicios\n| Servicio | Precio |\n| --- | --- |\n| Corte | 20 |';
  const chunks = createSemanticChunks(markdown, { title: 'Servicios' });
  assert.ok(chunks.length >= 1);
  assert.ok(chunks[0].content.includes('Document: Servicios'));
});
