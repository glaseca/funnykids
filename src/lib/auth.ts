import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { AstroCookieSetOptions } from 'astro';
import { env } from './env';

export const ADMIN_COOKIE = 'fk_admin';

function secret(): string {
  return env('AUTH_SECRET') ?? 'funnykids-dev-secret-cambia-esto';
}

function expectedToken(): string {
  return createHmac('sha256', secret()).update('funnykids:admin:v1').digest('hex');
}

export function adminCookie(): { name: string; value: string; options: AstroCookieSetOptions } {
  return {
    name: ADMIN_COOKIE,
    value: expectedToken(),
    options: {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: import.meta.env.PROD,
      maxAge: 60 * 60 * 12,
    },
  };
}

interface CookieJar {
  get(name: string): { value: string } | undefined;
}

export function isAdmin(cookies: CookieJar): boolean {
  const current = cookies.get(ADMIN_COOKIE)?.value;
  if (!current) return false;
  const a = Buffer.from(current);
  const b = Buffer.from(expectedToken());
  return a.length === b.length && timingSafeEqual(a, b);
}

export function checkPassword(password: string): boolean {
  const real = env('ADMIN_PASSWORD') ?? 'demo1234';
  const a = createHash('sha256').update(password).digest();
  const b = createHash('sha256').update(real).digest();
  return timingSafeEqual(a, b);
}
