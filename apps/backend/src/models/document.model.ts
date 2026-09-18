import { ObjectId } from 'mongodb';
import { getDatabase } from '../config/database';

export interface KnowledgeSource {
  _id?: ObjectId;
  projectId?: ObjectId;
  name: string; // Nombre del archivo o título
  type: 'PDF' | 'TXT' | 'CSV' | 'IMAGE' | 'URL'; // Solo tipos permitidos
  size: string; // "2.4 MB" o "12 pages" 
  sizeBytes?: number;
  status: 'Queued' | 'Processing' | 'Indexed' | 'Failed';
  stage?: 'queued' | 'extracting' | 'chunking' | 'embedding' | 'indexing' | 'reindexing' | 'finalizing';
  progress?: number; // 0-100
  filePath?: string; // Ruta del archivo en el servidor
  url?: string; // Para tipo URL
  vectorCount?: number; // Número de vectores generados
  collectionName: string; // Colección Qdrant asociada
  content?: string; // Para tipo TXT escrito manualmente
  extractedMarkdown?: string;
  extractionMethod?: 'llm_file' | 'manual' | 'parser' | 'csv' | 'raw' | 'llm_vision' | 'ocr' | 'ocr_vision' | 'pdf-parse';
  extractionTimeMs?: number;
  extractionConfidence?: number;
  ocrProvider?: string;
  ocrModel?: string;
  pagesProcessed?: number;
  extractedAt?: Date;
  category?: string;
  tags?: string[];
  author?: string;
  accessLevel?: string;
  sourceCreatedAt?: Date;
  logs?: Array<{
    timestamp: Date;
    level: 'info' | 'warn' | 'error';
    stage?: string;
    message: string;
  }>;
  lastSyncedAt?: Date;
  startedAt?: Date;
  finishedAt?: Date;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

export const getKnowledgeSourcesCollection = () => {
  return getDatabase().collection<KnowledgeSource>('knowledge_sources');
};
