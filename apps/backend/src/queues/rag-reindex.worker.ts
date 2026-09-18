import { Job, Worker } from 'bullmq';
import bullmqConnection from '../config/redis-bullmq';
import { logger } from '../utils/logger';
import { ragService } from '../services/rag.service';
import { appendSourceLog, updateSourceProgress } from '../services/rag-job.service';
import { RAG_REINDEX_QUEUE_NAME, RagReindexJobData } from './rag-reindex.queue';

/**
 * Worker de reindexado RAG.
 * Reprocesa cada fuente con el chunking nuevo, registra progreso por fuente y
 * revierte los vectores parciales si algo falla.
 */
export function createReindexWorker(options: { concurrency?: number } = {}) {
  const worker = new Worker<RagReindexJobData>(
    RAG_REINDEX_QUEUE_NAME,
    async (job: Job<RagReindexJobData>) => {
      const data = job.data;
      logger.info(`[RAG][Reindex] Worker start: ${data.sourceId}`);

      await updateSourceProgress(data.sourceId, {
        status: 'Processing',
        stage: 'reindexing',
        progress: 10,
        startedAt: new Date(),
      });
      await appendSourceLog(data.sourceId, {
        level: 'info',
        stage: 'reindexing',
        message: 'Reindexado iniciado con el nuevo chunking',
      });
      job.updateProgress(10);

      try {
        let chunks = 0;

        if (data.content) {
          const result = await ragService.processText(data.content, {
            collectionName: data.collectionName,
            source: data.sourceName,
            projectId: data.projectId,
            sourceId: data.sourceId,
            category: data.category,
            tags: data.tags,
            author: data.author,
            accessLevel: data.accessLevel,
            createdAt: data.createdAt,
          });
          chunks = result.chunks;
        } else if (data.filePath && data.fileType) {
          const result = await ragService.processFile(data.filePath, data.fileType, {
            collectionName: data.collectionName,
            source: data.sourceName,
            fileType: data.fileType,
            projectId: data.projectId,
            sourceId: data.sourceId,
            category: data.category,
            tags: data.tags,
            author: data.author,
            accessLevel: data.accessLevel,
            createdAt: data.createdAt,
          });
          chunks = result.chunks;
        } else {
          throw new Error('Fuente sin contenido ni archivo para reindexar');
        }

        job.updateProgress(100);
        await updateSourceProgress(data.sourceId, {
          status: 'Indexed',
          stage: 'finalizing',
          progress: 100,
          finishedAt: new Date(),
        });
        await appendSourceLog(data.sourceId, {
          level: 'info',
          stage: 'finalizing',
          message: `Reindexado completo (${chunks} chunks)`,
        });

        logger.info(`[RAG][Reindex] Worker done: ${data.sourceId}`);
        return { chunks };
      } catch (error: any) {
        await ragService.rollbackSource({
          sourceId: data.sourceId,
          collectionName: data.collectionName,
          sourceName: data.sourceName,
        });
        await updateSourceProgress(data.sourceId, {
          status: 'Failed',
          stage: 'finalizing',
          progress: 100,
          errorMessage: error?.message || 'Error en reindexado',
          finishedAt: new Date(),
        });
        await appendSourceLog(data.sourceId, {
          level: 'error',
          stage: 'finalizing',
          message: `Reindexado falló: ${error?.message || error}`,
        });
        logger.error(`[RAG][Reindex] Worker failed: ${data.sourceId} - ${error?.message || error}`);
        throw error;
      }
    },
    {
      connection: bullmqConnection,
      concurrency: options.concurrency ?? 1,
      lockDuration: 15 * 60 * 1000,
      stalledInterval: 60 * 1000,
      maxStalledCount: 1,
    }
  );

  return worker;
}
