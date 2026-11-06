import type { APIRoute } from 'astro';
import { isAdmin } from '../../lib/auth';
import {
  addClosure,
  getBookingById,
  removeClosure,
  updateBooking,
} from '../../lib/db';
import { markBalancePaidManually, setBookingStatus } from '../../lib/bookings';
import { sendBalanceReceipt, runReminders } from '../../lib/email';
import { isValidTurn } from '../../lib/config';
import { siteUrl } from '../../lib/env';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  const origin = siteUrl(new URL(request.url).origin);

  if (!isAdmin(cookies)) {
    return new Response(null, { status: 303, headers: { Location: `${origin}/admin/login` } });
  }

  const data = await request.formData();
  const action = String(data.get('action') ?? '');
  const id = String(data.get('id') ?? '');

  const back = new URL('/admin', origin);

  try {
    switch (action) {
      case 'confirm':
        setBookingStatus(id, 'confirmed');
        break;

      case 'cancel': {
        setBookingStatus(id, 'cancelled');
        updateBooking(id, { hold_expires_at: null });
        break;
      }

      case 'complete':
        setBookingStatus(id, 'completed');
        break;

      case 'mark-paid': {
        markBalancePaidManually(id);
        const booking = getBookingById(id);
        if (booking) await sendBalanceReceipt(booking, origin);
        break;
      }

      case 'add-closure': {
        const date = String(data.get('date') ?? '');
        const turnRaw = String(data.get('turn') ?? '');
        const reason = String(data.get('reason') ?? '').trim() || null;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Fecha no válida');
        const turn = turnRaw && isValidTurn(turnRaw) ? turnRaw : null;
        addClosure(date, turn, reason);
        break;
      }

      case 'remove-closure': {
        const closureId = Number(data.get('closureId'));
        if (Number.isInteger(closureId)) removeClosure(closureId);
        break;
      }

      case 'run-reminders': {
        const sent = await runReminders(origin);
        back.searchParams.set('ok', `Recordatorios enviados: ${sent}`);
        return new Response(null, { status: 303, headers: { Location: back.toString() } });
      }

      default:
        throw new Error('Acción no reconocida');
    }
  } catch (error) {
    console.error('[admin] error', action, error);
    back.searchParams.set('error', 'No se pudo completar la acción.');
    return new Response(null, { status: 303, headers: { Location: back.toString() } });
  }

  back.searchParams.set('ok', 'Cambios guardados.');
  return new Response(null, { status: 303, headers: { Location: back.toString() } });
};
