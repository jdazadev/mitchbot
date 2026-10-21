import fs from 'node:fs';
import { test, expect } from '../fixtures';
import type { APIRequestContext } from '@playwright/test';
import { createProjectOwner, signIn, type ProjectOwner } from '../helpers/owner';
import { uniqueEmail, uniqueId } from '../helpers/data';

const BOM = '﻿';

/** Propietario con dos conversaciones: una Web (con una fórmula) y una de WhatsApp del simulador. */
async function ownerWithConversations(api: APIRequestContext, publicApi: APIRequestContext) {
  const owner = await createProjectOwner(api, 'export-owner');
  const project = await (await api.get('project', { headers: owner.headers })).json();
  const start = async (platform: 'Web' | 'WhatsApp', clientName: string, initialMessage: string) => {
    const res = await publicApi.post(`public/test-chat/${project.slug}/start`, {
      data: { platform, clientName, clientIdentifier: `${platform}-${uniqueId()}`, initialMessage },
    });
    expect(res.ok()).toBeTruthy();
    return (await res.json()).conversation._id as string;
  };
  const web = await start('Web', 'Lucía Export', '=HYPERLINK("http://malo")');
  const whatsapp = await start('WhatsApp', 'Mateo Export', 'Hola desde WhatsApp');
  // Respuesta del operador en la conversación Web.
  const reply = await api.post(`conversations/${web}/messages`, {
    headers: owner.headers,
    data: { content: 'Respuesta, con coma', sender: 'human_agent' },
  });
  expect(reply.ok()).toBeTruthy();
  return { owner, project, web, whatsapp };
}

const exportUrl = (query: string) => `conversations/export?${query}`;

async function userWithRole(api: APIRequestContext, owner: ProjectOwner, role: 'assistant' | 'support') {
  const email = uniqueEmail(`export-${role}`);
  const password = `${role}-12345`;
  const created = await api.post('users', { data: { name: `Rol ${role}`, email, password, role } });
  expect(created.status()).toBe(201);
  const { _id } = await created.json();
  expect((await api.put(`users/${_id}`, { data: { projectIds: [owner.projectId] } })).ok()).toBeTruthy();
  const login = await api.post('auth/login', { data: { email, password } });
  const { token } = await login.json();
  return { email, password, headers: { Authorization: `Bearer ${token}`, 'X-Project-Id': owner.projectId } };
}

