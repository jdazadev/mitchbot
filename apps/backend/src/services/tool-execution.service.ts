import { ObjectId } from 'mongodb';
import { getToolExecutionsCollection, ToolExecution, ToolExecutionStatus } from '../models/tool-execution.model';

function toObjectId(value?: string): ObjectId | undefined {
  return value && ObjectId.isValid(value) ? new ObjectId(value) : undefined;
}

export const toolExecutionService = {
  async create(input: {
    conversationId: string;
    projectId?: string;
    contactId?: string;
    toolName: string;
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

  async setStatus(id: ObjectId | string, status: ToolExecutionStatus, result?: any, executedBy?: string) {
    const executionId = typeof id === 'string' ? new ObjectId(id) : id;
    await getToolExecutionsCollection().updateOne(
      { _id: executionId },
      {
        $set: {
          status,
          result,
          executedBy,
          updatedAt: new Date(),
        },
      }
    );
  },
};
