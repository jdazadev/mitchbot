import { ObjectId } from 'mongodb';
import { getDatabase } from '../config/database';
import type { ChannelPlatform, DeliveryStatus } from '../channels/types';

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
  status: 'pending' | 'success' | 'error' | 'needs_confirmation' | 'pending_approval' | 'approved' | 'rejected' | 'cancelled';
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
  /** Origen en un canal externo; con índice único parcial para descartar webhooks repetidos. */
  external?: { platform: ChannelPlatform; messageId: string };
  /** Entrega en canales externos (los mensajes Web no lo llevan). */
  delivery?: MessageDelivery;
  readAt?: Date;
  createdAt: Date;
}

export interface MessageDelivery {
  status: DeliveryStatus;
  attempts: number;
  externalId?: string;
  error?: string;
  updatedAt: Date;
}

export const getMessagesCollection = () => {
    return getDatabase().collection<Message>('messages');
};
