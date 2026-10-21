/** Mismo criterio que el backend (`services/sla.ts`): "vence pronto" desde el 75 % del objetivo. */
export const AT_RISK_RATIO = 0.75;
export const DEFAULT_RESPONSE_MINUTES = 15;

export type WaitState = 'ok' | 'at_risk' | 'breached';

export function waitState(since: string | null | undefined, responseMinutes: number, now = Date.now()): WaitState | null {
  if (!since) return null;
  const start = Date.parse(since);
  if (Number.isNaN(start)) return null;
  const elapsed = now - start;
  const target = responseMinutes * 60_000;
  if (elapsed > target) return 'breached';
  return elapsed >= target * AT_RISK_RATIO ? 'at_risk' : 'ok';
}

/** Duración legible y corta: "45 s", "12 min", "3 h 5 min", "2 d 4 h". */
export function formatDuration(ms: number | null | undefined, locale = 'es'): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return '—';
  const seconds = Math.max(0, Math.round(ms / 1000));
  const n = (value: number) => new Intl.NumberFormat(locale).format(value);
  if (seconds < 60) return `${n(seconds)} s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${n(minutes)} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return minutes % 60 ? `${n(hours)} h ${n(minutes % 60)} min` : `${n(hours)} h`;
  const days = Math.floor(hours / 24);
  return hours % 24 ? `${n(days)} d ${n(hours % 24)} h` : `${n(days)} d`;
}
