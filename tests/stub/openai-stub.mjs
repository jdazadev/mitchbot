/**
 * Stub local compatible con la API de OpenAI.
 *
 * Se usa en las pruebas e2e para sustituir a OpenRouter y garantizar respuestas
 * deterministas sin tráfico saliente ni costo. Soporta:
 *   - GET  /v1/models            -> lista de modelos falsos
 *   - POST /v1/chat/completions  -> respuesta fija o tool call (con streaming SSE)
 *   - POST /v1/embeddings        -> vectores deterministas
 *   - GET  /healthz              -> healthcheck para Playwright webServer
 *   - GET  /__stats              -> contador de peticiones (prueba de guardia)
 *   - POST /__reset              -> reinicia contadores
 *
 * Graph API de WhatsApp (Cloud API), para el canal de WhatsApp:
 *   - POST /meta/:version/:phoneNumberId/messages -> acepta el envío y devuelve un wamid
 *
 * Messaging API de Instagram (misma ruta, cuerpo `{ recipient: { id }, message: { text } }`):
 *   - POST /meta/:version/:accountId/messages -> acepta el envío y devuelve un message_id
 *   - GET  /meta/:version/:igsid             -> perfil `{ name, username }` del cliente
 *
 *
 * Plantillas de WhatsApp:
 *   - GET /meta/:version/:wabaId/message_templates -> catálogo fijo en dos páginas (`paging.next`)
 *   - Un envío `type: template` se valida contra el catálogo (132001 si no existe, 132000 si
 *     no cuadran las variables) y se registra con el texto `plantilla:<nombre>|v1|v2…`.
 *
 * Control (ambos canales):
 *   - GET  /__meta/messages?to=   -> mensajes recibidos (por destinatario)
 *   - POST /__meta/fail           -> { to, code, subcode?, status? }: los envíos a `to` fallan con ese error
 *   - POST /__meta/recover        -> { to }: los envíos a `to` vuelven a funcionar
 *
 * Disparadores deterministas:
 *   - Si el último mensaje de usuario contiene "AGENDAR_CITA" se emite un
 *     tool_call de `agenda_crear`.
 *   - "TRANSFERIR" emite `transfer_to_human`; "NOTIFICAR" emite `send_notification`.
 *   - "INTENCION_PAGO" emite `pagos_crear` si la operación está habilitada.
 *   - En caso contrario se responde el texto fijo STUB_REPLY.
 */
import http from 'node:http';

const PORT = Number(process.env.STUB_PORT || 4010);
const STUB_MODEL = process.env.STUB_MODEL || 'stub-model';
const STUB_EMBED_MODEL = process.env.STUB_EMBED_MODEL || 'stub-embed';
const STUB_REPLY = process.env.STUB_REPLY || 'Respuesta determinista de prueba E2E.';
const TOOL_TRIGGER = /AGENDAR_CITA|agendar cita|crear cita/i;
const TRANSFER_TRIGGER = /TRANSFERIR|transferir a (un )?(humano|asesor)/i;
const NOTIFICATION_TRIGGER = /NOTIFICAR|notificar al equipo/i;
const PAYMENT_TRIGGER = /INTENCION_PAGO|registrar intención de pago/i;
// Alineado con `rag.qdrant_vector_size` por defecto del backend (768).
const EMBED_DIM = Number(process.env.STUB_EMBED_DIM || 768);

const stats = { chatCompletions: 0, embeddings: 0, models: 0, requests: [] };

// Estado de la Graph API simulada; separado de `stats` para no mezclarlo con la guardia del proveedor de IA.
const META_TOKEN = process.env.STUB_META_TOKEN || 'e2e-wa-token';
const IG_TOKEN = process.env.STUB_IG_TOKEN || 'e2e-ig-token';
const meta = { sent: [], failures: new Map(), counter: 0 };

