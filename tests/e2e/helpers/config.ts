import path from 'node:path';

/**
 * Configuración compartida del entorno e2e.
 *
 * La suite usa puertos y base de datos dedicados para no interferir con los
 * servidores de desarrollo del usuario (3000 / 5173) ni con datos reales.
 */
const ports = {
  frontend: Number(process.env.E2E_FRONTEND_PORT || 5174),
  backend: Number(process.env.E2E_BACKEND_PORT || 3100),
  stub: Number(process.env.E2E_STUB_PORT || 4010),
};

export const E2E = {
  frontendUrl: process.env.E2E_FRONTEND_URL || `http://localhost:${ports.frontend}`,
  backendUrl: process.env.E2E_BACKEND_URL || `http://localhost:${ports.backend}`,
  stubUrl: process.env.E2E_STUB_URL || `http://localhost:${ports.stub}`,
  mongoUri: process.env.E2E_MONGODB_URI || 'mongodb://localhost:27017/mitchbot_e2e',

  ports,

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
    insightsModel: 'stub-insights',
    embedModel: 'stub-embed',
    reply: 'Respuesta determinista de prueba E2E.',
  },

  /** Credenciales de WhatsApp del backend e2e; la Graph API es el stub (`/meta`). */
  whatsapp: {
    token: 'e2e-wa-token',
    appSecret: 'e2e-wa-secret',
    verifyToken: 'e2e-wa-verify',
    /** Registro integrado (Embedded Signup): app y configuración de Meta simuladas, y clave fija de prueba. */
    appId: '100200300',
    signupConfigId: '400500600',
    credentialsKey: Buffer.alloc(32, 9).toString('base64'),
  },

  /** Credenciales de Instagram del backend e2e; la Graph API también es el stub (`/meta`). */
  instagram: {
    token: 'e2e-ig-token',
    appSecret: 'e2e-ig-secret',
    verifyToken: 'e2e-ig-verify',
  },

  /**
   * Claves VAPID fijas (solo para pruebas): el backend firma con ellas y el
   * proveedor de push simulado del stub recibe los envíos.
   */
  push: {
    publicKey: 'BCUqZ3jcRMGD-_J7-B8p7GpBc0qNfyF0DBuyKk2S6D8W8iWKNOzZR826hjG4S0Kr0vsUhMiBPR9bzbS5Z-xHf4o',
    privateKey: 'He3cNn1Rvua9vmas2kjgzZaiZb2lm1TE6QVIY1hykmo',
  },

  projectNoContact: {
    name: 'E2E NoContact',
    slug: 'e2e-nocontact',
  },

  /** Ruta del storageState generado por el project de setup. */
  storageState: path.resolve(__dirname, '../.auth/user.json'),
  authDir: path.resolve(__dirname, '../.auth'),
} as const;

export type E2EConfig = typeof E2E;
