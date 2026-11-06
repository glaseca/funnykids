import type { APIRoute } from 'astro';
import { getBookingByReference, updateBooking } from '../../lib/db';
import { siteUrl } from '../../lib/env';
import { createCheckout, stripeEnabled } from '../../lib/stripe';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const origin = siteUrl(new URL(request.url).origin);
  const data = await request.formData();
  const reference = String(data.get('reference') ?? '').trim().toUpperCase();
  const kind = data.get('kind') === 'balance' ? 'balance' : 'deposit';

  const booking = getBookingByReference(reference);
  if (!booking) return redirect(`${origin}/reservas?error=Reserva no encontrada.`);

  const amount = kind === 'deposit' ? booking.deposit_cents : Math.max(0, booking.subtotal_cents - booking.paid_cents);
  if (amount <= 0) return redirect(`${origin}/reserva/${booking.reference}`);

  if (!stripeEnabled()) return redirect(`${origin}/pago-demo/${booking.reference}`);

  try {
    const checkout = await createCheckout({ booking, amountCents: amount, kind, origin });
    if (!checkout) return redirect(`${origin}/reserva/${booking.reference}?pago=error`);

    if (kind === 'deposit') updateBooking(booking.id, { stripe_session_id: checkout.sessionId });

    return redirect(checkout.url);
  } catch (error) {
    console.error('[pay] error creando checkout', error);
    return redirect(`${origin}/reserva/${booking.reference}?pago=error`);
  }
};

function redirect(location: string): Response {
  return new Response(null, { status: 303, headers: { Location: location } });
}
