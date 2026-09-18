/**
 * Reindex RAG: reindexa todas las fuentes del proyecto activo con el chunking
 * semántico nuevo, usando BullMQ en background.
 *
 * - Elimina la colección de Qdrant para partir limpio.
 * - Encola cada fuente (Indexed/Failed) conservando su metadata.
 * - Ejecuta un worker local para procesar la cola y reporta progreso por fuente.
 * - Revierte los vectores parciales si una fuente falla.
 *
 * Ejecutar: pnpm tsx src/scripts/reindex-rag.ts
 */
import dotenv from 'dotenv';
import path from 'path';
import { ObjectId } from 'mongodb';
import { connectDatabase, closeDatabase } from '../config/database';
import qdrantClient from '../config/qdrant';
import { getProjectsCollection } from '../models/project.model';
import { getKnowledgeSourcesCollection } from '../models/document.model';
import { ragService } from '../services/rag.service';
import { logger } from '../utils/logger';
import { ragReindexQueue } from '../queues/rag-reindex.queue';
import { createReindexWorker } from '../queues/rag-reindex.worker';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function reindexRag() {
  logger.info('\n🔁 Reindex RAG — MitchBot v2');
  logger.info('================================\n');

  await connectDatabase();
  const worker = createReindexWorker({ concurrency: 1 });

  try {
    const project = await getProjectsCollection().findOne({ status: 'active' });
    if (!project?._id) {
      throw new Error('No hay proyecto activo para reindexar');
    }

    const projectId = project._id.toString();
    const collectionName = await ragService.getProjectCollectionName(projectId);

    logger.info(`📌 Proyecto activo: ${project.name || projectId}`);
    logger.info(`🧠 Colección Qdrant: ${collectionName}`);

    logger.info('🗑️  Eliminando colección en Qdrant...');
    try {
      await qdrantClient.deleteCollection(collectionName);
      logger.info('   ✅ Colección eliminada');
    } catch (e: any) {
      logger.warn(`   ⚠️  No se pudo eliminar colección (puede no existir): ${e?.message || e}`);
    }

    const sources = await getKnowledgeSourcesCollection()
      .find({
        projectId: new ObjectId(projectId),
        status: { $in: ['Indexed', 'Failed'] },
      })
      .sort({ createdAt: 1 })
      .toArray();

    if (sources.length === 0) {
      logger.info('ℹ️  No hay fuentes indexadas para reindexar');
      return;
    }

    logger.info(`🔄 Encolando ${sources.length} fuente(s) para reindexar...`);

    for (const source of sources) {
      const inferredType = source.type === 'PDF'
        ? 'application/pdf'
        : source.type === 'CSV'
          ? 'text/csv'
          : source.type === 'IMAGE'
            ? 'image/png'
            : 'text/plain';

      await ragReindexQueue.add('reindex', {
        sourceId: source._id!.toString(),
        sourceName: source.name,
        collectionName,
        filePath: source.filePath,
        fileType: source.filePath ? inferredType : undefined,
        content: source.content,
        projectId,
        category: source.category,
        tags: source.tags,
        author: source.author,
        accessLevel: source.accessLevel,
        createdAt: (source.sourceCreatedAt || source.createdAt)?.toISOString(),
      });
    }

    let completed = 0;
    let failed = 0;
    const total = sources.length;

    await new Promise<void>((resolve) => {
      worker.on('completed', (job) => {
        completed += 1;
        logger.info(`   ✅ (${completed + failed}/${total}) Reindexado: ${job?.data?.sourceName || job?.id}`);
        if (completed + failed >= total) resolve();
      });
      worker.on('failed', (job, err) => {
        failed += 1;
        logger.error(`   ❌ (${completed + failed}/${total}) Falló: ${job?.data?.sourceName || job?.id} — ${err?.message || err}`);
        if (completed + failed >= total) resolve();
      });
    });

    logger.info(`\n✅ Reindex finalizado — ${completed} ok, ${failed} con error, de ${total}`);
  } finally {
    await worker.close();
    await ragReindexQueue.close();
    await closeDatabase();
  }
}

reindexRag().catch(error => {
  logger.error('❌ Error en reindex RAG:', error);
  process.exit(1);
});
