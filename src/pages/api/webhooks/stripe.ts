import type { APIRoute } from 'astro';
import { env } from '../../../lib/env';
import { getBookingById, forgetWebhook, markWebhookSeen, updateBooking } from '../../../lib/db';
import { registerPayment } from '../../../lib/bookings';
import { sendBalanceReceipt, sendBookingConfirmation } from '../../../lib/email';
import { stripeClient } from '../../../lib/stripe';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const stripe = stripeClient();
  const secret = env('STRIPE_WEBHOOK_SECRET');
  if (!stripe || !secret) {
    return new Response('Stripe no configurado', { status: 503 });
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) return new Response('Falta la firma', { status: 400 });

  const raw = await request.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(raw, signature, secret);
  } catch (error) {
    console.error('[stripe] firma inválida', error);
    return new Response('Firma inválida', { status: 400 });
  }

  if (!markWebhookSeen(event.id)) {
    return new Response(JSON.stringify({ received: true, duplicate: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as {
        id: string;
        amount_total: number | null;
        metadata: Record<string, string> | null;
        client_reference_id: string | null;
      };

      const bookingId = session.metadata?.booking_id;
      const kind = session.metadata?.kind === 'balance' ? 'balance' : 'deposit';

      if (bookingId && session.amount_total) {
        const before = getBookingById(bookingId);
        const wasPending = before?.status === 'pending';

        const result = registerPayment({
          bookingId,
          kind,
          amountCents: session.amount_total,
          provider: 'stripe',
          providerRef: session.id,
        });

        if (result.ok) {
          const origin = env('SITE_URL') ?? 'http://localhost:4321';
          if (wasPending) await sendBookingConfirmation(result.booking, origin);
          else if (kind === 'balance') await sendBalanceReceipt(result.booking, origin);
        } else {
          console.error('[stripe] pago sin reserva aplicable', bookingId, result.reason);
        }
      }
    }

    if (event.type === 'checkout.session.expired') {
      const session = event.data.object as { metadata: Record<string, string> | null };
      const bookingId = session.metadata?.booking_id;
      if (bookingId) {
        const booking = getBookingById(bookingId);
        if (booking && booking.status === 'pending') {
          updateBooking(booking.id, { status: 'expired' });
        }
      }
    }
  } catch (error) {
    console.error('[stripe] error procesando webhook', error);
    forgetWebhook(event.id);
    return new Response('Error procesando el evento', { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
