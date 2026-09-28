import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ObjectId } from 'mongodb';
import { llmProviderService } from './llm-provider.service';
import { getMessagesCollection, Message } from '../models/message.model';
import { getConversationsCollection } from '../models/conversation.model';
import { emitToProjectDashboard, emitToRoom } from '../websocket/socket';
import { logger } from '../utils/logger';
import env from '../config/env';

export type InsightSentiment = 'positive' | 'neutral' | 'negative';
export type InsightUrgencyLevel = 'low' | 'medium' | 'high';
export type InsightUrgencyReason = 'none' | 'deadline' | 'incident' | 'escalation' | 'repetition';

export interface ConversationUrgency {
  level: InsightUrgencyLevel;
  reason: InsightUrgencyReason;
}

export interface ConversationInsights {
  sentiment: InsightSentiment;
  sentimentScores: { positive: number; neutral: number; negative: number };
  urgency: ConversationUrgency;
}

const SENTIMENTS: InsightSentiment[] = ['positive', 'neutral', 'negative'];
const URGENCY_LEVELS: InsightUrgencyLevel[] = ['low', 'medium', 'high'];
const URGENCY_REASONS: InsightUrgencyReason[] = ['none', 'deadline', 'incident', 'escalation', 'repetition'];
const analysisQueues = new Map<string, Promise<void>>();
const EXCLUDED_CONTENT_TYPES = new Set(['tool_call', 'tool_result', 'confirmation_request']);
const MAX_MESSAGES = 40;
const MAX_CHARS = 6000;
/** Marca que permite al stub e2e reconocer la petición de insights. */
export const INSIGHTS_MARKER = 'INSIGHTS_JSON';

const SYSTEM_PROMPT = [
  'Eres un analista de conversaciones de atención al cliente.',
  'Analiza la transcripción y responde EXCLUSIVAMENTE con un objeto JSON válido, sin texto adicional ni bloques de código, con esta forma exacta:',
  '{"sentiment":"positive|neutral|negative","sentimentScores":{"positive":0,"neutral":0,"negative":0},"urgency":{"level":"low|medium|high","reason":"none|deadline|incident|escalation|repetition"}}',
  'Los tres valores de sentimentScores deben ser números entre 0 y 1 y sumar 1.',
  'Evalúa la urgencia del cliente: deadline para plazos, incident para problemas urgentes, escalation para agravamiento y repetition para un problema repetido; usa none si no aplica.',
  `Marca interna: ${INSIGHTS_MARKER}`,
].join('\n');

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function buildTranscript(messages: Message[]): string {
  const lines = messages
    .filter(m => m.content && m.content.trim())
    .map(m => {
      const who = m.sender === 'contact' ? 'Cliente'
        : m.sender === 'human_agent' ? 'Agente humano'
        : 'Bot';
      return `${who}: ${m.content.trim()}`;
    });

  let transcript = lines.join('\n');
  if (transcript.length > MAX_CHARS) {
    transcript = transcript.slice(-MAX_CHARS);
  }
  return transcript;
}

function extractJson(raw: string): any {
  const cleaned = (raw || '').replace(/```json/gi, '').replace(/```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('El análisis no devolvió JSON válido');
  }
  return JSON.parse(cleaned.slice(start, end + 1));
}

