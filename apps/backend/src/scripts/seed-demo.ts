/**
 * Seed de demostración para las capturas del README: una panadería ficticia con
 * conversaciones por los tres canales, contactos, citas, herramientas, fuentes de
 * conocimiento y equipo. Los datos son inventados. BORRA la base de datos indicada,
 * así que úsalo solo con una base propia (por defecto `mitchbot_demo`). `http://127.0.0.1:5199`
 * está autorizado para el widget: es la web de ejemplo que levanta `scripts/screenshots/capture.mjs`.
 *
 * Uso:
 *   MONGODB_URI=mongodb://localhost:27017/mitchbot_demo pnpm --filter @mitchbot/backend seed:demo
 */
import { ObjectId } from 'mongodb';
import { connectDatabase, closeDatabase, getDatabase } from '../config/database';
import env from '../config/env';
import { userService } from '../services/user.service';
import { projectService } from '../services/project.service';

export const DEMO_USER = { name: 'Lucía Méndez', email: 'demo@mitchbot.io', password: 'demo12345' };

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

type Platform = 'WhatsApp' | 'Instagram' | 'Web';
type Line = [sender: 'contact' | 'ai_agent' | 'human_agent', text: string, minutesAfterStart: number];

interface DemoConversation {
  name: string;
  platform: Platform;
  identifier: string;
  phone?: string;
  email?: string;
  startedAgo: number;
  status?: 'active' | 'closed' | 'pending_human';
  mode?: 'auto_pilot' | 'human_takeover';
  unread?: number;
  sentiment: 'positive' | 'neutral' | 'negative';
  urgency?: { level: 'low' | 'medium' | 'high'; reason: 'none' | 'deadline' | 'incident' | 'escalation' | 'repetition' };
  waiting?: boolean;
  contact?: boolean;
  lines: Line[];
}

