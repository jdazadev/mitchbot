/**
 * Normaliza el idioma de los agentes al conjunto soportado (`es` | `en`).
 *
 * Los agentes con un idioma obsoleto o no soportado (`pt`, `auto` o ausente)
 * pasan a español.
 *
 * Ejecutar: pnpm tsx src/scripts/normalize-agent-language.ts
 */
import dotenv from 'dotenv';
import path from 'path';
import { connectDatabase, closeDatabase } from '../config/database';
import { logger } from '../utils/logger';
import { getAgentsCollection } from '../models/agent.model';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function normalizeAgentLanguage() {
  logger.info('\n🌐 Normalización de idioma de agentes — MitchBot v2');
  logger.info('===================================================\n');

  await connectDatabase();

  try {
    const agentsColl = getAgentsCollection();

    const filter = {
      $or: [
        { 'personality.language': { $exists: false } },
        { 'personality.language': { $nin: ['es', 'en'] } },
      ],
    };

    const pending = await agentsColl.countDocuments(filter);
    if (pending === 0) {
      logger.info('✅ No hay agentes con idioma no soportado.');
      return;
    }

    const result = await agentsColl.updateMany(filter, {
      $set: { 'personality.language': 'es', updatedAt: new Date() },
    });

    logger.info(`🤖 Agentes normalizados a español: ${result.modifiedCount}/${pending}`);

    const remaining = await agentsColl.countDocuments({
      'personality.language': { $nin: ['es', 'en'] },
    });
    logger.info(`🔎 Agentes con idioma no soportado restantes: ${remaining}`);

    logger.info('\n✅ Normalización completada');
  } finally {
    await closeDatabase();
  }
}

normalizeAgentLanguage().catch(error => {
  logger.error('❌ Error en la normalización:', error);
  process.exit(1);
});
