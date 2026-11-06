import type { APIRoute } from 'astro';
import { ADMIN_COOKIE, adminCookie, checkPassword } from '../../lib/auth';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  const data = await request.formData();
  const action = String(data.get('action') ?? 'login');

  if (action === 'logout') {
    cookies.delete(ADMIN_COOKIE, { path: '/' });
    return new Response(null, { status: 303, headers: { Location: '/admin/login' } });
  }

  const password = String(data.get('password') ?? '');
  if (!checkPassword(password)) {
    return new Response(null, { status: 303, headers: { Location: '/admin/login?error=1' } });
  }

  const cookie = adminCookie();
  cookies.set(cookie.name, cookie.value, cookie.options);

  return new Response(null, { status: 303, headers: { Location: '/admin' } });
};
