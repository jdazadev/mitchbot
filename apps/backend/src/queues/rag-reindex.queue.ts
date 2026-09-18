import { Queue } from 'bullmq';
import bullmqConnection from '../config/redis-bullmq';

export const RAG_REINDEX_QUEUE_NAME = 'rag-reindex';

export interface RagReindexJobData {
  sourceId: string;
  sourceName: string;
  collectionName: string;
  filePath?: string;
  fileType?: string;
  content?: string;
  projectId?: string;
  category?: string;
  tags?: string[];
  author?: string;
  accessLevel?: string;
  createdAt?: string;
}

export const ragReindexQueue = new Queue<RagReindexJobData>(RAG_REINDEX_QUEUE_NAME, {
  connection: bullmqConnection,
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: 200,
    removeOnFail: 200,
  },
});
