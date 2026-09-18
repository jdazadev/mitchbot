import { ObjectId } from 'mongodb';
import { getDatabase } from '../config/database';

export interface AIModel {
  _id?: ObjectId;
  name: string;         // Nombre visible: "Llama 3.2 (3B)"
  value: string;        // Valor técnico: "meta-llama/llama-3.1-8b-instruct"
  provider: string;     // "openrouter"
  description?: string;
  category?: string;    // "general" | "code" | "creative"
  isActive: boolean;
  isLocal?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Configuración de proveedor guardada en BD.
 * type: 'llm', 'embedding', 'file', 'image', 'audio' u 'ocr'
 * provider: siempre 'openrouter'
 * Las credenciales NUNCA se guardan aquí: provienen de variables de entorno.
 */
export interface ProviderConfig {
  _id?: ObjectId;
  projectId?: ObjectId;
  type: 'llm' | 'embedding' | 'file' | 'image' | 'audio' | 'ocr'; // Tipo de proveedor
  provider: string;                 // "openrouter"
  baseUrl?: string;                 // URL base personalizada
  selectedModel?: string;           // Modelo seleccionado (para local inmediato o embedding)
  selectedModelName?: string;       // Nombre legible del modelo seleccionado
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const getAIModelsCollection = () => {
  return getDatabase().collection<AIModel>('ai_models');
};

export const getProviderConfigsCollection = () => {
  return getDatabase().collection<ProviderConfig>('provider_configs');
};
