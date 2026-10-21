/** Plantilla aprobada de WhatsApp tal como la devuelve `GET /api/project/whatsapp/templates`. */
export interface WhatsAppTemplate {
  id?: string;
  name: string;
  language: string;
  category: string;
  parameterFormat: 'positional' | 'named';
  header?: string;
  body: string;
  footer?: string;
  buttons: { type: string; text: string }[];
  variables: { component: 'header' | 'body'; key: string; example?: string }[];
  supported: boolean;
  unsupportedReason?: string;
}

export interface TemplateParameters {
  header: string[];
  body: string[];
}

export const WINDOW_MS = 24 * 60 * 60 * 1000;

const PLACEHOLDER = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g;

const keysOf = (template: WhatsAppTemplate, component: 'header' | 'body') =>
  template.variables.filter((v) => v.component === component).map((v) => v.key);

/** Valores vacíos, uno por variable de cada componente. */
export function emptyParameters(template: WhatsAppTemplate): TemplateParameters {
  return { header: keysOf(template, 'header').map(() => ''), body: keysOf(template, 'body').map(() => '') };
}

function fill(text: string | undefined, keys: string[], values: string[]) {
  if (!text) return undefined;
  return text.replace(PLACEHOLDER, (whole, key) => {
    const value = values[keys.indexOf(key)]?.trim();
    return value ? value : whole;
  });
}

/** Vista previa del mensaje con las variables que ya están rellenas (las vacías quedan como `{{n}}`). */
export function previewTemplate(template: WhatsAppTemplate, parameters: TemplateParameters): string {
  return [
    fill(template.header, keysOf(template, 'header'), parameters.header),
    fill(template.body, keysOf(template, 'body'), parameters.body),
    template.footer,
  ].filter(Boolean).join('\n\n');
}

export const parametersComplete = (parameters: TemplateParameters) =>
  [...parameters.header, ...parameters.body].every((value) => value.trim().length > 0);

/**
 * WhatsApp solo admite mensajes libres durante 24 h desde el último mensaje del
 * cliente. Sin fecha registrada (conversaciones anteriores) no se bloquea nada.
 */
export function isWindowClosed(lastInboundAt: string | undefined | null, now = Date.now()): boolean {
  if (!lastInboundAt) return false;
  const at = Date.parse(lastInboundAt);
  return !Number.isNaN(at) && now - at > WINDOW_MS;
}
