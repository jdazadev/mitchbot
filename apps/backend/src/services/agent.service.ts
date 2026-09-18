import { ObjectId } from 'mongodb';
import { getAgentsCollection, Agent, AgentPersonality } from '../models/agent.model';
import { aiModelService } from './ai-model.service';
import { getDefaultPersonality } from './prompt-builder.service';

export const agentService = {
  async findAll() {
    return getAgentsCollection().find().sort({ createdAt: -1 }).toArray();
  },

  async findById(id: string) {
    if (!ObjectId.isValid(id)) throw new Error('Invalid ID');
    return getAgentsCollection().findOne({ _id: new ObjectId(id) });
  },

  async create(data: Omit<Agent, '_id' | 'createdAt' | 'updatedAt'> & { model?: string }) {
    const agentsColl = getAgentsCollection();

    // Resolver modelo: puede venir como modelValue directo, model string, o modelId
    let modelId = data.modelId;
    let modelValue = data.modelValue;

    // Si viene modelValue directo, usarlo tal cual (sin buscar en ai_models)
    if (modelValue && !modelId) {
      // Intentar encontrar en ai_models, pero no es obligatorio
      const aiModel = await aiModelService.findByValue(modelValue);
      if (aiModel) {
        modelId = aiModel._id!;
      }
    }
    // Si no hay modelValue pero hay model string, resolver
    else if (!modelValue && data.model) {
      modelValue = data.model;
      const aiModel = await aiModelService.findByValue(data.model);
      if (aiModel) {
        modelId = aiModel._id!;
      }
    }
    // Si ni modelValue ni model, usar fallback
    else if (!modelValue && !modelId) {
      modelValue = 'llama3.2:3b';
    }

    const newAgent: Agent = {
      _id: new ObjectId(),
      name: data.name,
      description: data.description,
      avatar: data.avatar,
      modelId: modelId || new ObjectId(), // placeholder si no se encuentra
      modelValue: modelValue,
      personality: {
        ...getDefaultPersonality(),
        ...(data as any).personality,
      },
      status: data.status || 'active',
      createdBy: data.createdBy,
      config: {
        temperature: 0.7,
        maxTokens: 300,
        enableWelcomeGreeting: false,
        enableGoodbyeMessage: false,
        enableFallbackAdvisor: false,
        goodbyeKeywords: [
          'adios', 'adiós', 'hasta luego', 'hasta pronto', 'nos vemos',
          'chao', 'ciao', 'bye', 'goodbye', 'gracias', 'muchas gracias',
          'ok gracias', 'listo gracias', 'vale gracias', 'ok, gracias',
        ],
        enableWhatsApp: true,
        enableInstagram: false,
        enableWeb: true,
        autoCreateContact: true,
        ...data.config,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await agentsColl.insertOne(newAgent);
    return newAgent;
  },

  async update(id: string, data: Partial<Agent> & { model?: string }) {
    if (!ObjectId.isValid(id)) throw new Error('Invalid ID');
    const { _id, createdAt, model, ...safeData } = data as any;

    // Si viene modelValue directamente, guardarlo tal cual
    if (safeData.modelValue && typeof safeData.modelValue === 'string') {
      // Intentar resolver modelId, pero no es obligatorio
      const aiModel = await aiModelService.findByValue(safeData.modelValue);
      if (aiModel) {
        safeData.modelId = aiModel._id;
      }
    }
    // Si viene un model string (legacy), resolver
    else if (model && typeof model === 'string') {
      safeData.modelValue = model;
      const aiModel = await aiModelService.findByValue(model);
      if (aiModel) {
        safeData.modelId = aiModel._id;
      }
    }

    // Si viene modelId como string, convertir a ObjectId
    if (safeData.modelId && typeof safeData.modelId === 'string') {
      safeData.modelId = new ObjectId(safeData.modelId);
    }

    const result = await getAgentsCollection().findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: { ...safeData, updatedAt: new Date() } },
      { returnDocument: 'after' }
    );
    return result;
  },

  async delete(id: string) {
    if (!ObjectId.isValid(id)) throw new Error('Invalid ID');
    const result = await getAgentsCollection().deleteOne({ _id: new ObjectId(id) });
    return result.deletedCount === 1;
  },

  /** Obtiene el agente activo (el principal para el bot) */
  async getActiveAgent() {
    return getAgentsCollection().findOne({ status: 'active' });
  },
};
