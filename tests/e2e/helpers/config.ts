import path from 'node:path';

/**
 * Configuración compartida del entorno e2e.
 *
 * La suite usa puertos y base de datos dedicados para no interferir con los
 * servidores de desarrollo del usuario (3000 / 5173) ni con datos reales.
 */
export const E2E = {
  frontendUrl: process.env.E2E_FRONTEND_URL || 'http://localhost:5174',
  backendUrl: process.env.E2E_BACKEND_URL || 'http://localhost:3100',
  stubUrl: process.env.E2E_STUB_URL || 'http://localhost:4010',
  mongoUri: process.env.E2E_MONGODB_URI || 'mongodb://localhost:27017/mitchbot_e2e',

  ports: {
    frontend: Number(process.env.E2E_FRONTEND_PORT || 5174),
    backend: Number(process.env.E2E_BACKEND_PORT || 3100),
    stub: Number(process.env.E2E_STUB_PORT || 4010),
  },

  user: {
    name: 'E2E User',
    email: 'e2e@mitchbot.test',
    password: 'e2e12345',
  },

  project: {
    name: 'E2E Project',
    slug: 'e2e-project',
  },

  stub: {
    apiKey: 'e2e-stub-key',
    model: 'stub-model',
    embedModel: 'stub-embed',
    reply: 'Respuesta determinista de prueba E2E.',
  },

  /** Ruta del storageState generado por el project de setup. */
  storageState: path.resolve(__dirname, '../.auth/user.json'),
  authDir: path.resolve(__dirname, '../.auth'),
} as const;

export type E2EConfig = typeof E2E;
