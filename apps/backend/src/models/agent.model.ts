import { ObjectId } from 'mongodb';
import { getDatabase } from '../config/database';

export interface AgentPersonality {
  role: 'assistant' | 'teacher' | 'seller' | 'support' | 'customer_service';
  traits: string[];              // máximo 3 rasgos, e.g. ['empático', 'entusiasta']
  emojiUsage: 'low' | 'medium' | 'high';
  language: 'es' | 'en';
  responseLength: 'short' | 'medium' | 'detailed';
  ragBehavior: 'strict' | 'hybrid' | 'general';
  fallbackMessage: string;
  additionalInstructions?: string;
}

export interface Agent {
  _id?: ObjectId;
  name: string;
  description?: string;
  avatar?: string;
  projectId?: ObjectId;  // Proyecto al que pertenece el agente
  modelId: ObjectId;     // Referencia a la colección ai_models
  modelValue?: string;   // Cache del value para uso rápido (e.g. 'llama3.2:3b')
  personality: AgentPersonality;
  status: 'active' | 'inactive';
  createdBy?: ObjectId; // User ID del creador
  config: {
    temperature?: number;
    maxTokens?: number;
    enableWelcomeGreeting?: boolean;
    enableGoodbyeMessage?: boolean;
    enableFallbackAdvisor?: boolean;
    goodbyeKeywords?: string[];
    enableWhatsApp?: boolean;
    enableInstagram?: boolean;
    enableWeb?: boolean;
    autoCreateContact?: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

export const getAgentsCollection = () => {
  return getDatabase().collection<Agent>('agents');
};
