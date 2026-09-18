import { pdf as pdfToImg } from 'pdf-to-img';
import { logger } from '../utils/logger';
import env from '../config/env';
import { configService } from './config.service';
import { aiModelService } from './ai-model.service';
import { appendSourceLog } from './rag-job.service';

/**
 * OCR Service
 *
 * Encapsula toda la lógica de extracción de texto por OCR/visión.
 * Cadena de proveedores: Ollama (Qwen2.5-VL) → Mistral OCR → OpenRouter → pdf-parse (legacy).
 *
 * Todos los PDFs se convierten a imágenes (pdf-to-img) y pasan por el pipeline OCR.
 */

export type OcrProvider = 'ollama' | 'mistral' | 'openrouter';

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

const PROVIDER_CHAIN: OcrProvider[] = ['ollama', 'mistral', 'openrouter'];

const DEFAULT_MODELS: Record<OcrProvider, string> = {
  ollama: 'qwen2.5-vl',
  mistral: 'mistral-ocr-latest',
  openrouter: 'google/gemini-2.0-flash-001',
};

const DEFAULT_BASE_URLS: Record<OcrProvider, string> = {
  ollama: env.OLLAMA_URL,
  mistral: 'https://api.mistral.ai/v1',
  openrouter: 'https://openrouter.ai/api/v1',
};

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
  chain: OcrProvider[];
  models: Record<OcrProvider, string>;
  apiKeys: Record<OcrProvider, string | undefined>;
  baseUrls: Record<OcrProvider, string>;
  scale: number;
  maxPages: number;
  batchSize: number;
  timeoutMs: number;
}

function isOcrProvider(value: any): value is OcrProvider {
  return PROVIDER_CHAIN.includes(value);
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

async function lookupFallbackApiKey(provider: OcrProvider, projectId?: string): Promise<string | undefined> {
  if (provider === 'ollama') return undefined;
  const types: Array<'llm' | 'embedding' | 'file' | 'image' | 'ocr'> = ['ocr', 'llm', 'embedding', 'file', 'image'];
  for (const type of types) {
    try {
      const config = await aiModelService.getProviderConfig(type, provider, projectId);
      if (config?.apiKey) return config.apiKey;
    } catch {
      // ignore lookup errors
    }
  }
  return undefined;
}

async function resolveOcrConfig(projectId?: string, overrideProvider?: OcrProvider): Promise<ResolvedOcrConfig> {
  const [
    providerCfg,
    ollamaModelCfg,
    mistralModelCfg,
    openrouterModelCfg,
    scaleCfg,
    maxPagesCfg,
    batchCfg,
    timeoutCfg,
  ] = await Promise.all([
    configService.get('rag.ocr_provider'),
    configService.get('rag.ocr_ollama_model'),
    configService.get('rag.ocr_mistral_model'),
    configService.get('rag.ocr_openrouter_model'),
    configService.get('rag.ocr_scale'),
    configService.get('rag.ocr_max_pages'),
    configService.get('rag.ocr_batch_size'),
    configService.get('rag.ocr_timeout_ms'),
  ]);

  const activeConfig = await aiModelService.getActiveOcrConfig(projectId).catch(() => null);

  const provider: OcrProvider =
    overrideProvider
    || (isOcrProvider(providerCfg) ? providerCfg : undefined)
    || (isOcrProvider(activeConfig?.provider) ? activeConfig?.provider as OcrProvider : undefined)
    || 'ollama';

  const models: Record<OcrProvider, string> = { ...DEFAULT_MODELS };
  if (typeof ollamaModelCfg === 'string' && ollamaModelCfg.trim()) models.ollama = ollamaModelCfg.trim();
  if (typeof mistralModelCfg === 'string' && mistralModelCfg.trim()) models.mistral = mistralModelCfg.trim();
  if (typeof openrouterModelCfg === 'string' && openrouterModelCfg.trim()) models.openrouter = openrouterModelCfg.trim();
  if (activeConfig?.model && isOcrProvider(activeConfig.provider)) {
    models[activeConfig.provider as OcrProvider] = activeConfig.model;
  }

  const apiKeys: Record<OcrProvider, string | undefined> = {
    ollama: undefined,
    mistral: undefined,
    openrouter: undefined,
  };
  const baseUrls: Record<OcrProvider, string> = { ...DEFAULT_BASE_URLS };

  if (activeConfig && isOcrProvider(activeConfig.provider)) {
    if (activeConfig.apiKey) apiKeys[activeConfig.provider as OcrProvider] = activeConfig.apiKey;
    if (activeConfig.baseUrl) baseUrls[activeConfig.provider as OcrProvider] = activeConfig.baseUrl;
  }

  for (const p of PROVIDER_CHAIN) {
    if (!apiKeys[p]) {
      apiKeys[p] = await lookupFallbackApiKey(p, projectId);
    }
  }

  const chain: OcrProvider[] = [provider, ...PROVIDER_CHAIN.filter(p => p !== provider)];

  return {
    provider,
    chain,
    models,
    apiKeys,
    baseUrls,
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

function buildOllamaRequest(url: string, model: string, base64: string): RequestInit {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      stream: false,
      options: { temperature: 0 },
      messages: [
        { role: 'user', content: OCR_PROMPT, images: [base64] },
      ],
    }),
  };
}

