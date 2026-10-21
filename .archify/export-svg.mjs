/**
 * Exporta un diagrama de Archify a SVG sin abrir el visor a mano: pulsa
 * "Export diagram → SVG · Auto" en Chromium y guarda la descarga.
 *
 *   node .archify/export-svg.mjs <diagrama.html> <salida.svg> [--leyenda]
 *
 * `--leyenda` traduce la etiqueta "Legend" a "Leyenda" (README en español).
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const [html, out, ...flags] = process.argv.slice(2);
if (!html || !out) {
  console.error('Uso: node .archify/export-svg.mjs <diagrama.html> <salida.svg> [--leyenda]');
  process.exit(1);
}

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  await page.goto(`file://${path.resolve(html)}`);
  await page.locator('[aria-label="Export diagram"]').first().click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('[data-format="svg"]').first().click()]);
  const tmp = `${out}.tmp`;
  await download.saveAs(tmp);
  let svg = fs.readFileSync(tmp, 'utf8');
  if (flags.includes('--leyenda')) svg = svg.replace('>Legend<', '>Leyenda<');
  fs.writeFileSync(out, svg);
  fs.rmSync(tmp);
  console.log(`SVG guardado en ${out}`);
} finally {
  await browser.close();
}
