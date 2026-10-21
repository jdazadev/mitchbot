import type { Project } from '../models/project.model';

export const MAX_ALLOWED_ORIGINS = 20;

export interface WidgetSettings {
  enabled?: boolean;
  allowedOrigins?: string[];
  position?: 'right' | 'left';
  title?: string | null;
  greeting?: string | null;
}

export class InvalidOriginError extends Error {
  constructor(value: string) {
    super(`"${value}" no es un origen válido: usa https://dominio.com (sin ruta)`);
    this.name = 'InvalidOriginError';
  }
}

/**
 * Normaliza un origen permitido: `http(s)://host[:puerto]`, sin ruta, consulta
 * ni credenciales. Se aceptan subdominios comodín (`https://*.tienda.com`),
 * que `frame-ancestors` entiende de forma nativa.
 */
export function normalizeOrigin(value: string): string {
  const raw = value.trim().replace(/\/+$/, '');
  const wildcard = /^(https?):\/\/\*\.(.+)$/i.exec(raw);
  let url: URL;
  try {
    url = new URL(wildcard ? `${wildcard[1]}://${wildcard[2]}` : raw);
  } catch {
    throw new InvalidOriginError(value);
  }
  const clean = (url.pathname === '/' || url.pathname === '') && !url.search && !url.hash && !url.username && !url.password;
  if (!['http:', 'https:'].includes(url.protocol) || !clean || !url.hostname) throw new InvalidOriginError(value);
  return wildcard ? `${url.protocol}//*.${url.host}` : url.origin;
}

/** Orígenes únicos y normalizados; lanza `InvalidOriginError` con el primero que no sirve. */
export function normalizeOrigins(values: string[]): string[] {
  return [...new Set(values.filter(v => v.trim()).map(normalizeOrigin))];
}

/** El widget solo se sirve si está activo y el canal Web también. */
export function isWidgetAvailable(project: Pick<Project, 'status' | 'config'> | null | undefined) {
  return !!project && project.status === 'active' && project.config?.channels?.web !== false && !!project.config?.widget?.enabled;
}

/**
 * `frame-ancestors`: quién puede embeber la página del widget. El propio backend
 * y el panel (vista previa) siempre; las webs del cliente, solo si las autorizó.
 */
export function frameAncestors(allowedOrigins: string[] = [], dashboardOrigins: string[] = []) {
  const sources = ["'self'", ...dashboardOrigins, ...allowedOrigins].filter((v, i, all) => v && all.indexOf(v) === i);
  return `frame-ancestors ${sources.join(' ')}`;
}

/** Fragmento que el cliente pega en su web. */
export function widgetSnippet(backendOrigin: string, slug: string) {
  return `<script src="${backendOrigin.replace(/\/+$/, '')}/widget.js" data-mitchbot="${slug}" async></script>`;
}