const CONVERSATIONS: DemoConversation[] = [
  {
    name: 'Camila Rojas', platform: 'WhatsApp', identifier: '573001112233', phone: '+57 300 111 2233',
    startedAgo: 14 * MINUTE, unread: 2, sentiment: 'positive', urgency: { level: 'medium', reason: 'deadline' }, contact: true,
    lines: [
      ['contact', 'Hola! Quiero encargar una torta de chocolate para el sábado, para 20 personas 🎂', 0],
      ['ai_agent', '¡Hola, Camila! Claro que sí. Para 20 personas te recomiendo la **torta de chocolate y avellanas** de 2 kg ($180.000). ¿La quieres con mensaje personalizado?', 1],
      ['contact', 'Sí, que diga "Feliz cumpleaños Sofi". ¿Me la pueden tener a las 3 pm?', 4],
      ['ai_agent', 'Perfecto. Te agendé la recogida para el **sábado a las 3:00 pm** con el mensaje "Feliz cumpleaños Sofi". Te pediremos un anticipo del 50 % para confirmarla.', 5],
      ['contact', '¿Puedo pagar por transferencia?', 12],
      ['contact', 'Y si es posible, con velitas incluidas 🙏', 13],
    ],
  },
  {
    name: 'Andrés Gómez', platform: 'Instagram', identifier: '17841400000001', startedAgo: 48 * MINUTE,
    status: 'pending_human', mode: 'human_takeover', unread: 1, sentiment: 'negative', urgency: { level: 'high', reason: 'incident' }, waiting: true,
    lines: [
      ['contact', 'Buenas, ayer pedí un domicilio y llegó el pan de masa madre aplastado 😕', 0],
      ['ai_agent', 'Siento mucho lo ocurrido, Andrés. Te paso con una persona del equipo para solucionarlo cuanto antes.', 1],
      ['human_agent', 'Hola Andrés, soy Lucía. Qué pena contigo. ¿Me envías una foto del pedido y tu número de orden?', 6],
      ['contact', 'Es la orden #4821. Necesito que me lo repongan hoy porque es para una cena', 40],
    ],
  },
  {
    name: 'María Fernanda López', platform: 'Web', identifier: 'web-mfl-2201', email: 'mafe.lopez@correo.test',
    startedAgo: 2 * HOUR, sentiment: 'neutral', contact: true,
    lines: [
      ['contact', '¿Tienen opciones sin gluten?', 0],
      ['ai_agent', 'Sí 😊 Tenemos **pan de almendras**, **brownies sin gluten** y **galletas de avena certificadas**. Se preparan en un área separada. ¿Te interesa alguno en especial?', 1],
      ['contact', 'Los brownies. ¿Hacen envíos a Chapinero?', 3],
      ['ai_agent', 'Sí, enviamos a Chapinero de lunes a sábado entre 9:00 am y 6:00 pm. El domicilio cuesta $8.000 y es gratis en pedidos desde $60.000.', 4],
    ],
  },
  {
    name: 'Julián Torres', platform: 'WhatsApp', identifier: '573004445566', phone: '+57 300 444 5566',
    startedAgo: 5 * HOUR, sentiment: 'positive', contact: true,
    lines: [
      ['contact', 'Buenos días, ¿a qué hora abren los domingos?', 0],
      ['ai_agent', '¡Buenos días, Julián! Los domingos abrimos de **8:00 am a 2:00 pm**. ¿Te ayudo con algo más?', 1],
      ['contact', 'Perfecto, gracias!', 3],
    ],
  },
  {
    name: 'Valentina Ruiz', platform: 'Instagram', identifier: '17841400000002', startedAgo: 9 * HOUR, unread: 1,
    sentiment: 'positive', urgency: { level: 'low', reason: 'none' },
    lines: [
      ['contact', 'Me encantaron los croissants que publicaron 😍 ¿Cuánto cuesta la caja de 6?', 0],
      ['ai_agent', '¡Gracias, Valentina! La caja de 6 croissants de mantequilla cuesta $27.000. También la tenemos surtida con almendra y chocolate.', 1],
      ['contact', 'La surtida! ¿Puedo reservarla para mañana?', 30],
    ],
  },
  {
    name: 'Ricardo Peña', platform: 'WhatsApp', identifier: '573007778899', phone: '+57 300 777 8899',
    startedAgo: 26 * HOUR, status: 'closed', sentiment: 'neutral', contact: true,
    lines: [
      ['contact', 'Necesito 50 pandebonos para un evento de empresa el viernes', 0],
      ['ai_agent', 'Con gusto. Para pedidos de más de 30 unidades manejamos precio especial: $1.900 c/u. ¿A qué hora y dónde los necesitas?', 1],
      ['contact', 'A las 8 am en la Calle 93. Listo, confirmado', 8],
      ['ai_agent', 'Quedó registrado: 50 pandebonos para el viernes a las 8:00 am en la Calle 93. ¡Gracias por elegirnos!', 9],
    ],
  },
  {
    name: 'Sara Jiménez', platform: 'Web', identifier: 'web-sj-1188', startedAgo: 3 * DAY, status: 'closed', sentiment: 'positive',
    lines: [
      ['contact', 'Hola, ¿hacen tortas veganas?', 0],
      ['ai_agent', '¡Sí! Nuestra torta vegana de zanahoria es de las favoritas. Se encarga con 48 horas de anticipación.', 1],
      ['contact', 'Genial, gracias 💚', 2],
    ],
  },
  {
    name: 'Diego Castaño', platform: 'WhatsApp', identifier: '573002223344', phone: '+57 300 222 3344', startedAgo: 4 * DAY,
    status: 'closed', sentiment: 'negative', urgency: { level: 'medium', reason: 'repetition' },
    lines: [
      ['contact', 'Llevo dos días preguntando por mi factura electrónica', 0],
      ['human_agent', 'Hola Diego, ya te la enviamos al correo registrado. Disculpa la demora.', 20],
      ['contact', 'Recibida, gracias', 45],
    ],
  },
];

