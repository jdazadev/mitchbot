import { E2E } from './config';

/**
 * Verifica que el backend y el stub de IA estén accesibles y, si no, falla con
 * un mensaje claro sobre los prerrequisitos. Se invoca desde el project de
 * setup (tras arrancar los webServers de Playwright) y desde los specs públicos.
 */
export async function assertE2EServers(): Promise<void> {
  const checks: { name: string; url: string; hint: string }[] = [
    {
      name: 'Backend',
      url: `${E2E.backendUrl}/health`,
      hint: 'Se arranca automáticamente con `pnpm test:e2e` (puerto 3100).',
    },
    {
      name: 'Stub de IA',
      url: `${E2E.stubUrl}/healthz`,
      hint: 'Se arranca automáticamente con `pnpm test:e2e` (puerto 4010).',
    },
  ];

  const failures: string[] = [];

  for (const check of checks) {
    let ok = false;
    let lastError = '';
    for (let attempt = 1; attempt <= 10 && !ok; attempt += 1) {
      try {
        const res = await fetch(check.url, { signal: AbortSignal.timeout(2000) });
        // Un 200 de otra app (HTML) no vale: los dos servicios responden JSON con status ok.
        const body = res.ok ? await res.json().catch(() => null) : null;
        if (body?.status === 'ok') {
          ok = true;
          break;
        }
        lastError = res.ok
          ? `responde, pero no es Mitchbot: otro proceso ocupa el puerto; libéralo o usa E2E_BACKEND_PORT / E2E_STUB_PORT=<libre>`
          : `status ${res.status}`;
      } catch (error: any) {
        lastError = error?.message || String(error);
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    if (!ok) failures.push(`  - ${check.name} no responde en ${check.url} (${lastError})\n    ${check.hint}`);
  }

  // Playwright reutiliza cualquier servidor que ya escuche en el puerto: si es
  // otra app, las pruebas fallarían sin explicación.
  try {
    const html = await (await fetch(E2E.frontendUrl, { signal: AbortSignal.timeout(2000) })).text();
    if (!html.includes('<title>Mitchbot')) {
      failures.push(
        `  - ${E2E.frontendUrl} responde, pero no es el frontend de Mitchbot.\n` +
        `    Otro proceso ocupa el puerto ${E2E.ports.frontend}: libéralo o usa E2E_FRONTEND_PORT=<libre>.`
      );
    }
  } catch (error: any) {
    failures.push(`  - Frontend no responde en ${E2E.frontendUrl} (${error?.message || error})`);
  }

  if (failures.length > 0) {
    throw new Error(
      [
        '',
        '❌ Prerrequisitos e2e no disponibles.',
        '',
        'Antes de ejecutar la suite asegúrate de tener:',
        '  1. Servicios Docker levantados:  docker compose up -d',
        '  2. Backend y stub de IA: los arranca Playwright automáticamente,',
        '     o manualmente:  pnpm --filter @mitchbot/backend dev  y  pnpm stub:e2e',
        '',
        'Fallos detectados:',
        ...failures,
        '',
      ].join('\n')
    );
  }
}
