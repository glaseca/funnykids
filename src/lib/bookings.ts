import { randomUUID } from 'node:crypto';
import { calcTotals, RULES, type Duration, type Turn } from './config';
import {
  db,
  getBookingById,
  getBookingByReference,
  getBookingByToken,
  insertBooking,
  insertPayment,
  newId,
  newReference,
  updateBooking,
} from './db';
import { turnStatus } from './availability';
import { addDaysISO, diffDays, parseISO, todayISO, toISO } from './dates';
import type { Booking } from './types';

export interface CreateBookingInput {
  date: string;
  turn: Turn;
  duration: Duration;
  children: number;
  cleaning: boolean;
  customerName: string;
  email: string;
  phone: string;
  childName: string;
  childAge: number | null;
  notes: string | null;
}

export type CreateBookingResult =
  | { ok: true; booking: Booking }
  | { ok: false; code: string; message: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

function sanitize(value: string, max = 500): string {
  return value.trim().replace(/\s+/g, ' ').slice(0, max);
}

function isRealDate(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  return toISO(parseISO(iso)) === iso;
}

export function validateInput(input: CreateBookingInput): { ok: true } | { ok: false; message: string } {
  if (!isRealDate(input.date)) return { ok: false, message: 'La fecha no es válida.' };
  if (input.duration !== 2 && input.duration !== 3) return { ok: false, message: 'La duración no es válida.' };
  if (!Number.isInteger(input.children) || input.children < RULES.minChildren || input.children > RULES.maxChildren) {
    return { ok: false, message: `El número de niños debe estar entre ${RULES.minChildren} y ${RULES.maxChildren}.` };
  }
  if (input.customerName.length < 2) return { ok: false, message: 'Indica el nombre de la persona que reserva.' };
  if (!EMAIL_RE.test(input.email)) return { ok: false, message: 'El email no parece válido.' };
  if (input.phone.replace(/\D/g, '').length < 9) return { ok: false, message: 'El teléfono no parece válido.' };
  if (input.childName.length < 2) return { ok: false, message: 'Indica el nombre del cumpleañero.' };
  if (input.childAge !== null && (input.childAge < 1 || input.childAge > 17)) {
    return { ok: false, message: 'La edad del cumpleañero debe estar entre 1 y 17 años.' };
  }
  return { ok: true };
}

export function createBooking(input: CreateBookingInput): CreateBookingResult {
  const validation = validateInput(input);
  if (!validation.ok) return { ok: false, code: 'invalid', message: validation.message };

  const status = turnStatus(input.date, input.turn);
  switch (status) {
    case 'taken':
      return { ok: false, code: 'slot_taken', message: 'Esa franja se acaba de ocupar. Elige otra, por favor.' };
    case 'closed':
      return { ok: false, code: 'closed', message: 'Ese día está cerrado. Elige otra fecha.' };
    case 'tooSoon':
      return {
        ok: false,
        code: 'too_soon',
        message: `Necesitamos al menos ${RULES.leadDays} días de antelación para prepararlo todo.`,
      };
    case 'tooFar':
      return { ok: false, code: 'too_far', message: 'Todavía no hemos abierto reservas tan lejos. Prueba una fecha más cercana.' };
    case 'weekdayClosed':
      return { ok: false, code: 'weekday_closed', message: 'Ese día no abrimos. Elige otro, por favor.' };
    case 'past':
      return { ok: false, code: 'past', message: 'Esa fecha ya ha pasado.' };
  }

  const totals = calcTotals(input.children, input.duration, input.cleaning);
  const now = new Date().toISOString();
  const hold = new Date(Date.now() + RULES.holdMinutes * 60_000).toISOString();

  const booking: Booking = {
    id: newId(),
    reference: newReference(),
    date: input.date,
    turn: input.turn,
    status: 'pending',
    duration: input.duration,
    children: input.children,
    children_final: input.children,
    cleaning: input.cleaning ? 1 : 0,
    subtotal_cents: totals.subtotalCents,
    deposit_cents: totals.depositCents,
    balance_cents: totals.balanceCents,
    paid_cents: 0,
    customer_name: sanitize(input.customerName, 120),
    email: input.email.trim().toLowerCase(),
    phone: sanitize(input.phone, 40),
    child_name: sanitize(input.childName, 80),
    child_age: input.childAge,
    notes: input.notes ? sanitize(input.notes, 1000) : null,
    terms_version: RULES.termsVersion,
    accepted_at: now,
    manage_token: randomUUID().replace(/-/g, ''),
    stripe_session_id: null,
    hold_expires_at: hold,
    created_at: now,
    confirmed_at: null,
    cancelled_at: null,
    reminder_48_sent: 0,
    reminder_24_sent: 0,
  };

  try {
    insertBooking(booking);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/UNIQUE/i.test(message)) {
      return { ok: false, code: 'slot_taken', message: 'Esa franja se acaba de ocupar. Elige otra, por favor.' };
    }
    throw error;
  }

  return { ok: true, booking };
}

