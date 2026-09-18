import { randomUUID } from 'node:crypto';

/** Identificador único por llamada (apto para ejecución en paralelo). */
export function uniqueId(): string {
  return `${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;
}

export function uniqueEmail(prefix = 'e2e'): string {
  return `${prefix}-${uniqueId()}@example.test`;
}

export function uniqueName(prefix = 'Cliente E2E'): string {
  return `${prefix} ${uniqueId()}`;
}

export function uniquePhone(): string {
  const suffix = String(Date.now()).slice(-7);
  return `+1555${suffix}`;
}

export function uniqueSlug(prefix = 'e2e'): string {
  return `${prefix}-${uniqueId()}`.toLowerCase();
}
