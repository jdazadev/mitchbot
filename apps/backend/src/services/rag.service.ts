import fs from 'fs';
import { createHash } from 'crypto';
import { pdf as pdfToImg } from 'pdf-to-img';
import { ObjectId } from 'mongodb';
import { QdrantVectorStore } from '@langchain/qdrant';
import { v4 as uuidv4 } from 'uuid';
import { HumanMessage } from '@langchain/core/messages';
import qdrantClient from '../config/qdrant';
import { getKnowledgeSourcesCollection, KnowledgeSource } from '../models/document.model';
import { logger } from '../utils/logger';
import { llmProviderService } from './llm-provider.service';
import { aiModelService } from './ai-model.service';
import { configService } from './config.service';
import { appendSourceLog, updateSourceProgress } from './rag-job.service';
import { ocrService } from './ocr.service';
import { rerankerService } from './reranker.service';
import { createSemanticChunks } from '../utils/chunking';

/**
 * Resuelve la configuración de embeddings desde el proveedor activo en BD.
 */
async function resolveEmbeddingsConfig(projectId?: string) {
  try {
    return await aiModelService.getActiveEmbeddingConfig(projectId);
  } catch (e) {
    logger.error('Error resolving embedding config:', e);
  }
  return null;
}

/** Crea embeddings basado en la configuración activa */
async function createEmbeddings(projectId?: string) {
  const config = await resolveEmbeddingsConfig(projectId);
  if (!config) {
    throw new Error('No hay un modelo de embeddings configurado');
  }
  return llmProviderService.createEmbeddings(config);
}

async function resolveEmbeddingCollectionName(projectId: string) {
  const config = await resolveEmbeddingsConfig(projectId);
  if (!config?.model) {
    return `knowledge_base_${projectId}`;
  }
  const hash = createHash('sha1').update(config.model).digest('hex').slice(0, 10);
  return `knowledge_base_${projectId}_${hash}`;
}

async function resolveFileModelConfig(projectId?: string) {
  try {
    return await aiModelService.getActiveFileConfig(projectId);
  } catch (e) {
    logger.error('Error resolving file model config:', e);
  }
  return null;
}

async function createFileExtractor(projectId?: string) {
  const config = await resolveFileModelConfig(projectId);
  if (!config) {
    return null;
  }
  return llmProviderService.createChatModel(config);
}

type PdfExtractConfig = {
  scale: number;
  maxPages: number;
  pageBatchSize: number;
  timeoutMs: number;
  maxBase64Chars: number;
  returnLimitChars: number;
};

function normalizeNonNegative(value: any, fallback: number) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return num < 0 ? fallback : num;
}

function resolvePdfScale(value: number) {
  if (!value || value <= 0) return 4;
  return Math.min(Math.max(Math.round(value), 1), 8);
}

function applyReturnLimit(text: string, limit: number) {
  if (!limit || limit <= 0) return text;
  return text.length > limit ? text.slice(0, limit) : text;
}

async function resolvePdfExtractConfig(): Promise<PdfExtractConfig> {
  const [
    scale,
    maxPages,
    pageBatchSize,
    timeoutMs,
    maxBase64Chars,
    returnLimitChars,
  ] = await Promise.all([
    configService.get('rag.pdf_extract_scale'),
    configService.get('rag.pdf_extract_max_pages'),
    configService.get('rag.pdf_extract_page_batch_size'),
    configService.get('rag.pdf_extract_timeout_ms'),
    configService.get('rag.pdf_extract_max_base64_chars'),
    configService.get('rag.pdf_extract_return_limit_chars'),
  ]);

  return {
    scale: resolvePdfScale(normalizeNonNegative(scale, 4)),
    maxPages: normalizeNonNegative(maxPages, 0),
    pageBatchSize: normalizeNonNegative(pageBatchSize, 2),
    timeoutMs: normalizeNonNegative(timeoutMs, 90000),
    maxBase64Chars: normalizeNonNegative(maxBase64Chars, 0),
    returnLimitChars: normalizeNonNegative(returnLimitChars, 0),
  };
}