export function findBooking(reference: string): Booking | null {
  return getBookingByReference(reference);
}

export function findBookingByToken(token: string): Booking | null {
  return getBookingByToken(token);
}

function hasConflict(date: string, turn: Turn, exceptId: string): boolean {
  const row = db()
    .prepare(
      `SELECT 1 AS x FROM bookings
       WHERE date = ? AND turn = ? AND status IN ('pending','confirmed') AND id <> ?`,
    )
    .get(date, turn, exceptId);
  return Boolean(row);
}

/**
 * Registra un pago y actualiza el estado. Es idempotente por provider_ref:
 * si Stripe reenvía el webhook, no se duplica el pago.
 */
export function registerPayment(params: {
  bookingId: string;
  kind: 'deposit' | 'balance';
  amountCents: number;
  provider: 'stripe' | 'demo' | 'manual';
  providerRef: string | null;
}): { ok: true; booking: Booking } | { ok: false; reason: string } {
  const booking = getBookingById(params.bookingId);
  if (!booking) return { ok: false, reason: 'booking_not_found' };

  if (params.providerRef) {
    const existing = db()
      .prepare(`SELECT 1 AS x FROM payments WHERE provider_ref = ? AND status = 'paid'`)
      .get(params.providerRef);
    if (existing) return { ok: true, booking };
  }

  if (booking.status === 'cancelled') return { ok: false, reason: 'booking_cancelled' };

  if (hasConflict(booking.date, booking.turn, booking.id)) {
    updateBooking(booking.id, { status: 'cancelled', cancelled_at: new Date().toISOString() });
    return { ok: false, reason: 'slot_conflict' };
  }

  insertPayment({
    id: newId(),
    booking_id: booking.id,
    kind: params.kind,
    amount_cents: params.amountCents,
    provider: params.provider,
    provider_ref: params.providerRef,
    status: 'paid',
    created_at: new Date().toISOString(),
  });

  const paid = booking.paid_cents + params.amountCents;
  const balance = Math.max(0, booking.subtotal_cents - paid);
  const now = new Date().toISOString();

  updateBooking(booking.id, {
    paid_cents: paid,
    balance_cents: balance,
    status: 'confirmed',
    confirmed_at: booking.confirmed_at ?? now,
    hold_expires_at: null,
  });

  return { ok: true, booking: getBookingById(booking.id)! };
}

export function canChangeHeadcount(booking: Booking): boolean {
  return (
    (booking.status === 'pending' || booking.status === 'confirmed') &&
    diffDays(booking.date, todayISO()) >= RULES.headcountCutoffDays
  );
}

