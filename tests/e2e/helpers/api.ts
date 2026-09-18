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
  return res.json();
}

export async function sendPublicMessage(
  api: APIRequestContext,
  slug: string,
  conversationId: string,
  content: string
) {
  const res = await api.post(`public/test-chat/${slug}/${conversationId}/messages`, {
    data: { content },
  });
  if (!res.ok()) throw new Error(`sendPublicMessage falló (${res.status()}): ${await res.text()}`);
  return res.json();
}

export async function sendHumanMessage(api: APIRequestContext, conversationId: string, content: string) {
  const res = await api.post(`conversations/${conversationId}/messages`, {
    data: { content, sender: 'human_agent' },
  });
  if (!res.ok()) throw new Error(`sendHumanMessage falló (${res.status()}): ${await res.text()}`);
  return res.json();
}

export async function listConversations(api: APIRequestContext) {
  const res = await api.get('conversations');
  if (!res.ok()) throw new Error(`listConversations falló (${res.status()})`);
  return res.json();
}

export async function getConversationMessages(api: APIRequestContext, conversationId: string) {
  const res = await api.get(`conversations/${conversationId}/messages`);
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
