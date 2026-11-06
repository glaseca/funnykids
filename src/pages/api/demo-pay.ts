import type { APIRoute } from 'astro';
import { getBookingByReference } from '../../lib/db';
import { registerPayment } from '../../lib/bookings';
import { sendBalanceReceipt, sendBookingConfirmation } from '../../lib/email';
import { siteUrl } from '../../lib/env';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const origin = siteUrl(new URL(request.url).origin);
  const data = await request.formData();
  const reference = String(data.get('reference') ?? '').trim().toUpperCase();
  const kind = data.get('kind') === 'balance' ? 'balance' : 'deposit';

  const booking = getBookingByReference(reference);
  if (!booking) return AstroRedirect(`${origin}/reservas?error=Reserva no encontrada.`);

  if (kind === 'deposit' && booking.status !== 'pending') {
    return AstroRedirect(`${origin}/reserva/${booking.reference}`);
  }

  const amount = kind === 'deposit' ? booking.deposit_cents : Math.max(0, booking.subtotal_cents - booking.paid_cents);
  if (amount <= 0) return AstroRedirect(`${origin}/reserva/${booking.reference}`);

  const wasPending = booking.status === 'pending';

  const result = registerPayment({
    bookingId: booking.id,
    kind,
    amountCents: amount,
    provider: 'demo',
    providerRef: null,
  });

  if (!result.ok) {
    return AstroRedirect(`${origin}/reserva/${booking.reference}?pago=error`);
  }

  if (wasPending) {
    await sendBookingConfirmation(result.booking, origin);
  } else if (kind === 'balance') {
    await sendBalanceReceipt(result.booking, origin);
  }

  return AstroRedirect(`${origin}/reserva/${booking.reference}?pago=ok`);
};

function AstroRedirect(location: string): Response {
  return new Response(null, { status: 303, headers: { Location: location } });
}
