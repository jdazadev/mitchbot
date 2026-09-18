import { ObjectId } from 'mongodb';
import { getDatabase } from '../config/database';

export interface AIModel {
  _id?: ObjectId;
  name: string;         // Nombre visible: "Llama 3.2 (3B)"
  value: string;        // Valor técnico: "llama3.2:3b"
  provider: string;     // "ollama" | "openrouter" | "gemini"
  description?: string;
  category?: string;    // "general" | "code" | "creative"
  isActive: boolean;
  isLocal?: boolean;    // true si es un modelo de Ollama
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Configuración de proveedor guardada en BD.
 * type: 'llm', 'embedding', 'file', 'image', 'audio' u 'ocr'
 * provider: 'ollama' | 'openrouter' | 'gemini' | 'mistral'
 */
export interface ProviderConfig {
  _id?: ObjectId;
  projectId?: ObjectId;
  type: 'llm' | 'embedding' | 'file' | 'image' | 'audio' | 'ocr'; // Tipo de proveedor
  provider: string;                 // "ollama" | "openrouter" | "gemini" | "mistral"
  apiKey?: string;                  // API key (solo para openrouter y gemini)
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
