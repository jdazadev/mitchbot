export type BreakerState = 'closed' | 'open' | 'half_open';

export interface BreakerSnapshot {
  state: BreakerState;
  /** Fallos transitorios consecutivos. */
  failures: number;
  /** Hasta cuándo sigue abierto (epoch ms); solo en `open`. */
  openUntil?: number;
}

export interface BreakerConfig {
  threshold: number;
  cooldownMs: number;
}

export type BreakerEvent = { type: 'success' } | { type: 'failure'; permanent: boolean };

export const CLOSED: BreakerSnapshot = { state: 'closed', failures: 0 };

/** Un circuito abierto cuya espera expiró admite una entrega de prueba. */
export function currentState(snapshot: BreakerSnapshot, now: number): BreakerSnapshot {
  if (snapshot.state === 'open' && snapshot.openUntil !== undefined && now >= snapshot.openUntil) {
    return { state: 'half_open', failures: snapshot.failures };
  }
  return snapshot;
}

/**
 * Transición del circuit breaker de un canal. Los errores permanentes (un número
 * mal escrito) no dicen nada de la salud del proveedor: no cuentan.
 */
export function transition(
  snapshot: BreakerSnapshot,
  event: BreakerEvent,
  config: BreakerConfig,
  now: number,
): BreakerSnapshot {
  const current = currentState(snapshot, now);
  if (event.type === 'success') return CLOSED;
  if (event.permanent) return current;

  if (current.state === 'half_open') {
    return { state: 'open', failures: current.failures + 1, openUntil: now + config.cooldownMs };
  }
  const failures = current.failures + 1;
  if (current.state === 'closed' && failures >= config.threshold) {
    return { state: 'open', failures, openUntil: now + config.cooldownMs };
  }
  return { ...current, failures };
}
