export interface WidgetForm {
  enabled: boolean;
  /** Un origen por línea, tal como lo escribe el administrador. */
  allowedOrigins: string;
  position: 'right' | 'left';
  title: string;
  greeting: string;
}

const ORIGIN = /^https?:\/\/(\*\.)?[a-z0-9.-]+(:\d{1,5})?\/?$/i;

export const originLines = (text: string) =>
  text.split(/[\n,]/).map((line) => line.trim()).filter(Boolean);

/** Líneas que no son `http(s)://host[:puerto]` (el servidor valida igual). */
export const invalidOrigins = (text: string) => originLines(text).filter((line) => !ORIGIN.test(line));

const originOf = (apiBase: string, origin = window.location.origin) => new URL(apiBase, origin).origin;

export function widgetSnippet(apiBase: string, slug: string, origin = window.location.origin) {
  return `<script src="${originOf(apiBase, origin)}/widget.js" data-mitchbot="${slug}" async></script>`;
}

export function widgetFrameUrl(apiBase: string, slug: string, origin = window.location.origin) {
  return `${originOf(apiBase, origin)}/api/public/widget/${encodeURIComponent(slug)}/frame`;
}