/** Catálogo de plantillas de la WABA simulada (`body` = número de variables del cuerpo). */
const TEMPLATES = [
  { name: 'bienvenida', language: 'es', status: 'APPROVED', category: 'MARKETING', components: [{ type: 'BODY', text: '¡Hola! Gracias por escribirnos.' }] },
  { name: 'plantilla_pendiente', language: 'es', status: 'PENDING', category: 'UTILITY', components: [{ type: 'BODY', text: 'Aún en revisión' }] },
  {
    name: 'promo_imagen', language: 'es', status: 'APPROVED', category: 'MARKETING',
    components: [{ type: 'HEADER', format: 'IMAGE' }, { type: 'BODY', text: 'Mira nuestra oferta' }],
  },
  {
    name: 'recordatorio_cita', language: 'es_MX', status: 'APPROVED', category: 'UTILITY', parameter_format: 'NAMED',
    components: [{ type: 'BODY', text: 'Hola {{nombre}}, te recordamos tu cita del {{fecha}}.', example: { body_text_named_params: [{ param_name: 'nombre', example: 'Ana' }, { param_name: 'fecha', example: 'martes' }] } }],
  },
  {
    name: 'seguimiento_pedido', language: 'es', status: 'APPROVED', category: 'UTILITY',
    components: [
      { type: 'BODY', text: 'Hola {{1}}, tu pedido {{2}} está en camino.', example: { body_text: [['Ana', 'A-12']] } },
      { type: 'FOOTER', text: 'Gracias por tu compra' },
    ],
  },
];
const templateVariables = (template, type) =>
  [...new Set([...((template.components.find((c) => c.type === type)?.text || '').matchAll(/\{\{\s*(\w+)\s*\}\}/g))].map((m) => m[1]))];

function log(entry) {
  stats.requests.push({ ...entry, at: new Date().toISOString() });
  if (stats.requests.length > 200) stats.requests.shift();
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function textOf(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map((p) => (typeof p === 'string' ? p : p?.text || '')).join('');
  }
  return '';
}

function lastUserMessage(messages = []) {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i];
    if (m?.role === 'user' || m?.role === 'human') return textOf(m.content);
  }
  return '';
}

function deterministicEmbedding(seedText, index) {
  // Vector determinista derivado del texto (sin aleatoriedad entre corridas).
  const vec = new Array(EMBED_DIM);
  let h = 2166136261 ^ index;
  for (let i = 0; i < seedText.length; i += 1) {
    h ^= seedText.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  for (let i = 0; i < EMBED_DIM; i += 1) {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    vec[i] = ((h >>> 0) % 20000) / 10000 - 1;
  }
  // Normaliza para similitud coseno estable.
  const norm = Math.sqrt(vec.reduce((acc, v) => acc + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}

function base64Float32(values) {
  const buf = Buffer.alloc(values.length * 4);
  values.forEach((v, i) => buf.writeFloatLE(v, i * 4));
  return buf.toString('base64');
}

function buildToolArgs() {
  const date = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return { date, time: '10:00', service: 'Consulta E2E' };
}

/** Determina la herramienta a invocar según el mensaje del cliente. */
function pickTool(userText, tools) {
  if (!Array.isArray(tools) || tools.length === 0) return null;
  const available = new Set(tools.map((tool) => tool?.function?.name).filter(Boolean));
  if (TOOL_TRIGGER.test(userText) && available.has('agenda_crear')) return 'agenda_crear';
  if (PAYMENT_TRIGGER.test(userText) && available.has('pagos_crear')) return 'pagos_crear';
  if (TRANSFER_TRIGGER.test(userText) && available.has('transfer_to_human')) return 'transfer_to_human';
  if (NOTIFICATION_TRIGGER.test(userText) && available.has('send_notification')) return 'send_notification';
  return null;
}

function toolArguments(name) {
  if (name === 'transfer_to_human') return { reason: 'Prueba E2E' };
  if (name === 'send_notification') return { message: 'Notificación E2E', level: 'warning' };
  if (name === 'pagos_crear') return { amount: 25, method: 'transferencia' };
  return buildToolArgs();
}

function sseStart(res, extraHeaders = {}) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    ...extraHeaders,
  });
}

function sseChunk(res, payload) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function completionBase(model) {
  return {
    id: `chatcmpl-stub-${Date.now()}`,
    object: 'chat.completion.chunk',
    created: Math.floor(Date.now() / 1000),
    model,
  };
}

