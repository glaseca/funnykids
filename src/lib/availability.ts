import { RULES, isValidTurn, type Turn } from './config';
import { addDaysISO, diffDays, todayISO, weekdayOf } from './dates';
import { db, expireHolds, listClosures } from './db';

export type TurnStatus = 'free' | 'taken' | 'closed' | 'past' | 'tooSoon' | 'tooFar' | 'weekdayClosed';

export interface Availability {
  date: string;
  AM: TurnStatus;
  PM: TurnStatus;
}

const STATUS_LABEL: Record<TurnStatus, string> = {
  free: 'Libre',
  taken: 'Reservado',
  closed: 'Cerrado',
  past: 'Pasado',
  tooSoon: 'Muy pronto',
  tooFar: 'Aún no disponible',
  weekdayClosed: 'Cerrado',
};

export function statusLabel(status: TurnStatus): string {
  return STATUS_LABEL[status];
}

function activeRows(prefix?: string): Array<{ date: string; turn: Turn }> {
  expireHolds();
  if (prefix) {
    return db()
      .prepare(
        `SELECT date, turn FROM bookings WHERE status IN ('pending','confirmed') AND date LIKE ?`,
      )
      .all(`${prefix}-%`) as unknown as Array<{ date: string; turn: Turn }>;
  }
  return db()
    .prepare(`SELECT date, turn FROM bookings WHERE status IN ('pending','confirmed')`)
    .all() as unknown as Array<{ date: string; turn: Turn }>;
}

function baseStatus(date: string, today: string, minDate: string, maxDate: string): TurnStatus {
  if (date < today) return 'past';
  if (date < minDate) return 'tooSoon';
  if (date > maxDate) return 'tooFar';
  if ((RULES.closedWeekdays as readonly number[]).includes(weekdayOf(date))) return 'weekdayClosed';
  return 'free';
}

/** Disponibilidad de un mes completo, indexada por fecha. */
export function monthAvailability(year: number, month: number): Map<string, Availability> {
  const prefix = `${year}-${String(month).padStart(2, '0')}`;
  const today = todayISO();
  const minDate = addDaysISO(today, RULES.leadDays);
  const maxDate = addDaysISO(today, RULES.horizonDays);

  const map = new Map<string, Availability>();
  const days = new Date(Date.UTC(year, month, 0, 12)).getUTCDate();

  for (let d = 1; d <= days; d++) {
    const iso = `${prefix}-${String(d).padStart(2, '0')}`;
    map.set(iso, { date: iso, AM: 'free', PM: 'free' });
  }

  const closures = listClosures().filter((c) => c.date.startsWith(prefix));
  for (const closure of closures) {
    const entry = map.get(closure.date);
    if (!entry) continue;
    if (closure.turn === null) {
      entry.AM = 'closed';
      entry.PM = 'closed';
    } else {
      entry[closure.turn] = 'closed';
    }
  }

  for (const row of activeRows(prefix)) {
    const entry = map.get(row.date);
    if (!entry) continue;
    entry[row.turn] = 'taken';
  }

  for (const entry of map.values()) {
    for (const turn of ['AM', 'PM'] as Turn[]) {
      if (entry[turn] === 'closed' || entry[turn] === 'taken') continue;
      entry[turn] = baseStatus(entry.date, today, minDate, maxDate);
    }
  }

  return map;
}

/** Estado de una franja concreta (validación de servidor). */
export function turnStatus(date: string, turn: Turn): TurnStatus {
  if (!isValidTurn(turn)) return 'closed';
  const today = todayISO();
  const minDate = addDaysISO(today, RULES.leadDays);
  const maxDate = addDaysISO(today, RULES.horizonDays);

  const closure = listClosures().find((c) => c.date === date && (c.turn === null || c.turn === turn));
  if (closure) return 'closed';

  expireHolds();
  const row = db()
    .prepare(
      `SELECT 1 AS x FROM bookings WHERE date = ? AND turn = ? AND status IN ('pending','confirmed')`,
    )
    .get(date, turn);
  if (row) return 'taken';

  return baseStatus(date, today, minDate, maxDate);
}

export function isBookable(date: string, turn: Turn): boolean {
  return turnStatus(date, turn) === 'free';
}

export function daysUntil(date: string): number {
  return diffDays(date, todayISO());
}
