import { ObjectId } from 'mongodb';
import { getDatabase } from '../config/database';

export type MessageSender = 'contact' | 'ai_agent' | 'human_agent' | 'tool';

export type MessageContentType =
  | 'text'
  | 'image'
  | 'file'
  | 'emoji'
  | 'tool_call'
  | 'tool_result'
  | 'confirmation_request';

export interface MessageToolData {
  toolName: string;
  params?: any;
  result?: any;
  status: 'pending' | 'success' | 'error' | 'needs_confirmation' | 'cancelled';
  executionId?: string;   // ID de la ejecución de herramienta (para confirmaciones)
  confirmedBy?: string;   // userId o 'contact'
}

export interface Message {
  _id?: ObjectId;
  conversationId: ObjectId;
  sender: MessageSender;
  senderName: string;
  content: string;
  contentType: MessageContentType;
  isBot: boolean;
  confidence?: string; // "98%" — confianza de la respuesta IA
  toolData?: MessageToolData;
  metadata?: {
    attachments?: { url: string; type: string; name: string }[];
    suggestedActions?: string[]; // "Suggest tracking link", "View recent orders"
  };
  readAt?: Date;
  createdAt: Date;
}

export const getMessagesCollection = () => {
    return getDatabase().collection<Message>('messages');
};
