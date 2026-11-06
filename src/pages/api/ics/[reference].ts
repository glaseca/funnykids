import type { APIRoute } from 'astro';
import { getBookingByReference } from '../../../lib/db';
import { slotLabel } from '../../../lib/config';
import { TZ } from '../../../lib/dates';
import { BUSINESS } from '../../../lib/site';

export const prerender = false;

function offsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date);

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUTC = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return asUTC - date.getTime();
}

function madridToUTC(dateISO: string, time: string): Date {
  const guess = new Date(`${dateISO}T${time}:00Z`);
  const offset = offsetMs(guess, TZ);
  const candidate = new Date(guess.getTime() - offset);
  const secondOffset = offsetMs(candidate, TZ);
  return new Date(guess.getTime() - secondOffset);
}

function icsStamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function escapeICS(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

export const GET: APIRoute = ({ params }) => {
  const booking = getBookingByReference(params.reference ?? '');
  if (!booking || booking.status === 'cancelled' || booking.status === 'expired') {
    return new Response('Reserva no encontrada', { status: 404 });
  }

  const startTime = booking.turn === 'AM' ? '10:30' : '16:30';
  const start = madridToUTC(booking.date, startTime);
  const end = new Date(start.getTime() + booking.duration * 60 * 60 * 1000);

  const summary = `Cumpleaños de ${booking.child_name} en ${BUSINESS.name}`;
  const description = [
    `Reserva ${booking.reference}`,
    `Horario: ${slotLabel(booking.turn, booking.duration)}`,
    `Niños: ${booking.children_final ?? booking.children}`,
    `Dirección: ${BUSINESS.address}`,
    `Teléfono: ${BUSINESS.phone}`,
  ].join('\n');

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Funny Kids//Reservas//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${booking.reference}@funnykids.es`,
    `DTSTAMP:${icsStamp(new Date())}`,
    `DTSTART:${icsStamp(start)}`,
    `DTEND:${icsStamp(end)}`,
    `SUMMARY:${escapeICS(summary)}`,
    `DESCRIPTION:${escapeICS(description)}`,
    `LOCATION:${escapeICS(BUSINESS.address)}`,
    'STATUS:CONFIRMED',
    'BEGIN:VALARM',
    'TRIGGER:-P1D',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeICS(`Mañana es el cumple de ${booking.child_name}`)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  return new Response(lines.join('\r\n'), {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="funnykids-${booking.reference}.ics"`,
      'Cache-Control': 'no-store',
    },
  });
};
