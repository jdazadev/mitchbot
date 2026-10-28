import { defineConfig, devices } from '@playwright/test';
import { E2E } from './tests/e2e/helpers/config';

/**
 * Configuración Playwright — suite e2e de MitchBot v2.
 *
 * Prerrequisitos (ver tests/e2e/README.md):
 *   - Servicios Docker: MongoDB, Redis, Qdrant (`docker compose up -d`).
 *   - Playwright no necesita que backend/frontend estén levantados: los arranca
 *     en puertos dedicados (3100 / 5174) y un stub de IA en 4010.
 */
export default defineConfig({
  testDir: './tests/e2e',
  /* Ejecuta los archivos de prueba en paralelo. */
  fullyParallel: true,
  /* Falla si queda un test.only en el código. */
  forbidOnly: !!process.env.CI,
  /* Reintentos sólo en CI. */
  retries: process.env.CI ? 2 : 0,
  /* Workers: 1 en CI para estabilidad; por defecto en local. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporte legible (HTML) + lista en consola. */
  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],

  /* Chequeo de prerrequisitos + seed de datos e2e antes de la suite. */
  globalSetup: './tests/e2e/global-setup.ts',

  /* Tiempo máximo por prueba (streaming/websocket incluido). */
  timeout: 60_000,
  expect: { timeout: 15_000 },

  use: {
    baseURL: E2E.frontendUrl,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    /* 1. Autenticación reutilizable: genera storageState. */
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },

    /* 2. Suite autenticada (Chromium por defecto). */
    {
      name: 'chromium',
      dependencies: ['setup'],
      testIgnore: [/auth\.setup\.ts/, /auth\.spec\.ts/, /onboarding\.spec\.ts/, /public-chat\.spec\.ts/],
      use: {
        ...devices['Desktop Chrome'],
        storageState: E2E.storageState,
      },
    },

    /* 3. Suite sin sesión: login, registro y chat público. */
    {
      name: 'chromium-public',
      dependencies: ['setup'],
      testMatch: [/auth\.spec\.ts/, /onboarding\.spec\.ts/, /public-chat\.spec\.ts/],
      use: {
        ...devices['Desktop Chrome'],
        storageState: { cookies: [], origins: [] },
      },
    },
  ],

  /* Servidores del entorno e2e (puertos dedicados). */
  webServer: [
    {
      command: 'node tests/stub/openai-stub.mjs',
      url: `${E2E.stubUrl}/healthz`,
      reuseExistingServer: true,
      timeout: 30_000,
      env: {
        STUB_PORT: String(E2E.ports.stub),
        STUB_MODEL: E2E.stub.model,
        STUB_EMBED_MODEL: E2E.stub.embedModel,
        STUB_REPLY: E2E.stub.reply,
        STUB_META_TOKEN: E2E.whatsapp.token,
        STUB_META_APP_ID: E2E.whatsapp.appId,
        STUB_META_APP_SECRET: E2E.whatsapp.appSecret,
        STUB_IG_TOKEN: E2E.instagram.token,
      },
    },
    {
      command: 'pnpm --filter @mitchbot/backend dev',
      url: `${E2E.backendUrl}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        ...process.env,
        PORT: String(E2E.ports.backend),
        NODE_ENV: 'development',
        MONGODB_URI: E2E.mongoUri,
        REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
        QDRANT_URL: process.env.QDRANT_URL || 'http://localhost:6333',
        OPENROUTER_API_KEY: E2E.stub.apiKey,
        OPENROUTER_BASE_URL: `${E2E.stubUrl}/v1`,
        OPENROUTER_LLM_MODEL: E2E.stub.model,
        OPENROUTER_INSIGHTS_MODEL: E2E.stub.insightsModel,
        OPENROUTER_EMBEDDING_MODEL: E2E.stub.embedModel,
        DASHBOARD_RESPONSE_CONVERSATION_LIMIT: '1',
        DASHBOARD_RESPONSE_TIMEOUT_MS: '5000',
        // Colas de canales propias: no se cruzan con un backend de desarrollo en el mismo Redis.
        CHANNEL_QUEUE_PREFIX: 'e2e',
        // WhatsApp real contra la Graph API simulada del stub.
        WHATSAPP_TOKEN: E2E.whatsapp.token,
        WHATSAPP_APP_SECRET: E2E.whatsapp.appSecret,
        WHATSAPP_VERIFY_TOKEN: E2E.whatsapp.verifyToken,
        WHATSAPP_API_URL: `${E2E.stubUrl}/meta`,
        WHATSAPP_API_VERSION: 'v21.0',
        META_APP_ID: E2E.whatsapp.appId,
        WHATSAPP_SIGNUP_CONFIG_ID: E2E.whatsapp.signupConfigId,
        CREDENTIALS_KEY: E2E.whatsapp.credentialsKey,
        INSTAGRAM_TOKEN: E2E.instagram.token,
        INSTAGRAM_APP_SECRET: E2E.instagram.appSecret,
        INSTAGRAM_VERIFY_TOKEN: E2E.instagram.verifyToken,
        INSTAGRAM_API_URL: `${E2E.stubUrl}/meta`,
        INSTAGRAM_API_VERSION: 'v21.0',
        // Push: claves de prueba y proveedor simulado en el stub (por HTTP).
        VAPID_PUBLIC_KEY: E2E.push.publicKey,
        VAPID_PRIVATE_KEY: E2E.push.privateKey,
        VAPID_SUBJECT: 'mailto:e2e@mitchbot.test',
        PUSH_ALLOWED_HOSTS: `localhost:${E2E.ports.stub}`,
        FRONTEND_URL: E2E.frontendUrl,
      },
    },
    {
      command: `pnpm --filter @mitchbot/frontend exec vite --port ${E2E.ports.frontend} --strictPort`,
      url: E2E.frontendUrl,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        ...process.env,
        VITE_API_URL: `${E2E.backendUrl}/api`,
      },
    },
  ],
});
