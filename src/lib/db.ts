import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Booking, BookingStatus, Closure, EmailLog, Payment, Turn } from './types';
import { addDaysISO, nextWeekday, todayISO } from './dates';
import { calcTotals } from './config';

const COLS = [
  'id', 'reference', 'date', 'turn', 'status', 'duration', 'children', 'children_final',
  'cleaning', 'subtotal_cents', 'deposit_cents', 'balance_cents', 'paid_cents',
  'customer_name', 'email', 'phone', 'child_name', 'child_age', 'notes',
  'terms_version', 'accepted_at', 'manage_token', 'stripe_session_id', 'hold_expires_at',
  'created_at', 'confirmed_at', 'cancelled_at', 'reminder_48_sent', 'reminder_24_sent',
] as const;

const INSERT_SQL = `INSERT INTO bookings (${COLS.join(', ')})
  VALUES (${COLS.map(() => '?').join(', ')})`;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,
  date TEXT NOT NULL,
  turn TEXT NOT NULL,
  status TEXT NOT NULL,
  duration INTEGER NOT NULL,
  children INTEGER NOT NULL,
  children_final INTEGER,
  cleaning INTEGER NOT NULL DEFAULT 1,
  subtotal_cents INTEGER NOT NULL,
  deposit_cents INTEGER NOT NULL,
  balance_cents INTEGER NOT NULL,
  paid_cents INTEGER NOT NULL DEFAULT 0,
  customer_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  child_name TEXT NOT NULL,
  child_age INTEGER,
  notes TEXT,
  terms_version TEXT NOT NULL,
  accepted_at TEXT NOT NULL,
  manage_token TEXT NOT NULL,
  stripe_session_id TEXT,
  hold_expires_at TEXT,
  created_at TEXT NOT NULL,
  confirmed_at TEXT,
  cancelled_at TEXT,
  reminder_48_sent INTEGER NOT NULL DEFAULT 0,
  reminder_24_sent INTEGER NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_slot_active
  ON bookings(date, turn) WHERE status IN ('pending', 'confirmed');

CREATE INDEX IF NOT EXISTS ix_bookings_date ON bookings(date);

