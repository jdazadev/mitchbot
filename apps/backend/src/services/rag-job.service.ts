import { ObjectId } from 'mongodb';
import { getKnowledgeSourcesCollection } from '../models/document.model';
import { logger } from '../utils/logger';

export async function appendSourceLog(
  sourceId: string,
  entry: { level: 'info' | 'warn' | 'error'; stage?: string; message: string }
) {
  try {
    await getKnowledgeSourcesCollection().updateOne(
      { _id: new ObjectId(sourceId) },
      {
        $push: {
          logs: {
            timestamp: new Date(),
            level: entry.level,
            stage: entry.stage,
            message: entry.message,
          },
        },
        $set: { updatedAt: new Date() },
      }
    );
  } catch (error: any) {
    logger.warn(`[RAG] Could not append log: ${error?.message || error}`);
  }
}

export async function updateSourceProgress(
  sourceId: string,
  data: {
    status?: 'Queued' | 'Processing' | 'Indexed' | 'Failed';
    stage?: 'queued' | 'extracting' | 'chunking' | 'embedding' | 'indexing' | 'reindexing' | 'finalizing';
    progress?: number;
    startedAt?: Date;
    finishedAt?: Date;
    errorMessage?: string;
  }
) {
  try {
    await getKnowledgeSourcesCollection().updateOne(
      { _id: new ObjectId(sourceId) },
      {
        $set: {
          ...data,
          updatedAt: new Date(),
        },
      }
    );
  } catch (error: any) {
    logger.warn(`[RAG] Could not update progress: ${error?.message || error}`);
  }
}
