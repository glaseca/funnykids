/**
 * Reglas de negocio y precios.
 * Todo en céntimos para evitar errores de coma flotante.
 * Los precios son IVA incluido (precio final al consumidor).
 */

export const TURNS = {
  AM: { label: 'Mañana', start: '10:30', end: '13:30' },
  PM: { label: 'Tarde', start: '16:30', end: '19:30' },
} as const;

export type Turn = keyof typeof TURNS;

export type Duration = 2 | 3;

export const RULES = {
  minChildren: 10,
  maxChildren: 50,
  /** Días mínimos de antelación para reservar online. */
  leadDays: 3,
  /** Horizonte máximo de reserva. */
  horizonDays: 180,
  /** Minutos que se bloquea la franja mientras se paga. */
  holdMinutes: 35,
  /** Días antes del evento para poder cambiar el aforo. */
  headcountCutoffDays: 2,
  /** Días antes para cancelar con devolución de la señal. */
  freeCancellationDays: 7,
  /** Días de la semana cerrados (0 = domingo). Vacío = abierto todos. */
  closedWeekdays: [] as number[],
  termsVersion: '2026-11-01',
} as const;

export const PRICING = {
  perChild2h: 1500,
  perChild3h: 2000,
  cleaning: 2000,
  deposit: 5000,
} as const;

export const CURRENCY = 'EUR';

export function isValidTurn(value: unknown): value is Turn {
  return value === 'AM' || value === 'PM';
}

export function isValidDuration(value: unknown): value is Duration {
  return value === 2 || value === 3;
}

export function pricePerChild(duration: Duration): number {
  return duration === 2 ? PRICING.perChild2h : PRICING.perChild3h;
}

export interface Totals {
  children: number;
  duration: Duration;
  cleaning: boolean;
  subtotalCents: number;
  depositCents: number;
  balanceCents: number;
}

export function calcTotals(children: number, duration: Duration, cleaning: boolean): Totals {
  const subtotal = children * pricePerChild(duration) + (cleaning ? PRICING.cleaning : 0);
  const deposit = Math.min(PRICING.deposit, subtotal);
  return {
    children,
    duration,
    cleaning,
    subtotalCents: subtotal,
    depositCents: deposit,
    balanceCents: subtotal - deposit,
  };
}

/** Hora de fin según la duración elegida (la franja empieza siempre a la misma hora). */
export function endTime(turn: Turn, duration: Duration): string {
  const [h, m] = TURNS[turn].start.split(':').map(Number);
  const total = h * 60 + m + duration * 60;
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export function slotLabel(turn: Turn, duration: Duration): string {
  return `${TURNS[turn].start} – ${endTime(turn, duration)}`;
}
