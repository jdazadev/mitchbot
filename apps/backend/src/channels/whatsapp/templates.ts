import type { MessageTemplate, MetaTemplateComponent } from '../../models/message.model';
import { ChannelError } from '../types';
import { classifyWhatsAppError } from './adapter';

/** Variable de una plantilla: `{{1}}` (posicional) o `{{nombre}}` (con nombre). */
export interface TemplateVariable {
  component: 'header' | 'body';
  key: string;
  example?: string;
}

export interface WhatsAppTemplate {
  id?: string;
  name: string;
  language: string;
  category: string;
  status: string;
  parameterFormat: 'positional' | 'named';
  header?: string;
  body: string;
  footer?: string;
  buttons: { type: string; text: string }[];
  variables: TemplateVariable[];
  supported: boolean;
  unsupportedReason?: string;
}

/** Valores de las variables en el orden de `variables` de cada componente. */
export interface TemplateParameters {
  header?: string[];
  body?: string[];
}

const PLACEHOLDER = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g;

/** Variables únicas de un texto, en orden de aparición. */
export function placeholdersOf(text: string | undefined): string[] {
  if (!text) return [];
  const keys: string[] = [];
  for (const match of text.matchAll(PLACEHOLDER)) if (!keys.includes(match[1])) keys.push(match[1]);
  return keys;
}

/** Ejemplos que Meta guarda al aprobar: por posición (`body_text`) o por nombre (`*_named_params`). */
function examplesOf(component: any, kind: 'header' | 'body'): Record<string, string> {
  const example = component?.example ?? {};
  const named = example[`${kind}_text_named_params`];
  if (Array.isArray(named)) return Object.fromEntries(named.map((p: any) => [p.param_name, String(p.example ?? '')]));
  const positional = kind === 'body' ? example.body_text?.[0] : example.header_text;
  if (Array.isArray(positional)) return Object.fromEntries(positional.map((value: unknown, i: number) => [String(i + 1), String(value)]));
  return {};
}

/** Convierte una plantilla de la Graph API y decide si Mitchbot puede enviarla. */
export function parseTemplate(raw: any): WhatsAppTemplate {
  const components: any[] = Array.isArray(raw?.components) ? raw.components : [];
  const find = (type: string) => components.find(c => String(c?.type).toUpperCase() === type);
  const header = find('HEADER');
  const body = find('BODY');
  const footer = find('FOOTER');
  const buttons = (find('BUTTONS')?.buttons ?? []) as any[];

  let unsupportedReason: string | undefined;
  if (String(raw?.category).toUpperCase() === 'AUTHENTICATION') unsupportedReason = 'Las plantillas de autenticación no se pueden enviar desde Mitchbot';
  else if (header && String(header.format ?? 'TEXT').toUpperCase() !== 'TEXT') unsupportedReason = 'Tiene una cabecera multimedia';
  else if (buttons.some(b => String(b?.type).toUpperCase() === 'URL' && placeholdersOf(b?.url).length)) unsupportedReason = 'Tiene un botón con URL variable';
  else if (buttons.some(b => ['COPY_CODE', 'OTP', 'FLOW', 'CATALOG', 'MPM'].includes(String(b?.type).toUpperCase()))) unsupportedReason = 'Tiene botones que Mitchbot aún no admite';
  else {
    const other = components.find(c => !['HEADER', 'BODY', 'FOOTER', 'BUTTONS'].includes(String(c?.type).toUpperCase()));
    if (other) unsupportedReason = `Tiene un componente que Mitchbot aún no admite (${String(other.type).toLowerCase()})`;
  }

  const headerText = header && String(header.format ?? 'TEXT').toUpperCase() === 'TEXT' ? header.text : undefined;
  const headerExamples = examplesOf(header, 'header');
  const bodyExamples = examplesOf(body, 'body');
  const variables: TemplateVariable[] = [
    ...placeholdersOf(headerText).map(key => ({ component: 'header' as const, key, example: headerExamples[key] })),
    ...placeholdersOf(body?.text).map(key => ({ component: 'body' as const, key, example: bodyExamples[key] })),
  ];

  return {
    id: raw?.id ? String(raw.id) : undefined,
    name: String(raw?.name ?? ''),
    language: String(raw?.language ?? ''),
    category: String(raw?.category ?? ''),
    status: String(raw?.status ?? ''),
    parameterFormat: String(raw?.parameter_format).toUpperCase() === 'NAMED' ? 'named' : 'positional',
    header: headerText,
    body: String(body?.text ?? ''),
    footer: footer?.text,
    buttons: buttons.map(b => ({ type: String(b?.type ?? ''), text: String(b?.text ?? '') })),
    variables,
    supported: !unsupportedReason && !!body?.text,
    unsupportedReason: unsupportedReason ?? (body?.text ? undefined : 'No tiene cuerpo de texto'),
  };
}

