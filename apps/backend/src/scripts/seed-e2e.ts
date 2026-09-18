/**
 * Seed e2e: garantiza un usuario, proyecto, agente y proveedores dedicados a
 * pruebas end-to-end. Es idempotente y NO destructivo: sólo hace upsert de los
 * documentos e2e en la base de datos de pruebas (por defecto `mitchbot_e2e`).
 *
 * Uso:
 *   E2E_MONGODB_URI=mongodb://localhost:27017/mitchbot_e2e \
 *     pnpm --filter @mitchbot/backend seed:e2e
 */
import { MongoClient } from 'mongodb';
import Redis from 'ioredis';
import bcrypt from 'bcryptjs';

const MONGODB_URI =
  process.env.E2E_MONGODB_URI ||
  process.env.MONGODB_URI ||
  'mongodb://localhost:27017/mitchbot_e2e';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const E2E_USER = {
  name: 'E2E User',
  email: 'e2e@mitchbot.test',
  password: 'e2e12345',
  role: 'admin' as const,
};

const E2E_PROJECT = {
  name: 'E2E Project',
  slug: 'e2e-project',
  description: 'Proyecto dedicado a pruebas end-to-end',
  channels: { whatsapp: true, instagram: true, web: true },
  welcomeMessage: '¡Hola! ¿En qué puedo ayudarte?',
  goodbyeMessage: '¡Gracias por tu consulta! Hasta pronto.',
  autoCreateContact: true,
};

const E2E_AGENT = {
  name: 'E2E Agent',
  description: 'Agente determinista para pruebas e2e',
  modelValue: 'stub-model',
};

async function resetWsRateLimits() {
  const redis = new Redis(REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 });
  try {
    await redis.connect();
    const keys = await redis.keys('ws:rate:*');
    if (keys.length > 0) await redis.del(...keys);
  } catch {
    // Redis puede no estar disponible; no es bloqueante para el seed.
  } finally {
    redis.disconnect();
  }
}

async function seedE2E() {
  console.log('\n🌱 Seed E2E — MitchBot v2');
  console.log('==========================');
  console.log(`🗄️  Base de datos: ${MONGODB_URI}\n`);

  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    const db = client.db();
    const now = new Date();

    // --- Usuario e2e ---
    const users = db.collection('users');
    const hashedPassword = await bcrypt.hash(E2E_USER.password, 12);
    const existingUser = await users.findOne({ email: E2E_USER.email });

    let userId;
    if (existingUser) {
      userId = existingUser._id;
      await users.updateOne(
        { _id: userId },
        {
          $set: {
            name: E2E_USER.name,
            password: hashedPassword,
            role: E2E_USER.role,
            status: 'Active',
            updatedAt: now,
          },
        }
      );
    } else {
      const inserted = await users.insertOne({
        name: E2E_USER.name,
        email: E2E_USER.email,
        password: hashedPassword,
        role: E2E_USER.role,
        status: 'Active',
        lastLoginAt: null,
        createdAt: now,
        updatedAt: now,
      });
      userId = inserted.insertedId;
    }

    // --- Proyecto e2e ---
    const projects = db.collection('projects');
    let project = await projects.findOne({ slug: E2E_PROJECT.slug });
    if (!project) {
      const inserted = await projects.insertOne({
        name: E2E_PROJECT.name,
        slug: E2E_PROJECT.slug,
        description: E2E_PROJECT.description,
        config: {
          channels: E2E_PROJECT.channels,
          messages: {
            welcome: E2E_PROJECT.welcomeMessage,
            goodbye: E2E_PROJECT.goodbyeMessage,
          },
          options: { autoCreateContact: E2E_PROJECT.autoCreateContact },
        },
        createdBy: userId,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      });
      project = await projects.findOne({ _id: inserted.insertedId });
    }
    const projectId = project!._id;

    // --- Agente e2e ---
    const agents = db.collection('agents');
    let agent = await agents.findOne({ projectId });
    if (!agent) {
      const inserted = await agents.insertOne({
        name: E2E_AGENT.name,
        description: E2E_AGENT.description,
        projectId,
        modelId: projectId, // placeholder; no requiere un ai_model real
        modelValue: E2E_AGENT.modelValue,
        personality: {
          role: 'assistant',
          traits: ['neutro'],
          emojiUsage: 'medium',
          language: 'es',
          responseLength: 'medium',
          ragBehavior: 'hybrid',
          fallbackMessage: 'Lo siento, no tengo información disponible sobre ese tema en este momento.',
        },
        status: 'active',
        createdBy: userId,
        config: {
          temperature: 0.7,
          maxTokens: 300,
          enableWelcomeGreeting: false,
          enableGoodbyeMessage: false,
          enableFallbackAdvisor: false,
          goodbyeKeywords: ['adios', 'hasta luego', 'gracias', 'bye'],
          enableWhatsApp: true,
          enableInstagram: true,
          enableWeb: true,
          autoCreateContact: true,
        },
        createdAt: now,
        updatedAt: now,
      });
      agent = await agents.findOne({ _id: inserted.insertedId });
    } else {
      await agents.updateOne(
        { _id: agent._id },
        { $set: { modelValue: E2E_AGENT.modelValue, status: 'active', updatedAt: now } }
      );
    }

    await projects.updateOne(
      { _id: projectId },
      { $set: { agentId: agent!._id, updatedAt: now } }
    );

    // --- Pertenencia del usuario al proyecto ---
    await users.updateOne(
      { _id: userId },
      {
        $set: {
          projectIds: [projectId],
          activeProjectId: projectId,
          updatedAt: now,
        },
      }
    );

    console.log('✅ Seed E2E completado');
    console.log(`   👤 Usuario:  ${E2E_USER.email} / ${E2E_USER.password}`);
    console.log(`   📦 Proyecto: ${E2E_PROJECT.name} (slug: ${E2E_PROJECT.slug})`);
    console.log(`   🤖 Agente:   ${E2E_AGENT.name} (modelo por entorno)`);
    console.log(`   🧠 Embedding: por entorno\n`);

    // Limpia contadores de rate limiting WebSocket para evitar acumulación entre
    // corridas consecutivas de la suite (mismo usuario e2e).
    await resetWsRateLimits();
  } catch (error) {
    console.error('❌ Error en seed e2e:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

seedE2E();
