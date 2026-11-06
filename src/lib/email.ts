import { env } from './env';
import { logEmail, newId, updateBooking } from './db';
import type { Booking } from './types';
import { slotLabel } from './config';
import { diffDays, formatLongYear, todayISO } from './dates';
import { formatEUR, formatEURExact } from './money';
import { reminderCandidates } from './bookings';
import { BUSINESS } from './site';

function esc(value: string | number | null): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function shell(origin: string, title: string, intro: string, body: string): string {
  return `<!doctype html>
<html lang="es">
  <body style="margin:0;padding:32px 16px;background:#fff7ec;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#17172b;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;">
      <tr>
        <td style="padding-bottom:16px;">
          <a href="${origin}" style="text-decoration:none;color:#17172b;font-size:22px;font-weight:800;letter-spacing:-0.02em;">
            🎈 Funny Kids
          </a>
        </td>
      </tr>
      <tr>
        <td style="background:#fffdf8;border:2px solid #17172b;border-radius:24px;padding:32px;">
          <h1 style="margin:0 0 8px;font-size:24px;line-height:1.25;">${esc(title)}</h1>
          <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#52526b;">${intro}</p>
          ${body}
          <hr style="border:none;border-top:1px solid #e7dccd;margin:28px 0 20px;" />
          <p style="margin:0;font-size:13px;line-height:1.7;color:#52526b;">
            ${esc(BUSINESS.name)} · ${esc(BUSINESS.address)}<br />
            ${esc(BUSINESS.phone)} · <a href="mailto:${BUSINESS.email}" style="color:#17172b;">${BUSINESS.email}</a>
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding-top:16px;font-size:12px;color:#8a8a9e;text-align:center;">
          Te escribimos porque hiciste una reserva en ${esc(BUSINESS.name)}.
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function rows(items: Array<[string, string]>): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
    ${items
      .map(
        ([label, value]) => `<tr>
          <td style="padding:8px 0;font-size:14px;color:#8a8a9e;width:42%;">${esc(label)}</td>
          <td style="padding:8px 0;font-size:15px;font-weight:600;text-align:right;">${value}</td>
        </tr>`,
      )
      .join('')}
  </table>`;
}

function button(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;background:#ff6b5a;color:#ffffff;text-decoration:none;font-weight:700;font-size:16px;padding:14px 24px;border-radius:999px;">${esc(label)}</a>`;
}

/* -------------------------------------------------------------------------- */

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  kind: string;
  bookingId?: string | null;
}): Promise<'resend' | 'simulated' | 'error'> {
  const key = env('RESEND_API_KEY');
  const from = env('EMAIL_FROM') ?? 'Funny Kids <reservas@funnykids.es>';
  let provider: 'resend' | 'simulated' | 'error' = 'simulated';

  if (key) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: [params.to],
          subject: params.subject,
          html: params.html,
        }),
      });
      provider = res.ok ? 'resend' : 'error';
      if (!res.ok) {
        console.error('[email] Resend error', res.status, await res.text());
      }
    } catch (error) {
      console.error('[email] fallo de red', error);
      provider = 'error';
    }
  }

  logEmail({
    id: newId(),
    booking_id: params.bookingId ?? null,
    to_email: params.to,
    subject: params.subject,
    body: params.html,
    kind: params.kind,
    provider,
    created_at: new Date().toISOString(),
  });

  return provider;
}

/* -------------------------------------------------------------------------- */

export async function sendBookingConfirmation(booking: Booking, origin: string): Promise<void> {
  const manage = `${origin}/reserva/${booking.reference}/gestionar?token=${booking.manage_token}`;
  const html = shell(
    origin,
    '¡Reserva confirmada! 🎉',
    `Hola ${esc(booking.customer_name)}, ya tenemos vuestra franja guardada. Aquí van todos los detalles.`,
    `${rows([
      ['Referencia', `<span style="font-family:monospace;">${esc(booking.reference)}</span>`],
      ['Fecha', esc(formatLongYear(booking.date))],
      ['Horario', esc(slotLabel(booking.turn, booking.duration))],
      ['Niños', esc(booking.children)],
      ['Total', esc(formatEUR(booking.subtotal_cents))],
      ['Señal pagada', esc(formatEUR(booking.paid_cents))],
      ['Pendiente', esc(formatEUR(booking.subtotal_cents - booking.paid_cents))],
    ])}
    <p style="margin:0 0 20px;font-size:15px;line-height:1.7;">
      Puedes pagar el resto cuando quieras desde tu página de reserva, con tarjeta o Bizum.
    </p>
    <p style="margin:0 0 8px;">${button(manage, 'Ver y gestionar mi reserva')}</p>
    <p style="margin:24px 0 0;font-size:14px;line-height:1.7;color:#52526b;">
      La franja incluye 30 minutos antes para montar la merienda. Trae la tarta, la comida y calcetines antideslizantes para la piscina de bolas.
    </p>`,
  );

  await sendEmail({
    to: booking.email,
    subject: `Reserva confirmada · ${booking.reference} · ${formatLongYear(booking.date)}`,
    html,
    kind: 'confirmation',
    bookingId: booking.id,
  });

  const adminEmail = env('ADMIN_EMAIL') ?? BUSINESS.email;
  await sendEmail({
    to: adminEmail,
    subject: `Nueva reserva · ${booking.reference} · ${formatLongYear(booking.date)}`,
    html: shell(
      origin,
      'Nueva reserva confirmada',
      `Entra ${esc(formatEUR(booking.paid_cents))} de señal. Total previsto: ${esc(formatEUR(booking.subtotal_cents))}.`,
      `${rows([
        ['Referencia', esc(booking.reference)],
        ['Fecha', esc(formatLongYear(booking.date))],
        ['Horario', esc(slotLabel(booking.turn, booking.duration))],
        ['Cliente', esc(booking.customer_name)],
        ['Teléfono', `<a href="tel:${esc(booking.phone)}" style="color:#17172b;">${esc(booking.phone)}</a>`],
        ['Email', esc(booking.email)],
        ['Cumpleañero', `${esc(booking.child_name)}${booking.child_age ? ` (${booking.child_age} años)` : ''}`],
        ['Niños', esc(booking.children)],
        ['Notas', esc(booking.notes ?? '—')],
      ])}
      <p style="margin:0;">${button(`${origin}/admin`, 'Abrir el panel')}</p>`,
    ),
    kind: 'admin_new_booking',
    bookingId: booking.id,
  });
}

