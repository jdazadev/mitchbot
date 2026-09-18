/**
 * Utilidades de chunking semántico y detección de idioma.
 *
 * - Divide por encabezados Markdown (h1-h3)
 * - Antepone `Document: {title} | Section: {heading}` a cada chunk
 * - Conserva las tablas Markdown como un único chunk
 * - Tamaño de chunk en TOKENS (aprox. 1 token ≈ 4 caracteres)
 * - Overlap en tokens
 * - Detecta idioma por heurística de stop words (sin llamadas externas)
 */

export type ChunkLanguage = 'en' | 'es' | 'mixed';

export interface ChunkMetadata {
  document_id?: string;
  chunk_id: number;
  total_chunks: number;
  document_title?: string;
  section_heading?: string;
  page_number?: number;
  is_table?: boolean;
  language: ChunkLanguage;
  [key: string]: any;
}

export interface SemanticChunk {
  content: string;
  metadata: ChunkMetadata;
}

const CHARS_PER_TOKEN = 4;
const DEFAULT_CHUNK_TOKENS = 800;
const DEFAULT_OVERLAP_TOKENS = 100;
const MIN_OVERLAP_CHARS = 40;

const SPANISH_WORDS = new Set([
  'el', 'la', 'los', 'las', 'de', 'que', 'y', 'en', 'un', 'una', 'es', 'por', 'con', 'para',
  'no', 'se', 'del', 'al', 'como', 'mas', 'pero', 'sus', 'le', 'ya', 'este', 'porque', 'esta',
  'entre', 'cuando', 'muy', 'sin', 'sobre', 'tambien', 'hasta', 'hay', 'donde', 'desde', 'todo',
  'nos', 'todos', 'uno', 'contra', 'otros', 'ese', 'eso', 'ante', 'ello', 'esto', 'antes',
  'algunos', 'unos', 'otro', 'otra', 'tanto', 'esa', 'estos', 'mucho', 'nada', 'muchos', 'cual',
  'poco', 'ella', 'estar', 'estas', 'algunas', 'algo', 'nosotros', 'tus', 'tu', 'te', 'ti',
  'hola', 'gracias', 'como', 'cual', 'donde', 'servicio', 'cliente', 'producto', 'precio',
  'horario', 'cita', 'pedido', 'puede', 'tiene', 'hacer', 'favor',
]);

const ENGLISH_WORDS = new Set([
  'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'it', 'for', 'not', 'on', 'with',
  'as', 'you', 'do', 'at', 'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'she', 'or',
  'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what', 'so', 'up', 'out', 'if',
  'about', 'who', 'get', 'which', 'go', 'me', 'when', 'make', 'can', 'like', 'time', 'no', 'just',
  'him', 'know', 'take', 'people', 'into', 'year', 'your', 'good', 'some', 'could', 'them', 'see',
  'than', 'now', 'look', 'only', 'come', 'over', 'think', 'also', 'back', 'after', 'use', 'two',
  'how', 'our', 'work', 'first', 'well', 'way', 'even', 'new', 'want', 'because', 'any', 'these',
  'give', 'day', 'most', 'hello', 'thanks', 'please', 'service', 'customer', 'product', 'price',
  'schedule', 'appointment', 'order', 'hours', 'available', 'help',
]);

/** Estimación aproximada de tokens (1 token ≈ 4 caracteres para EN/ES) */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Detecta el idioma del texto con una heurística de stop words.
 * No realiza llamadas externas.
 */
export function detectLanguage(text: string): ChunkLanguage {
  if (!text || !text.trim()) return 'mixed';

  const words = text
    .toLowerCase()
    .replace(/[0-9]/g, ' ')
    .match(/[a-záéíóúñü]+/gi) || [];

  if (words.length === 0) return 'mixed';

  let es = 0;
  let en = 0;
  for (const word of words) {
    if (SPANISH_WORDS.has(word)) es += 1;
    if (ENGLISH_WORDS.has(word)) en += 1;
  }

  const signals = es + en;
  if (signals === 0) return 'mixed';
  if (es > en * 1.2) return 'es';
  if (en > es * 1.2) return 'en';
  return 'mixed';
}

function normalizeText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

interface Section {
  heading: string;
  body: string;
}

