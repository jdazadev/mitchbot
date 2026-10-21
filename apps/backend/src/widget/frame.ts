import { WIDGET_STRINGS, type WidgetLanguage } from './strings';

export interface FrameConfig {
  slug: string;
  title: string;
  greeting?: string;
  color: string;
  colorContrast: 'light' | 'dark';
  language: WidgetLanguage;
}

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

/** JSON seguro dentro de `<script type="application/json">`: sin `</script>` ni `<!--`. */
const scriptJson = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c');

/** Tinta legible sobre el color de marca (luminancia relativa). */
export function contrastFor(hex: string): 'light' | 'dark' {
  const value = hex.replace('#', '');
  const full = value.length === 3 ? value.split('').map(c => c + c).join('') : value.slice(0, 6);
  const [r, g, b] = [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16) / 255)
    .map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.45 ? 'dark' : 'light';
}

/** Página del chat del widget: HTML mínimo, estilos y lógica en archivos del propio backend. */
export function renderFrame(config: FrameConfig) {
  const strings = WIDGET_STRINGS[config.language];
  const brandInk = config.colorContrast === 'light' ? '#ffffff' : '#0b0b0c';
  return `<!doctype html>
<html lang="${config.language}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(config.title)}</title>
<link rel="stylesheet" href="/widget/frame.css">
<style>:root { --brand: ${config.color}; --brand-ink: ${brandInk}; }</style>
</head>
<body>
<div class="widget">
  <header class="header">
    <h1>${escapeHtml(config.title)}</h1>
    <button type="button" id="close" class="icon-button" aria-label="${escapeHtml(strings.close)}" title="${escapeHtml(strings.close)}">
      <svg width="18" height="18" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M205.66 194.34a8 8 0 0 1-11.32 11.32L128 139.31l-66.34 66.35a8 8 0 0 1-11.32-11.32L116.69 128 50.34 61.66a8 8 0 0 1 11.32-11.32L128 116.69l66.34-66.35a8 8 0 0 1 11.32 11.32L139.31 128Z"/></svg>
    </button>
  </header>
  <div id="messages" class="messages" aria-label="${escapeHtml(config.title)}"></div>
  <p id="live" class="sr-only" role="status" aria-live="polite"></p>
  <p id="error" class="error" role="alert" hidden></p>
  <form id="composer" class="composer">
    <label for="message" class="sr-only">${escapeHtml(strings.placeholder)}</label>
    <input id="message" autocomplete="off" maxlength="4096" placeholder="${escapeHtml(strings.placeholder)}">
    <button id="send" type="submit">${escapeHtml(strings.send)}</button>
  </form>
  <p class="footer">${escapeHtml(strings.poweredBy)}</p>
</div>
<script id="mitchbot-config" type="application/json">${scriptJson({ ...config, strings })}</script>
<script src="/socket.io/socket.io.min.js"></script>
<script src="/widget/frame.js"></script>
</body>
</html>`;
}

/** Página para un widget que no existe o está desactivado (no se embebe nada). */
export const UNAVAILABLE_FRAME = '<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Widget no disponible</title></head><body></body></html>';