export async function sendReminder(booking: Booking, origin: string, days: number): Promise<void> {
  const manage = `${origin}/reserva/${booking.reference}/gestionar?token=${booking.manage_token}`;
  const html = shell(
    origin,
    days <= 1 ? '¡Mañana es el día! 🎂' : 'Tu cumple está a la vuelta de la esquina',
    `Hola ${esc(booking.customer_name)}, os esperamos el ${esc(formatLongYear(booking.date))} a las ${esc(slotLabel(booking.turn, booking.duration).split(' – ')[0])}.`,
    `${rows([
      ['Referencia', esc(booking.reference)],
      ['Horario', esc(slotLabel(booking.turn, booking.duration))],
      ['Dirección', esc(BUSINESS.address)],
      ['Pendiente', esc(formatEUR(Math.max(0, booking.subtotal_cents - booking.paid_cents)))],
    ])}
    <p style="margin:0 0 12px;font-size:15px;line-height:1.7;">Qué traer:</p>
    <ul style="margin:0 0 24px;padding-left:20px;font-size:15px;line-height:1.8;">
      <li>La tarta y la merienda que queráis.</li>
      <li>Calcetines antideslizantes para la piscina de bolas.</li>
      <li>Las ganas de pasarlo bien (nosotros ponemos el resto).</li>
    </ul>
    <p style="margin:0;">${button(manage, 'Ver mi reserva')}</p>`,
  );

  await sendEmail({
    to: booking.email,
    subject: `Recordatorio · ${formatLongYear(booking.date)} · ${booking.reference}`,
    html,
    kind: `reminder_${days}d`,
    bookingId: booking.id,
  });
}

export async function sendBalanceReceipt(booking: Booking, origin: string): Promise<void> {
  await sendEmail({
    to: booking.email,
    subject: `Pago recibido · ${booking.reference}`,
    html: shell(
      origin,
      'Pago recibido ✅',
      'Gracias, ya no queda nada pendiente. Nos vemos el día del cumple.',
      `${rows([
        ['Referencia', esc(booking.reference)],
        ['Fecha', esc(formatLongYear(booking.date))],
        ['Total', esc(formatEUR(booking.subtotal_cents))],
        ['Pagado', esc(formatEUR(booking.paid_cents))],
        ['Pendiente', esc(formatEURExact(Math.max(0, booking.subtotal_cents - booking.paid_cents)))],
      ])}`,
    ),
    kind: 'balance_paid',
    bookingId: booking.id,
  });
}

export async function sendCancellation(booking: Booking, origin: string): Promise<void> {
  await sendEmail({
    to: booking.email,
    subject: `Reserva cancelada · ${booking.reference}`,
    html: shell(
      origin,
      'Reserva cancelada',
      'Hemos cancelado la reserva. Si quieres, puedes elegir otra fecha cuando te venga bien.',
      `${rows([
        ['Referencia', esc(booking.reference)],
        ['Fecha', esc(formatLongYear(booking.date))],
      ])}
      <p style="margin:0;">${button(`${origin}/reservas`, 'Ver disponibilidad')}</p>`,
    ),
    kind: 'cancellation',
    bookingId: booking.id,
  });
}

/** Envía los recordatorios de 48 h y 24 h pendientes. Devuelve cuántos ha enviado. */
export async function runReminders(origin: string): Promise<number> {
  let sent = 0;

  for (const booking of reminderCandidates(2)) {
    await sendReminder(booking, origin, diffDays(booking.date, todayISO()));
    updateBooking(booking.id, { reminder_48_sent: 1 });
    sent++;
  }

  for (const booking of reminderCandidates(1)) {
    await sendReminder(booking, origin, diffDays(booking.date, todayISO()));
    updateBooking(booking.id, { reminder_24_sent: 1 });
    sent++;
  }

  return sent;
}
