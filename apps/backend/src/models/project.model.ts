import { ObjectId } from 'mongodb';
import { getDatabase } from '../config/database';
import { ToolProjectConfig } from '../tools/types';

export interface Project {
  _id?: ObjectId;
  name: string;
  slug: string;
  description?: string;
  logo?: string | null;
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
    tools?: ToolProjectConfig;
    // Número de WhatsApp Business que atiende el proyecto; las credenciales vienen del entorno
    whatsapp?: {
      phoneNumberId?: string | null;
    };
    // ID de la cuenta profesional de Instagram que atiende el proyecto
    instagram?: {
      accountId?: string | null;
    };
    // Identidad visual; el frontend deriva de `color` la familia --brand*
    brand?: {
      color?: string;
      logo?: string | null;
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
