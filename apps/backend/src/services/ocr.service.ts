import { pdf as pdfToImg } from 'pdf-to-img';
import { logger } from '../utils/logger';
import env from '../config/env';
import { configService } from './config.service';
import { appendSourceLog } from './rag-job.service';

/**
 * OCR Service
 *
 * Encapsula toda la lógica de extracción de texto por OCR/visión.
 * Proveedor único: OpenRouter (modelos de visión). Fallback legacy: pdf-parse.
 *
 * Todos los PDFs se convierten a imágenes (pdf-to-img) y pasan por el pipeline OCR.
 */

export type OcrProvider = 'openrouter';

export type OcrMethod = 'ocr' | 'ocr_vision' | 'llm_vision' | 'pdf-parse' | 'parser';

export interface OcrOptions {
  /** Escala de render de PDF (pdf-to-img). Default: config `rag.ocr_scale` (2). */
  scale?: number;
  /** Máximo de páginas a procesar. 0 = sin límite. */
  maxPages?: number;
  /** Páginas procesadas en paralelo. 0 = sin batching. */
  batchSize?: number;
  /** Timeout por página en ms. */
  timeoutMs?: number;
  /** Nombre de la fuente (para logs). */
  sourceName?: string;
  projectId?: string;
  sourceId?: string;
  /** Forzar un proveedor concreto (sobreescribe la config). */
  provider?: OcrProvider;
}

export interface OcrResult {
  text: string;
  pages: string[];
  method: OcrMethod;
  /** Confianza heurística (0-1) basada en cobertura de páginas con texto. */
  confidence: number;
  provider?: OcrProvider;
  model?: string;
  extractionTimeMs: number;
  pagesProcessed: number;
}

const DEFAULT_OCR_MODEL = env.OPENROUTER_OCR_MODEL;

const OCR_PROMPT = `Eres un motor de OCR. Extrae TODO el texto visible en la imagen (en español o inglés) y devuélvelo ÚNICAMENTE en Markdown.

Reglas estrictas:
- No inventes, no completes ni infieras texto.
- No omitas líneas ni secciones; extrae TODO el texto visible.
- Respeta el orden de lectura original.
- Usa encabezados, listas y tablas solo si existen en el documento (tablas como Markdown).
- Si no puedes leer el contenido con certeza, responde exactamente: NO_TEXT_FOUND
- Devuelve ÚNICAMENTE el Markdown o NO_TEXT_FOUND.`;

interface ResolvedOcrConfig {
  provider: OcrProvider;
  model: string;
  apiKey: string | undefined;
  baseUrl: string;
  scale: number;
  maxPages: number;
  batchSize: number;
  timeoutMs: number;
}

function isOcrProvider(value: any): value is OcrProvider {
  return value === 'openrouter';
}

function normalizeNonNegative(value: any, fallback: number) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return num < 0 ? fallback : num;
}

function resolveScale(value: any) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return 2;
  return Math.min(Math.max(Math.round(num), 1), 8);
}

function normalizeExtractedText(raw: string) {
  const text = String(raw || '').trim();
  if (!text) return '';
  if (text.toUpperCase() === 'NO_TEXT_FOUND') return '';
  return text;
}

async function log(sourceId: string | undefined, entry: { level: 'info' | 'warn' | 'error'; stage?: string; message: string }) {
  if (!sourceId) return;
  await appendSourceLog(sourceId, entry);
}

async function resolveOcrConfig(): Promise<ResolvedOcrConfig> {
  const [openrouterModelCfg, scaleCfg, maxPagesCfg, batchCfg, timeoutCfg] = await Promise.all([
    configService.get('rag.ocr_openrouter_model'),
    configService.get('rag.ocr_scale'),
    configService.get('rag.ocr_max_pages'),
    configService.get('rag.ocr_batch_size'),
    configService.get('rag.ocr_timeout_ms'),
  ]);

  const model = (typeof openrouterModelCfg === 'string' && openrouterModelCfg.trim())
    ? openrouterModelCfg.trim()
    : DEFAULT_OCR_MODEL;

  return {
    provider: 'openrouter',
    model,
    apiKey: env.OPENROUTER_API_KEY,
    baseUrl: env.OPENROUTER_BASE_URL,
    scale: resolveScale(scaleCfg),
    maxPages: normalizeNonNegative(maxPagesCfg, 0),
    batchSize: normalizeNonNegative(batchCfg, 4),
    timeoutMs: normalizeNonNegative(timeoutCfg, 60000),
  };
}

