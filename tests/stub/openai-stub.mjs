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
 * Disparadores deterministas:
 *   - Si el último mensaje de usuario contiene "AGENDAR_CITA" se emite un
 *     tool_call de `create_appointment`.
 *   - En caso contrario se responde el texto fijo STUB_REPLY.
 */
import http from 'node:http';

const PORT = Number(process.env.STUB_PORT || 4010);
const STUB_MODEL = process.env.STUB_MODEL || 'stub-model';
const STUB_EMBED_MODEL = process.env.STUB_EMBED_MODEL || 'stub-embed';
const STUB_REPLY = process.env.STUB_REPLY || 'Respuesta determinista de prueba E2E.';
const TOOL_TRIGGER = /AGENDAR_CITA|agendar cita|crear cita/i;
const TRANSFER_TRIGGER = /TRANSFERIR|transferir a (un )?(humano|asesor)/i;
// Alineado con `rag.qdrant_vector_size` por defecto del backend (768).
const EMBED_DIM = Number(process.env.STUB_EMBED_DIM || 768);

const stats = { chatCompletions: 0, embeddings: 0, models: 0, requests: [] };

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
  if (TOOL_TRIGGER.test(userText)) return 'create_appointment';
  if (TRANSFER_TRIGGER.test(userText)) return 'transfer_to_human';
  return null;
}

function toolArguments(name) {
  if (name === 'transfer_to_human') return { reason: 'Prueba E2E' };
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
  const toolName = pickTool(userText, body.tools);
  const useTool = !!toolName;
  // Eco determinista y único: si el mensaje incluye [[echo:TOKEN]] la respuesta
  // contiene ese TOKEN, permitiendo correlacionar streaming por prueba.
  const echoMatch = userText.match(/\[\[echo:([^\]]+)\]\]/);
  // Memoria: si el cliente pide recordar un token que apareció en un turno
  // anterior, la respuesta confirma si el historial llegó al modelo.
  const memoryMatch = userText.match(/RECUERDA\s+([\w-]+)/i);
  let reply = echoMatch ? `ECO ${echoMatch[1]} respuesta determinista de prueba E2E.` : STUB_REPLY;
  if (memoryMatch) {
    const token = memoryMatch[1];
    const earlier = (body.messages || [])
      .slice(0, -1)
      .some((m) => (m?.role === 'user' || m?.role === 'human') && textOf(m.content).includes(token));
    reply = earlier ? `MEMORIA_OK ${token}` : `MEMORIA_FALLO ${token}`;
  }

  log({ kind: 'chat.completions', model, stream: wantsStream, tool: useTool, toolName });

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
