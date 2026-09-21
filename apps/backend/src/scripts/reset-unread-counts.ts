/**
 * Reset one-off de los contadores de no leídos contaminados.
 *
 * Los `unreadCount` existentes se inflaron porque el bot y el agente humano
 * también sumaban; este script los deja en cero en todas las conversaciones.
 *
 * Ejecutar: pnpm tsx src/scripts/reset-unread-counts.ts
 */
import dotenv from 'dotenv';
import path from 'path';
import { connectDatabase, closeDatabase } from '../config/database';
import { getConversationsCollection } from '../models/conversation.model';
import { logger } from '../utils/logger';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function resetUnreadCounts() {
  logger.info('\n🧹 Reset de contadores no leídos — MitchBot v2');
  logger.info('============================================\n');

  await connectDatabase();

  try {
    const result = await getConversationsCollection().updateMany(
      {},
      { $set: { unreadCount: 0 } }
    );

    logger.info(`✅ Conversaciones actualizadas: ${result.modifiedCount}`);
  } finally {
    await closeDatabase();
  }
}

resetUnreadCounts().catch(error => {
  logger.error('❌ Error reseteando contadores no leídos:', error);
  process.exit(1);
});