async function requestJson(url: string, init: RequestInit, timeoutMs: number): Promise<any> {
  const controller = new AbortController();
  const timer = timeoutMs > 0 ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status}${body ? `: ${body.slice(0, 200)}` : ''}`);
    }
    return await res.json();
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function buildOpenRouterRequest(apiKey: string, model: string, base64: string): RequestInit {
  return {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://mitchbot.app',
      'X-Title': 'MitchBot OCR',
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: OCR_PROMPT },
            { type: 'image_url', image_url: { url: `data:image/png;base64,${base64}` } },
          ],
        },
      ],
    }),
  };
}

/** Ejecuta OCR de una imagen PNG con OpenRouter */
async function ocrImageWithProvider(buffer: Buffer, config: ResolvedOcrConfig): Promise<string> {
  if (!config.apiKey) {
    throw new Error('Falta la credencial del proveedor: define OPENROUTER_API_KEY para el OCR.');
  }

  const base64 = buffer.toString('base64');
  const base = config.baseUrl.replace(/\/$/, '');
  const data = await requestJson(`${base}/chat/completions`, buildOpenRouterRequest(config.apiKey, config.model, base64), config.timeoutMs);
  const content = data?.choices?.[0]?.message?.content;
  const text = Array.isArray(content) ? content.map((c: any) => c?.text || '').join('') : (content || '');
  return normalizeExtractedText(text);
}

/** Renderiza un PDF a PNGs (Buffer) */
async function renderPdfPages(input: string | Buffer, scale: number, maxPages: number): Promise<{ page: number; buffer: Buffer }[]> {
  const document = await pdfToImg(input, { scale });
  const limit = maxPages > 0 ? maxPages : Number.POSITIVE_INFINITY;
  const pages: { page: number; buffer: Buffer }[] = [];
  let pageIndex = 0;
  for await (const image of document) {
    pageIndex += 1;
    if (pageIndex > limit) break;
    pages.push({ page: pageIndex, buffer: Buffer.isBuffer(image) ? image : Buffer.from(image as any) });
  }
  return pages;
}

/** Procesa todas las páginas (batching + allSettled para tolerar fallos puntuales) */
async function runProvider(
  pages: { page: number; buffer: Buffer }[],
  config: ResolvedOcrConfig,
): Promise<string[]> {
  const results: string[] = new Array(pages.length).fill('');
  const batchSize = config.batchSize > 0 ? config.batchSize : pages.length;

  for (let i = 0; i < pages.length; i += batchSize) {
    const batch = pages.slice(i, i + batchSize);
    const settled = await Promise.allSettled(
      batch.map(({ buffer }) => ocrImageWithProvider(buffer, config)),
    );
    settled.forEach((entry, idx) => {
      if (entry.status === 'fulfilled') {
        results[i + idx] = entry.value || '';
      }
    });
  }

  return results;
}

function buildResult(options: {
  texts: string[];
  totalPages: number;
  method: OcrMethod;
  provider?: OcrProvider;
  model?: string;
  startedAt: number;
}): OcrResult {
  const nonEmpty = options.texts.filter(t => t && t.trim());
  const text = nonEmpty.join('\n\n');
  const confidence = options.totalPages > 0
    ? Math.min(1, nonEmpty.length / options.totalPages)
    : (text ? 1 : 0);

  return {
    text,
    pages: nonEmpty,
    method: options.method,
    confidence,
    provider: options.provider,
    model: options.model,
    extractionTimeMs: Date.now() - options.startedAt,
    pagesProcessed: options.totalPages,
  };
}

/** Fallback legacy: extracción de texto embebido en el PDF con pdf-parse */
async function extractPdfLegacy(input: string | Buffer, startedAt: number): Promise<OcrResult> {
  try {
    const { PDFParse } = await import('pdf-parse');
    const data = Buffer.isBuffer(input) ? input : undefined;
    const parser = new PDFParse(data ? { data } : { url: input as string } as any);
    const result = await parser.getText();
    await parser.destroy();
    const pages = (result?.pages || [])
      .map(p => (p?.text || '').trim())
      .filter(Boolean);
    const text = pages.join('\n\n') || (result?.text || '').trim();
    const finalPages = pages.length > 0 ? pages : (text ? [text] : []);
    return {
      text,
      pages: finalPages,
      method: 'pdf-parse',
      confidence: finalPages.length > 0 ? 0.5 : 0,
      extractionTimeMs: Date.now() - startedAt,
      pagesProcessed: result?.total || finalPages.length,
    };
  } catch (error: any) {
    logger.error(`[OCR] pdf-parse fallback failed: ${error?.message || error}`);
    return {
      text: '',
      pages: [],
      method: 'pdf-parse',
      confidence: 0,
      extractionTimeMs: Date.now() - startedAt,
      pagesProcessed: 0,
    };
  }
}

/** Extrae texto de un PDF convirtiéndolo a imágenes y aplicando OCR (con fallback legacy) */
export async function extractPdf(input: string | Buffer, options: OcrOptions = {}): Promise<OcrResult> {
  const startedAt = Date.now();
  const config = await resolveOcrConfig();

  const scale = options.scale ? resolveScale(options.scale) : config.scale;
  const maxPages = options.maxPages !== undefined ? normalizeNonNegative(options.maxPages, config.maxPages) : config.maxPages;
  const batchSize = options.batchSize !== undefined ? normalizeNonNegative(options.batchSize, config.batchSize) : config.batchSize;
  const timeoutMs = options.timeoutMs !== undefined ? normalizeNonNegative(options.timeoutMs, config.timeoutMs) : config.timeoutMs;

  const effectiveConfig: ResolvedOcrConfig = { ...config, scale, maxPages, batchSize, timeoutMs };

  await log(options.sourceId, {
    level: 'info',
    stage: 'extracting',
    message: `OCR config: provider=openrouter model=${effectiveConfig.model} scale=${scale} maxPaginas=${maxPages} batch=${batchSize} timeoutMs=${timeoutMs}`,
  });

  let pages: { page: number; buffer: Buffer }[] = [];
  try {
    pages = await renderPdfPages(input, scale, maxPages);
  } catch (error: any) {
    logger.warn(`[OCR] No se pudo convertir PDF a imágenes: ${error?.message || error}`);
    await log(options.sourceId, { level: 'warn', stage: 'extracting', message: `pdf-to-img falló: ${error?.message || error}` });
    return extractPdfLegacy(input, startedAt);
  }

  if (pages.length === 0) {
    await log(options.sourceId, { level: 'warn', stage: 'extracting', message: 'PDF sin páginas renderizables, usando fallback' });
    return extractPdfLegacy(input, startedAt);
  }

  const providerStartedAt = Date.now();
  try {
    const texts = await runProvider(pages, effectiveConfig);
    const nonEmpty = texts.filter(t => t && t.trim());
    if (nonEmpty.length === 0) {
      await log(options.sourceId, { level: 'warn', stage: 'extracting', message: 'OCR OpenRouter no extrajo texto, usando pdf-parse (legacy)' });
      return extractPdfLegacy(input, startedAt);
    }

    const result = buildResult({
      texts,
      totalPages: pages.length,
      method: 'ocr_vision',
      provider: 'openrouter',
      model: effectiveConfig.model,
      startedAt,
    });

    await log(options.sourceId, {
      level: 'info',
      stage: 'extracting',
      message: `OCR completado con openrouter (${effectiveConfig.model}) — ${nonEmpty.length}/${pages.length} páginas, ${result.text.length} chars, ${result.extractionTimeMs}ms`,
    });
    logger.info(`[OCR] PDF extracted via openrouter/${effectiveConfig.model}: ${nonEmpty.length} pages, ${result.text.length} chars, ${Date.now() - providerStartedAt}ms`);
    return result;
  } catch (error: any) {
    logger.warn(`[OCR] openrouter falló: ${error?.message || error}`);
    await log(options.sourceId, { level: 'warn', stage: 'extracting', message: `OCR openrouter falló: ${error?.message || error}` });
    await log(options.sourceId, { level: 'warn', stage: 'extracting', message: 'Cadena OCR agotada, usando pdf-parse (legacy)' });
    return extractPdfLegacy(input, startedAt);
  }
}

/** Extrae texto de una imagen aplicando OCR */
export async function extractImage(
  buffer: Buffer,
  _fileType: string,
  options: OcrOptions = {},
): Promise<OcrResult> {
  const startedAt = Date.now();
  const config = await resolveOcrConfig();
  const effectiveConfig: ResolvedOcrConfig = {
    ...config,
    timeoutMs: options.timeoutMs !== undefined ? normalizeNonNegative(options.timeoutMs, config.timeoutMs) : config.timeoutMs,
  };

  try {
    const raw = await ocrImageWithProvider(buffer, effectiveConfig);
    const text = normalizeExtractedText(raw);
    if (!text) {
      return {
        text: '',
        pages: [],
        method: 'ocr_vision',
        confidence: 0,
        extractionTimeMs: Date.now() - startedAt,
        pagesProcessed: 1,
      };
    }
    const result = buildResult({ texts: [text], totalPages: 1, method: 'ocr_vision', provider: 'openrouter', model: effectiveConfig.model, startedAt });
    await log(options.sourceId, {
      level: 'info',
      stage: 'extracting',
      message: `OCR imagen completado con openrouter (${effectiveConfig.model}) — ${result.text.length} chars, ${result.extractionTimeMs}ms`,
    });
    return result;
  } catch (error: any) {
    logger.warn(`[OCR] Imagen openrouter falló: ${error?.message || error}`);
    await log(options.sourceId, { level: 'warn', stage: 'extracting', message: `OCR imagen openrouter falló: ${error?.message || error}` });
    return {
      text: '',
      pages: [],
      method: 'ocr_vision',
      confidence: 0,
      extractionTimeMs: Date.now() - startedAt,
      pagesProcessed: 1,
    };
  }
}

/**
 * Función unificada de extracción para documentos.
 * PDF → OCR por imágenes. Imagen → OCR. Texto/CSV → lectura directa.
 */
export async function extractDocument(
  buffer: Buffer,
  fileType: string,
  options: OcrOptions = {},
): Promise<OcrResult> {
  const startedAt = Date.now();

  if (fileType === 'application/pdf') {
    return extractPdf(buffer, options);
  }

  if (fileType.startsWith('image/')) {
    return extractImage(buffer, fileType, options);
  }

  const text = buffer.toString('utf-8').trim();
  return {
    text,
    pages: text ? [text] : [],
    method: 'parser',
    confidence: text ? 1 : 0,
    extractionTimeMs: Date.now() - startedAt,
    pagesProcessed: 0,
  };
}

export const ocrService = {
  extractDocument,
  extractPdf,
  extractImage,
};
