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
    // Número de WhatsApp Business que atiende el proyecto. Su token es el del entorno o, si se conectó
    // con el registro integrado, el de `channel_credentials` (nunca en `config`).
    whatsapp?: {
      phoneNumberId?: string | null;
      /** Cuenta de WhatsApp Business del número: de ella salen las plantillas aprobadas. */
      wabaId?: string | null;
    };
    // Objetivos de servicio: respuesta (minutos) y resolución (horas)
    sla?: {
      responseMinutes?: number;
      resolutionHours?: number;
      alerts?: boolean;
    };
    // Widget embebible del canal Web
    widget?: {
      enabled?: boolean;
      /** Orígenes que pueden embeber el widget (`frame-ancestors`). */
      allowedOrigins?: string[];
      position?: 'right' | 'left';
      title?: string | null;
      greeting?: string | null;
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
