/**
 * Utilidades de fecha. Trabajamos con strings YYYY-MM-DD y aritmética en UTC
 * para esquivar los cambios de hora (DST) de Europe/Madrid.
 */

export const TZ = 'Europe/Madrid';

const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/** Fecha de hoy en Europe/Madrid como YYYY-MM-DD. */
export function todayISO(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** Hora actual en Europe/Madrid como HH:mm. */
export function nowHM(now = new Date()): string {
  return new Intl.DateTimeFormat('es-ES', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(now);
}

export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

export function toISO(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDaysISO(iso: string, days: number): string {
  const d = parseISO(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return toISO(d);
}

export function diffDays(a: string, b: string): number {
  return Math.round((parseISO(a).getTime() - parseISO(b).getTime()) / 86_400_000);
}

export function weekdayOf(iso: string): number {
  return parseISO(iso).getUTCDay();
}

export function formatLong(iso: string): string {
  const text = new Intl.DateTimeFormat('es-ES', {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(parseISO(iso));
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function formatLongYear(iso: string): string {
  const text = new Intl.DateTimeFormat('es-ES', {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(parseISO(iso));
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function formatShort(iso: string): string {
  return new Intl.DateTimeFormat('es-ES', {
    timeZone: 'UTC',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(parseISO(iso));
}

export function monthLabel(year: number, month: number): string {
  const text = `${MONTHS[month - 1]} de ${year}`;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function parseMonthKey(key: string): { year: number; month: number } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(key);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  return { year, month };
}

export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const idx = year * 12 + (month - 1) + delta;
  return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0, 12)).getUTCDate();
}

export function isWeekend(iso: string): boolean {
  const d = weekdayOf(iso);
  return d === 0 || d === 6;
}

export function weekdayName(iso: string): string {
  return WEEKDAYS[weekdayOf(iso)];
}

export interface GridDay {
  iso: string;
  day: number;
  inMonth: boolean;
}

/** Semanas completas (lunes a domingo) que cubren el mes indicado. */
export function monthGrid(year: number, month: number): GridDay[][] {
  const first = new Date(Date.UTC(year, month - 1, 1, 12));
  const offset = (first.getUTCDay() + 6) % 7; // lunes = 0
  const start = new Date(first);
  start.setUTCDate(start.getUTCDate() - offset);

  const weeks: GridDay[][] = [];
  for (let w = 0; w < 6; w++) {
    const week: GridDay[] = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(start);
      date.setUTCDate(start.getUTCDate() + w * 7 + d);
      week.push({
        iso: toISO(date),
        day: date.getUTCDate(),
        inMonth: date.getUTCMonth() === month - 1,
      });
    }
    weeks.push(week);
  }
  return weeks;
}

export function nextWeekday(iso: string, weekday: number, minDaysAhead = 0): string {
  let candidate = addDaysISO(iso, minDaysAhead);
  while (weekdayOf(candidate) !== weekday) {
    candidate = addDaysISO(candidate, 1);
  }
  return candidate;
}
