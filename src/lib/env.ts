/** Acceso a variables de entorno válido tanto en dev como en el build de Node. */
const viteEnv = import.meta.env as unknown as Record<string, string | undefined>;

export function env(key: string): string | undefined {
  const value = viteEnv[key] ?? process.env[key];
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function siteUrl(fallbackOrigin?: string): string {
  return (env('SITE_URL') ?? fallbackOrigin ?? 'http://localhost:4321').replace(/\/$/, '');
}

export function isDemoPayments(): boolean {
  return !env('STRIPE_SECRET_KEY');
}
