import type { APIRoute } from 'astro';
import { env, siteUrl } from '../../../lib/env';
import { runReminders } from '../../../lib/email';

export const prerender = false;

async function handle({ request, url }: { request: Request; url: URL }): Promise<Response> {
  const expected = env('CRON_SECRET');
  if (!expected) {
    return new Response(JSON.stringify({ error: 'CRON_SECRET no configurado' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const provided = request.headers.get('x-cron-secret') ?? url.searchParams.get('secret');
  if (provided !== expected) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const origin = siteUrl(new URL(request.url).origin);
  const sent = await runReminders(origin);

  return new Response(JSON.stringify({ ok: true, sent }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const GET: APIRoute = ({ request, url }) => handle({ request, url });
export const POST: APIRoute = ({ request, url }) => handle({ request, url });
