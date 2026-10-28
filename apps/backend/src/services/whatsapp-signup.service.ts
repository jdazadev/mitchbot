import { ObjectId } from 'mongodb';
import env from '../config/env';
import { logger } from '../utils/logger';
import { open, seal } from '../utils/secret-box';
import { getChannelCredentialsCollection, type ChannelCredential } from '../models/channel-credential.model';
import { projectService } from './project.service';
import { notifyProject } from './notify.service';
import { isAccountTaken } from '../channels/meta/routing';
import { ChannelError } from '../channels/types';
import { createSignupClient, generatePin, type PhoneInfo, type SignupClient, type SignupPayload } from '../channels/whatsapp/signup';

/** Error con el estado HTTP que debe ver el panel. */
export class SignupError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = 'SignupError';
  }
}

/** Lo que el panel ve de una conexión: nunca el token. */
export interface WhatsAppConnection {
  account: string;
  wabaId: string;
  mode: ChannelCredential['mode'];
  status: ChannelCredential['status'];
  displayPhone?: string;
  verifiedName?: string;
  connectedAt: Date;
}

/** El registro integrado necesita la app de Meta, su configuración y la clave de cifrado. */
export function signupMissing() {
  return [
    !env.META_APP_ID && 'META_APP_ID',
    !env.WHATSAPP_SIGNUP_CONFIG_ID && 'WHATSAPP_SIGNUP_CONFIG_ID',
    !env.WHATSAPP_APP_SECRET && 'WHATSAPP_APP_SECRET',
    !env.CREDENTIALS_KEY && 'CREDENTIALS_KEY',
  ].filter(Boolean) as string[];
}

export const isSignupEnabled = () => signupMissing().length === 0;

const TOKEN_CACHE_MS = 60_000;
const tokens = new Map<string, { at: number; token: string | null }>();

let clientOverride: SignupClient | undefined;
/** Solo para pruebas: sustituye el cliente de la Graph API. */
export function setSignupClientForTests(client: SignupClient | undefined) {
  clientOverride = client;
  tokens.clear();
}

function signupClient() {
  if (clientOverride) return clientOverride;
  return createSignupClient({
    appId: env.META_APP_ID!,
    appSecret: env.WHATSAPP_APP_SECRET!,
    apiUrl: env.WHATSAPP_API_URL,
    apiVersion: env.WHATSAPP_API_VERSION,
  });
}

function toConnection(credential: ChannelCredential): WhatsAppConnection {
  return {
    account: credential.account,
    wabaId: credential.wabaId,
    mode: credential.mode,
    status: credential.status,
    displayPhone: credential.displayPhone,
    verifiedName: credential.verifiedName,
    connectedAt: credential.connectedAt,
  };
}

function metaFailure(step: string, error: unknown): never {
  if (error instanceof SignupError) throw error;
  const reason = error instanceof ChannelError ? error.message : 'Error desconocido';
  throw new SignupError(502, `${step}: ${reason}`);
}

const credentials = () => getChannelCredentialsCollection();

/** Campos con valor: una reconexión no deja `null` donde antes no había nada. */
function definedOnly<T extends Record<string, unknown>>(fields: T) {
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined)) as Partial<T>;
}

/** Campos sin valor en esta conexión: se borran los de la anterior. */
function unsetMissing(fields: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value === undefined).map(([name]) => [name, '' as const]));
}