export const insightsService = {
  /** Modelo dedicado (`OPENROUTER_INSIGHTS_MODEL`) con fallback al de chat. */
  resolveModel(): string {
    return env.OPENROUTER_INSIGHTS_MODEL || env.OPENROUTER_LLM_MODEL || '';
  },

  /** Valida y normaliza la respuesta del modelo. */
  parse(raw: string): ConversationInsights {
    const data = extractJson(raw);

    const sentiment = String(data?.sentiment || '').toLowerCase() as InsightSentiment;
    if (!SENTIMENTS.includes(sentiment)) {
      throw new Error('Sentimiento inválido en el análisis');
    }

    const urgencyLevel = data?.urgency?.level as InsightUrgencyLevel;
    if (!URGENCY_LEVELS.includes(urgencyLevel)) {
      throw new Error('Nivel de urgencia inválido en el análisis');
    }

    const scoresRaw = data?.sentimentScores || {};
    const positive = clamp01(Number(scoresRaw.positive));
    const neutral = clamp01(Number(scoresRaw.neutral));
    const negative = clamp01(Number(scoresRaw.negative));
    const total = positive + neutral + negative;

    return {
      sentiment,
      sentimentScores: total > 0
        ? { positive: positive / total, neutral: neutral / total, negative: negative / total }
        : { positive: 0, neutral: 1, negative: 0 },
      urgency: {
        level: urgencyLevel,
        reason: URGENCY_REASONS.includes(data?.urgency?.reason)
          ? data.urgency.reason
          : 'none',
      },
    };
  },

  /** Ejecuta el análisis sobre una transcripción. */
  async analyze(transcript: string, model?: string): Promise<ConversationInsights> {
    const resolvedModel = model || this.resolveModel();
    if (!resolvedModel) {
      throw new Error('Falta el modelo de análisis: define OPENROUTER_INSIGHTS_MODEL o OPENROUTER_LLM_MODEL.');
    }

    const chatModel = llmProviderService.createChatModel({
      provider: 'openrouter',
      model: resolvedModel,
      temperature: 0,
      maxTokens: 400,
    });

    const response = await chatModel.invoke([
      new SystemMessage(SYSTEM_PROMPT),
      new HumanMessage(`Transcripción:\n${transcript}`),
    ]);

    const content = typeof response.content === 'string'
      ? response.content
      : JSON.stringify(response.content);

    return this.parse(content);
  },

  /**
   * Analiza la conversación, persiste el resultado y lo propaga por WebSocket.
   * Devuelve `null` si no hay mensajes analizables.
   */
  async analyzeConversation(conversationId: string): Promise<ConversationInsights | null> {
    const previous = analysisQueues.get(conversationId) || Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>(resolve => { release = resolve; });
    const queued = previous.then(() => current);
    analysisQueues.set(conversationId, queued);
    await previous;

    try {
      return await this.runConversationAnalysis(conversationId);
    } finally {
      release();
      if (analysisQueues.get(conversationId) === queued) analysisQueues.delete(conversationId);
    }
  },

  async runConversationAnalysis(conversationId: string): Promise<ConversationInsights | null> {
    const [messages, conversation] = await Promise.all([
      getMessagesCollection()
        .find({ conversationId: new ObjectId(conversationId) })
        .sort({ createdAt: 1 })
        .toArray(),
      getConversationsCollection().findOne({ _id: new ObjectId(conversationId) }),
    ]);

    const eligible = messages
      .filter(m => m.sender !== 'tool' && !EXCLUDED_CONTENT_TYPES.has(m.contentType))
      .slice(-MAX_MESSAGES);

    if (eligible.length === 0) return null;

    const transcript = buildTranscript(eligible);
    const insights = await this.analyze(transcript);

    await getConversationsCollection().updateOne(
      { _id: new ObjectId(conversationId) },
      {
        $set: {
          'aiInsights.sentiment': insights.sentiment,
          'aiInsights.sentimentScores': insights.sentimentScores,
          'aiInsights.urgency': insights.urgency,
          updatedAt: new Date(),
        },
        $unset: { 'aiInsights.summary': '' },
      }
    );

    try {
      const payload = { conversationId, insights };
      emitToRoom(conversationId, 'chat:insights', payload);
      emitToProjectDashboard(
        conversation?.projectId?.toString(),
        'chat:insights',
        payload,
        conversationId,
      );
    } catch (e) {
      logger.warn('[Insights] Socket emit failed', e as any);
    }

    return insights;
  },

  /** Análisis fire-and-forget: nunca propaga errores al flujo principal. */
  async refreshInBackground(conversationId: string): Promise<void> {
    try {
      await this.analyzeConversation(conversationId);
    } catch (error: any) {
      logger.warn(`[Insights] Análisis automático falló (${conversationId}): ${error?.message || error}`);
    }
  },
};
