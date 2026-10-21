import fs from 'node:fs';
import type { APIRequestContext, Playwright } from '@playwright/test';
import { E2E } from './config';

export interface StoredAuth {
  token?: string;
  projectId?: string;
  user?: any;
}

/** Lee el token/proyecto desde el storageState generado por el setup. */
export function loadStoredAuth(): StoredAuth {
  if (!fs.existsSync(E2E.storageState)) return {};
  const raw = JSON.parse(fs.readFileSync(E2E.storageState, 'utf8'));
  const origin = (raw.origins || []).find((o: any) => String(o.origin).startsWith(E2E.frontendUrl));
  const entries: Record<string, string> = {};
  for (const item of origin?.localStorage || []) entries[item.name] = item.value;

  let user: any;
  try {
    user = entries.mitchbot_user ? JSON.parse(entries.mitchbot_user) : undefined;
  } catch {
    user = undefined;
  }

  return {
    token: entries.mitchbot_token,
    projectId: entries.mitchbot_active_project || user?.activeProjectId,
    user,
  };
}

/**
 * Contexto de API autenticado como el usuario e2e.
 * Nota: `baseURL` termina en `/api/` y las rutas se pasan sin `/` inicial para
 * que la resolución de URLs de Playwright conserve el prefijo `/api/`.
 */
export function authedContext(playwright: Playwright): Promise<APIRequestContext> {
  const auth = loadStoredAuth();
  return playwright.request.newContext({
    baseURL: `${E2E.backendUrl}/api/`,
    extraHTTPHeaders: {
      ...(auth.token ? { Authorization: `Bearer ${auth.token}` } : {}),
      ...(auth.projectId ? { 'X-Project-Id': auth.projectId } : {}),
    },
  });
}

/** Contexto de API sin autenticación. */
export function publicContext(playwright: Playwright): Promise<APIRequestContext> {
  return playwright.request.newContext({ baseURL: `${E2E.backendUrl}/api/` });
}

// =================== Helpers de negocio ===================

/** Tokens de las conversaciones públicas iniciadas en este worker (los exige el envío). */
const clientTokens = new Map<string, string>();

export const clientTokenOf = (conversationId: string) => clientTokens.get(conversationId);

export async function startPublicConversation(
  api: APIRequestContext,
  body: {
    slug: string;
    platform?: 'WhatsApp' | 'Instagram' | 'Web';
    clientName?: string;
    clientPhone?: string;
    clientEmail?: string;
    clientIdentifier: string;
    initialMessage: string;
  }
) {
  const res = await api.post(`public/test-chat/${body.slug}/start`, {
    data: {
      platform: body.platform || 'Web',
      clientName: body.clientName,
      clientPhone: body.clientPhone,
      clientEmail: body.clientEmail,
      clientIdentifier: body.clientIdentifier,
      initialMessage: body.initialMessage,
    },
  });
  if (!res.ok()) throw new Error(`startPublicConversation falló (${res.status()}): ${await res.text()}`);
  const result = await res.json();
  if (result.conversation?._id && result.clientToken) clientTokens.set(result.conversation._id, result.clientToken);
  return result;
}

export async function sendPublicMessage(
  api: APIRequestContext,
  slug: string,
  conversationId: string,
  content: string
) {
  const res = await api.post(`public/test-chat/${slug}/${conversationId}/messages`, {
    data: { content, clientToken: clientTokenOf(conversationId) },
  });
  if (!res.ok()) throw new Error(`sendPublicMessage falló (${res.status()}): ${await res.text()}`);
  return res.json();
}

export async function sendHumanMessage(
  api: APIRequestContext,
  conversationId: string,
  content: string,
  projectId?: string
) {
  const res = await api.post(`conversations/${conversationId}/messages`, {
    data: { content, sender: 'human_agent' },
    ...(projectId ? { headers: { 'X-Project-Id': projectId } } : {}),
  });
  if (!res.ok()) throw new Error(`sendHumanMessage falló (${res.status()}): ${await res.text()}`);
  return res.json();
}

/** Lista los proyectos del usuario autenticado. */
export async function listProjects(api: APIRequestContext): Promise<any[]> {
  const res = await api.get('project/list');
  if (!res.ok()) throw new Error(`listProjects falló (${res.status()})`);
  return res.json();
}

/** Obtiene un proyecto por slug (de la lista del usuario). */
export async function getProjectBySlug(api: APIRequestContext, slug: string): Promise<any> {
  const projects = await listProjects(api);
  const project = projects.find((p: any) => p.slug === slug);
  if (!project) throw new Error(`Proyecto con slug "${slug}" no encontrado`);
  return project;
}