async function handleChatCompletions(req, res, body) {
  stats.chatCompletions += 1;
  const model = body.model || STUB_MODEL;
  const wantsStream = body.stream === true;
  const userText = lastUserMessage(body.messages);
  // Petición de insights: el prompt del servicio incluye esta marca y espera JSON.
  const allText = (body.messages || []).map((m) => textOf(m.content)).join('\n');
  const wantsInsights = allText.includes('INSIGHTS_JSON');
  const toolName = pickTool(userText, body.tools);
  const useTool = !wantsInsights && !!toolName;
  // Eco determinista y único: si el mensaje incluye [[echo:TOKEN]] la respuesta
  // contiene ese TOKEN, permitiendo correlacionar streaming por prueba.
  const echoMatch = userText.match(/\[\[echo:([^\]]+)\]\]/);
  // Memoria: si el cliente pide recordar un token que apareció en un turno
  // anterior, la respuesta confirma si el historial llegó al modelo.
  const memoryMatch = userText.match(/RECUERDA\s+([\w-]+)/i);
  let reply = echoMatch ? `ECO ${echoMatch[1]} respuesta determinista de prueba E2E.` : STUB_REPLY;
  let insightDelayMs = 0;
  if (memoryMatch) {
    const token = memoryMatch[1];
    const earlier = (body.messages || [])
      .slice(0, -1)
      .some((m) => (m?.role === 'user' || m?.role === 'human') && textOf(m.content).includes(token));
    reply = earlier ? `MEMORIA_OK ${token}` : `MEMORIA_FALLO ${token}`;
  }
  if (wantsInsights) {
    const latestCustomerMessage = userText
      .split('\n')
      .filter((line) => line.startsWith('Cliente:'))
      .at(-1) || '';
    const delayedOldInsight = latestCustomerMessage.includes('OLD_INSIGHT_DELAY');
    const lowInsight = latestCustomerMessage.includes('NEW_INSIGHT_LOW');
    insightDelayMs = delayedOldInsight ? 1000 : 0;
    reply = JSON.stringify({
      sentiment: delayedOldInsight ? 'negative' : 'positive',
      sentimentScores: delayedOldInsight
        ? { positive: 0.1, neutral: 0.2, negative: 0.7 }
        : { positive: 0.65, neutral: 0.25, negative: 0.1 },
      urgency: lowInsight
        ? { level: 'low', reason: 'none' }
        : delayedOldInsight
          ? { level: 'high', reason: 'escalation' }
          : { level: 'medium', reason: 'deadline' },
    });
  }

  log({
    kind: 'chat.completions', model, stream: wantsStream, tool: useTool, toolName, insights: wantsInsights,
    toolNames: (body.tools || []).map((tool) => tool?.function?.name).filter(Boolean),
    userText,
  });

  if (insightDelayMs) await new Promise((resolve) => setTimeout(resolve, insightDelayMs));

  if (useTool) {
    const args = toolArguments(toolName);
    const callId = `call_stub_${Date.now()}`;
    if (!wantsStream) {
      return sendJson(res, 200, {
        id: `chatcmpl-stub-${Date.now()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model,
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: null,
              tool_calls: [
                {
                  id: callId,
                  type: 'function',
                  function: { name: toolName, arguments: JSON.stringify(args) },
                },
              ],
            },
            finish_reason: 'tool_calls',
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      });
    }

    sseStart(res);
    // Los argumentos van completos en el primer delta para no depender de la
    // acumulación de fragmentos del cliente.
    sseChunk(res, {
      ...completionBase(model),
      choices: [
        {
          index: 0,
          delta: {
            role: 'assistant',
            tool_calls: [
              {
                index: 0,
                id: callId,
                type: 'function',
                function: { name: toolName, arguments: JSON.stringify(args) },
              },
            ],
          },
          finish_reason: null,
        },
      ],
    });
    sseChunk(res, {
      ...completionBase(model),
      choices: [{ index: 0, delta: {}, finish_reason: 'tool_calls' }],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    });
    res.write('data: [DONE]\n\n');
    return res.end();
  }

  if (!wantsStream) {
    return sendJson(res, 200, {
      id: `chatcmpl-stub-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [
        { index: 0, message: { role: 'assistant', content: reply }, finish_reason: 'stop' },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 8, total_tokens: 18 },
    });
  }

  sseStart(res);
  const tokens = reply.split(' ');
  sseChunk(res, {
    ...completionBase(model),
    choices: [{ index: 0, delta: { role: 'assistant', content: '' }, finish_reason: null }],
  });
  for (const token of tokens) {
    sseChunk(res, {
      ...completionBase(model),
      choices: [{ index: 0, delta: { content: `${token} ` }, finish_reason: null }],
    });
  }
  sseChunk(res, {
    ...completionBase(model),
    choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
    usage: { prompt_tokens: 10, completion_tokens: tokens.length, total_tokens: 10 + tokens.length },
  });
  res.write('data: [DONE]\n\n');
  return res.end();
}