function normalizePdfExtractConfig(config: PdfExtractConfig) {
  return {
    ...config,
    scale: resolvePdfScale(normalizeNonNegative(config.scale, 4)),
    maxPages: normalizeNonNegative(config.maxPages, 0),
    pageBatchSize: normalizeNonNegative(config.pageBatchSize, 2),
    timeoutMs: normalizeNonNegative(config.timeoutMs, 90000),
    maxBase64Chars: normalizeNonNegative(config.maxBase64Chars, 0),
    returnLimitChars: normalizeNonNegative(config.returnLimitChars, 0),
  };
}

const payloadIndexCache = new Set<string>();

/** Elimina de Qdrant los vectores asociados a una fuente */
async function purgeSourceVectors(options: {
  sourceId: string;
  collectionName?: string;
  sourceName?: string;
}) {
  const { sourceId, collectionName, sourceName } = options;
  if (!collectionName) return;

  try {
    await qdrantClient.delete(collectionName, {
      filter: {
        should: [
          { key: 'sourceId', match: { value: sourceId } },
          { key: 'source_id', match: { value: sourceId } },
          { key: 'document_id', match: { value: sourceId } },
          sourceName ? { key: 'sourceName', match: { value: sourceName } } : undefined,
          sourceName ? { key: 'source', match: { value: sourceName } } : undefined,
        ].filter(Boolean) as any,
      },
      wait: true,
    });
  } catch (error: any) {
    logger.warn(`[RAG] Rollback Qdrant failed: ${error?.message || error}`);
  }
}

async function rollbackSourceOnFailure(options: {
  sourceId: string;
  collectionName?: string;
  sourceName?: string;
}) {
  const { sourceId } = options;
  await purgeSourceVectors(options);

  try {
    await getKnowledgeSourcesCollection().deleteOne({ _id: new ObjectId(sourceId) });
  } catch (error: any) {
    logger.warn(`[RAG] Rollback Mongo failed: ${error?.message || error}`);
  }
}

const collectionConfigCache = new Set<string>();

/**
 * Garantiza que la colección de Qdrant exista con la configuración HNSW/optimizers
 * esperada. Si ya existe, solo actualiza el HNSW (no recrea).
 */
async function ensureCollectionConfigured(collectionName: string) {
  if (collectionConfigCache.has(collectionName)) return;

  const [m, efConstruct, ef, onDisk, vectorSize, indexingThreshold] = await Promise.all([
    configService.get('rag.qdrant_hnsw_m'),
    configService.get('rag.qdrant_ef_construct'),
    configService.get('rag.qdrant_ef'),
    configService.get('rag.qdrant_on_disk'),
    configService.get('rag.qdrant_vector_size'),
    configService.get('rag.qdrant_indexing_threshold'),
  ]);

  const hnswConfig = {
    m: Number(m) > 0 ? Number(m) : 16,
    ef_construct: Number(efConstruct) > 0 ? Number(efConstruct) : 100,
    ef: Number(ef) > 0 ? Number(ef) : 64,
  };
  const size = Number(vectorSize) > 0 ? Number(vectorSize) : 768;
  const threshold = Number(indexingThreshold) > 0 ? Number(indexingThreshold) : 10000;

  try {
    await qdrantClient.getCollection(collectionName);
    // La colección ya existe: ajustar HNSW solo si es necesario
    try {
      await qdrantClient.updateCollection(collectionName, {
        hnsw_config: hnswConfig,
      });
    } catch (error: any) {
      logger.warn(`[RAG] No se pudo actualizar HNSW de ${collectionName}: ${error?.message || error}`);
    }
  } catch {
    try {
      await qdrantClient.createCollection(collectionName, {
        vectors: {
          size,
          distance: 'Cosine',
          on_disk: onDisk !== false,
        },
        hnsw_config: hnswConfig,
        optimizers_config: {
          indexing_threshold: threshold,
        },
      });
      logger.info(`[RAG] Colección Qdrant creada: ${collectionName} (size=${size}, m=${hnswConfig.m}, ef=${hnswConfig.ef})`);
    } catch (error: any) {
      logger.warn(`[RAG] No se pudo crear/configurar colección ${collectionName}: ${error?.message || error}`);
    }
  }

  collectionConfigCache.add(collectionName);
}

