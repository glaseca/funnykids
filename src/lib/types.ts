export type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'expired';

export type Turn = 'AM' | 'PM';

export type Duration = 2 | 3;

export interface Booking {
  id: string;
  reference: string;
  date: string;
  turn: Turn;
  status: BookingStatus;
  duration: Duration;
  children: number;
  children_final: number | null;
  cleaning: number;
  subtotal_cents: number;
  deposit_cents: number;
  balance_cents: number;
  paid_cents: number;
  customer_name: string;
  email: string;
  phone: string;
  child_name: string;
  child_age: number | null;
  notes: string | null;
  terms_version: string;
  accepted_at: string;
  manage_token: string;
  stripe_session_id: string | null;
  hold_expires_at: string | null;
  created_at: string;
  confirmed_at: string | null;
  cancelled_at: string | null;
  reminder_48_sent: number;
  reminder_24_sent: number;
}

export interface Payment {
  id: string;
  booking_id: string;
  kind: 'deposit' | 'balance';
  amount_cents: number;
  provider: 'stripe' | 'demo' | 'manual';
  provider_ref: string | null;
  status: 'pending' | 'paid' | 'refunded' | 'failed';
  created_at: string;
}

export interface Closure {
  id: number;
  date: string;
  turn: Turn | null;
  reason: string | null;
}

export interface EmailLog {
  id: string;
  booking_id: string | null;
  to_email: string;
  subject: string;
  body: string;
  kind: string;
  provider: 'resend' | 'simulated' | 'error';
  created_at: string;
}
