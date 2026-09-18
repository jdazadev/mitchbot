import { Job, Worker } from 'bullmq';
import bullmqConnection from '../config/redis-bullmq';
import { logger } from '../utils/logger';
import { ragService } from '../services/rag.service';
import { appendSourceLog, updateSourceProgress } from '../services/rag-job.service';

export const RAG_UPLOAD_QUEUE_NAME = 'rag-upload';

export const ragUploadWorker = new Worker(
  RAG_UPLOAD_QUEUE_NAME,
  async (job: Job) => {
    const data = job.data as {
      sourceId: string;
      filePath: string;
      fileType: string;
      sourceName: string;
      collectionName: string;
      projectId?: string;
      category?: string;
      tags?: string[];
      author?: string;
      accessLevel?: string;
      createdAt?: string;
    };

    logger.info(`[RAG] Worker start: ${data.sourceId}`);
    await appendSourceLog(data.sourceId, {
      level: 'info',
      stage: 'queued',
      message: 'Job recibido en worker',
    });

    await updateSourceProgress(data.sourceId, {
      status: 'Processing',
      stage: 'extracting',
      progress: 10,
      startedAt: new Date(),
    });
    await appendSourceLog(data.sourceId, {
      level: 'info',
      stage: 'extracting',
      message: 'Procesamiento iniciado',
    });

    job.updateProgress(10);

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

    job.updateProgress(100);

    await appendSourceLog(data.sourceId, {
      level: 'info',
      stage: 'finalizing',
      message: `Worker finalizo con ${result.chunks} chunks`,
    });

    logger.info(`[RAG] Worker done: ${data.sourceId}`);

    return { chunks: result.chunks };
  },
  {
    connection: bullmqConnection,
    lockDuration: 10 * 60 * 1000,
    stalledInterval: 60 * 1000,
    maxStalledCount: 1,
  }
);

ragUploadWorker.on('failed', async (job: Job | undefined, err: Error) => {
  if (!job) return;
  const data = job.data as { sourceId: string };
  logger.error(`[RAG] Worker failed: ${data.sourceId} - ${err?.message}`);
  await appendSourceLog(data.sourceId, {
    level: 'error',
    stage: 'finalizing',
    message: err?.message || 'Error en worker',
  });
  await updateSourceProgress(data.sourceId, {
    status: 'Failed',
    stage: 'finalizing',
    progress: 100,
    errorMessage: err?.message || 'Error en worker',
    finishedAt: new Date(),
  });
});