const keysOf = (template: WhatsAppTemplate, component: 'header' | 'body') =>
  template.variables.filter(v => v.component === component).map(v => v.key);

/** Comprueba que cada variable tenga un valor; devuelve el motivo o `null`. */
export function validateParameters(template: WhatsAppTemplate, parameters: TemplateParameters): string | null {
  for (const component of ['header', 'body'] as const) {
    const keys = keysOf(template, component);
    const values = parameters[component] ?? [];
    if (values.length !== keys.length) {
      return `La ${component === 'header' ? 'cabecera' : 'plantilla'} necesita ${keys.length} variable(s) y llegaron ${values.length}`;
    }
    const empty = keys.find((_, i) => typeof values[i] !== 'string' || !values[i].trim());
    if (empty) return `Falta el valor de la variable {{${empty}}}`;
    // Meta rechaza saltos de línea, tabuladores y más de cuatro espacios seguidos en las variables.
    const invalid = keys.find((_, i) => /[\n\t]| {5,}/.test(values[i]));
    if (invalid) return `La variable {{${invalid}}} no puede tener saltos de línea, tabuladores ni más de cuatro espacios seguidos`;
  }
  return null;
}

function fill(text: string | undefined, keys: string[], values: string[] = []) {
  if (!text) return undefined;
  return text.replace(PLACEHOLDER, (whole, key) => {
    const index = keys.indexOf(key);
    return index >= 0 && values[index] !== undefined ? values[index].trim() : whole;
  });
}

/** Texto que verá el cliente: cabecera, cuerpo y pie con las variables rellenadas. */
export function renderTemplate(template: WhatsAppTemplate, parameters: TemplateParameters): string {
  return [
    fill(template.header, keysOf(template, 'header'), parameters.header),
    fill(template.body, keysOf(template, 'body'), parameters.body),
    template.footer,
  ].filter(Boolean).join('\n\n');
}

/** Plantilla lista para guardar en el mensaje y enviar a la Cloud API. */
export function templateMessage(template: WhatsAppTemplate, parameters: TemplateParameters): MessageTemplate {
  const components: MetaTemplateComponent[] = [];
  for (const type of ['header', 'body'] as const) {
    const keys = keysOf(template, type);
    if (!keys.length) continue;
    components.push({
      type,
      parameters: keys.map((key, i) => ({
        type: 'text' as const,
        text: (parameters[type] ?? [])[i].trim(),
        ...(template.parameterFormat === 'named' ? { parameter_name: key } : {}),
      })),
    });
  }
  return { name: template.name, language: template.language, components };
}

export interface TemplateClientOptions {
  token: string;
  apiUrl: string;
  apiVersion: string;
  fetch?: typeof fetch;
}

const MAX_PAGES = 10;
const FIELDS = 'id,name,language,status,category,parameter_format,components';

/** Plantillas aprobadas de una WABA, siguiendo la paginación de la Graph API. */
export async function fetchApprovedTemplates(options: TemplateClientOptions, wabaId: string): Promise<WhatsAppTemplate[]> {
  const request = options.fetch ?? fetch;
  const base = options.apiUrl.replace(/\/+$/, '');
  let url: string | undefined = `${base}/${options.apiVersion}/${encodeURIComponent(wabaId)}/message_templates?fields=${FIELDS}&limit=100`;
  const templates: WhatsAppTemplate[] = [];

  for (let page = 0; url && page < MAX_PAGES; page += 1) {
    let response: Response;
    try {
      response = await request(url, {
        headers: { Authorization: `Bearer ${options.token}` },
        signal: AbortSignal.timeout(15_000),
      });
    } catch (error: any) {
      throw new ChannelError(`No se pudo conectar con WhatsApp: ${error?.message || error}`, 'transient');
    }
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw classifyWhatsAppError(response.status, body, response.headers.get('retry-after'));
    for (const raw of Array.isArray(body?.data) ? body.data : []) {
      if (String(raw?.status).toUpperCase() === 'APPROVED') templates.push(parseTemplate(raw));
    }
    url = typeof body?.paging?.next === 'string' ? body.paging.next : undefined;
  }
  return templates.sort((a, b) => a.name.localeCompare(b.name) || a.language.localeCompare(b.language));
}
