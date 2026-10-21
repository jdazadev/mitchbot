import { expect, type APIRequestContext, type Browser } from '@playwright/test';
import { uniqueEmail, uniqueName } from './data';

export interface ProjectOwner {
  email: string;
  password: string;
  projectId: string;
  /** Cabeceras de API como el propietario, sobre su proyecto. */
  headers: Record<string, string>;
}

/**
 * Usuario admin con un proyecto propio, para pruebas que cambian la
 * configuración del proyecto y no deben tocar el proyecto e2e compartido.
 */
export async function createProjectOwner(api: APIRequestContext, label: string): Promise<ProjectOwner> {
  const email = uniqueEmail(label);
  const password = `${label}-123`;
  const created = await api.post('users', { data: { name: `Owner ${label}`, email, password, role: 'admin' } });
  expect(created.ok()).toBeTruthy();
  const login = await api.post('auth/login', { data: { email, password } });
  const { token } = await login.json();
  const headers = { Authorization: `Bearer ${token}`, 'X-Project-Id': '' };
  const project = await api.post('project', {
    headers,
    data: { name: uniqueName(label), agent: { name: `Agente ${label}` } },
  });
  expect(project.status()).toBe(201);
  const projectId = (await project.json()).project._id as string;
  return { email, password, projectId, headers: { ...headers, 'X-Project-Id': projectId } };
}

/** Sesión de navegador nueva como el propietario. */
export async function signIn(browser: Browser, owner: { email: string; password: string }) {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  await page.goto('/login');
  await page.getByPlaceholder('tu@email.com').fill(owner.email);
  await page.getByPlaceholder('••••••••').fill(owner.password);
  await page.getByRole('button', { name: /Iniciar Sesión/ }).click();
  await page.waitForURL((url: URL) => url.pathname === '/');
  return { context, page };
}
