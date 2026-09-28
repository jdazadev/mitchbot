import { ObjectId } from 'mongodb';
import { getDatabase } from '../config/database';

export type ToolExecutionStatus = 'pending_confirmation' | 'pending_approval' | 'executing' | 'approving' | 'executed' | 'approved' | 'rejected' | 'failed' | 'cancelled';

export interface ToolExecution {
  _id?: ObjectId;
  conversationId: ObjectId;
  projectId?: ObjectId;
  contactId?: ObjectId;
  messageId?: ObjectId;      // Mensaje de confirmation_request asociado
  toolName: string;
  toolId?: string;
  operation?: string;
  binding?: string;
  params: Record<string, any>;
  result?: any;
  status: ToolExecutionStatus;
  userMessage?: string;      // Mensaje original del usuario que disparó la acción
  executedBy?: string;       // userId o 'contact'
  decisionBy?: ObjectId;
  decisionAt?: Date;
  approvalDecision?: 'approved' | 'rejected';
  createdAt: Date;
  updatedAt: Date;
}

export const getToolExecutionsCollection = () => {
  return getDatabase().collection<ToolExecution>('tool_executions');
};
