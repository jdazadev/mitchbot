import { ObjectId } from 'mongodb';
import { getDatabase } from '../config/database';

export interface Conversation {
  _id?: ObjectId;
  projectId?: ObjectId;
  contactId?: ObjectId; // Referencia al contacto (puede ser null hasta que se cree el contacto)
  platform: "WhatsApp" | "Instagram" | "Web";
  status: "active" | "closed" | "pending_human";
  mode: "auto_pilot" | "human_takeover";
  tag?: string; // "Bot Active", "CLOSED", "HUMAN NEEDED"
  tagColor?: string;
  lastMessage?: string;
  lastMessageAt?: Date;
  unreadCount?: number;
  lastBotMessageAt?: Date;
  lastWelcomeAt?: Date;
  assignedTo?: string; // ID del agente humano si aplica
  aiInsights?: {
    sentiment: "positive" | "neutral" | "negative";
    sentimentScores: { positive: number; neutral: number; negative: number };
    confidence?: string;
  };
  // Datos temporales del cliente antes de crear el contacto
  clientInfo: {
    name?: string;
    phone?: string;
    email?: string;
    identifier: string; // ID único del cliente (phone, email, etc.)
  };
  isContactCreated: boolean; // Flag para saber si el contacto ya fue creado
  createdAt: Date;
  updatedAt: Date;
}

export const getConversationsCollection = () => {
    return getDatabase().collection<Conversation>('conversations');
};
