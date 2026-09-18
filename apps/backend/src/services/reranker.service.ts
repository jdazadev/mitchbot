import { OllamaEmbeddings } from '@langchain/ollama';
import env from '../config/env';
import { configService } from './config.service';
import { logger } from '../utils/logger';

/**
 * Re-ranking de resultados RAG.
 *
 * Estrategia:
 * 1. Si el re-ranker está deshabilitado (`rag.use_reranker = false`) o hay pocos
 *    documentos, se devuelven tal cual (similarity-only).
 * 2. Se intenta un re-ranking local con embeddings de Ollama (bi-encoder, modelo
 *    configurable). Es rápido y no requiere servicios externos.
 * 3. Si el modelo local no está disponible, se usa una heurística de solapamiento
 *    de términos (keyword/bigramas).
 * 4. Ante cualquier error, degrada a similarity-only (no bloquea el chat).
 */

export interface RankableDocument {
  pageContent?: string;
  metadata?: Record<string, any>;
  [key: string]: any;
}

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'are', 'was', 'were', 'have', 'has',
  'you', 'your', 'our', 'their', 'what', 'when', 'where', 'which', 'how', 'why', 'not',
  'los', 'las', 'del', 'que', 'por', 'con', 'para', 'una', 'uno', 'unos', 'unas', 'como',
  'pero', 'sus', 'este', 'esta', 'esto', 'estos', 'estas', 'son', 'fue', 'ser', 'hay',
]);

function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-záéíóúñü0-9]+/gi) || [])
    .map(t => t.trim())
    .filter(t => t.length > 2 && !STOP_WORDS.has(t));
}

function bigrams(tokens: string[]): Set<string> {
  const result = new Set<string>();
  for (let i = 0; i < tokens.length - 1; i += 1) {
    result.add(`${tokens[i]} ${tokens[i + 1]}`);
  }
  return result;
}

function keywordScore(query: string, document: string): number {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return 0;

  const documentTokens = tokenize(document);
  const documentSet = new Set(documentTokens);

  // Coincidencia exacta o por prefijo (pago ≈ pagos, corte ≈ cortes)
  const matchesToken = (token: string): boolean => {
    if (documentSet.has(token)) return true;
    if (token.length < 4) return false;
    for (const documentToken of documentSet) {
      if (documentToken.length >= 4 && (documentToken.startsWith(token) || token.startsWith(documentToken))) {
        return true;
      }
    }
    return false;
  };

  let unigramHits = 0;
  for (const token of queryTokens) {
    if (matchesToken(token)) unigramHits += 1;
  }
  const unigram = unigramHits / queryTokens.length;

  const queryBigrams = bigrams(queryTokens);
  const documentBigrams = bigrams(documentTokens);
  let bigramHits = 0;
  for (const bigram of queryBigrams) {
    if (documentBigrams.has(bigram)) bigramHits += 1;
  }
  const bigram = queryBigrams.size > 0 ? bigramHits / queryBigrams.size : 0;

  return 0.65 * unigram + 0.35 * bigram;
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (!a?.length || !b?.length || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  if (!ms || ms <= 0) return promise;
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('reranker timeout')), ms)),
  ]);
}

const RERANK_TIMEOUT_MS = 2500;
const modelAvailability = new Map<string, { available: boolean; checkedAt: number }>();

/** Comprueba (con caché) si un modelo existe en Ollama para no esperar timeouts */
async function isOllamaModelAvailable(model: string): Promise<boolean> {
  const cached = modelAvailability.get(model);
  if (cached && Date.now() - cached.checkedAt < 60_000) return cached.available;

  try {
    const res = await withTimeout(fetch(`${env.OLLAMA_URL}/api/tags`), 1500);
    if (!res.ok) throw new Error(`status ${res.status}`);
    const data = await res.json() as { models?: any[] };
    const names = (data.models || []).map(m => m.name || m.model || '');
    const available = names.some(n => n === model || n.startsWith(`${model}:`) || n.startsWith(model));
    modelAvailability.set(model, { available, checkedAt: Date.now() });
    return available;
  } catch {
    modelAvailability.set(model, { available: false, checkedAt: Date.now() });
    return false;
  }
}

/** Re-ranking local usando embeddings de Ollama */
async function embeddingRerank(
  query: string,
  documents: RankableDocument[],
  model: string,
): Promise<RankableDocument[]> {
  const embeddings = new OllamaEmbeddings({ model, baseUrl: env.OLLAMA_URL });
  const inputs = [query, ...documents.map(d => d.pageContent || '')];
  const [queryVector, ...documentVectors] = await withTimeout(embeddings.embedDocuments(inputs), RERANK_TIMEOUT_MS);

  return documents
    .map((document, index) => ({
      document,
      score: cosineSimilarity(queryVector, documentVectors[index] || []),
    }))
    .sort((a, b) => b.score - a.score)
    .map(entry => entry.document);
}

/** Re-ranking heurístico (keyword + bigramas) */
function heuristicRerank(query: string, documents: RankableDocument[]): RankableDocument[] {
  return documents
    .map(document => ({
      document,
      score: keywordScore(query, document.pageContent || ''),
    }))
    .sort((a, b) => b.score - a.score)
    .map(entry => entry.document);
}

export const rerankerService = {
  async rerank(
    query: string,
    documents: RankableDocument[],
    options: { finalK?: number; projectId?: string } = {},
  ): Promise<RankableDocument[]> {
    const finalK = options.finalK && options.finalK > 0
      ? options.finalK
      : Number(await configService.get('rag.reranker_final_k')) || 3;

    if (!documents.length) return [];

    const enabled = await configService.get('rag.use_reranker');
    if (enabled === false || documents.length <= finalK) {
      return documents.slice(0, finalK);
    }

    try {
      const provider = await configService.get('rag.reranker_provider');
      const model = await configService.get('rag.reranker_model');

      if (provider === 'ollama' && model && await isOllamaModelAvailable(model)) {
        const reranked = await embeddingRerank(query, documents, model);
        logger.info(`[Reranker] ${documents.length} docs re-rankeados con embeddings (${model})`);
        return reranked.slice(0, finalK);
      }

      const reranked = heuristicRerank(query, documents);
      logger.info(`[Reranker] ${documents.length} docs re-rankeados con heurística`);
      return reranked.slice(0, finalK);
    } catch (error: any) {
      logger.warn(`[Reranker] Fallback a similarity-only: ${error?.message || error}`);
      try {
        return heuristicRerank(query, documents).slice(0, finalK);
      } catch {
        return documents.slice(0, finalK);
      }
    }
  },
};
