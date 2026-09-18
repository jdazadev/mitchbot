import fs from 'fs';
import { ObjectId } from 'mongodb';
import { getKnowledgeSourcesCollection, KnowledgeSource } from '../models/document.model';
import { ragUploadQueue } from '../queues/rag-upload.queue';
import { createHash } from 'crypto';
import { aiModelService } from './ai-model.service';
import { appendSourceLog, updateSourceProgress } from './rag-job.service';

export async function enqueueRagUpload(params: {
  filePath: string;
  fileType: string;
  sourceName: string;
  collectionName: string;
  projectId: string;
  category?: string;
  tags?: string[];
  author?: string;
  accessLevel?: string;
  createdAt?: string;
}) {
  let collectionName = params.collectionName;
  if (params.projectId) {
    const embeddingConfig = await aiModelService.getActiveEmbeddingConfig(params.projectId);
    if (embeddingConfig?.model) {
      const hash = createHash('sha1').update(embeddingConfig.model).digest('hex').slice(0, 10);
      collectionName = `knowledge_base_${params.projectId}_${hash}`;
    }
  }

  const fileStats = fs.statSync(params.filePath);
  const sizeInMB = (fileStats.size / (1024 * 1024)).toFixed(2);
  const isCsv = params.fileType === 'text/csv' || params.fileType === 'application/csv' || params.sourceName.endsWith('.csv');
  const isImage = params.fileType.startsWith('image/');
  const type: KnowledgeSource['type'] = params.fileType === 'application/pdf'
    ? 'PDF'
    : isCsv
      ? 'CSV'
      : isImage
        ? 'IMAGE'
        : 'TXT';

  const sourceCreatedAt = params.createdAt ? new Date(params.createdAt) : undefined;

  const source: KnowledgeSource = {
    name: params.sourceName,
    type,
    size: `${sizeInMB} MB`,
    sizeBytes: fileStats.size,
    status: 'Queued',
    stage: 'queued',
    progress: 0,
    filePath: params.filePath,
    category: params.category,
    tags: params.tags,
    author: params.author,
    accessLevel: params.accessLevel,
    sourceCreatedAt,
    projectId: ObjectId.isValid(params.projectId) ? new ObjectId(params.projectId) : undefined,
    collectionName,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const insertResult = await getKnowledgeSourcesCollection().insertOne(source);
  const sourceId = insertResult.insertedId.toString();

  await appendSourceLog(sourceId, {
    level: 'info',
    stage: 'queued',
    message: 'Subida encolada',
  });

  await updateSourceProgress(sourceId, { status: 'Queued', stage: 'queued', progress: 0 });

  await ragUploadQueue.add('rag-upload', {
    sourceId,
    filePath: params.filePath,
    fileType: params.fileType,
    sourceName: params.sourceName,
    collectionName,
    projectId: params.projectId,
    category: params.category,
    tags: params.tags,
    author: params.author,
    accessLevel: params.accessLevel,
    createdAt: params.createdAt,
  }, {
    attempts: 1,
  });

  return { sourceId };
}