export const whatsAppSignupService = {
  /** Conexión de WhatsApp del proyecto, o `null` si no la conectó con el registro integrado. */
  async connection(projectId: string) {
    const credential = await credentials().findOne({ projectId: new ObjectId(projectId), channel: 'whatsapp' });
    return credential ? toConnection(credential) : null;
  },

  /**
   * Completa el alta tras la ventana de Meta: canjea el código, suscribe la app a la
   * WABA, registra el número (salvo en coexistencia), guarda el token cifrado y deja
   * el número como cuenta de WhatsApp del proyecto.
   */
  async complete(projectId: string, payload: SignupPayload, userId?: string) {
    if (!isSignupEnabled()) throw new SignupError(503, `El registro integrado no está configurado (faltan ${signupMissing().join(', ')})`);
    if (await isAccountTaken('whatsapp', payload.phoneNumberId, projectId)) {
      throw new SignupError(409, 'Ese número de WhatsApp ya está conectado a otro proyecto');
    }
    const projectKey = new ObjectId(projectId);
    const other = await credentials().findOne({ channel: 'whatsapp', account: payload.phoneNumberId, projectId: { $ne: projectKey } });
    if (other) throw new SignupError(409, 'Ese número de WhatsApp ya está conectado a otro proyecto');

    const meta = signupClient();
    const token = await meta.exchangeCode(payload.code).catch(error => metaFailure('Meta no aceptó el código de conexión', error));
    await meta.subscribeApp(payload.wabaId, token).catch(error => metaFailure('No se pudo suscribir Mitchbot a la cuenta de WhatsApp', error));
    const pin = generatePin();
    if (payload.mode === 'cloud') {
      await meta.registerNumber(payload.phoneNumberId, token, pin).catch(error => metaFailure('No se pudo registrar el número', error));
    }
    const info = await meta.phoneInfo(payload.phoneNumberId, token).catch((error): PhoneInfo => {
      logger.warn(`[WhatsApp] No se pudieron leer los datos del número ${payload.phoneNumberId}: ${error?.message || error}`);
      return {};
    });

    const key = env.CREDENTIALS_KEY!;
    const now = new Date();
    const previous = await credentials().findOne({ projectId: projectKey, channel: 'whatsapp' });
    try {
      await credentials().updateOne(
        { projectId: projectKey, channel: 'whatsapp' },
        {
          $set: definedOnly({
            account: payload.phoneNumberId,
            wabaId: payload.wabaId,
            businessId: payload.businessId,
            token: seal(token, key),
            pin: payload.mode === 'cloud' ? seal(pin, key) : undefined,
            mode: payload.mode,
            status: 'active' as const,
            displayPhone: info.displayPhone,
            verifiedName: info.verifiedName,
            connectedBy: userId && ObjectId.isValid(userId) ? new ObjectId(userId) : undefined,
            connectedAt: now,
            updatedAt: now,
          }),
          $unset: { invalidAt: '', ...unsetMissing({ businessId: payload.businessId, pin: payload.mode === 'cloud' ? pin : undefined, displayPhone: info.displayPhone, verifiedName: info.verifiedName }) },
        },
        { upsert: true },
      );
    } catch (error: any) {
      if (error?.code === 11000) throw new SignupError(409, 'Ese número de WhatsApp ya está conectado a otro proyecto');
      throw error;
    }

    await projectService.update(projectId, {
      config: { whatsapp: { phoneNumberId: payload.phoneNumberId, wabaId: payload.wabaId }, channels: { whatsapp: true } },
    } as any);
    tokens.delete(payload.phoneNumberId);
    if (previous && previous.account !== payload.phoneNumberId) tokens.delete(previous.account);

    const saved = await credentials().findOne({ projectId: projectKey, channel: 'whatsapp' });
    return toConnection(saved!);
  },

  /** Quita la suscripción de la app, borra la credencial y deja el proyecto sin número. */
  async disconnect(projectId: string) {
    const projectKey = new ObjectId(projectId);
    const credential = await credentials().findOne({ projectId: projectKey, channel: 'whatsapp' });
    if (!credential) throw new SignupError(404, 'El proyecto no tiene WhatsApp conectado');

    if (credential.status === 'active' && env.CREDENTIALS_KEY) {
      try {
        await signupClient().unsubscribeApp(credential.wabaId, open(credential.token, env.CREDENTIALS_KEY));
      } catch (error: any) {
        // La baja en Mitchbot no depende de Meta: el cliente puede quitar la app desde su panel.
        logger.warn(`[WhatsApp] No se pudo quitar la suscripción de la WABA ${credential.wabaId}: ${error?.message || error}`);
      }
    }
    await credentials().deleteOne({ _id: credential._id });
    tokens.delete(credential.account);

    const project = await projectService.findById(projectId);
    if (project?.config?.whatsapp?.phoneNumberId === credential.account) {
      await projectService.update(projectId, { config: { whatsapp: { phoneNumberId: null, wabaId: null } } } as any);
    }
  },

  /**
   * Token para enviar desde un número: el de su conexión si la tiene (o `null` si está
   * inválida) y, si no, el del entorno.
   */
  async tokenFor(account: string): Promise<string | null> {
    const cached = tokens.get(account);
    if (cached && Date.now() - cached.at < TOKEN_CACHE_MS) return cached.token;

    const credential = await credentials().findOne({ channel: 'whatsapp', account }, { projection: { token: 1, status: 1 } });
    let token: string | null = env.WHATSAPP_TOKEN || null;
    if (credential) {
      token = credential.status === 'active' && env.CREDENTIALS_KEY ? open(credential.token, env.CREDENTIALS_KEY) : null;
    }
    tokens.set(account, { at: Date.now(), token });
    return token;
  },

  /** Token de la conexión del proyecto, o el del entorno si no tiene. */
  async tokenForProject(projectId: string): Promise<string | null> {
    const credential = await credentials().findOne(
      { projectId: new ObjectId(projectId), channel: 'whatsapp' },
      { projection: { account: 1 } },
    );
    return credential ? this.tokenFor(credential.account) : env.WHATSAPP_TOKEN || null;
  },

  /** Meta rechazó el token de un número: la conexión queda inválida y el equipo recibe un aviso. */
  async markInvalid(account: string) {
    const result = await credentials().findOneAndUpdate(
      { channel: 'whatsapp', account, status: 'active' },
      { $set: { status: 'invalid', invalidAt: new Date(), updatedAt: new Date() } },
      { returnDocument: 'after' },
    );
    tokens.delete(account);
    if (!result) return;
    notifyProject(result.projectId.toString(), {
      kind: 'channel',
      level: 'error',
      message: `Meta rechazó la conexión de WhatsApp${result.displayPhone ? ` de ${result.displayPhone}` : ''}. Vuelve a conectarla en Configuración → Canales.`,
    });
  },
};
