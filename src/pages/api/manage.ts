import type { APIRoute } from 'astro';
import { db, getBookingByReference, listPayments, updateBooking } from '../../lib/db';
import { canChangeHeadcount, setBookingStatus, updateHeadcount } from '../../lib/bookings';
import { sendCancellation } from '../../lib/email';
import { siteUrl } from '../../lib/env';
import { stripeClient } from '../../lib/stripe';
import { diffDays, todayISO } from '../../lib/dates';
import { RULES } from '../../lib/config';

export const prerender = false;

function redirect(location: string): Response {
  return new Response(null, { status: 303, headers: { Location: location } });
}

async function refundStripePayments(bookingId: string): Promise<void> {
  const stripe = stripeClient();
  if (!stripe) return;

  const paid = listPayments(bookingId).filter((p) => p.provider === 'stripe' && p.status === 'paid' && p.provider_ref);

  for (const payment of paid) {
    try {
      const session = await stripe.checkout.sessions.retrieve(payment.provider_ref!);
      const intent = session.payment_intent;
      const paymentIntent = typeof intent === 'string' ? intent : intent?.id;
      if (!paymentIntent) continue;

      await stripe.refunds.create({ payment_intent: paymentIntent });
      db().prepare(`UPDATE payments SET status = 'refunded' WHERE id = ?`).run(payment.id);
    } catch (error) {
      console.error('[manage] no se pudo reembolsar el pago', payment.id, error);
    }
  }
}

export const POST: APIRoute = async ({ request }) => {
  const origin = siteUrl(new URL(request.url).origin);
  const data = await request.formData();

  const reference = String(data.get('reference') ?? '').trim().toUpperCase();
  const token = String(data.get('token') ?? '');
  const action = String(data.get('action') ?? '');

  const booking = getBookingByReference(reference);
  if (!booking || !token || token !== booking.manage_token) {
    return redirect(`${origin}/reservas?error=Enlace de gestión no válido.`);
  }

  const manageUrl = `${origin}/reserva/${booking.reference}/gestionar?token=${booking.manage_token}`;

  if (action === 'update-children') {
    if (!canChangeHeadcount(booking)) {
      return redirect(`${manageUrl}&error=${encodeURIComponent('Ya no se puede cambiar el aforo online.')}`);
    }
    const children = Number(data.get('children'));
    const result = updateHeadcount(booking, children);
    if (!result.ok) {
      return redirect(`${manageUrl}&error=${encodeURIComponent(result.message)}`);
    }
    return redirect(`${manageUrl}&ok=ninos`);
  }

  if (action === 'cancel') {
    if (booking.status === 'cancelled') return redirect(`${manageUrl}&ok=cancelada`);

    const days = diffDays(booking.date, todayISO());
    const refundable = days >= RULES.freeCancellationDays && booking.paid_cents > 0;

    if (refundable) {
      await refundStripePayments(booking.id);
    }

    setBookingStatus(booking.id, 'cancelled');
    updateBooking(booking.id, { hold_expires_at: null });

    await sendCancellation(booking, origin);

    return redirect(`${manageUrl}&ok=cancelada`);
  }

  return redirect(`${manageUrl}&error=${encodeURIComponent('Acción no reconocida.')}`);
};
