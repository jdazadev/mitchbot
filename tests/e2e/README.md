# Pruebas e2e (Playwright)

Suite end-to-end de MitchBot v2. Corre contra un entorno dedicado: **backend en
el puerto 3100**, **frontend en el 5174**, **stub de IA en el 4010** y la base de
datos **`mitchbot_e2e`**. No toca los servidores de desarrollo (3000/5173) ni la
base de datos real.

## Prerrequisitos

1. **Servicios Docker** (MongoDB, Redis, Qdrant):
   ```bash
   docker compose up -d
   ```
2. **Navegador de Playwright** instalado (solo la primera vez):
   ```bash
   pnpm exec playwright install chromium
   ```

Playwright arranca automáticamente el stub, el backend y el frontend en los
puertos dedicados, y ejecuta el seed e2e. Si faltan los servicios Docker o los
servidores no responden, la suite falla con un mensaje claro indicando qué falta.

## Comandos

```bash
# Suite completa
pnpm test:e2e

# Un módulo (filtra por nombre de archivo / título)
pnpm test:e2e messaging
pnpm test:e2e contacts
pnpm test:e2e realtime

# Modo UI interactivo
pnpm test:e2e:ui

# Con navegador visible
pnpm test:e2e:headed

# Corrida tipo CI (headless, lista)
pnpm test:e2e:ci

# Ver el reporte HTML de la última corrida
pnpm test:e2e:report

# Utilidades
pnpm stub:e2e   # levanta solo el stub de IA (puerto 4010)
pnpm seed:e2e   # siembra usuario/proyecto/agente/proveedores e2e
```

## Determinismo del proveedor de IA

El backend apunta a un **stub local compatible con la API de OpenAI**
(`tests/stub/openai-stub.mjs`) mediante `OPENROUTER_BASE_URL`, y usa una API key
de prueba. El stub:

- devuelve una respuesta de texto fija (`Respuesta determinista de prueba E2E.`);
- emite un `tool_call` de `create_appointment` cuando el mensaje del cliente
  contiene `AGENDAR_CITA`;
- genera embeddings deterministas (dimensión 1536);
- registra las peticiones en `/__stats` (usado por la prueba de guardia).

La prueba `provider-guard.spec.ts` verifica que no haya tráfico al proveedor real.

## Estructura

```
tests/
├── stub/openai-stub.mjs          # stub de la API OpenAI
└── e2e/
    ├── auth.setup.ts             # login único → storageState
    ├── global-setup.ts           # chequeo Docker + seed e2e
    ├── fixtures.ts               # fixtures test (api autenticada / pública)
    ├── helpers/                  # config, api, datos únicos, prerrequisitos
    └── specs/                    # specs por módulo
```

## Notas

- La autenticación se reutiliza vía `storageState` (`tests/e2e/.auth/user.json`,
  ignorado por git). El proyecto `setup` hace login una sola vez.
- Los specs públicos (login, onboarding, chat público) corren sin sesión en el
  proyecto `chromium-public`.
- Los datos de cada prueba usan identificadores únicos, por lo que pueden
  ejecutarse en paralelo sin colisionar.
