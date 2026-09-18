/**
 * Migración al modelo multi-proyecto.
 *
 * - Asigna el proyecto actual a los usuarios existentes y fija su `activeProjectId`.
 * - Vincula los agentes existentes a su proyecto (por `agentId`) o al proyecto actual.
 *
 * Ejecutar: pnpm tsx src/scripts/migrate-multi-project.ts
 */
import dotenv from 'dotenv';
import path from 'path';
import { ObjectId } from 'mongodb';
import { connectDatabase, closeDatabase } from '../config/database';
import { logger } from '../utils/logger';
import { getUsersCollection } from '../models/user.model';
import { getAgentsCollection } from '../models/agent.model';
import { getProjectsCollection } from '../models/project.model';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function migrateMultiProject() {
  logger.info('\n🔀 Migración Multi-Proyecto — MitchBot v2');
  logger.info('=========================================\n');

  await connectDatabase();

  try {
    const projectsColl = getProjectsCollection();
    const projects = await projectsColl.find().sort({ createdAt: 1 }).toArray();

    if (projects.length === 0) {
      logger.warn('⚠️  No hay proyectos. Nada que migrar.');
      return;
    }

    const currentProject = projects.find(p => p.status === 'active') || projects[0];
    const currentProjectId = currentProject._id!;
    logger.info(`📌 Proyecto actual: ${currentProject.name} (${currentProjectId.toString()})`);

    // 1. Usuarios: asignar proyecto actual y fijar activeProjectId
    const usersColl = getUsersCollection();
    const users = await usersColl.find().toArray();
    let migratedUsers = 0;

    for (const user of users) {
      const update: Record<string, any> = {};
      const projectIds = (user.projectIds || []).map(id => id.toString());

      if (!user.activeProjectId && !projectIds.includes(currentProjectId.toString())) {
        projectIds.push(currentProjectId.toString());
      }
      if (!user.activeProjectId) {
        update.activeProjectId = currentProjectId;
      }
      if (!user.projectIds || user.projectIds.length === 0) {
        update.projectIds = projectIds.map(id => new ObjectId(id));
      }

      if (Object.keys(update).length > 0) {
        update.updatedAt = new Date();
        await usersColl.updateOne({ _id: user._id }, { $set: update });
        migratedUsers += 1;
      }
    }
    logger.info(`👤 Usuarios migrados: ${migratedUsers}/${users.length}`);

    // 2. Agentes: vincular a su proyecto por agentId o al proyecto actual
    const agentsColl = getAgentsCollection();
    const agents = await agentsColl.find().toArray();
    let migratedAgents = 0;

    for (const agent of agents) {
      if (agent.projectId) continue;

      const ownerProject = projects.find(p => p.agentId?.toString() === agent._id!.toString());
      await agentsColl.updateOne(
        { _id: agent._id },
        { $set: { projectId: ownerProject?._id || currentProjectId, updatedAt: new Date() } }
      );
      migratedAgents += 1;
    }
    logger.info(`🤖 Agentes migrados: ${migratedAgents}/${agents.length}`);

    logger.info('\n✅ Migración completada');
  } finally {
    await closeDatabase();
  }
}

migrateMultiProject().catch(error => {
  logger.error('❌ Error en la migración:', error);
  process.exit(1);
});
