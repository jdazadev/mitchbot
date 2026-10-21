import type { Project } from '../models/project.model';

export interface SlaTargets {
  responseMinutes: number;
  resolutionHours: number;
  alerts: boolean;
}

export const DEFAULT_SLA: SlaTargets = { responseMinutes: 15, resolutionHours: 24, alerts: true };
/** Fracción del objetivo a partir de la cual una espera "vence pronto". */
export const AT_RISK_RATIO = 0.75;

export function slaTargets(project: Pick<Project, 'config'> | null | undefined): SlaTargets {
  const sla = project?.config?.sla;
  return {
    responseMinutes: sla?.responseMinutes ?? DEFAULT_SLA.responseMinutes,
    resolutionHours: sla?.resolutionHours ?? DEFAULT_SLA.resolutionHours,
    alerts: sla?.alerts ?? DEFAULT_SLA.alerts,
  };
}

/** Mensaje mínimo para el cálculo: quién lo envía, qué tipo es y cuándo. */
export interface SlaMessage {
  sender: string;
  contentType: string;
  content?: string;
  createdAt: Date;
}

/** Lo que el cliente percibe como respuesta: texto o plantilla del bot o del equipo, o una confirmación. */
export function isReply(message: SlaMessage) {
  if (!message.content?.trim()) return false;
  if (message.contentType === 'confirmation_request') return true;
  return (message.sender === 'ai_agent' || message.sender === 'human_agent')
    && (message.contentType === 'text' || message.contentType === 'template');
}

export interface ResponseTurn {
  since: Date;
  /** Espera hasta la respuesta, o `undefined` si sigue sin respuesta. */
  waitMs?: number;
}

/**
 * Turnos de una conversación: cada tramo desde el primer mensaje del cliente sin
 * responder hasta la siguiente respuesta. Los mensajes deben venir ordenados.
 */
export function responseTurns(messages: SlaMessage[]): ResponseTurn[] {
  const turns: ResponseTurn[] = [];
  let pending: Date | null = null;
  for (const message of messages) {
    if (message.sender === 'contact' && message.content?.trim()) {
      pending ??= message.createdAt;
    } else if (pending && isReply(message)) {
      turns.push({ since: pending, waitMs: message.createdAt.getTime() - pending.getTime() });
      pending = null;
    }
  }
  if (pending) turns.push({ since: pending });
  return turns;
}

export function percentile(values: number[], p: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index];
}

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return Math.round(sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2);
}

const rate = (onTime: number, total: number) => (total ? Math.round((onTime / total) * 100) : null);

/**
 * Cumplimiento de respuesta en el rango: turnos que empezaron en él. Uno sin
 * respuesta solo cuenta (como fuera de plazo) si ya superó el objetivo.
 */
export function responseCompliance(turns: ResponseTurn[], targetMs: number, range: { from: Date; to: Date }, now: Date) {
  const inRange = turns.filter(turn => turn.since >= range.from && turn.since <= range.to);
  const answered = inRange.filter(turn => turn.waitMs !== undefined).map(turn => turn.waitMs!);
  const overdue = inRange.filter(turn => turn.waitMs === undefined && now.getTime() - turn.since.getTime() > targetMs).length;
  const onTime = answered.filter(wait => wait <= targetMs).length;
  const total = answered.length + overdue;
  return { total, onTime, rate: rate(onTime, total), medianMs: median(answered), p90Ms: percentile(answered, 90) };
}

export interface SlaConversation {
  status: string;
  createdAt: Date;
  closedAt?: Date | null;
  updatedAt?: Date;
}

/**
 * Resolución de las conversaciones creadas en el rango: cerradas dentro del
 * objetivo frente a cerradas tarde o abiertas que ya lo superaron.
 */
export function resolutionCompliance(conversations: SlaConversation[], targetMs: number, now: Date) {
  const durations: number[] = [];
  let overdueOpen = 0;
  for (const conversation of conversations) {
    if (conversation.status === 'closed') {
      // Conversaciones cerradas antes de registrar `closedAt`: su última actualización.
      const closedAt = conversation.closedAt ?? conversation.updatedAt;
      if (closedAt) durations.push(Math.max(closedAt.getTime() - conversation.createdAt.getTime(), 0));
    } else if (now.getTime() - conversation.createdAt.getTime() > targetMs) {
      overdueOpen += 1;
    }
  }
  const onTime = durations.filter(duration => duration <= targetMs).length;
  const total = durations.length + overdueOpen;
  return { total, onTime, rate: rate(onTime, total), medianMs: median(durations) };
}

export type WaitState = 'ok' | 'at_risk' | 'breached';

/** Estado de una espera en curso respecto al objetivo de respuesta. */
export function waitState(since: Date | null | undefined, targetMs: number, now: Date): WaitState | null {
  if (!since) return null;
  const elapsed = now.getTime() - since.getTime();
  if (elapsed > targetMs) return 'breached';
  return elapsed >= targetMs * AT_RISK_RATIO ? 'at_risk' : 'ok';
}