/** Volumen de los últimos 30 días: conversaciones cerradas con un par de mensajes. */
const HISTORY_NAMES = ['Laura', 'Felipe', 'Natalia', 'Santiago', 'Paula', 'Mateo', 'Daniela', 'Sebastián', 'Isabella', 'Tomás', 'Gabriela', 'Nicolás'];
const HISTORY_TOPICS: [string, string][] = [
  ['¿Tienen pan de masa madre hoy?', 'Sí, salió del horno a las 7:00 am. Te lo apartamos si quieres.'],
  ['¿Cuál es la dirección del local?', 'Estamos en la Carrera 7 #45-12, Bogotá. Abrimos todos los días.'],
  ['¿Hacen desayunos sorpresa?', 'Sí, desde $85.000 con entrega a domicilio. Se encargan con un día de anticipación.'],
  ['¿Aceptan tarjeta?', 'Aceptamos tarjeta, transferencia y efectivo.'],
];

async function seedDemo() {
  const uri = env.MONGODB_URI;
  if (!/mitchbot_demo|demo/.test(uri)) throw new Error(`El seed de demo borra la base: usa una base de demo (recibido ${uri})`);
  await connectDatabase();
  const db = getDatabase();
  await db.dropDatabase();
  await connectDatabase();

  const now = Date.now();
  const at = (agoMs: number) => new Date(now - agoMs);

  // Equipo: la administradora, soporte y quien aprueba los cobros.
  const admin = await userService.create({ ...DEMO_USER, role: 'admin' });
  const { project } = await projectService.create({
    name: 'Panadería Aurora',
    slug: 'panaderia-aurora',
    description: 'Panadería artesanal con domicilios en Bogotá',
    agent: {
      name: 'Aurora',
      description: 'Asistente de ventas y atención de la panadería',
      model: 'openrouter',
      personality: {
        role: 'seller',
        traits: ['cálida', 'resolutiva', 'cercana'],
        emojiUsage: 'medium',
        language: 'es',
        responseLength: 'short',
        ragBehavior: 'hybrid',
        fallbackMessage: 'Déjame consultarlo con el equipo y te respondo en unos minutos.',
        additionalInstructions: 'Ofrece siempre el anticipo del 50 % para pedidos especiales.',
      },
      enableWelcomeGreeting: true,
      enableGoodbyeMessage: true,
    },
    config: {
      channels: { whatsapp: true, instagram: true, web: true },
      messages: { welcome: '¡Hola! Soy Aurora, de Panadería Aurora 🥐 ¿En qué te ayudo?', goodbye: '¡Gracias por escribirnos! Que tengas un día delicioso.' },
      options: { autoCreateContact: true },
    },
    createdBy: admin._id!.toString(),
  });
  const projectId = project._id!;
  await userService.joinProject(admin._id!.toString(), projectId.toString());
  await userService.setActiveProject(admin._id!.toString(), projectId.toString());
  await projectService.update(projectId.toString(), {
    config: {
      brand: { color: '#E2C6FF' },
      whatsapp: { phoneNumberId: '106540352242922', wabaId: '102290129340398' },
      instagram: { accountId: '17841400000000000' },
      sla: { responseMinutes: 15, resolutionHours: 24, alerts: true },
      widget: { enabled: true, allowedOrigins: ['https://panaderia-aurora.test', 'http://127.0.0.1:5199'], position: 'right', title: 'Panadería Aurora', greeting: '¿Antojo de algo rico? Escríbenos 🥐' },
    },
  } as any);

  for (const member of [
    { name: 'Tomás Herrera', email: 'tomas@mitchbot.io', role: 'support' as const },
    { name: 'Elena Vargas', email: 'elena@mitchbot.io', role: 'approver' as const },
    { name: 'Pablo Ríos', email: 'pablo@mitchbot.io', role: 'assistant' as const },
  ]) {
    await userService.create({ ...member, password: 'demo12345', projectIds: [projectId.toString()] });
  }

  const conversations = db.collection('conversations');
  const messages = db.collection('messages');
  const contacts = db.collection('contacts');
  const activities = db.collection('activities');
  const ids: Record<string, ObjectId> = {};

  for (const demo of CONVERSATIONS) {
    const conversationId = new ObjectId();
    ids[demo.name] = conversationId;
    const start = demo.startedAgo;
    const last = demo.lines[demo.lines.length - 1];
    const lastAt = at(start - last[2] * MINUTE);
    const lastInbound = [...demo.lines].reverse().find(line => line[0] === 'contact')!;
    let contactId: ObjectId | undefined;
    if (demo.contact) {
      contactId = new ObjectId();
      await contacts.insertOne({
        _id: contactId, projectId, name: demo.name, phone: demo.phone || '', email: demo.email, platform: demo.platform,
        status: demo.status === 'closed' ? 'Active' : 'New', tags: demo.platform === 'Web' ? ['web'] : ['cliente'],
        metadata: { identifier: demo.identifier, totalOrders: Math.floor(Math.random() * 6) + 1 },
        lastContactAt: lastAt, createdAt: at(start), updatedAt: lastAt,
      });
    }
    await conversations.insertOne({
      _id: conversationId, projectId, contactId, platform: demo.platform,
      status: demo.status || 'active', mode: demo.mode || 'auto_pilot',
      lastMessage: last[1], lastMessageAt: lastAt, unreadCount: demo.unread || 0,
      lastInboundAt: at(start - lastInbound[2] * MINUTE),
      awaitingReplySince: demo.waiting ? at(start - lastInbound[2] * MINUTE) : null,
      closedAt: demo.status === 'closed' ? lastAt : null,
      channelAccount: demo.platform === 'WhatsApp' ? '106540352242922' : demo.platform === 'Instagram' ? '17841400000000000' : undefined,
      aiInsights: {
        sentiment: demo.sentiment,
        sentimentScores: demo.sentiment === 'positive' ? { positive: 0.82, neutral: 0.15, negative: 0.03 }
          : demo.sentiment === 'negative' ? { positive: 0.04, neutral: 0.21, negative: 0.75 } : { positive: 0.25, neutral: 0.68, negative: 0.07 },
        ...(demo.urgency ? { urgency: demo.urgency } : {}),
      },
      clientInfo: { name: demo.name, phone: demo.phone, email: demo.email, identifier: demo.identifier },
      isContactCreated: !!demo.contact, createdAt: at(start), updatedAt: lastAt,
    });
    await messages.insertMany(demo.lines.map(([sender, text, minutes], index) => ({
      conversationId, sender, content: text, contentType: 'text', isBot: sender === 'ai_agent',
      senderName: sender === 'contact' ? demo.name : sender === 'ai_agent' ? 'Aurora' : 'Lucía Méndez',
      ...(demo.platform !== 'Web' && sender !== 'contact'
        ? { delivery: { status: index === demo.lines.length - 1 ? 'delivered' : 'read', attempts: 1, externalId: `wamid.demo.${conversationId}.${index}`, updatedAt: at(start - minutes * MINUTE) } }
        : {}),
      createdAt: at(start - minutes * MINUTE),
    })));
    await activities.insertOne({
      projectId, type: 'conversation_created', title: 'Nueva conversación', detail: `${demo.name} escribió por ${demo.platform}`,
      icon: 'chat', color: 'sky', metadata: { conversationId: conversationId.toString() }, createdAt: at(start),
    });
  }

  // Historial para el volumen y la salud del bot.
  for (let day = 1; day <= 29; day++) {
    const count = 2 + ((day * 7) % 5);
    for (let i = 0; i < count; i++) {
      const platform: Platform = (['WhatsApp', 'WhatsApp', 'Instagram', 'Web'] as Platform[])[(day + i) % 4];
      const [question, answer] = HISTORY_TOPICS[(day + i) % HISTORY_TOPICS.length];
      const name = `${HISTORY_NAMES[(day * 3 + i) % HISTORY_NAMES.length]} ${String.fromCharCode(65 + ((day + i) % 26))}.`;
      const start = day * DAY + i * 37 * MINUTE;
      const conversationId = new ObjectId();
      await conversations.insertOne({
        _id: conversationId, projectId, platform, status: 'closed', mode: 'auto_pilot', lastMessage: answer,
        lastMessageAt: at(start - 2 * MINUTE), lastInboundAt: at(start), closedAt: at(start - 2 * MINUTE), unreadCount: 0,
        aiInsights: { sentiment: i % 5 === 0 ? 'neutral' : 'positive', sentimentScores: { positive: 0.7, neutral: 0.25, negative: 0.05 } },
        clientInfo: { name, identifier: `hist-${day}-${i}` }, isContactCreated: false, createdAt: at(start), updatedAt: at(start - 2 * MINUTE),
      });
      await messages.insertMany([
        { conversationId, sender: 'contact', senderName: name, content: question, contentType: 'text', isBot: false, createdAt: at(start) },
        { conversationId, sender: 'ai_agent', senderName: 'Aurora', content: answer, contentType: 'text', isBot: true, createdAt: at(start - (1 + (i % 3)) * MINUTE) },
      ]);
    }
  }

  // Contactos adicionales, uno archivado.
  const moreContacts: [string, Platform, string, string][] = [
    ['Laura Ospina', 'WhatsApp', '+57 301 555 0101', 'Active'], ['Felipe Arango', 'Instagram', '', 'Active'],
    ['Natalia Cruz', 'Web', '', 'Inactive'], ['Santiago Mora', 'WhatsApp', '+57 302 555 0303', 'Active'],
    ['Paula Restrepo', 'WhatsApp', '+57 303 555 0404', 'New'], ['Mateo Salazar', 'Instagram', '', 'Archived'],
  ];
  for (const [index, [name, platform, phone, status]] of moreContacts.entries()) {
    await contacts.insertOne({
      projectId, name, phone, platform, status, tags: index % 2 ? ['frecuente'] : ['pedidos'],
      email: `${name.split(' ')[0].toLowerCase()}@correo.test`, metadata: { totalOrders: index + 2 },
      lastContactAt: at((index + 2) * DAY), createdAt: at((index + 10) * DAY), updatedAt: at((index + 2) * DAY),
    });
  }

  // Citas y herramientas: una recogida agendada, un cobro pendiente de aprobación y el historial.
  const camila = ids['Camila Rojas'];
  const saturday = new Date(now + 3 * DAY);
  saturday.setHours(15, 0, 0, 0);
  await db.collection('appointments').insertMany([
    { projectId, conversationId: camila, date: saturday, time: '15:00', service: 'Recogida torta de chocolate (20 personas)', status: 'confirmed', createdBy: 'ai_agent', createdAt: at(10 * MINUTE), updatedAt: at(10 * MINUTE) },
    { projectId, conversationId: ids['Ricardo Peña'], date: new Date(now + DAY), time: '08:00', service: 'Entrega 50 pandebonos — Calle 93', status: 'pending', createdBy: 'ai_agent', createdAt: at(DAY), updatedAt: at(DAY) },
    { projectId, date: at(2 * DAY), time: '10:00', service: 'Degustación de tortas de boda', status: 'completed', createdBy: 'human_agent', createdAt: at(6 * DAY), updatedAt: at(2 * DAY) },
  ]);
  const executions = db.collection('tool_executions');
  await executions.insertMany([
    { projectId, conversationId: camila, toolName: 'pagos_crear', toolId: 'pagos', operation: 'crear', binding: 'internal', params: { amount: 90000, method: 'transferencia', reference: 'Anticipo torta Sofi' }, status: 'pending_approval', userMessage: '¿Puedo pagar por transferencia?', createdAt: at(2 * MINUTE), updatedAt: at(2 * MINUTE) },
    { projectId, conversationId: ids['Andrés Gómez'], toolName: 'agenda_eliminar', toolId: 'agenda', operation: 'eliminar', binding: 'internal', params: { appointmentId: 'orden-4821', reason: 'Reposición del pedido' }, status: 'pending_approval', userMessage: 'Necesito que me lo repongan hoy', createdAt: at(8 * MINUTE), updatedAt: at(8 * MINUTE) },
    { projectId, conversationId: camila, toolName: 'agenda_crear', toolId: 'agenda', operation: 'crear', binding: 'internal', params: { date: saturday.toISOString().slice(0, 10), time: '15:00', service: 'Recogida torta de chocolate' }, result: { success: true }, status: 'executed', executedBy: 'contact', createdAt: at(10 * MINUTE), updatedAt: at(10 * MINUTE) },
    { projectId, conversationId: ids['Ricardo Peña'], toolName: 'agenda_crear', toolId: 'agenda', operation: 'crear', binding: 'internal', params: { service: 'Entrega 50 pandebonos' }, result: { success: true }, status: 'executed', executedBy: 'contact', createdAt: at(DAY), updatedAt: at(DAY) },
    { projectId, conversationId: ids['María Fernanda López'], toolName: 'conocimiento_leer', toolId: 'conocimiento', operation: 'leer', binding: 'internal', params: { query: 'productos sin gluten' }, result: { success: true }, status: 'executed', createdAt: at(2 * HOUR), updatedAt: at(2 * HOUR) },
    { projectId, conversationId: ids['Valentina Ruiz'], toolName: 'inventario_leer', toolId: 'inventario', operation: 'leer', binding: 'internal', params: { product: 'croissant surtido' }, result: { success: true }, status: 'executed', createdAt: at(9 * HOUR), updatedAt: at(9 * HOUR) },
    { projectId, conversationId: ids['Diego Castaño'], toolName: 'pagos_crear', toolId: 'pagos', operation: 'crear', binding: 'internal', params: { amount: 45000, method: 'efectivo' }, status: 'rejected', approvalDecision: 'rejected', decisionBy: admin._id, decisionAt: at(4 * DAY), createdAt: at(4 * DAY), updatedAt: at(4 * DAY) },
  ]);
  await activities.insertMany([
    { projectId, type: 'tool_executed', title: 'Cita agendada', detail: 'Recogida de torta para Camila Rojas', icon: 'calendar', color: 'lime', createdAt: at(10 * MINUTE) },
    { projectId, type: 'bot_handoff', title: 'Traspaso a humano', detail: 'Andrés Gómez reportó un pedido dañado', icon: 'user', color: 'lilac', createdAt: at(47 * MINUTE) },
    { projectId, type: 'new_contact', title: 'Nuevo contacto', detail: 'María Fernanda López (Web)', icon: 'user-plus', color: 'sky', createdAt: at(2 * HOUR) },
    { projectId, type: 'conversation_closed', title: 'Conversación cerrada', detail: 'Ricardo Peña — pedido de evento', icon: 'check', color: 'lime', createdAt: at(26 * HOUR) },
  ]);

  // Base de conocimiento (solo el registro: las capturas no necesitan vectores reales).
  const sources: [string, 'PDF' | 'TXT' | 'CSV' | 'IMAGE', string, 'Indexed' | 'Processing' | 'Failed', number][] = [
    ['Carta de productos 2026.pdf', 'PDF', '2.4 MB', 'Indexed', 148],
    ['Preguntas frecuentes.txt', 'TXT', '18 KB', 'Indexed', 36],
    ['Lista de precios.csv', 'CSV', '42 KB', 'Indexed', 61],
    ['Políticas de domicilio.pdf', 'PDF', '640 KB', 'Indexed', 22],
    ['Menú de temporada.jpg', 'IMAGE', '1.1 MB', 'Processing', 0],
  ];
  await db.collection('knowledge_sources').insertMany(sources.map(([name, type, size, status, vectorCount], index) => ({
    projectId, name, type, size, status, vectorCount, collectionName: 'knowledge_base',
    ...(status === 'Processing' ? { stage: 'embedding', progress: 64 } : {}),
    extractionMethod: type === 'PDF' || type === 'IMAGE' ? 'ocr_vision' : type === 'CSV' ? 'csv' : 'manual',
    lastSyncedAt: at(index * DAY + HOUR), createdAt: at((index + 1) * 2 * DAY), updatedAt: at(index * DAY + HOUR),
  })));

  console.log(`✅ Demo lista: ${DEMO_USER.email} / ${DEMO_USER.password} · proyecto panaderia-aurora (${projectId})`);
}

seedDemo()
  .catch(error => {
    console.error('❌ Seed de demo falló:', error);
    process.exitCode = 1;
  })
  .finally(() => closeDatabase());