/** Detalle de una conversación (con header de proyecto opcional). */
export async function getConversation(api: APIRequestContext, conversationId: string, projectId?: string) {
  const res = await api.get(`conversations/${conversationId}`, {
    ...(projectId ? { headers: { 'X-Project-Id': projectId } } : {}),
  });
  if (!res.ok()) throw new Error(`getConversation falló (${res.status()})`);
  return res.json();
}

/** Guarda al cliente como contacto (idempotente). */
export async function createConversationContact(api: APIRequestContext, conversationId: string, projectId?: string) {
  const res = await api.post(`conversations/${conversationId}/contact`, {
    ...(projectId ? { headers: { 'X-Project-Id': projectId } } : {}),
  });
  if (!res.ok()) throw new Error(`createConversationContact falló (${res.status()}): ${await res.text()}`);
  return res.json();
}

/** Cambia el modo de la conversación. */
export async function updateConversationMode(
  api: APIRequestContext,
  conversationId: string,
  mode: 'auto_pilot' | 'human_takeover',
  projectId?: string
) {
  const res = await api.put(`conversations/${conversationId}/mode`, {
    data: { mode },
    ...(projectId ? { headers: { 'X-Project-Id': projectId } } : {}),
  });
  if (!res.ok()) throw new Error(`updateConversationMode falló (${res.status()})`);
  return res.json();
}

/** Lee los insights almacenados (puede ser null). */
export async function getInsights(api: APIRequestContext, conversationId: string) {
  const res = await api.get(`conversations/${conversationId}/insights`);
  if (!res.ok()) throw new Error(`getInsights falló (${res.status()})`);
  return res.json();
}

/** Fuerza el recálculo de insights. */
export async function analyzeInsights(api: APIRequestContext, conversationId: string) {
  const res = await api.post(`conversations/${conversationId}/insights`);
  if (!res.ok()) throw new Error(`analyzeInsights falló (${res.status()}): ${await res.text()}`);
  return res.json();
}

/** Busca contactos por término (opcionalmente en otro proyecto). */
export async function listContacts(api: APIRequestContext, search: string, projectId?: string) {
  const res = await api.get(`contacts`, {
    params: { q: search, limit: 50 },
    ...(projectId ? { headers: { 'X-Project-Id': projectId } } : {}),
  });
  if (!res.ok()) throw new Error(`listContacts falló (${res.status()})`);
  return res.json();
}

export async function listConversations(api: APIRequestContext) {
  const res = await api.get('conversations');
  if (!res.ok()) throw new Error(`listConversations falló (${res.status()})`);
  return res.json();
}

export async function listActivities(api: APIRequestContext, projectId?: string) {
  const res = await api.get('dashboard/activities', {
    ...(projectId ? { headers: { 'X-Project-Id': projectId } } : {}),
  });
  if (!res.ok()) throw new Error(`listActivities falló (${res.status()})`);
  return res.json();
}

export async function getConversationMessages(api: APIRequestContext, conversationId: string, projectId?: string) {
  const res = await api.get(`conversations/${conversationId}/messages`, {
    ...(projectId ? { headers: { 'X-Project-Id': projectId } } : {}),
  });
  if (!res.ok()) throw new Error(`getConversationMessages falló (${res.status()})`);
  return res.json();
}

export async function getActiveProject(api: APIRequestContext) {
  const res = await api.get('project');
  if (!res.ok()) throw new Error(`getActiveProject falló (${res.status()})`);
  return res.json();
}

export async function createUser(
  api: APIRequestContext,
  data: { name: string; email: string; password: string; role?: string; projectIds?: string[] }
) {
  const res = await api.post('users', { data });
  if (!res.ok()) throw new Error(`createUser falló (${res.status()}): ${await res.text()}`);
  return res.json();
}

export async function updateUser(api: APIRequestContext, id: string, data: Record<string, any>) {
  const res = await api.put(`users/${id}`, { data });
  if (!res.ok()) throw new Error(`updateUser falló (${res.status()}): ${await res.text()}`);
  return res.json();
}

// =================== Stub de IA ===================

export async function resetStub(api: APIRequestContext) {
  await api.post(`${E2E.stubUrl}/__reset`);
}

export async function getStubStats(api: APIRequestContext): Promise<{
  chatCompletions: number;
  embeddings: number;
  models: number;
  requests: any[];
}> {
  const res = await api.get(`${E2E.stubUrl}/__stats`);
  return res.json();
}

/** Espera (polling) a que el stub reciba al menos `count` chat completions. */
export async function waitForStubChatCalls(
  api: APIRequestContext,
  count: number,
  timeoutMs = 20_000
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const stats = await getStubStats(api);
    if (stats.chatCompletions >= count) return;
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`El stub no recibió ${count} chat completion(s) en ${timeoutMs}ms`);
}