/** Divide el texto por encabezados Markdown (h1-h3) */
function splitSections(text: string, fallbackHeading: string): Section[] {
  const lines = text.split('\n');
  const sections: Section[] = [];
  let current: Section = { heading: fallbackHeading, body: '' };
  const headerRe = /^(#{1,3})\s+(.+?)\s*#*\s*$/;

  for (const line of lines) {
    const match = line.match(headerRe);
    if (match) {
      if (current.body.trim()) sections.push(current);
      current = { heading: match[2].trim(), body: '' };
      continue;
    }
    current.body += `${line}\n`;
  }

  if (current.body.trim()) sections.push(current);
  if (sections.length === 0 && text.trim()) {
    sections.push({ heading: fallbackHeading, body: text });
  }
  return sections;
}

const isTableLine = (line: string) => {
  const trimmed = line.trim();
  return trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.length > 1;
};

/** Separa el cuerpo en bloques: párrafos y tablas (las tablas no se parten) */
function splitBlocks(body: string): { text: string; isTable: boolean }[] {
  const lines = body.split('\n');
  const blocks: { text: string; isTable: boolean }[] = [];
  let paragraph: string[] = [];
  let table: string[] = [];

  const flushParagraph = () => {
    const text = paragraph.join('\n').trim();
    if (text) blocks.push({ text, isTable: false });
    paragraph = [];
  };
  const flushTable = () => {
    const text = table.join('\n').trim();
    if (text) blocks.push({ text, isTable: true });
    table = [];
  };

  for (const line of lines) {
    if (isTableLine(line)) {
      flushParagraph();
      table.push(line);
      continue;
    }
    if (table.length > 0) flushTable();

    if (line.trim() === '') {
      flushParagraph();
      continue;
    }
    paragraph.push(line);
  }

  flushTable();
  flushParagraph();
  return blocks;
}

/** Parte un bloque demasiado largo respetando saltos de línea/frases */
function splitOversizedBlock(text: string, maxChars: number, overlapChars: number): string[] {
  if (text.length <= maxChars) return [text];

  const pieces: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = Math.min(start + maxChars, text.length);
    if (end < text.length) {
      const slice = text.slice(start, end);
      const breakAt = Math.max(slice.lastIndexOf('\n'), slice.lastIndexOf('. '), slice.lastIndexOf('; '));
      if (breakAt > maxChars * 0.5) {
        end = start + breakAt + 1;
      }
    }
    pieces.push(text.slice(start, end).trim());
    if (end >= text.length) break;
    start = Math.max(end - overlapChars, start + 1);
  }

  return pieces.filter(Boolean);
}

/** Ubica el número de página aproximado de un chunk dentro del arreglo de páginas */
function detectPageNumber(text: string, pages?: string[]): number | undefined {
  if (!pages || pages.length === 0) return undefined;
  const normalize = (value: string) => value.replace(/\s+/g, ' ').trim();
  const needle = normalize(text).slice(0, 44);
  if (needle.length < 12) return undefined;

  for (let i = 0; i < pages.length; i += 1) {
    const page = normalize(pages[i] || '');
    if (page.includes(needle)) return i + 1;
  }

  // Fallback: mayor solapamiento de las primeras 120 letras
  const probe = normalize(text).slice(0, 120);
  let bestPage: number | undefined;
  let bestScore = 0;
  for (let i = 0; i < pages.length; i += 1) {
    const page = normalize(pages[i] || '');
    let score = 0;
    for (let j = 0; j < probe.length; j += 1) {
      if (page[j] === probe[j]) score += 1;
    }
    if (score > bestScore && score > probe.length * 0.4) {
      bestScore = score;
      bestPage = i + 1;
    }
  }
  return bestPage;
}

export interface CreateSemanticChunksOptions {
  title?: string;
  pages?: string[];
  chunkSize?: number;
  overlap?: number;
  extraMetadata?: Record<string, any>;
}

/**
 * Crea chunks semánticos a partir de texto (Markdown).
 * Cada chunk incluye: `Document: {title} | Section: {heading}`.
 */
export function createSemanticChunks(
  text: string,
  options: CreateSemanticChunksOptions = {},
): SemanticChunk[] {
  const fallbackHeading = 'General';
  const title = options.title?.trim() || 'Documento';
  const chunkTokens = options.chunkSize && options.chunkSize > 0 ? options.chunkSize : DEFAULT_CHUNK_TOKENS;
  const overlapTokens = options.overlap !== undefined && options.overlap >= 0 ? options.overlap : DEFAULT_OVERLAP_TOKENS;

  const maxChars = chunkTokens * CHARS_PER_TOKEN;
  const overlapChars = Math.max(overlapTokens * CHARS_PER_TOKEN, MIN_OVERLAP_CHARS);

  const cleaned = normalizeText(text);
  const sections = splitSections(cleaned, fallbackHeading);

  const rawChunks: { body: string; heading: string; isTable: boolean }[] = [];

  for (const section of sections) {
    const blocks = splitBlocks(section.body);
    let current = '';
    let currentIsTable = true;

    const pushCurrent = () => {
      const body = current.trim();
      if (body) rawChunks.push({ body, heading: section.heading, isTable: currentIsTable && body.includes('|') });
      current = '';
      currentIsTable = true;
    };

    for (const block of blocks) {
      if (estimateTokens(block.text) > chunkTokens) {
        pushCurrent();
        const pieces = splitOversizedBlock(block.text, maxChars, overlapChars);
        for (const piece of pieces) {
          rawChunks.push({ body: piece, heading: section.heading, isTable: block.isTable });
        }
        continue;
      }

      const candidate = current ? `${current}\n\n${block.text}` : block.text;
      if (current && estimateTokens(candidate) > chunkTokens) {
        const previous = current;
        pushCurrent();
        const overlap = previous.slice(-overlapChars).trim();
        current = overlap ? `${overlap}\n\n${block.text}` : block.text;
        currentIsTable = block.isTable;
      } else {
        current = candidate;
        if (current.trim() === block.text.trim()) {
          currentIsTable = block.isTable;
        } else if (!block.isTable) {
          currentIsTable = false;
        }
      }
    }

    pushCurrent();
  }

  const total = rawChunks.length;
  return rawChunks.map((chunk, index) => {
    const prefix = `Document: ${title} | Section: ${chunk.heading}`;
    const content = `${prefix}\n${chunk.body}`;
    const metadata: ChunkMetadata = {
      ...(options.extraMetadata || {}),
      chunk_id: index + 1,
      total_chunks: total,
      document_title: title,
      section_heading: chunk.heading,
      page_number: detectPageNumber(chunk.body, options.pages),
      is_table: chunk.isTable || undefined,
      language: detectLanguage(content),
    };
    return { content, metadata };
  });
}
