import { Queue } from 'bullmq';
import bullmqConnection from '../config/redis-bullmq';

export const RAG_UPLOAD_QUEUE_NAME = 'rag-upload';

export const ragUploadQueue = new Queue(RAG_UPLOAD_QUEUE_NAME, {
  connection: bullmqConnection,
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: 200,
    removeOnFail: 200,
  },
});