async function ensurePayloadIndexes(collectionName: string, projectId?: string) {
  const cacheKey = `${collectionName}:${projectId || 'global'}`;
  if (payloadIndexCache.has(cacheKey)) return;

  const indexConfig = await configService.get('rag.qdrant_payload_indexes');
  if (!Array.isArray(indexConfig) || indexConfig.length === 0) {
    payloadIndexCache.add(cacheKey);
    return;
  }

  for (const item of indexConfig) {
    const field = item?.field;
    const type = item?.type;
    if (!field || !type) continue;

    try {
      await qdrantClient.createPayloadIndex(collectionName, {
        field_name: field,
        field_schema: type,
      });
    } catch (error: any) {
      if (error?.message?.includes('already exists')) continue;
      logger.warn(`[RAG] Payload index error (${field}): ${error?.message || error}`);
    }
  }

  payloadIndexCache.add(cacheKey);
}

async function extractWithFileModel(options: {
  filePath: string;
  fileType: string;
  sourceName: string;
  projectId?: string;
}) {
  const extractor = await createFileExtractor(options.projectId);
  if (!extractor) {
    return null;
  }

  const extractConfig = normalizePdfExtractConfig(await resolvePdfExtractConfig());
  const maxChars = 80000;
  const maxBase64Chars = 200000;
  let rawText = '';
  let pages: string[] = [];
  let base64Payload: string | null = null;
  const isPdf = options.fileType === 'application/pdf';
  const isCsv = options.fileType === 'text/csv' || options.fileType === 'application/csv' || options.sourceName.endsWith('.csv');
  const isText = options.fileType === 'text/plain';
  const isImage = options.fileType.startsWith('image/');

  if (isPdf) {
    const buffer = fs.readFileSync(options.filePath);
    const base64 = buffer.toString('base64');
    base64Payload = base64;
  } else if (isText || isCsv) {
    rawText = fs.readFileSync(options.filePath, 'utf-8');
  } else if (isImage) {
    const buffer = fs.readFileSync(options.filePath);
    const base64 = buffer.toString('base64');
    base64Payload = base64;
  } else {
    try {
      rawText = fs.readFileSync(options.filePath, 'utf-8');
    } catch {
      const buffer = fs.readFileSync(options.filePath);
      const base64 = buffer.toString('base64');
      base64Payload = base64;
    }
  }

  if (!rawText.trim() && !base64Payload) {
    return { text: '', pages };
  }

  const trimmed = rawText.length > maxChars ? rawText.slice(0, maxChars) : rawText;
  const base64Limit = extractConfig.maxBase64Chars === 0
    ? 0
    : (extractConfig.maxBase64Chars > 0 ? extractConfig.maxBase64Chars : maxBase64Chars);
  const base64PayloadFinal = base64Payload
    ? (base64Limit === 0 ? base64Payload : (base64Payload.length > base64Limit ? base64Payload.slice(0, base64Limit) : base64Payload))
    : base64Payload;
  const base64Section = base64PayloadFinal
    ? `\n\nFILE_BASE64 (puede estar truncado):\ndata:${options.fileType};base64,${base64PayloadFinal}`
    : '';
  const prompt = `Extrae el contenido del archivo y devuelvelo SOLO en Markdown.\n\nReglas estrictas:\n- No inventes, no completes, no infieras texto.\n- Respeta el orden original.\n- Usa encabezados, listas y tablas solo si existen en el documento.\n- Si el contenido es una tabla CSV, conviertelo a tabla Markdown fiel.\n- Si no puedes leer el contenido con certeza, responde exactamente: NO_TEXT_FOUND\n- Devuelve UNICAMENTE el Markdown o NO_TEXT_FOUND.\n\nArchivo: ${options.sourceName}\nTipo: ${options.fileType}\nContenido (puede estar truncado):\n${trimmed}${base64Section}`;

  try {
    const response = await extractor.invoke([new HumanMessage(prompt)], { timeout: 90000 });
    const content = Array.isArray((response as any)?.content)
      ? (response as any).content.map((c: any) => c?.text || '').join('')
      : (response as any)?.content || '';

    const normalized = String(content || '').trim();
    if (normalized.toUpperCase() === 'NO_TEXT_FOUND') {
      return { text: '', pages };
    }
    if (!normalized && rawText.trim()) {
      return { text: rawText, pages };
    }

    return { text: normalized, pages };
  } catch (error: any) {
    logger.warn(`[RAG] File extractor failed: ${error?.message || error}`);
    return null;
  }
}