CREATE TABLE IF NOT EXISTS closures (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  turn TEXT,
  reason TEXT
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  provider TEXT NOT NULL,
  provider_ref TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS emails (
  id TEXT PRIMARY KEY,
  booking_id TEXT,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  kind TEXT NOT NULL,
  provider TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS webhook_events (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL
);
`;

type Global = typeof globalThis & { __fkDb?: DatabaseSync };
const g = globalThis as Global;

function open(): DatabaseSync {
  const file = resolve(process.cwd(), process.env.DB_PATH ?? 'data/funnykids.db');
  mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = OFF;');
  db.exec(SCHEMA);
  // Publicamos la instancia antes del seed: insertBooking usa db() internamente.
  g.__fkDb = db;
  seed(db);
  return db;
}

export function db(): DatabaseSync {
  if (!g.__fkDb) g.__fkDb = open();
  return g.__fkDb;
}

export function newId(): string {
  return randomUUID();
}

const REF_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function newReference(): string {
  let out = '';
  for (let i = 0; i < 6; i++) {
    out += REF_ALPHABET[Math.floor(Math.random() * REF_ALPHABET.length)];
  }
  return `FK-${out}`;
}

/* -------------------------------------------------------------------------- */
/*  Bookings                                                                  */
/* -------------------------------------------------------------------------- */

export function insertBooking(b: Booking): void {
  const values = COLS.map((c) => b[c] as string | number | null);
  db().prepare(INSERT_SQL).run(...values);
}

export function getBookingById(id: string): Booking | null {
  const row = db().prepare('SELECT * FROM bookings WHERE id = ?').get(id);
  return (row as unknown as Booking) ?? null;
}

export function getBookingByReference(reference: string): Booking | null {
  const row = db().prepare('SELECT * FROM bookings WHERE reference = ?').get(reference.toUpperCase());
  return (row as unknown as Booking) ?? null;
}

export function getBookingByToken(token: string): Booking | null {
  const row = db().prepare('SELECT * FROM bookings WHERE manage_token = ?').get(token);
  return (row as unknown as Booking) ?? null;
}

export function listBookings(): Booking[] {
  return db().prepare('SELECT * FROM bookings ORDER BY date DESC, turn DESC').all() as unknown as Booking[];
}

export function updateBooking(id: string, fields: Partial<Record<string, string | number | null>>): void {
  const keys = Object.keys(fields);
  if (keys.length === 0) return;
  const sql = `UPDATE bookings SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`;
  db().prepare(sql).run(...keys.map((k) => fields[k] ?? null), id);
}

export function expireHolds(): void {
  const now = new Date().toISOString();
  db()
    .prepare(`UPDATE bookings SET status = 'expired' WHERE status = 'pending' AND hold_expires_at IS NOT NULL AND hold_expires_at < ?`)
    .run(now);
}

/* -------------------------------------------------------------------------- */
/*  Closures                                                                  */
/* -------------------------------------------------------------------------- */

export function listClosures(): Closure[] {
  return db().prepare('SELECT * FROM closures ORDER BY date ASC').all() as unknown as Closure[];
}

export function addClosure(date: string, turn: Turn | null, reason: string | null): void {
  db().prepare('DELETE FROM closures WHERE date = ? AND (turn IS ? OR turn = ?)').run(date, turn, turn);
  db().prepare('INSERT INTO closures (date, turn, reason) VALUES (?, ?, ?)').run(date, turn, reason);
}

export function removeClosure(id: number): void {
  db().prepare('DELETE FROM closures WHERE id = ?').run(id);
}

/* -------------------------------------------------------------------------- */
/*  Payments / emails                                                         */
/* -------------------------------------------------------------------------- */

export function insertPayment(p: Payment): void {
  db()
    .prepare(
      `INSERT INTO payments (id, booking_id, kind, amount_cents, provider, provider_ref, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(p.id, p.booking_id, p.kind, p.amount_cents, p.provider, p.provider_ref, p.status, p.created_at);
}

export function listPayments(bookingId: string): Payment[] {
  return db()
    .prepare('SELECT * FROM payments WHERE booking_id = ? ORDER BY created_at DESC')
    .all(bookingId) as unknown as Payment[];
}

export function logEmail(e: EmailLog): void {
  db()
    .prepare(
      `INSERT INTO emails (id, booking_id, to_email, subject, body, kind, provider, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(e.id, e.booking_id, e.to_email, e.subject, e.body, e.kind, e.provider, e.created_at);
}

export function listEmails(limit = 20): EmailLog[] {
  return db()
    .prepare('SELECT * FROM emails ORDER BY created_at DESC LIMIT ?')
    .all(limit) as unknown as EmailLog[];
}

export function listEmailsForBooking(bookingId: string): EmailLog[] {
  return db()
    .prepare('SELECT * FROM emails WHERE booking_id = ? ORDER BY created_at DESC')
    .all(bookingId) as unknown as EmailLog[];
}

/* -------------------------------------------------------------------------- */
/*  Webhook idempotency                                                       */
/* -------------------------------------------------------------------------- */

export function markWebhookSeen(id: string): boolean {
  try {
    db().prepare('INSERT INTO webhook_events (id, created_at) VALUES (?, ?)').run(id, new Date().toISOString());
    return true;
  } catch {
    return false;
  }
}

/** Permite reintentar un webhook que falló a mitad de proceso. */
export function forgetWebhook(id: string): void {
  db().prepare('DELETE FROM webhook_events WHERE id = ?').run(id);
}

/* -------------------------------------------------------------------------- */
/*  Seed de demostración                                                      */
/* -------------------------------------------------------------------------- */

function seed(database: DatabaseSync): void {
  const count = database.prepare('SELECT COUNT(*) AS n FROM bookings').get() as { n: number };
  if (Number(count.n) > 0) return;

  const today = todayISO();
  const firstSaturday = nextWeekday(today, 6, 5);
  const secondSaturday = addDaysISO(firstSaturday, 7);

  const demoRows: Array<Partial<Booking> & { date: string; turn: Turn }> = [
    {
      date: firstSaturday,
      turn: 'PM',
      duration: 3,
      children: 24,
      customer_name: 'Marta Ruiz',
      email: 'marta.demo@example.com',
      phone: '+34 611 222 333',
      child_name: 'Lucía',
      child_age: 7,
      notes: 'Traen tarta y sándwiches. Necesitan el microondas.',
      status: 'confirmed',
    },
    {
      date: secondSaturday,
      turn: 'AM',
      duration: 2,
      children: 18,
      customer_name: 'Javier Nogales',
      email: 'javier.demo@example.com',
      phone: '+34 622 333 444',
      child_name: 'Bruno',
      child_age: 5,
      notes: null,
      status: 'confirmed',
    },
  ];

  for (const row of demoRows) {
    const totals = calcTotals(row.children!, row.duration!, true);
    const now = new Date().toISOString();
    const booking: Booking = {
      id: newId(),
      reference: newReference(),
      date: row.date,
      turn: row.turn,
      status: (row.status ?? 'confirmed') as BookingStatus,
      duration: row.duration!,
      children: row.children!,
      children_final: row.children!,
      cleaning: 1,
      subtotal_cents: totals.subtotalCents,
      deposit_cents: totals.depositCents,
      balance_cents: totals.balanceCents,
      paid_cents: totals.depositCents,
      customer_name: row.customer_name!,
      email: row.email!,
      phone: row.phone!,
      child_name: row.child_name!,
      child_age: row.child_age ?? null,
      notes: row.notes ?? null,
      terms_version: '2026-11-01',
      accepted_at: now,
      manage_token: randomUUID().replace(/-/g, ''),
      stripe_session_id: null,
      hold_expires_at: null,
      created_at: now,
      confirmed_at: now,
      cancelled_at: null,
      reminder_48_sent: 0,
      reminder_24_sent: 0,
    };
    insertBooking(booking);
  }
}
