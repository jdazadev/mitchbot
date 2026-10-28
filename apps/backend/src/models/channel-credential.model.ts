import { ObjectId } from 'mongodb';
import { getDatabase } from '../config/database';

/** `cloud`: número registrado en la Cloud API. `coexistence`: número de la app WhatsApp Business. */
export type WhatsAppConnectionMode = 'cloud' | 'coexistence';

/**
 * Credencial de un canal conectado con el registro integrado de Meta. Vive fuera de
 * `project.config` para que nunca salga en las respuestas del proyecto; el token y el
 * PIN van cifrados con `CREDENTIALS_KEY`.
 */
export interface ChannelCredential {
  _id?: ObjectId;
  projectId: ObjectId;
  channel: 'whatsapp';
  account: string;
  wabaId: string;
  businessId?: string;
  token: string;
  pin?: string;
  mode: WhatsAppConnectionMode;
  status: 'active' | 'invalid';
  displayPhone?: string;
  verifiedName?: string;
  connectedBy?: ObjectId;
  connectedAt: Date;
  updatedAt: Date;
  invalidAt?: Date;
}

export const getChannelCredentialsCollection = () => getDatabase().collection<ChannelCredential>('channel_credentials');