test.describe('Exportación de conversaciones', () => {
  test('el CSV en bloque trae los mensajes del proyecto, seguro para hojas de cálculo', async ({ api, publicApi }) => {
    const { owner, project } = await ownerWithConversations(api, publicApi);

    const res = await api.get(exportUrl('format=csv&days=7'), { headers: owner.headers });
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('text/csv');
    expect(res.headers()['content-disposition']).toContain(`mitchbot-conversaciones-${project.slug}-`);
    const csv = await res.text();
    expect(csv.startsWith(BOM)).toBe(true);
    const lines = csv.slice(1).trimEnd().split('\r\n');
    expect(lines[0]).toBe('conversation_id,platform,client_name,client_identifier,client_phone,client_email,conversation_status,message_id,sent_at,sender,sender_name,type,content,delivery_status');
    expect(csv).toContain(`"'=HYPERLINK(""http://malo"")"`);
    expect(csv).toContain('"Respuesta, con coma"');
    expect(csv).toContain('Hola desde WhatsApp');
    expect(csv).toContain('Lucía Export');

    const onlyWhatsApp = await (await api.get(exportUrl('format=csv&days=7&platform=WhatsApp'), { headers: owner.headers })).text();
    expect(onlyWhatsApp).toContain('Hola desde WhatsApp');
    expect(onlyWhatsApp).not.toContain('Lucía Export');
  });

  test('el JSON individual trae el historial y no sirve conversaciones ajenas', async ({ api, publicApi }) => {
    const { owner, web } = await ownerWithConversations(api, publicApi);
    const res = await api.get(`conversations/${web}/export?format=json`, { headers: owner.headers });
    expect(res.status()).toBe(200);
    expect(res.headers()['content-disposition']).toContain('mitchbot-conversacion-lucia-export-');
    const data = await res.json();
    expect(data.range).toBeNull();
    expect(data.conversations).toHaveLength(1);
    const contents = data.conversations[0].messages.map((m: any) => m.content);
    expect(contents[0]).toBe('=HYPERLINK("http://malo")');
    expect(contents).toContain('Respuesta, con coma');

    const rival = await createProjectOwner(api, 'export-rival');
    expect((await api.get(`conversations/${web}/export?format=json`, { headers: rival.headers })).status()).toBe(404);
  });

  test('valida formato y rango, y solo deja exportar a admin y support', async ({ api, publicApi }) => {
    const { owner } = await ownerWithConversations(api, publicApi);
    expect((await api.get(exportUrl('format=xlsx'), { headers: owner.headers })).status()).toBe(400);
    const tooLong = await api.get(exportUrl('from=2024-01-01&to=2026-01-01'), { headers: owner.headers });
    expect(tooLong.status()).toBe(400);
    expect((await tooLong.json()).error).toContain('366');
    expect((await api.get(exportUrl('from=2026-10-10&to=2026-10-01'), { headers: owner.headers })).status()).toBe(400);
    expect((await api.get(exportUrl('platform=Fax'), { headers: owner.headers })).status()).toBe(400);

    const assistant = await userWithRole(api, owner, 'assistant');
    expect((await api.get(exportUrl('format=csv'), { headers: assistant.headers })).status()).toBe(403);
    const support = await userWithRole(api, owner, 'support');
    expect((await api.get(exportUrl('format=csv'), { headers: support.headers })).status()).toBe(200);
  });

  test('cada exportación queda en la actividad del proyecto', async ({ api, publicApi }) => {
    const { owner } = await ownerWithConversations(api, publicApi);
    await api.get(exportUrl('format=json&days=7'), { headers: owner.headers });
    await expect.poll(async () => {
      const activities = await (await api.get('dashboard/activities', { headers: owner.headers })).json();
      return activities.find((a: any) => a.type === 'conversations_exported')?.detail;
    }).toMatch(/^Owner export-owner exportó \d+ mensajes \(JSON\)$/);
  });

  test('desde el hilo se descarga la conversación abierta', async ({ api, publicApi, browser }) => {
    const { owner } = await ownerWithConversations(api, publicApi);
    const { context, page } = await signIn(browser, owner);
    await page.goto('/messaging');
    await expect(page.getByText('Cargando conversaciones...')).toHaveCount(0, { timeout: 20_000 });
    await page.getByText('Lucía Export').first().click();

    await page.getByTestId('export-conversation').click();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('menuitem', { name: 'CSV (hoja de cálculo)' }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^mitchbot-conversacion-lucia-export-\d{4}-\d{2}-\d{2}\.csv$/);
    const csv = fs.readFileSync((await download.path())!, 'utf8');
    expect(csv).toContain('Respuesta, con coma');
    expect(csv).not.toContain('Hola desde WhatsApp');
    await context.close();
  });

  test('desde la bandeja se exporta en bloque eligiendo periodo, canal y formato', async ({ api, publicApi, browser }) => {
    const { owner } = await ownerWithConversations(api, publicApi);
    await api.put('project', { headers: owner.headers, data: { config: { channels: { whatsapp: true, instagram: false, web: true } } } });
    const { context, page } = await signIn(browser, owner);
    await page.goto('/messaging');

    await page.getByTestId('export-conversations').click();
    const dialog = page.getByRole('dialog', { name: 'Exportar conversaciones' });
    await dialog.getByRole('button', { name: 'Últimos 7 días' }).click();
    await dialog.getByRole('button', { name: 'WhatsApp' }).click();
    await dialog.getByRole('button', { name: 'JSON' }).click();
    const [download] = await Promise.all([page.waitForEvent('download'), dialog.getByRole('button', { name: 'Descargar' }).click()]);

    expect(download.suggestedFilename()).toMatch(/^mitchbot-conversaciones-.*\.json$/);
    const data = JSON.parse(fs.readFileSync((await download.path())!, 'utf8'));
    expect(data.conversations.map((c: any) => c.client.name)).toEqual(['Mateo Export']);
    await expect(dialog).toHaveCount(0);
    await context.close();
  });

  test('un asistente no ve las acciones de exportación', async ({ api, publicApi, browser }) => {
    const { owner } = await ownerWithConversations(api, publicApi);
    const assistant = await userWithRole(api, owner, 'assistant');
    const { context, page } = await signIn(browser, assistant);
    await page.goto('/messaging');
    await expect(page.getByText('Cargando conversaciones...')).toHaveCount(0, { timeout: 20_000 });
    await page.getByText('Lucía Export').first().click();
    await expect(page.getByPlaceholder('Escribe un mensaje...')).toBeVisible();
    await expect(page.getByTestId('export-conversations')).toHaveCount(0);
    await expect(page.getByTestId('export-conversation')).toHaveCount(0);
    await context.close();
  });
});
