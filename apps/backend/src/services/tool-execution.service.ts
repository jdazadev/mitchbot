import { ObjectId } from 'mongodb';
import { getToolExecutionsCollection, ToolExecution, ToolExecutionStatus } from '../models/tool-execution.model';
import { ToolOperation } from '../tools/types';

function toObjectId(value?: string): ObjectId | undefined {
  return value && ObjectId.isValid(value) ? new ObjectId(value) : undefined;
}

export const toolExecutionService = {
  async create(input: {
    conversationId: string;
    projectId?: string;
    contactId?: string;
    toolName: string;
    toolId?: string;
    operation?: ToolOperation;
    binding?: string;
    params: Record<string, any>;
    status?: ToolExecutionStatus;
    userMessage?: string;
  }): Promise<ToolExecution> {
    const execution: ToolExecution = {
      _id: new ObjectId(),
      conversationId: new ObjectId(input.conversationId),
      projectId: toObjectId(input.projectId),
      contactId: toObjectId(input.contactId),
      toolName: input.toolName,
      toolId: input.toolId,
      operation: input.operation,
      binding: input.binding,
      params: input.params || {},
      status: input.status || 'pending_confirmation',
      userMessage: input.userMessage,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await getToolExecutionsCollection().insertOne(execution);
    return execution;
  },

  async findById(id: string) {
    if (!ObjectId.isValid(id)) return null;
    return getToolExecutionsCollection().findOne({ _id: new ObjectId(id) });
  },

  async list(input: {
    projectId: string;
    toolId?: string;
    operation?: string;
    binding?: string;
    status?: ToolExecutionStatus;
    from?: Date;
    to?: Date;
    page?: number;
    limit?: number;
  }) {
    if (!ObjectId.isValid(input.projectId)) throw new Error('ID de proyecto inválido');
    const page = Math.max(1, input.page || 1);
    const limit = Math.min(100, Math.max(1, input.limit || 20));
    const query: Record<string, any> = { projectId: new ObjectId(input.projectId) };
    if (input.toolId) query.toolId = input.toolId;
    if (input.operation) query.operation = input.operation;
    if (input.binding) query.binding = input.binding;
    if (input.status) query.status = input.status;
    if (input.from || input.to) {
      query.createdAt = {};
      if (input.from) query.createdAt.$gte = input.from;
      if (input.to) query.createdAt.$lte = input.to;
    }
    const collection = getToolExecutionsCollection();
    const [items, total] = await Promise.all([
      collection.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).toArray(),
      collection.countDocuments(query),
    ]);
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  async listPending(projectId: string) {
    if (!ObjectId.isValid(projectId)) throw new Error('ID de proyecto inválido');
    return getToolExecutionsCollection().find({ projectId: new ObjectId(projectId), status: 'pending_approval' })
      .sort({ createdAt: 1 }).toArray();
  },

  async claimApproval(id: string, projectId: string, decisionBy: string, decision: 'approved' | 'rejected') {
    if (!ObjectId.isValid(id) || !ObjectId.isValid(projectId) || !ObjectId.isValid(decisionBy)) throw new Error('ID inválido');
    if (decision === 'rejected') {
      return getToolExecutionsCollection().findOneAndUpdate(
        { _id: new ObjectId(id), projectId: new ObjectId(projectId), status: 'pending_approval' },
        { $set: { status: 'rejected', approvalDecision: 'rejected', decisionBy: new ObjectId(decisionBy), decisionAt: new Date(), updatedAt: new Date() } },
        { returnDocument: 'after' },
      );
    }
    return getToolExecutionsCollection().findOneAndUpdate(
      { _id: new ObjectId(id), projectId: new ObjectId(projectId), status: 'pending_approval' },
      { $set: { status: 'approving', approvalDecision: 'approved', decisionBy: new ObjectId(decisionBy), decisionAt: new Date(), updatedAt: new Date() } },
      { returnDocument: 'after' },
    );
  },

  async findInProject(id: string, projectId: string) {
    if (!ObjectId.isValid(id) || !ObjectId.isValid(projectId)) return null;
    return getToolExecutionsCollection().findOne({ _id: new ObjectId(id), projectId: new ObjectId(projectId) });
  },

  async setMessageId(id: ObjectId | string, messageId: ObjectId | string) {
    const executionId = typeof id === 'string' ? new ObjectId(id) : id;
    const msgId = typeof messageId === 'string' ? new ObjectId(messageId) : messageId;
    await getToolExecutionsCollection().updateOne(
      { _id: executionId },
      { $set: { messageId: msgId, updatedAt: new Date() } }
    );
  },

  async updateParams(id: ObjectId | string, params: Record<string, any>) {
    const executionId = typeof id === 'string' ? new ObjectId(id) : id;
    await getToolExecutionsCollection().updateOne(
      { _id: executionId },
      { $set: { params, updatedAt: new Date() } }
    );
  },

  async setStatus(id: ObjectId | string, status: ToolExecutionStatus, result?: any, executedBy?: string, decisionBy?: string) {
    const executionId = typeof id === 'string' ? new ObjectId(id) : id;
    await getToolExecutionsCollection().updateOne(
      { _id: executionId },
      {
        $set: {
          status,
          result,
          executedBy,
          ...(decisionBy && ObjectId.isValid(decisionBy) ? { decisionBy: new ObjectId(decisionBy), decisionAt: new Date() } : {}),
          updatedAt: new Date(),
        },
      }
    );
  },
};
