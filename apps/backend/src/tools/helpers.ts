export const DAY_NAMES = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;

export type DayName = typeof DAY_NAMES[number];

export const DAY_LABELS_ES: Record<DayName, string> = {
  monday: 'Lunes',
  tuesday: 'Martes',
  wednesday: 'Miércoles',
  thursday: 'Jueves',
  friday: 'Viernes',
  saturday: 'Sábado',
  sunday: 'Domingo',
};

export function weekdayName(date: Date): DayName {
  return DAY_NAMES[date.getDay()];
}

/** Parsea un rango "09:00-18:00". Devuelve null si está cerrado. */
export function parseHoursRange(value: any): { open: string; close: string } | null {
  if (!value || typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized || normalized === 'closed' || normalized === 'cerrado') return null;
  const match = normalized.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
  if (!match) return null;
  return { open: match[1], close: match[2] };
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + (m || 0);
}

function minutesToTime(total: number): string {
  const h = Math.floor(total / 60).toString().padStart(2, '0');
  const m = (total % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

/** Genera slots de tiempo entre open y close */
export function generateSlots(open: string, close: string, slotMinutes: number): string[] {
  const step = slotMinutes > 0 ? slotMinutes : 30;
  const start = timeToMinutes(open);
  const end = timeToMinutes(close);
  const slots: string[] = [];
  for (let current = start; current + step <= end; current += step) {
    slots.push(minutesToTime(current));
  }
  return slots;
}

export function normalizeTime(value: any): string | undefined {
  if (typeof value !== 'string') return undefined;
  const match = value.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return undefined;
  const h = match[1].padStart(2, '0');
  const m = match[2];
  return `${h}:${m}`;
}

export function formatDateEs(date: Date): string {
  return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