export function updateHeadcount(
  booking: Booking,
  children: number,
): { ok: true; booking: Booking } | { ok: false; message: string } {
  if (!canChangeHeadcount(booking)) {
    return {
      ok: false,
      message: `Ya no se puede cambiar el aforo online. Llámanos y lo vemos (${RULES.headcountCutoffDays} días antes como máximo).`,
    };
  }
  if (!Number.isInteger(children) || children < RULES.minChildren || children > RULES.maxChildren) {
    return { ok: false, message: `El aforo debe estar entre ${RULES.minChildren} y ${RULES.maxChildren} niños.` };
  }

  const totals = calcTotals(children, booking.duration, booking.cleaning === 1);
  const paid = booking.paid_cents;
  updateBooking(booking.id, {
    children_final: children,
    children,
    subtotal_cents: totals.subtotalCents,
    deposit_cents: Math.min(totals.depositCents, paid > 0 ? Math.max(paid, 0) : totals.depositCents),
    balance_cents: Math.max(0, totals.subtotalCents - paid),
  });

  return { ok: true, booking: getBookingById(booking.id)! };
}

export function setBookingStatus(id: string, status: 'confirmed' | 'cancelled' | 'completed'): void {
  const booking = getBookingById(id);
  if (!booking) return;
  updateBooking(id, {
    status,
    cancelled_at: status === 'cancelled' ? new Date().toISOString() : booking.cancelled_at,
    hold_expires_at: status === 'confirmed' ? null : booking.hold_expires_at,
  });
}

export function markBalancePaidManually(id: string): void {
  const booking = getBookingById(id);
  if (!booking) return;
  const due = Math.max(0, booking.subtotal_cents - booking.paid_cents);
  if (due === 0) return;
  registerPayment({
    bookingId: id,
    kind: 'balance',
    amountCents: due,
    provider: 'manual',
    providerRef: null,
  });
}

export interface AdminStats {
  upcoming: number;
  monthConfirmed: number;
  monthCapacity: number;
  revenueCents: number;
  collectedCents: number;
  pending: number;
}

export function getStats(): AdminStats {
  const today = todayISO();
  const monthPrefix = today.slice(0, 7);
  const one = (sql: string, ...params: Array<string | number>) =>
    Number((db().prepare(sql).get(...params) as { v: number | null } | undefined)?.v ?? 0);

  return {
    upcoming: one(`SELECT COUNT(*) AS v FROM bookings WHERE status = 'confirmed' AND date >= ?`, today),
    monthConfirmed: one(
      `SELECT COUNT(*) AS v FROM bookings WHERE status IN ('confirmed','completed') AND date LIKE ?`,
      `${monthPrefix}-%`,
    ),
    monthCapacity: 2 * new Date(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 0).getDate(),
    revenueCents: one(
      `SELECT COALESCE(SUM(subtotal_cents), 0) AS v FROM bookings WHERE status IN ('confirmed','completed') AND date >= ?`,
      today,
    ),
    collectedCents: one(
      `SELECT COALESCE(SUM(paid_cents), 0) AS v FROM bookings WHERE status IN ('confirmed','completed') AND date >= ?`,
      today,
    ),
    pending: one(`SELECT COUNT(*) AS v FROM bookings WHERE status = 'pending' AND hold_expires_at > ?`, new Date().toISOString()),
  };
}

export function upcomingBookings(from = todayISO()): Booking[] {
  return db()
    .prepare(`SELECT * FROM bookings WHERE date >= ? AND status IN ('pending','confirmed') ORDER BY date ASC, turn ASC`)
    .all(from) as unknown as Booking[];
}

export function pastBookings(): Booking[] {
  return db()
    .prepare(`SELECT * FROM bookings WHERE date < ? ORDER BY date DESC LIMIT 40`)
    .all(todayISO()) as unknown as Booking[];
}

export function reminderCandidates(days: number): Booking[] {
  const target = addDaysISO(todayISO(), days);
  const column = days === 2 ? 'reminder_48_sent' : 'reminder_24_sent';
  return db()
    .prepare(`SELECT * FROM bookings WHERE status = 'confirmed' AND date = ? AND ${column} = 0`)
    .all(target) as unknown as Booking[];
}
