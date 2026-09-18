import { ObjectId } from 'mongodb';
import { getDatabase } from '../config/database';

export interface Project {
  _id?: ObjectId;
  name: string;
  slug: string;
  description?: string;
  logo?: string;
  // Agente asociado (1 proyecto = 1 agente)
  agentId?: ObjectId;
  // Configuración del proyecto
  config: {
    channels: {
      whatsapp: boolean;
      instagram: boolean;
      web: boolean;
    };
    messages: {
      welcome: string;
      goodbye: string;
    };
    options: {
      autoCreateContact: boolean;
    };
  };
  createdBy: ObjectId; // User ID del creador
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

export const getProjectsCollection = () => {
  return getDatabase().collection<Project>('projects');
};