function buildMistralRequest(url: string, apiKey: string, model: string, base64: string): RequestInit {
  return {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      document: {
        type: 'image_url',
        image_url: `data:image/png;base64,${base64}`,
      },
    }),
  };
}

function buildOpenRouterRequest(url: string, apiKey: string, model: string, base64: string): RequestInit {
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

/** Ejecuta OCR de una imagen PNG con el proveedor indicado */
async function ocrImageWithProvider(
  provider: OcrProvider,
  buffer: Buffer,
  config: ResolvedOcrConfig,
): Promise<string> {
  const model = config.models[provider];
  const base64 = buffer.toString('base64');
  const timeout = config.timeoutMs;

  if (provider === 'ollama') {
    const base = (config.baseUrls.ollama || env.OLLAMA_URL).replace(/\/$/, '');
    const data = await requestJson(`${base}/api/chat`, buildOllamaRequest(base, model, base64), timeout);
    return normalizeExtractedText(data?.message?.content || '');
  }

  if (provider === 'mistral') {
    const apiKey = config.apiKeys.mistral;
    if (!apiKey) throw new Error('API Key de Mistral requerida para OCR');
    const base = (config.baseUrls.mistral || DEFAULT_BASE_URLS.mistral).replace(/\/$/, '');
    const data = await requestJson(`${base}/ocr`, buildMistralRequest(base, apiKey, model, base64), timeout);
    const pages = Array.isArray(data?.pages) ? data.pages : [];
    const text = pages.map((p: any) => p?.markdown || '').join('\n\n');
    return normalizeExtractedText(text);
  }

  // openrouter
  const apiKey = config.apiKeys.openrouter;
  if (!apiKey) throw new Error('API Key de OpenRouter requerida para OCR');
  const base = (config.baseUrls.openrouter || DEFAULT_BASE_URLS.openrouter).replace(/\/$/, '');
  const data = await requestJson(`${base}/chat/completions`, buildOpenRouterRequest(base, apiKey, model, base64), timeout);
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

/** Procesa todas las páginas con un proveedor (batching + allSettled para tolerar fallos puntuales) */
async function runProvider(
  provider: OcrProvider,
  pages: { page: number; buffer: Buffer }[],
  config: ResolvedOcrConfig,
): Promise<string[]> {
  const results: string[] = new Array(pages.length).fill('');
  const batchSize = config.batchSize > 0 ? config.batchSize : pages.length;

  for (let i = 0; i < pages.length; i += batchSize) {
    const batch = pages.slice(i, i + batchSize);
    const settled = await Promise.allSettled(
      batch.map(({ buffer }) => ocrImageWithProvider(provider, buffer, config)),
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
  const config = await resolveOcrConfig(options.projectId, options.provider);

  const scale = options.scale ? resolveScale(options.scale) : config.scale;
  const maxPages = options.maxPages !== undefined ? normalizeNonNegative(options.maxPages, config.maxPages) : config.maxPages;
  const batchSize = options.batchSize !== undefined ? normalizeNonNegative(options.batchSize, config.batchSize) : config.batchSize;
  const timeoutMs = options.timeoutMs !== undefined ? normalizeNonNegative(options.timeoutMs, config.timeoutMs) : config.timeoutMs;

  const effectiveConfig: ResolvedOcrConfig = { ...config, scale, maxPages, batchSize, timeoutMs };

  await log(options.sourceId, {
    level: 'info',
    stage: 'extracting',
    message: `OCR config: provider=${effectiveConfig.provider} scale=${scale} maxPaginas=${maxPages} batch=${batchSize} timeoutMs=${timeoutMs}`,
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

  for (const provider of effectiveConfig.chain) {
    const providerStartedAt = Date.now();
    try {
      const texts = await runProvider(provider, pages, effectiveConfig);
      const nonEmpty = texts.filter(t => t && t.trim());
      if (nonEmpty.length === 0) {
        await log(options.sourceId, {
          level: 'warn',
          stage: 'extracting',
          message: `OCR ${provider} no extrajo texto, probando siguiente proveedor`,
        });
        continue;
      }

      const method: OcrMethod = provider === 'mistral' ? 'ocr' : 'ocr_vision';
      const result = buildResult({
        texts,
        totalPages: pages.length,
        method,
        provider,
        model: effectiveConfig.models[provider],
        startedAt,
      });

      await log(options.sourceId, {
        level: 'info',
        stage: 'extracting',
        message: `OCR completado con ${provider} (${effectiveConfig.models[provider]}) — ${nonEmpty.length}/${pages.length} páginas, ${result.text.length} chars, ${result.extractionTimeMs}ms`,
      });
      logger.info(`[OCR] PDF extracted via ${provider}/${effectiveConfig.models[provider]}: ${nonEmpty.length} pages, ${result.text.length} chars, ${Date.now() - providerStartedAt}ms`);
      return result;
    } catch (error: any) {
      logger.warn(`[OCR] ${provider} falló: ${error?.message || error}`);
      await log(options.sourceId, {
        level: 'warn',
        stage: 'extracting',
        message: `OCR ${provider} falló: ${error?.message || error}`,
      });
    }
  }

  await log(options.sourceId, { level: 'warn', stage: 'extracting', message: 'Cadena OCR agotada, usando pdf-parse (legacy)' });
  return extractPdfLegacy(input, startedAt);
}

/** Extrae texto de una imagen aplicando OCR */
export async function extractImage(
  buffer: Buffer,
  fileType: string,
  options: OcrOptions = {},
): Promise<OcrResult> {
  const startedAt = Date.now();
  const config = await resolveOcrConfig(options.projectId, options.provider);
  const effectiveConfig: ResolvedOcrConfig = {
    ...config,
    timeoutMs: options.timeoutMs !== undefined ? normalizeNonNegative(options.timeoutMs, config.timeoutMs) : config.timeoutMs,
  };

  for (const provider of effectiveConfig.chain) {
    try {
      const raw = await ocrImageWithProvider(provider, buffer, effectiveConfig);
      const text = normalizeExtractedText(raw);
      if (!text) {
        continue;
      }
      const method: OcrMethod = provider === 'mistral' ? 'ocr' : 'ocr_vision';
      const result = buildResult({ texts: [text], totalPages: 1, method, provider, model: effectiveConfig.models[provider], startedAt });
      await log(options.sourceId, {
        level: 'info',
        stage: 'extracting',
        message: `OCR imagen completado con ${provider} (${effectiveConfig.models[provider]}) — ${result.text.length} chars, ${result.extractionTimeMs}ms`,
      });
      return result;
    } catch (error: any) {
      logger.warn(`[OCR] Imagen ${provider} falló: ${error?.message || error}`);
      await log(options.sourceId, { level: 'warn', stage: 'extracting', message: `OCR imagen ${provider} falló: ${error?.message || error}` });
    }
  }

  return {
    text: '',
    pages: [],
    method: 'ocr_vision',
    confidence: 0,
    extractionTimeMs: Date.now() - startedAt,
    pagesProcessed: 1,
  };
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

/** Verifica la conexión de un proveedor OCR sin procesar documentos reales */
async function testProviderConnection(
  provider: OcrProvider,
  apiKey: string | undefined,
  baseUrl: string | undefined,
  model: string | undefined,
): Promise<{ success: boolean; message?: string; error?: string }> {
  const resolvedModel = model || DEFAULT_MODELS[provider];
  try {
    if (provider === 'ollama') {
      const base = (baseUrl || env.OLLAMA_URL).replace(/\/$/, '');
      const data = await requestJson(`${base}/api/tags`, { method: 'GET' }, 8000);
      const models: any[] = data?.models || [];
      const names = models.map(m => m.name || m.model || '');
      const found = names.some(n => n === resolvedModel || n.startsWith(`${resolvedModel}:`) || n.startsWith(resolvedModel));
      return {
        success: true,
        message: found
          ? `Ollama conectado. Modelo "${resolvedModel}" disponible.`
          : `Ollama conectado, pero el modelo "${resolvedModel}" no está descargado (${models.length} modelos disponibles).`,
      };
    }

    if (provider === 'mistral') {
      if (!apiKey) return { success: false, error: 'API Key de Mistral requerida' };
      const base = (baseUrl || DEFAULT_BASE_URLS.mistral).replace(/\/$/, '');
      await requestJson(`${base}/models`, { method: 'GET', headers: { Authorization: `Bearer ${apiKey}` } }, 10000);
      return { success: true, message: `Mistral conectado. Modelo OCR: ${resolvedModel}` };
    }

    if (!apiKey) return { success: false, error: 'API Key de OpenRouter requerida' };
    await requestJson('https://openrouter.ai/api/v1/models', {
      method: 'GET',
      headers: { Authorization: `Bearer ${apiKey}` },
    }, 10000);
    return { success: true, message: `OpenRouter conectado. Modelo OCR: ${resolvedModel}` };
  } catch (error: any) {
    return { success: false, error: error?.message || String(error) };
  }
}

export const ocrService = {
  extractDocument,
  extractPdf,
  extractImage,

  /** Prueba la conexión con el proveedor OCR configurado (o uno explícito). */
  async testConnection(params?: { provider?: string; apiKey?: string; baseUrl?: string; model?: string; projectId?: string }) {
    let provider = isOcrProvider(params?.provider) ? params!.provider as OcrProvider : undefined;
    let apiKey = params?.apiKey;
    let baseUrl = params?.baseUrl;
    let model = params?.model;

    if (!provider || !model || (!apiKey && provider !== 'ollama')) {
      const config = await resolveOcrConfig(params?.projectId);
      provider = provider || config.provider;
      model = model || config.models[provider];
      apiKey = apiKey || config.apiKeys[provider];
      baseUrl = baseUrl || config.baseUrls[provider];
    }

    return testProviderConnection(provider, apiKey, baseUrl, model);
  },
};
