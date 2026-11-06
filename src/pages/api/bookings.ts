import type { APIRoute } from 'astro';
import { createBooking } from '../../lib/bookings';
import { updateBooking } from '../../lib/db';
import { isValidDuration, isValidTurn, type Duration, type Turn } from '../../lib/config';
import { siteUrl } from '../../lib/env';
import { createCheckout, stripeEnabled } from '../../lib/stripe';

export const prerender = false;

function fail(origin: string, message: string, data: FormData): Response {
  const url = new URL('/reservas', origin);
  const date = String(data.get('date') ?? '');
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    url.searchParams.set('mes', date.slice(0, 7));
    url.searchParams.set('fecha', date);
  }
  const turn = String(data.get('turn') ?? '');
  if (isValidTurn(turn)) url.searchParams.set('turno', turn);
  const duration = Number(data.get('duration'));
  if (isValidDuration(duration)) url.searchParams.set('duracion', String(duration));
  const children = Number(data.get('children'));
  if (Number.isInteger(children)) url.searchParams.set('ninos', String(children));
  url.searchParams.set('error', message);
  return new Response(null, { status: 303, headers: { Location: url.toString() } });
}

export const POST: APIRoute = async ({ request }) => {
  const origin = siteUrl(new URL(request.url).origin);
  const data = await request.formData();

  if (data.get('terms') !== '1') {
    return fail(origin, 'Tienes que aceptar las condiciones de reserva para continuar.', data);
  }

  const date = String(data.get('date') ?? '');
  const turnRaw = String(data.get('turn') ?? '');
  const durationRaw = Number(data.get('duration'));
  const childrenRaw = Number(data.get('children'));
  const childAgeRaw = String(data.get('childAge') ?? '').trim();

  if (!isValidTurn(turnRaw)) return fail(origin, 'La franja elegida no es válida.', data);
  if (!isValidDuration(durationRaw)) return fail(origin, 'La duración elegida no es válida.', data);

  const turn = turnRaw as Turn;
  const duration = durationRaw as Duration;

  const result = createBooking({
    date,
    turn,
    duration,
    children: childrenRaw,
    cleaning: data.get('cleaning') === '1',
    customerName: String(data.get('customerName') ?? ''),
    email: String(data.get('email') ?? ''),
    phone: String(data.get('phone') ?? ''),
    childName: String(data.get('childName') ?? ''),
    childAge: childAgeRaw ? Number(childAgeRaw) : null,
    notes: String(data.get('notes') ?? '').trim() || null,
  });

  if (!result.ok) return fail(origin, result.message, data);

  const booking = result.booking;

  if (!stripeEnabled()) {
    return new Response(null, {
      status: 303,
      headers: { Location: `${origin}/pago-demo/${booking.reference}` },
    });
  }

  try {
    const checkout = await createCheckout({
      booking,
      amountCents: booking.deposit_cents,
      kind: 'deposit',
      origin,
    });

    if (!checkout) {
      updateBooking(booking.id, { status: 'cancelled', cancelled_at: new Date().toISOString() });
      return fail(origin, 'No hemos podido iniciar el pago. Inténtalo de nuevo en un minuto.', data);
    }

    updateBooking(booking.id, { stripe_session_id: checkout.sessionId });

    return new Response(null, {
      status: 303,
      headers: { Location: checkout.url },
    });
  } catch (error) {
    console.error('[bookings] no se pudo crear el checkout', error);
    updateBooking(booking.id, { status: 'cancelled', cancelled_at: new Date().toISOString() });
    return fail(origin, 'El pago no está disponible ahora mismo. Prueba otra vez en unos minutos.', data);
  }
};
