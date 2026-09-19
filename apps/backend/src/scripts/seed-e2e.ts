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
  // Instagram deshabilitado para validar que los filtros derivan de la config.
  channels: { whatsapp: true, instagram: false, web: true },
  welcomeMessage: '¡Hola! ¿En qué puedo ayudarte?',
  goodbyeMessage: '¡Gracias por tu consulta! Hasta pronto.',
  autoCreateContact: true,
};

const E2E_PROJECT_NOCONTACT = {
  name: 'E2E NoContact',
  slug: 'e2e-nocontact',
  description: 'Proyecto e2e con creación automática de contactos deshabilitada',
  channels: { whatsapp: true, instagram: false, web: true },
  welcomeMessage: '¡Hola! ¿En qué puedo ayudarte?',
  goodbyeMessage: '¡Gracias por tu consulta! Hasta pronto.',
  autoCreateContact: false,
};

const E2E_AGENT = {
  name: 'E2E Agent',
  description: 'Agente determinista para pruebas e2e',
  modelValue: 'stub-model',
};

const E2E_AGENT_NOCONTACT = {
  name: 'E2E Agent NoContact',
  description: 'Agente determinista para pruebas e2e (sin auto-contacto)',
  modelValue: 'stub-model',
};

const E2E_AGENT_CONFIG = {
  temperature: 0.7,
  maxTokens: 300,
  enableWelcomeGreeting: false,
  enableGoodbyeMessage: false,
  enableFallbackAdvisor: false,
  goodbyeKeywords: ['adios', 'hasta luego', 'bye'],
  enableWhatsApp: true,
  enableInstagram: true,
  enableWeb: true,
  autoCreateContact: true,
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

    // --- Proyectos e2e ---
    const projects = db.collection('projects');
    const agents = db.collection('agents');

    type ProjectDef = typeof E2E_PROJECT;
    type AgentDef = typeof E2E_AGENT;

    const upsertProject = async (def: ProjectDef) => {
      const config = {
        channels: def.channels,
        messages: {
          welcome: def.welcomeMessage,
          goodbye: def.goodbyeMessage,
        },
        options: { autoCreateContact: def.autoCreateContact },
      };
      let doc = await projects.findOne({ slug: def.slug });
      if (!doc) {
        const inserted = await projects.insertOne({
          name: def.name,
          slug: def.slug,
          description: def.description,
          config,
          createdBy: userId,
          status: 'active',
          createdAt: now,
          updatedAt: now,
        });
        doc = await projects.findOne({ _id: inserted.insertedId });
      } else {
        await projects.updateOne(
          { _id: doc._id },
          { $set: { name: def.name, description: def.description, config, updatedAt: now } }
        );
      }
      return doc!;
    };

    const upsertAgent = async (projectId: any, def: AgentDef) => {
      const agentDoc = {
        name: def.name,
        description: def.description,
        projectId,
        modelId: projectId, // placeholder; no requiere un ai_model real
        modelValue: def.modelValue,
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
        config: E2E_AGENT_CONFIG,
      };
      let doc = await agents.findOne({ projectId });
      if (!doc) {
        const inserted = await agents.insertOne({ ...agentDoc, createdAt: now, updatedAt: now });
        doc = await agents.findOne({ _id: inserted.insertedId });
      } else {
        await agents.updateOne({ _id: doc._id }, { $set: { ...agentDoc, updatedAt: now } });
      }
      return doc!;
    };

    // Proyecto principal (auto-creación de contactos habilitada).
    const project = await upsertProject(E2E_PROJECT);
    const projectId = project._id;
    const agent = await upsertAgent(projectId, E2E_AGENT);
    await projects.updateOne(
      { _id: projectId },
      { $set: { agentId: agent._id, updatedAt: now } }
    );

    // Proyecto secundario (auto-creación de contactos deshabilitada).
    const projectNc = await upsertProject(E2E_PROJECT_NOCONTACT);
    const projectNcId = projectNc._id;
    const agentNc = await upsertAgent(projectNcId, E2E_AGENT_NOCONTACT);
    await projects.updateOne(
      { _id: projectNcId },
      { $set: { agentId: agentNc._id, updatedAt: now } }
    );

    // --- Pertenencia del usuario a los proyectos ---
    await users.updateOne(
      { _id: userId },
      {
        $set: {
          projectIds: [projectId, projectNcId],
          activeProjectId: projectId,
          updatedAt: now,
        },
      }
    );

    console.log('✅ Seed E2E completado');
    console.log(`   👤 Usuario:  ${E2E_USER.email} / ${E2E_USER.password}`);
    console.log(`   📦 Proyecto: ${E2E_PROJECT.name} (slug: ${E2E_PROJECT.slug})`);
    console.log(`   📦 Proyecto: ${E2E_PROJECT_NOCONTACT.name} (slug: ${E2E_PROJECT_NOCONTACT.slug})`);
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
