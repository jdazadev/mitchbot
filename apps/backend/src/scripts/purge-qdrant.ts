/**
 * Purga completa de Qdrant: elimina todas las colecciones.
 *
 * Ejecutar: pnpm tsx src/scripts/purge-qdrant.ts
 */
import dotenv from 'dotenv';
import path from 'path';
import qdrantClient from '../config/qdrant';
import { logger } from '../utils/logger';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function purgeQdrant() {
  logger.info('\n🧹 Purga Qdrant — MitchBot v2');
  logger.info('================================\n');

  const collections = await qdrantClient.getCollections();
  const names = collections?.collections?.map(item => item.name) || [];

  if (names.length === 0) {
    logger.info('ℹ️  No hay colecciones para eliminar');
    return;
  }

  logger.info(`🗑️  Eliminando ${names.length} colección(es)...`);

  for (const name of names) {
    try {
      await qdrantClient.deleteCollection(name);
      logger.info(`   ✅ Eliminada: ${name}`);
    } catch (e: any) {
      logger.error(`   ❌ Error eliminando ${name}: ${e?.message || e}`);
    }
  }

  logger.info('\n✅ Purga completa finalizada');
}

purgeQdrant().catch(error => {
  logger.error('❌ Error en purga Qdrant:', error);
  process.exit(1);
});
