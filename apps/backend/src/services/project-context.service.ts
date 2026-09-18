import { ObjectId } from 'mongodb';
import { getProjectsCollection } from '../models/project.model';
import { getProviderConfigsCollection } from '../models/ai-model.model';
import { getKnowledgeSourcesCollection } from '../models/document.model';
import { getConversationsCollection } from '../models/conversation.model';
import { logger } from '../utils/logger';
import { projectService } from './project.service';

export const projectContextService = {
  async ensureProjectContext() {
    const project = await getProjectsCollection().findOne({ status: 'active' });
    if (!project?._id) {
      logger.warn('[ProjectContext] No active project found');
      return;
    }

    await this.backfillProjectSlugs();
    await this.backfillProviderConfigs(project._id);
    await this.backfillKnowledgeSources(project._id);
    await this.backfillConversations(project._id);
    await this.backfillKnowledgeCollections(project._id);
  },

  async backfillProjectSlugs() {
    const projectsColl = getProjectsCollection();
    const projects = await projectsColl.find({ slug: { $exists: false } }).toArray();
    if (projects.length === 0) return;

    for (const project of projects) {
      const baseSlug = this.slugify(project.name || '');
      const slug = await projectService.ensureUniqueSlug(baseSlug);
      await projectsColl.updateOne({ _id: project._id }, { $set: { slug, updatedAt: new Date() } });
    }
  },

  async backfillProviderConfigs(projectId: ObjectId) {
    const coll = getProviderConfigsCollection();
    const result = await coll.updateMany(
      { projectId: { $exists: false } },
      { $set: { projectId, updatedAt: new Date() } }
    );
    if (result.modifiedCount > 0) {
      logger.info(`[ProjectContext] Provider configs updated: ${result.modifiedCount}`);
    }
  },

  async backfillKnowledgeSources(projectId: ObjectId) {
    const coll = getKnowledgeSourcesCollection();
    const result = await coll.updateMany(
      { projectId: { $exists: false } },
      { $set: { projectId, updatedAt: new Date() } }
    );
    if (result.modifiedCount > 0) {
      logger.info(`[ProjectContext] Knowledge sources updated: ${result.modifiedCount}`);
    }
  },

  async backfillConversations(projectId: ObjectId) {
    const coll = getConversationsCollection();
    const result = await coll.updateMany(
      { projectId: { $exists: false } },
      { $set: { projectId, updatedAt: new Date() } }
    );
    if (result.modifiedCount > 0) {
      logger.info(`[ProjectContext] Conversations updated: ${result.modifiedCount}`);
    }
  },

  async backfillKnowledgeCollections(projectId: ObjectId) {
    const coll = getKnowledgeSourcesCollection();
    const targetCollection = `knowledge_base_${projectId.toString()}`;
    const sources = await coll.find({ projectId }).toArray();
    if (sources.length === 0) return;

    const updates = await Promise.all(
      sources.map(async (source) => {
        if (source.collectionName === targetCollection) return 0;
        const result = await coll.updateOne(
          { _id: source._id },
          { $set: { collectionName: targetCollection, updatedAt: new Date() } }
        );
        return result.modifiedCount;
      })
    );

    const updated = updates.reduce((acc, value) => acc + value, 0);
    if (updated > 0) {
      logger.info(`[ProjectContext] Knowledge collections updated: ${updated}`);
    }
  },

  slugify(value: string) {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 64);
  },
};
