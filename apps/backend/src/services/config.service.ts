import { getConfigCollection } from '../models/config.model';

// Valores por defecto si no existen en la BD
const DEFAULTS: Record<string, any> = {
  channels: { whatsapp: true, instagram: false, web: true },
  messages: { welcome: '¡Hola! ¿En qué puedo ayudarte?', goodbye: '¡Gracias por tu consulta! Hasta pronto.' },
  personality: {},
  options: { autoCreateContact: true },
  'devadmin.pdf_preview_quality': 'medium',
  // Negocio (usado por las herramientas del agente)
  'business.hours': {
    monday: '09:00-18:00',
    tuesday: '09:00-18:00',
    wednesday: '09:00-18:00',
    thursday: '09:00-18:00',
    friday: '09:00-18:00',
    saturday: '10:00-14:00',
    sunday: 'closed',
  },
  'business.services': ['Consulta general'],
  'business.timezone': 'America/Mexico_City',
  'business.slot_minutes': 30,
  'business.currency': 'USD',
  'rag.pdf_extract_scale': 4,
  'rag.pdf_extract_max_pages': 0,
  'rag.pdf_extract_page_batch_size': 2,
  'rag.pdf_extract_timeout_ms': 90000,
  'rag.pdf_extract_max_base64_chars': 0,
  'rag.pdf_extract_return_limit_chars': 0,
  // Pipeline OCR unificado (todos los PDFs)
  'rag.ocr_provider': 'ollama',
  'rag.ocr_ollama_model': 'qwen2.5-vl',
  'rag.ocr_mistral_model': 'mistral-ocr-latest',
  'rag.ocr_openrouter_model': 'google/gemini-2.0-flash-001',
  'rag.ocr_scale': 2,
  'rag.ocr_max_pages': 0,
  'rag.ocr_batch_size': 4,
  'rag.ocr_timeout_ms': 60000,
  // Re-ranking de resultados RAG
  'rag.use_reranker': true,
  'rag.reranker_provider': 'ollama',
  'rag.reranker_model': 'nomic-embed-text',
  'rag.reranker_top_k': 10,
  'rag.reranker_final_k': 3,
  // Configuración de colección Qdrant (HNSW / optimizers)
  'rag.qdrant_hnsw_m': 16,
  'rag.qdrant_ef_construct': 100,
  'rag.qdrant_ef': 64,
  'rag.qdrant_on_disk': true,
  'rag.qdrant_vector_size': 768,
  'rag.qdrant_indexing_threshold': 10000,
  'rag.qdrant_payload_indexes': [
    { field: 'category', type: 'keyword' },
    { field: 'tags', type: 'keyword' },
    { field: 'access_level', type: 'keyword' },
    { field: 'created_at', type: 'datetime' },
    { field: 'language', type: 'keyword' },
    { field: 'document_id', type: 'keyword' },
  ],
};

export const configService = {
  /** Obtiene una configuración por clave. Devuelve el default si no existe. */
  async get(key: string) {
    const configColl = getConfigCollection();
    const config = await configColl.findOne({ key });
    return config?.value ?? DEFAULTS[key] ?? null;
  },

  /** Obtiene todas las configuraciones. */
  async getAll() {
    const configColl = getConfigCollection();
    const configs = await configColl.find().toArray();

    // Merge con defaults
    const result: Record<string, any> = { ...DEFAULTS };
    for (const config of configs) {
      result[config.key] = config.value;
    }
    return result;
  },

  /** Actualiza una configuración (upsert). */
  async set(key: string, value: any) {
    const configColl = getConfigCollection();
    await configColl.updateOne(
      { key },
      { $set: { key, value, updatedAt: new Date() } },
      { upsert: true }
    );
    return { key, value };
  },

  /** Actualiza múltiples configuraciones a la vez. */
  async setAll(configs: Record<string, any>) {
    const results: Record<string, any> = {};
    for (const [key, value] of Object.entries(configs)) {
      await this.set(key, value);
      results[key] = value;
    }
    return results;
  },
};
