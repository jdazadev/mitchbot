/**
 * Limpia todos los datos del proyecto activo en MongoDB y Qdrant.
 *
 * Ejecutar: pnpm tsx src/scripts/cleanup-project.ts
 */
import dotenv from 'dotenv';
import path from 'path';
import { ObjectId } from 'mongodb';
import { connectDatabase, closeDatabase } from '../config/database';
import qdrantClient from '../config/qdrant';
import { getProjectsCollection } from '../models/project.model';
import { getConversationsCollection } from '../models/conversation.model';
import { getMessagesCollection } from '../models/message.model';
import { getContactsCollection } from '../models/contact.model';
import { getKnowledgeSourcesCollection } from '../models/document.model';
import { getProviderConfigsCollection } from '../models/ai-model.model';
import { logger } from '../utils/logger';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function cleanupProject() {
  logger.info('\n🧹 Limpieza Proyecto Activo — MitchBot v2');
  logger.info('=========================================\n');

  await connectDatabase();

  try {
    const project = await getProjectsCollection().findOne({ status: 'active' });
    if (!project?._id) {
      throw new Error('No hay proyecto activo para limpiar');
    }

    const projectId = project._id.toString();
    const projectObjectId = new ObjectId(projectId);

    logger.info(`📌 Proyecto activo: ${project.name || projectId}`);

    const sources = await getKnowledgeSourcesCollection().find({ projectId: projectObjectId }).toArray();
    const collectionName = sources[0]?.collectionName || `knowledge_base_${projectId}`;

    logger.info(`🧠 Colección Qdrant: ${collectionName}`);
    try {
      await qdrantClient.deleteCollection(collectionName);
      logger.info('   ✅ Colección Qdrant eliminada');
    } catch (e: any) {
      logger.warn(`   ⚠️  No se pudo eliminar colección (puede no existir): ${e?.message || e}`);
    }

    const deletes = await Promise.all([
      getMessagesCollection().deleteMany({ projectId: projectObjectId }),
      getConversationsCollection().deleteMany({ projectId: projectObjectId }),
      getContactsCollection().deleteMany({ projectId: projectObjectId }),
      getKnowledgeSourcesCollection().deleteMany({ projectId: projectObjectId }),
      getProviderConfigsCollection().deleteMany({ projectId: projectObjectId }),
    ]);

    logger.info('🗑️  Limpieza MongoDB completada:');
    logger.info(`   - mensajes: ${deletes[0].deletedCount}`);
    logger.info(`   - conversaciones: ${deletes[1].deletedCount}`);
    logger.info(`   - contactos: ${deletes[2].deletedCount}`);
    logger.info(`   - fuentes RAG: ${deletes[3].deletedCount}`);
    logger.info(`   - provider configs: ${deletes[4].deletedCount}`);

    logger.info('\n✅ Proyecto limpio');
  } finally {
    await closeDatabase();
  }
}

cleanupProject().catch(error => {
  logger.error('❌ Error limpiando proyecto:', error);
  process.exit(1);
});
