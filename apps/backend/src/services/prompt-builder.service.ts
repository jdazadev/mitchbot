import { AgentPersonality } from '../models/agent.model';

// =================== MAPEOS DE PERSONALIDAD ===================

const ROLE_MAP: Record<AgentPersonality['role'], string> = {
  assistant: 'Eres un asistente virtual servicial y eficiente.',
  teacher: 'Eres un profesor paciente que explica conceptos paso a paso de forma clara y didáctica.',
  seller: 'Eres un vendedor persuasivo que destaca beneficios y guía al cliente hacia la mejor opción.',
  support: 'Eres un agente de soporte técnico que resuelve problemas de forma metódica y eficiente.',
  customer_service: 'Eres un agente de atención al cliente empático que gestiona consultas con profesionalismo y calidez.',
};

const EMOJI_MAP: Record<AgentPersonality['emojiUsage'], string> = {
  low: 'Usa emojis de forma mínima, solo cuando sea estrictamente necesario.',
  medium: 'Usa emojis ocasionalmente para dar calidez a tus respuestas.',
  high: 'Usa emojis frecuentemente en tus respuestas para hacerlas más cercanas y expresivas.',
};

const LANGUAGE_MAP: Record<AgentPersonality['language'], string> = {
  es: 'Responde siempre en español.',
  en: 'Always respond in English.',
  pt: 'Sempre responda em português.',
  auto: 'Responde en el mismo idioma que use el usuario.',
};

const RESPONSE_LENGTH_MAP: Record<AgentPersonality['responseLength'], string> = {
  short: 'Responde de forma breve y concisa, máximo 1-2 oraciones.',
  medium: 'Responde en párrafos cortos con la información necesaria, sin extenderte demasiado.',
  detailed: 'Responde de forma completa y detallada, proporcionando toda la información relevante.',
};

const RAG_BEHAVIOR_MAP: Record<AgentPersonality['ragBehavior'], string> = {
  strict: 'Solo responde con información que se encuentre en los documentos proporcionados. No inventes ni supongas información.',
  hybrid: 'Prioriza la información de los documentos proporcionados, pero puedes complementar con tu conocimiento general cuando sea necesario.',
  general: 'Usa tu conocimiento general libremente para responder. Los documentos proporcionados son material de referencia adicional.',
};

const TRAIT_DESCRIPTIONS: Record<string, string> = {
  formal: 'formal y profesional',
  empático: 'empático y comprensivo',
  irreverente: 'irreverente y con humor ácido',
  directo: 'directo y sin rodeos',
  objetivo: 'objetivo y basado en hechos',
  entusiasta: 'entusiasta y motivador',
  sarcástico: 'con toques de sarcasmo sutil',
  sociable: 'sociable y conversacional',
  amable: 'amable y cordial',
  alegre: 'alegre y positivo',
  neutro: 'con tono neutro y profesional',
};

// =================== BUILDER ===================

/**
 * Construye un system prompt completo a partir de la configuración de personalidad del agente.
 * Esta es la función central que traduce opciones de UI → prompt de texto para el LLM.
 */
export interface PromptContext {
  agentName?: string;
  agentDescription?: string;
  enableWelcomeGreeting?: boolean;
  enableGoodbyeMessage?: boolean;
  enableFallbackAdvisor?: boolean;
  goodbyeKeywords?: string[];
}

export function buildSystemPrompt(personality: AgentPersonality, context?: PromptContext): string {
  const sections: string[] = [];

  // 1. Rol base
  sections.push(ROLE_MAP[personality.role] || ROLE_MAP.assistant);

  // 1.1 Contexto del agente
  if (context?.agentName?.trim()) {
    sections.push(`Nombre del agente: ${context.agentName.trim()}.`);
  }
  if (context?.agentDescription?.trim()) {
    sections.push(`Descripción del agente: ${context.agentDescription.trim()}.`);
  }

  // 2. Rasgos de personalidad
  if (personality.traits && personality.traits.length > 0) {
    const validTraits = personality.traits
      .slice(0, 3)
      .map(t => TRAIT_DESCRIPTIONS[t.toLowerCase()] || t)
      .filter(Boolean);

    if (validTraits.length > 0) {
      sections.push(`Tu estilo de comunicación es ${validTraits.join(', ')}.`);
    }
  }

  // 3. Idioma
  sections.push(LANGUAGE_MAP[personality.language] || LANGUAGE_MAP.es);

  // 4. Emojis
  sections.push(EMOJI_MAP[personality.emojiUsage] || EMOJI_MAP.medium);

  // 5. Longitud de respuesta
  sections.push(RESPONSE_LENGTH_MAP[personality.responseLength] || RESPONSE_LENGTH_MAP.medium);

  // 6. Comportamiento RAG
  sections.push(RAG_BEHAVIOR_MAP[personality.ragBehavior] || RAG_BEHAVIOR_MAP.hybrid);

  // 7. Mensajes automáticos
  if (context?.enableWelcomeGreeting) {
    sections.push('Saluda únicamente al inicio de la conversación o cuando se retome tras una pausa larga; el resto del tiempo continúa la conversación sin reiniciar el saludo.');
  }
  if (context?.enableGoodbyeMessage) {
    const keywords = context.goodbyeKeywords?.filter(k => k.trim()).join(', ');
    const keywordText = keywords ? ` Palabras clave: ${keywords}.` : '';
    sections.push(`Despídete cuando el usuario se despida o cuando la conversación se cierre.${keywordText}`);
  }

  // 8. Mensaje fallback
  if (context?.enableFallbackAdvisor) {
    sections.push('Si no sabes la respuesta, discúlpate y aconseja contactar con un asesor.');
  } else if (personality.fallbackMessage) {
    sections.push(`Si no tienes información sobre el tema, responde exactamente: "${personality.fallbackMessage}"`);
  }

  // 9. Instrucciones adicionales
  if (personality.additionalInstructions?.trim()) {
    sections.push(`Instrucciones adicionales: ${personality.additionalInstructions.trim()}`);
  }

  return sections.join('\n');
}

/**
 * Devuelve los valores por defecto de AgentPersonality.
 */
export function getDefaultPersonality(): AgentPersonality {
  return {
    role: 'assistant',
    traits: ['neutro'],
    emojiUsage: 'medium',
    language: 'es',
    responseLength: 'medium',
    ragBehavior: 'hybrid',
    fallbackMessage: 'Lo siento, no tengo información disponible sobre ese tema en este momento.',
  };
}
