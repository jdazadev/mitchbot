import { ObjectId } from 'mongodb';
import { getDatabase } from '../config/database';

export interface AppConfig {
  _id?: ObjectId;
  key: string; // Clave única de configuración
  value: any;  // Valor flexible
  updatedAt: Date;
}

// Configuraciones esperadas:
// key: 'channels' -> value: { whatsapp: true, instagram: false, web: true }
// key: 'messages' -> value: { welcome: '...', goodbye: '...' }
// key: 'personality' -> value: { systemPrompt: '...' }
// key: 'options' -> value: { autoCreateContact: true }
// key: 'rag.qdrant_payload_indexes' -> value: [{ field: 'category', type: 'keyword' }, ...]

export const getConfigCollection = () => {
  return getDatabase().collection<AppConfig>('app_config');
};