async function convertPdfToImages(options: { filePath: string; maxPages?: number; scale?: number }) {
  const maxPages = Math.min(Math.max(options.maxPages ?? 6, 1), 10);
  const scale = Math.min(Math.max(options.scale ?? 4, 2), 8);
  const document = await pdfToImg(options.filePath, { scale });
  const images: string[] = [];
  let pageIndex = 0;

  for await (const image of document) {
    pageIndex += 1;
    const buffer = Buffer.isBuffer(image) ? image : Buffer.from(image as any);
    const base64 = buffer.toString('base64');
    images.push(`data:image/png;base64,${base64}`);
    if (pageIndex >= maxPages) break;
  }

  return { images, pages: images.length };
}

export const ragService = {
  async convertPdfToImages(options: { filePath: string; maxPages?: number; projectId?: string }) {
    let scale = 4;
    if (options.projectId) {
      const quality = (await configService.get('devadmin.pdf_preview_quality')) || 'medium';
      scale = quality === 'high' ? 6 : quality === 'low' ? 3 : 4;
    }
    return convertPdfToImages({ filePath: options.filePath, maxPages: options.maxPages, scale });
  },
  async getProjectCollectionName(projectId: string) {
    if (!ObjectId.isValid(projectId)) {
      throw new Error('ProjectId inválido');
    }
    const configCollection = await resolveEmbeddingCollectionName(projectId);
    if (configCollection) {
      return configCollection;
    }
    const projectObjectId = new ObjectId(projectId);
    const latestSource = await getKnowledgeSourcesCollection()
      .find({ projectId: projectObjectId })
      .sort({ createdAt: -1 })
      .limit(1)
      .toArray();

    const existingCollection = latestSource[0]?.collectionName;
    return existingCollection || `knowledge_base_${projectId}`;
  },
  /**
   * Procesa un archivo subido (PDF, TXT, CSV) y lo indexa en Qdrant.
   * También registra la fuente en MongoDB.
   */
  async processFile(filePath: string, fileType: string, meta: { 
    collectionName: string; 
    source: string; 
    fileType: string;
    projectId?: string;
    sourceId?: string;
    category?: string;
    tags?: string[];
    author?: string;
    accessLevel?: string;
    createdAt?: Date | string;
  }) {
    let text = '';
    let pages: string[] = [];
    let type: KnowledgeSource['type'] = 'TXT';
    let extractionMethod: KnowledgeSource['extractionMethod'] | undefined;
    let extractionTimeMs: number | undefined;
    let extractionConfidence: number | undefined;
    let ocrProvider: string | undefined;
    let ocrModel: string | undefined;
    let pagesProcessed: number | undefined;

    if (fileType === 'application/pdf') {
      if (meta.sourceId) {
        await appendSourceLog(meta.sourceId, { level: 'info', stage: 'extracting', message: 'Extrayendo PDF con pipeline OCR' });
      }
      const buffer = fs.readFileSync(filePath);
      const ocr = await ocrService.extractPdf(buffer, {
        sourceName: meta.source,
        projectId: meta.projectId,
        sourceId: meta.sourceId,
      });
      text = ocr.text;
      pages = ocr.pages;
      extractionMethod = ocr.method;
      extractionTimeMs = ocr.extractionTimeMs;
      extractionConfidence = ocr.confidence;
      ocrProvider = ocr.provider;
      ocrModel = ocr.model;
      pagesProcessed = ocr.pagesProcessed;
      logger.info(`[RAG] PDF text extracted via OCR (${ocr.method}/${ocr.provider || 'n/a'}): ${text.length} chars, ${pages.length} pages`);
      type = 'PDF';
    } else if (fileType === 'text/plain') {
      text = fs.readFileSync(filePath, 'utf-8');
      extractionMethod = 'raw';
      type = 'TXT';
    } else if (fileType === 'text/csv' || fileType === 'application/csv' || meta.source.endsWith('.csv')) {
      const startedAt = Date.now();
      const llmExtracted = await extractWithFileModel({
        filePath,
        fileType: 'text/csv',
        sourceName: meta.source,
        projectId: meta.projectId,
      });
      extractionTimeMs = Date.now() - startedAt;
      if (llmExtracted?.text) {
        text = llmExtracted.text;
        extractionMethod = 'llm_file';
      } else {
        text = fs.readFileSync(filePath, 'utf-8');
        extractionMethod = 'csv';
      }
      type = 'CSV';
    } else if (fileType.startsWith('image/')) {
      const buffer = fs.readFileSync(filePath);
      const ocr = await ocrService.extractImage(buffer, fileType, {
        sourceName: meta.source,
        projectId: meta.projectId,
        sourceId: meta.sourceId,
      });
      text = ocr.text;
      pages = ocr.pages;
      extractionMethod = ocr.method;
      extractionTimeMs = ocr.extractionTimeMs;
      extractionConfidence = ocr.confidence;
      ocrProvider = ocr.provider;
      ocrModel = ocr.model;
      pagesProcessed = ocr.pagesProcessed;
      type = 'IMAGE';
    } else {
      throw new Error('Tipo de archivo no soportado. Solo se aceptan PDF, TXT, CSV o imagenes.');
    }

    // Registrar fuente en MongoDB como "Processing"
    const fileStats = fs.statSync(filePath);
    const sizeInMB = (fileStats.size / (1024 * 1024)).toFixed(2);

    const sourceCreatedAt = meta.createdAt ? new Date(meta.createdAt) : undefined;
    const sourceId = meta.sourceId && ObjectId.isValid(meta.sourceId) ? meta.sourceId : null;

    if (sourceId) {
      await getKnowledgeSourcesCollection().updateOne(
        { _id: new ObjectId(sourceId) },
        {
          $set: {
            name: meta.source,
            type,
            size: `${sizeInMB} MB`,
            sizeBytes: fileStats.size,
            status: 'Processing',
            stage: 'extracting',
            progress: 5,
            filePath,
            category: meta.category,
            tags: meta.tags,
            author: meta.author,
            accessLevel: meta.accessLevel,
            sourceCreatedAt,
            collectionName: meta.collectionName || 'knowledge_base',
            startedAt: new Date(),
            updatedAt: new Date(),
          }
        }
      );
      await appendSourceLog(sourceId, { level: 'info', stage: 'extracting', message: 'Inicio de extraccion' });
    }

    let insertResult: { insertedId: ObjectId } | null = null;
    if (!sourceId) {
      const source: KnowledgeSource = {
        name: meta.source,
        type,
        size: `${sizeInMB} MB`,
        sizeBytes: fileStats.size,
        status: 'Processing',
        stage: 'extracting',
        progress: 5,
        filePath,
        category: meta.category,
        tags: meta.tags,
        author: meta.author,
        accessLevel: meta.accessLevel,
        sourceCreatedAt,
        projectId: meta.projectId && ObjectId.isValid(meta.projectId) ? new ObjectId(meta.projectId) : undefined,
        collectionName: meta.collectionName || 'knowledge_base',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      insertResult = await getKnowledgeSourcesCollection().insertOne(source);
    }

    const effectiveSourceId = sourceId || insertResult?.insertedId.toString();
    if (!effectiveSourceId) {
      throw new Error('No se pudo determinar sourceId');
    }
    await updateSourceProgress(effectiveSourceId, { status: 'Processing', stage: 'extracting', progress: 15, startedAt: new Date() });
    await appendSourceLog(effectiveSourceId, { level: 'info', stage: 'extracting', message: 'Extraccion completada' });

    if (text?.length) {
      const extractConfig = normalizePdfExtractConfig(await resolvePdfExtractConfig());
      const trimmedMarkdown = applyReturnLimit(text, extractConfig.returnLimitChars);
      await getKnowledgeSourcesCollection().updateOne(
        { _id: new ObjectId(effectiveSourceId) },
        {
          $set: {
            extractedMarkdown: trimmedMarkdown,
            extractionMethod: extractionMethod || 'llm_file',
            extractionTimeMs,
            extractionConfidence,
            ocrProvider,
            ocrModel,
            pagesProcessed,
            extractedAt: new Date(),
            updatedAt: new Date(),
          },
        }
      );
    } else {
      await appendSourceLog(effectiveSourceId, { level: 'warn', stage: 'extracting', message: 'No se pudo extraer texto' });
    }

    try {
      await updateSourceProgress(effectiveSourceId, { stage: 'chunking', progress: 30 });
      const result = await this.processText(text, {
        ...meta,
        sourceId: effectiveSourceId,
        pages,
        createdAt: sourceCreatedAt || new Date(),
      });
      
      // Actualizar a "Indexed" con el conteo de vectores
      await getKnowledgeSourcesCollection().updateOne(
        { _id: new ObjectId(effectiveSourceId) },
        { 
          $set: { 
            status: 'Indexed' as const, 
            stage: 'finalizing',
            progress: 100,
            vectorCount: result.chunks,
            lastSyncedAt: new Date(),
            finishedAt: new Date(),
            updatedAt: new Date(),
          } 
        }
      );
      await appendSourceLog(effectiveSourceId, { level: 'info', stage: 'finalizing', message: `Indexado completo (${result.chunks} chunks)` });

      return { ...result, sourceId: new ObjectId(effectiveSourceId) };
    } catch (error: any) {
      await appendSourceLog(effectiveSourceId, { level: 'error', stage: 'finalizing', message: error.message || 'Error al procesar' });
      await rollbackSourceOnFailure({
        sourceId: effectiveSourceId,
        collectionName: meta.collectionName || 'knowledge_base',
        sourceName: meta.source,
      });
      throw error;
    }
  },

  async extractTextOnly(options: { filePath: string; fileType: string; sourceName: string; projectId?: string }) {
    const isPdf = options.fileType === 'application/pdf';
    const isCsv = options.fileType === 'text/csv' || options.fileType === 'application/csv' || options.sourceName.endsWith('.csv');
    const isText = options.fileType === 'text/plain';
    const isImage = options.fileType.startsWith('image/');

    if (isPdf) {
      const buffer = fs.readFileSync(options.filePath);
      const ocr = await ocrService.extractPdf(buffer, {
        sourceName: options.sourceName,
        projectId: options.projectId,
      });
      const extractConfig = normalizePdfExtractConfig(await resolvePdfExtractConfig());
      return {
        text: applyReturnLimit(ocr.text, extractConfig.returnLimitChars),
        pages: ocr.pages,
        method: ocr.method,
        provider: ocr.provider,
        model: ocr.model,
        confidence: ocr.confidence,
        extractionTimeMs: ocr.extractionTimeMs,
      };
    }

    if (isCsv) {
      const llmExtracted = await extractWithFileModel({
        filePath: options.filePath,
        fileType: 'text/csv',
        sourceName: options.sourceName,
        projectId: options.projectId,
      });
      if (llmExtracted?.text) {
        const extractConfig = await resolvePdfExtractConfig();
        return { text: applyReturnLimit(llmExtracted.text, extractConfig.returnLimitChars), pages: llmExtracted.pages, method: 'llm_file' };
      }
      const rawText = fs.readFileSync(options.filePath, 'utf-8');
      const extractConfig = normalizePdfExtractConfig(await resolvePdfExtractConfig());
      return { text: applyReturnLimit(rawText, extractConfig.returnLimitChars), pages: [], method: 'csv' };
    }

    if (isText) {
      const rawText = fs.readFileSync(options.filePath, 'utf-8');
      const extractConfig = normalizePdfExtractConfig(await resolvePdfExtractConfig());
      return { text: applyReturnLimit(rawText, extractConfig.returnLimitChars), pages: [], method: 'raw' };
    }

    if (isImage) {
      const buffer = fs.readFileSync(options.filePath);
      const ocr = await ocrService.extractImage(buffer, options.fileType, {
        sourceName: options.sourceName,
        projectId: options.projectId,
      });
      const extractConfig = normalizePdfExtractConfig(await resolvePdfExtractConfig());
      return {
        text: applyReturnLimit(ocr.text, extractConfig.returnLimitChars),
        pages: ocr.pages,
        method: ocr.method,
        provider: ocr.provider,
        model: ocr.model,
        confidence: ocr.confidence,
        extractionTimeMs: ocr.extractionTimeMs,
      };
    }

    return { text: '', pages: [], method: 'ocr_vision' };
  },

  /**
   * Procesa texto escrito manualmente (opción de escribir TXT y subirlo).
   */
  async processWrittenText(data: { title: string; content: string; collectionName?: string; projectId?: string }) {
    const source: KnowledgeSource = {
      name: data.title,
      type: 'TXT',
      size: `${(Buffer.byteLength(data.content, 'utf-8') / 1024).toFixed(1)} KB`,
      sizeBytes: Buffer.byteLength(data.content, 'utf-8'),
      status: 'Processing',
      stage: 'extracting',
      progress: 5,
      content: data.content,
      projectId: data.projectId && ObjectId.isValid(data.projectId) ? new ObjectId(data.projectId) : undefined,
      collectionName: data.collectionName || 'knowledge_base',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const insertResult = await getKnowledgeSourcesCollection().insertOne(source);
    const sourceId = insertResult.insertedId.toString();
    await appendSourceLog(sourceId, { level: 'info', stage: 'extracting', message: 'Inicio de ingesta manual' });
    await updateSourceProgress(sourceId, { status: 'Processing', stage: 'extracting', progress: 15, startedAt: new Date() });

    try {
      await updateSourceProgress(sourceId, { stage: 'chunking', progress: 30 });
      const result = await this.processText(data.content, { 
        collectionName: data.collectionName || 'knowledge_base',
        source: data.title,
        projectId: data.projectId,
        sourceId,
        createdAt: source.createdAt,
      });

      await getKnowledgeSourcesCollection().updateOne(
        { _id: insertResult.insertedId },
        { 
          $set: { 
            status: 'Indexed' as const, 
            stage: 'finalizing',
            progress: 100,
            vectorCount: result.chunks,
            lastSyncedAt: new Date(),
            finishedAt: new Date(),
            updatedAt: new Date(),
          } 
        }
      );
      await appendSourceLog(sourceId, { level: 'info', stage: 'finalizing', message: `Indexado completo (${result.chunks} chunks)` });

      return { ...result, sourceId: insertResult.insertedId };
    } catch (error: any) {
      await appendSourceLog(sourceId, { level: 'error', stage: 'finalizing', message: error.message || 'Error al procesar' });
      await rollbackSourceOnFailure({
        sourceId,
        collectionName: source.collectionName,
        sourceName: source.name,
      });
      throw error;
    }
  },

  async processText(text: string, meta: any) {
    if (meta?.sourceId) {
      await updateSourceProgress(meta.sourceId, { stage: 'chunking', progress: 35 });
      await appendSourceLog(meta.sourceId, { level: 'info', stage: 'chunking', message: 'Fragmentando texto' });
    }
    const cleanedText = text
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]{2,}/g, ' ')
      .trim();

    if (!cleanedText) {
      logger.warn(`[RAG] Empty extracted text for source: ${meta?.source || 'unknown'}`);
      throw new Error('El contenido del archivo está vacío o no se pudo extraer texto.');
    }

    const semanticChunks = createSemanticChunks(cleanedText, {
      title: meta?.source,
      pages: Array.isArray(meta?.pages) ? meta.pages : undefined,
      chunkSize: 800,
      overlap: 100,
      extraMetadata: {
        source_id: meta?.sourceId,
        sourceId: meta?.sourceId,
        sourceName: meta?.source,
        source: meta?.source,
        project_id: meta?.projectId,
        category: meta?.category,
        tags: meta?.tags,
        author: meta?.author,
        access_level: meta?.accessLevel,
      },
    });

    if (meta?.sourceId) {
      await updateSourceProgress(meta.sourceId, { stage: 'embedding', progress: 60 });
      await appendSourceLog(meta.sourceId, { level: 'info', stage: 'embedding', message: `Embeddings para ${semanticChunks.length} chunks` });
    }

    const documentId = meta?.sourceId || meta?.documentId || uuidv4();
    const createdAt = meta?.createdAt ? new Date(meta.createdAt) : undefined;

    const documentsWithIds = semanticChunks.map((chunk) => ({
      pageContent: chunk.content,
      metadata: {
        ...chunk.metadata,
        id: uuidv4(),
        document_id: documentId,
        text: chunk.content,
        source_id: meta?.sourceId,
        sourceId: meta?.sourceId,
        sourceName: meta?.source,
        source: meta?.source,
        project_id: meta?.projectId,
        category: meta?.category,
        tags: meta?.tags,
        author: meta?.author,
        created_at: createdAt ? createdAt.toISOString() : undefined,
        access_level: meta?.accessLevel,
      }
    }));

    const embeddingsInstance = await createEmbeddings(meta?.projectId);

    const collectionName = meta.collectionName || 'knowledge_base';

    await ensureCollectionConfigured(collectionName);

    await QdrantVectorStore.fromDocuments(
      documentsWithIds,
      embeddingsInstance,
      {
        client: qdrantClient,
        collectionName,
      }
    );

    await ensurePayloadIndexes(collectionName, meta?.projectId);

    if (meta?.sourceId) {
      await updateSourceProgress(meta.sourceId, { stage: 'indexing', progress: 85 });
      await appendSourceLog(meta.sourceId, { level: 'info', stage: 'indexing', message: 'Subiendo vectores a Qdrant' });
    }

    return { chunks: documentsWithIds.length };
  },

  async search(query: string, collectionName: string = 'knowledge_base', limit: number = 3, projectId?: string) {
    try {
      const embeddingsInstance = await createEmbeddings(projectId);
      const vectorStore = await QdrantVectorStore.fromExistingCollection(
        embeddingsInstance,
        {
          client: qdrantClient,
          collectionName,
        }
      );

      const rerankerEnabled = (await configService.get('rag.use_reranker')) !== false;
      const configuredTopK = Number(await configService.get('rag.reranker_top_k')) || 10;
      const retrieveK = rerankerEnabled ? Math.max(configuredTopK, limit) : limit;

      // Add a 5 second timeout to prevent RAG from hanging the chat for too long
      const searchPromise = vectorStore.similaritySearch(query, retrieveK);
      const timeoutPromise = new Promise<any[]>((_, reject) => 
        setTimeout(() => reject(new Error('RAG search timeout')), 5000)
      );

      const results = await Promise.race([searchPromise, timeoutPromise]);

      if (!rerankerEnabled) {
        return results.slice(0, limit);
      }

      return await rerankerService.rerank(query, results, { finalK: limit, projectId });
    } catch (e: any) {
      logger.warn(`[RAG] Search error or timeout: ${e.message}`);
      return []; // Devuelve vacío para no bloquear el chat
    }
  },

  /**
   * Revierte los vectores parciales de una fuente sin borrar el registro Mongo
   * (usado por el reindexado en background).
   */
  async rollbackSource(options: { sourceId: string; collectionName?: string; sourceName?: string }) {
    await purgeSourceVectors(options);
  },

  /**
   * Eliminar una fuente de conocimiento (MongoDB + Qdrant).
   */
  async deleteSource(id: string) {
    const { ObjectId } = await import('mongodb');
    if (!ObjectId.isValid(id)) throw new Error('Invalid ID');

    const source = await getKnowledgeSourcesCollection().findOne({ _id: new ObjectId(id) });
    if (!source) return false;

    const collectionName = source.collectionName
      || (source.projectId ? await resolveEmbeddingCollectionName(source.projectId.toString()) : undefined);
    if (!collectionName) {
      throw new Error('No se pudo resolver la coleccion de Qdrant para eliminar');
    }

    try {
      await qdrantClient.delete(collectionName, {
        filter: {
          should: [
            {
              key: 'sourceId',
              match: { value: id },
            },
            {
              key: 'source_id',
              match: { value: id },
            },
            {
              key: 'document_id',
              match: { value: id },
            },
            {
              key: 'sourceName',
              match: { value: source.name },
            },
            {
              key: 'source',
              match: { value: source.name },
            },
          ],
        },
        wait: true,
      });
      logger.info(`[RAG] Qdrant delete success: sourceId=${id}, collection=${collectionName}`);
    } catch (e: any) {
      logger.error(`[RAG] Error deleting vectors from Qdrant: ${e?.message || e}`);
      throw new Error('No se pudo eliminar el documento de Qdrant');
    }

    const result = await getKnowledgeSourcesCollection().deleteOne({ _id: new ObjectId(id) });
    return result.deletedCount === 1;
  },
};
