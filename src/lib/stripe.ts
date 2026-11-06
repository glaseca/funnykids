import Stripe from 'stripe';
import { env } from './env';
import type { Booking } from './types';
import { slotLabel } from './config';
import { formatLongYear } from './dates';

let client: Stripe | null = null;

export function stripeClient(): Stripe | null {
  const key = env('STRIPE_SECRET_KEY');
  if (!key) return null;
  if (!client) client = new Stripe(key);
  return client;
}

export function stripeEnabled(): boolean {
  return Boolean(env('STRIPE_SECRET_KEY'));
}

export async function createCheckout(params: {
  booking: Booking;
  amountCents: number;
  kind: 'deposit' | 'balance';
  origin: string;
}): Promise<{ url: string; sessionId: string } | null> {
  const stripe = stripeClient();
  if (!stripe) return null;

  const { booking, amountCents, kind, origin } = params;
  const title = kind === 'deposit' ? `Señal de reserva ${booking.reference}` : `Saldo de reserva ${booking.reference}`;

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    locale: 'es',
    customer_email: booking.email,
    client_reference_id: booking.reference,
    metadata: {
      booking_id: booking.id,
      kind,
    },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'eur',
          unit_amount: amountCents,
          product_data: {
            name: title,
            description: `${formatLongYear(booking.date)} · ${slotLabel(booking.turn, booking.duration)}`,
          },
        },
      },
    ],
    success_url: `${origin}/reserva/${booking.reference}?pago=ok`,
    cancel_url: `${origin}/reserva/${booking.reference}?pago=cancelado`,
    expires_at: Math.floor(Date.now() / 1000) + 31 * 60,
  });

  if (!session.url) return null;
  return { url: session.url, sessionId: session.id };
}