async function handleEmbeddings(req, res, body) {
  stats.embeddings += 1;
  const model = body.model || STUB_EMBED_MODEL;
  const input = Array.isArray(body.input) ? body.input : [body.input ?? ''];
  log({ kind: 'embeddings', model, count: input.length });

  const data = input.map((text, index) => {
    const vec = deterministicEmbedding(textOf(text), index);
    const embedding = body.encoding_format === 'base64' ? base64Float32(vec) : vec;
    return { object: 'embedding', index, embedding };
  });

  return sendJson(res, 200, {
    object: 'list',
    data,
    model,
    usage: { prompt_tokens: input.length, total_tokens: input.length },
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (req.method === 'GET' && url.pathname === '/healthz') {
    return sendJson(res, 200, { status: 'ok', service: 'openai-stub' });
  }

  if (req.method === 'GET' && url.pathname === '/__stats') {
    return sendJson(res, 200, stats);
  }

  if (req.method === 'POST' && url.pathname === '/__reset') {
    stats.chatCompletions = 0;
    stats.embeddings = 0;
    stats.models = 0;
    stats.requests = [];
    return sendJson(res, 200, { status: 'reset' });
  }

  const metaSend = req.method === 'POST' && url.pathname.match(/^\/meta\/v\d+\.\d+\/([^/]+)\/messages$/);
  if (metaSend) {
    const body = await readBody(req);
    // WhatsApp envía `to` + `text.body`; Instagram, `recipient.id` + `message.text`.
    const instagram = !!body.recipient;
    const token = instagram ? IG_TOKEN : META_TOKEN;
    if (req.headers.authorization !== `Bearer ${token}`) {
      return sendJson(res, 401, { error: { message: 'Invalid OAuth access token.', type: 'OAuthException', code: 190 } });
    }
    const to = instagram ? body.recipient.id : body.to;
    const failure = meta.failures.get(to);
    if (!failure && body.type === 'template') {
      const template = TEMPLATES.find((t) => t.name === body.template?.name && t.language === body.template?.language?.code && t.status === 'APPROVED');
      if (!template) {
        return sendJson(res, 404, { error: { message: 'Template name does not exist in the translation', code: 132001 } });
      }
      const sentBody = (body.template.components || []).find((c) => c.type === 'body')?.parameters || [];
      if (sentBody.length !== templateVariables(template, 'BODY').length) {
        return sendJson(res, 400, { error: { message: 'Number of parameters does not match', code: 132000 } });
      }
    }
    if (failure) {
      return sendJson(res, failure.status, {
        error: { message: `Stub: fallo ${failure.code}`, type: 'OAuthException', code: failure.code, error_subcode: failure.subcode },
      });
    }
    meta.counter += 1;
    const id = instagram ? `mid.stub.${Date.now()}.${meta.counter}` : `wamid.stub.${Date.now()}.${meta.counter}`;
    const text = instagram
      ? body.message?.text
      : body.type === 'template'
        ? [`plantilla:${body.template.name}`, ...((body.template.components || []).flatMap((c) => c.parameters.map((p) => p.text)))].join('|')
        : body.text?.body;
    meta.sent.push({ id, channel: instagram ? 'instagram' : 'whatsapp', phoneNumberId: metaSend[1], to, text, at: new Date().toISOString() });
    if (meta.sent.length > 500) meta.sent.shift();
    if (instagram) return sendJson(res, 200, { recipient_id: to, message_id: id });
    return sendJson(res, 200, { messaging_product: 'whatsapp', contacts: [{ input: body.to, wa_id: body.to }], messages: [{ id }] });
  }

  const templateList = req.method === 'GET' && url.pathname.match(/^\/meta\/v\d+\.\d+\/([^/]+)\/message_templates$/);
  if (templateList) {
    if (req.headers.authorization !== `Bearer ${META_TOKEN}`) {
      return sendJson(res, 401, { error: { message: 'Invalid OAuth access token.', code: 190 } });
    }
    // Dos páginas, como la Graph API cuando hay más plantillas que `limit`.
    const second = url.searchParams.get('after') === 'p2';
    const next = new URL(url);
    next.searchParams.set('after', 'p2');
    return sendJson(res, 200, {
      data: second ? TEMPLATES.slice(3) : TEMPLATES.slice(0, 3),
      ...(second ? {} : { paging: { next: `http://localhost:${PORT}${next.pathname}${next.search}` } }),
    });
  }

  const igProfile = req.method === 'GET' && url.pathname.match(/^\/meta\/v\d+\.\d+\/([^/]+)$/);
  if (igProfile) {
    if (req.headers.authorization !== `Bearer ${IG_TOKEN}`) {
      return sendJson(res, 401, { error: { message: 'Invalid OAuth access token.', code: 190 } });
    }
    const igsid = decodeURIComponent(igProfile[1]);
    return sendJson(res, 200, { name: `Cliente IG ${igsid.slice(-5)}`, username: `cliente_${igsid.slice(-5)}`, id: igsid });
  }

  if (req.method === 'GET' && url.pathname === '/__meta/messages') {
    const to = url.searchParams.get('to');
    return sendJson(res, 200, meta.sent.filter((m) => !to || m.to === to));
  }

  if (req.method === 'POST' && url.pathname === '/__meta/fail') {
    const body = await readBody(req);
    meta.failures.set(body.to, {
      code: Number(body.code) || 131047,
      subcode: body.subcode ? Number(body.subcode) : undefined,
      status: Number(body.status) || 400,
    });
    return sendJson(res, 200, { status: 'failing', to: body.to });
  }

  if (req.method === 'POST' && url.pathname === '/__meta/recover') {
    const body = await readBody(req);
    meta.failures.delete(body.to);
    return sendJson(res, 200, { status: 'recovered', to: body.to });
  }

  if (req.method === 'GET' && (url.pathname === '/v1/models' || url.pathname === '/models')) {
    stats.models += 1;
    log({ kind: 'models' });
    return sendJson(res, 200, {
      object: 'list',
      data: [
        {
          id: STUB_MODEL,
          object: 'model',
          created: 0,
          owned_by: 'e2e-stub',
          name: 'Stub Model (E2E)',
          context_length: 8192,
        },
        {
          id: STUB_EMBED_MODEL,
          object: 'model',
          created: 0,
          owned_by: 'e2e-stub',
          name: 'Stub Embeddings (E2E)',
        },
      ],
    });
  }

  if (req.method === 'POST' && url.pathname === '/v1/chat/completions') {
    const body = await readBody(req);
    return handleChatCompletions(req, res, body);
  }

  if (req.method === 'POST' && url.pathname === '/v1/embeddings') {
    const body = await readBody(req);
    return handleEmbeddings(req, res, body);
  }

  log({ kind: 'not-found', path: url.pathname, method: req.method });
  return sendJson(res, 404, { error: { message: `Stub: ruta no encontrada ${url.pathname}`, type: 'invalid_request_error' } });
});

server.listen(PORT, () => {
  console.log(`[openai-stub] escuchando en http://localhost:${PORT}`);
});
