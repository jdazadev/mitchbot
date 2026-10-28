import { ObjectId } from 'mongodb';
import env from '../config/env';
import { getConversationsCollection } from '../models/conversation.model';
import { projectService } from './project.service';
import { whatsAppSignupService } from './whatsapp-signup.service';
import { chatService } from './chat.service';
import { isExternal } from '../channels/registry';
import { ChannelError } from '../channels/types';
import {
  fetchApprovedTemplates,
  renderTemplate,
  templateMessage,
  validateParameters,
  type TemplateClientOptions,
  type TemplateParameters,
  type WhatsAppTemplate,
} from '../channels/whatsapp/templates';

/** Error con el estado HTTP que debe ver el panel. */
export class TemplateError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = 'TemplateError';
  }
}

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { at: number; templates: WhatsAppTemplate[] }>();

/** Solo para pruebas: cliente de la Graph API y caché. */
let clientOverride: TemplateClientOptions | undefined;
export function setTemplateClientForTests(options: TemplateClientOptions | undefined) {
  clientOverride = options;
  cache.clear();
}

/** Cliente con el token de la conexión del proyecto o, si no tiene, el del entorno. */
async function clientOptions(projectId: string): Promise<TemplateClientOptions> {
  if (clientOverride) return clientOverride;
  const token = await whatsAppSignupService.tokenForProject(projectId);
  if (!token) throw new TemplateError(503, 'El proyecto no tiene WhatsApp conectado: conéctalo en Configuración → Canales');
  return { token, apiUrl: env.WHATSAPP_API_URL, apiVersion: env.WHATSAPP_API_VERSION };
}

async function wabaFor(projectId: string) {
  const project = await projectService.findById(projectId);
  const wabaId = project?.config?.whatsapp?.wabaId || env.WHATSAPP_WABA_ID;
  if (!wabaId) {
    throw new TemplateError(409, 'Configura el ID de la cuenta de WhatsApp Business (WABA) en Configuración → Canales para usar plantillas');
  }
  return wabaId;
}

export const templateService = {
  /** Plantillas aprobadas de la WABA del proyecto, con caché de 5 minutos. */
  async list(projectId: string, refresh = false) {
    const wabaId = await wabaFor(projectId);
    const cached = cache.get(wabaId);
    if (!refresh && cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.templates;
    try {
      const templates = await fetchApprovedTemplates(await clientOptions(projectId), wabaId);
      cache.set(wabaId, { at: Date.now(), templates });
      return templates;
    } catch (error) {
      if (error instanceof TemplateError) throw error;
      const reason = error instanceof ChannelError ? error.message : 'Error desconocido';
      throw new TemplateError(502, `No se pudieron cargar las plantillas de WhatsApp: ${reason}`);
    }
  },

  /** Envía una plantilla aprobada a una conversación de WhatsApp real del proyecto. */
  async send(
    projectId: string,
    conversationId: string,
    input: { name: string; language: string; parameters: TemplateParameters },
    senderName?: string,
  ) {
    if (!ObjectId.isValid(conversationId)) throw new TemplateError(404, 'Conversación no encontrada');
    const conversation = await getConversationsCollection().findOne(
      { _id: new ObjectId(conversationId), projectId: new ObjectId(projectId) },
      { projection: { platform: 1, channelAccount: 1 } },
    );
    if (!conversation) throw new TemplateError(404, 'Conversación no encontrada');
    if (conversation.platform !== 'WhatsApp' || !conversation.channelAccount || !isExternal('WhatsApp')) {
      throw new TemplateError(409, 'Las plantillas solo se envían a conversaciones reales de WhatsApp');
    }

    const templates = await this.list(projectId);
    const template = templates.find(t => t.name === input.name && t.language === input.language);
    if (!template) throw new TemplateError(404, 'La plantilla no existe o no está aprobada');
    if (!template.supported) throw new TemplateError(409, `La plantilla no se puede enviar: ${template.unsupportedReason}`);

    const parameters = { header: input.parameters.header ?? [], body: input.parameters.body ?? [] };
    const invalid = validateParameters(template, parameters);
    if (invalid) throw new TemplateError(400, invalid);

    return chatService.sendMessage(conversationId, renderTemplate(template, parameters), 'human_agent', senderName, {
      template: templateMessage(template, parameters),
    });
  },
};
