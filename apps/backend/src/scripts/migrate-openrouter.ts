/**
 * Migración: refactor-proveedores-openrouter
 *
 * 1. Elimina el campo `apiKey` de todos los documentos de `provider_configs`
 *    (las credenciales pasan a variables de entorno).
 * 2. Normaliza/desactiva cualquier usuario con rol `devadmin`.
 *
 * Idempotente: puede ejecutarse varias veces sin efectos adicionales.
 *
 * Ejecutar: pnpm --filter @mitchbot/backend tsx src/scripts/migrate-openrouter.ts
 */
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/mitchbot';

async function migrate() {
  console.log('\n🔄 Migración — refactor-proveedores-openrouter');
  console.log('=============================================\n');

  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    const db = client.db();

    // 1. Eliminar API keys persistidas
    const providerConfigs = db.collection('provider_configs');
    const unsetResult = await providerConfigs.updateMany(
      { apiKey: { $exists: true } },
      { $unset: { apiKey: '' } }
    );
    console.log(`🔑 provider_configs: ${unsetResult.modifiedCount} documento(s) sin apiKey`);

    const remainingKeys = await providerConfigs.countDocuments({ apiKey: { $exists: true } });
    console.log(`   Verificación: ${remainingKeys} documento(s) aún con apiKey\n`);

    // 2. Normalizar/desactivar usuarios devadmin
    const users = db.collection('users');
    const devadminCount = await users.countDocuments({ role: 'devadmin' });

    if (devadminCount === 0) {
      console.log('👤 users: no hay usuarios con rol devadmin');
    } else {
      const normalizeResult = await users.updateMany(
        { role: 'devadmin' },
        { $set: { role: 'assistant', status: 'Inactive', updatedAt: new Date() } }
      );
      console.log(`👤 users: ${normalizeResult.modifiedCount} usuario(s) devadmin normalizados a assistant/Inactive`);
    }

    const remainingDevadmin = await users.countDocuments({ role: 'devadmin' });
    console.log(`   Verificación: ${remainingDevadmin} usuario(s) con rol devadmin\n`);

    console.log('✅ Migración completada');
  } catch (error) {
    console.error('❌ Error en la migración:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

migrate();
