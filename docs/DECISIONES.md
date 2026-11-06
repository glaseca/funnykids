# Decisiones del proyecto — Funny Kids

Documento vivo con las decisiones acordadas para la web y el sistema de reservas.
Última actualización: 6 de noviembre de 2026.

---

## 1. Negocio y alcance

- **Negocio:** sala de fiestas infantiles en Getafe (Madrid), una sola sede.
- **Modelo:** alquiler de la sala en exclusiva por franjas. No se vende comida ni animación.
- **Web:** sitio de marketing + motor de reservas propio integrado.
- **Contenido:** los textos, precios, dirección, teléfono, reseñas y fotos actuales son **de demostración**. El usuario los sustituirá por los reales.
- **Fuera de alcance:** Verifactu y facturación fiscal. No se emite factura desde la app en esta fase.

## 2. Ocupación y franjas

- **Una reserva por franja** (sala completa en exclusiva).
- **Dos franjas al día:**
  - Mañana: 10:30 – 13:30
  - Tarde: 16:30 – 19:30
- **Duración contratable:** 2 o 3 horas desde la hora de inicio.
- **Buffer de limpieza:** 30 minutos antes/después. La franja incluye 30 min antes para montar.
- **Antelación mínima online:** 3 días.
- **Horizonte máximo:** 180 días.
- **Bloqueo temporal:** al iniciar la reserva, la franja se retiene 35 minutos hasta completar el pago.

## 3. Precios y pagos

- **15 €/niño** para 2 horas.
- **20 €/niño** para 3 horas.
- **Limpieza opcional:** +20 €.
- **Mínimo:** 10 niños. **Máximo:** 50 niños.
- **IVA incluido** en todos los precios mostrados.
- **Señal:** 50 € fijos, descontables del total.
- **Resto:** se paga online con un enlace por reserva, o en el local el día del evento.
- **Pasarela:** Stripe Checkout. Se aceptan tarjeta y **Bizum** (Stripe lo soporta en EUR para pagos únicos).
- **Sin cuotas anuales de plugins.** Solo comisiones de Stripe.
- **Bizum en Stripe:** no se fija `payment_method_types`, para que Stripe muestre automáticamente tarjeta, Bizum y wallets según el país/dispositivo.

## 4. Cancelaciones y cambios

- **Devolución íntegra de la señal** si se cancela con **≥ 7 días** de antelación.
- **Sin devolución** con menos de 7 días (la franja ya está bloqueada).
- **Cambio de fecha:** gratuito hasta 7 días antes, sujeto a disponibilidad. Se gestiona a mano.
- **Cambio de aforo:** online hasta **48 horas** antes. El precio se recalcula automáticamente.
- Los cambios de aforo nunca bajan del mínimo de 10 niños ni suben de 50.

## 5. Stack técnico

- **Astro 7** en modo `server` (SSR) con adaptador **`@astrojs/node`** en modo standalone.
- **Tailwind CSS 4** mediante `@tailwindcss/vite`.
- **TypeScript** estricto.
- **Base de datos:** SQLite con el módulo nativo **`node:sqlite`** (Node 22.12+ / 24).
  - Sin ORM ni dependencias externas de base de datos.
  - Fichero en `data/funnykids.db` (ignorado por git).
- **Pagos:** SDK oficial de **Stripe** (`stripe` v23).
- **Emails:** **Resend** vía API HTTP (sin SDK), con plantillas HTML propias.
- **Sesión de admin:** cookie HMAC firmada con `AUTH_SECRET`. Sin tabla de usuarios.
- **Node requerido:** ≥ 22.12 (probado con 24.13).

### Por qué no WordPress / plugins

- Se descartó WordPress + WooCommerce por:
  - El plugin oficial de Stripe para WooCommerce **no soporta Bizum**.
  - WooCommerce Bookings (~225 €/año), Deposits (~198 €/año) y Product Add-ons (~72 €/año) suman costes recurrentes.
  - Menos control visual y de flujo.
- Se descartaron widgets de reserva de terceros por límites de diseño y coste.

## 6. Modo demo

La app funciona sin configurar nada:

- **Sin `STRIPE_SECRET_KEY`:** los pagos se simulan en `/pago-demo/[referencia]`. No se mueve dinero.
- **Sin `RESEND_API_KEY`:** los emails no se envían; se guardan en la tabla `emails` y se pueden ver en `/admin`.
- **Admin por defecto:** contraseña `demo1234` (variable `ADMIN_PASSWORD`).
- **Datos de ejemplo:** al crear la base de datos se insertan 2 reservas confirmadas en los dos próximos sábados para que el calendario no esté vacío.
- Para empezar de cero: borrar `data/funnykids.db` y reiniciar.

## 7. Seguridad y privacidad

- La gestión de una reserva requiere un **token aleatorio** además de la referencia.
- El panel `/admin` está protegido por cookie HttpOnly, SameSite=Lax y Secure en producción.
- Los webhooks de Stripe se verifican con firma y son **idempotentes** (tabla `webhook_events` + comprobación de `provider_ref`).
- No se almacenan datos de tarjeta. Stripe gestiona el pago.
- Protección de datos: consentimiento explícito en el formulario y páginas legales de demo (aviso, privacidad, condiciones).
- Pendiente antes de producción: revisar textos legales con asesoría y sustituir datos de demo.

## 8. Despliegue

- La app necesita **proceso Node persistente y disco persistente** por `node:sqlite`.
- Opciones válidas: VPS, Railway, Render con disco, Fly.io con volumen, Docker propio.
- **No encaja** en funciones serverless con sistema de ficheros efímero (Vercel/Netlify/Cloudflare Workers) sin cambiar la capa de datos.
- Si más adelante se quiere serverless, migrar `src/lib/db.ts` a Turso/libSQL o Postgres. La interfaz de acceso está concentrada en ese archivo.
- Configurar webhook de Stripe a `https://dominio/api/webhooks/stripe` con los eventos:
  - `checkout.session.completed`
  - `checkout.session.expired`
- Recordatorios: llamar a `/api/cron/reminders` con la cabecera `x-cron-secret` (o `?secret=`) desde un cron externo.

## 9. Convenciones de código

- Precios siempre en **céntimos** (`formatEUR` / `formatEURExact`).
- Fechas como strings `YYYY-MM-DD` y aritmética en UTC para evitar problemas de cambio de hora.
- Zona horaria de negocio: `Europe/Madrid`.
- `node:sqlite` no acepta booleanos JS: usar `0`/`1`.
- Todo el acceso a base de datos es **solo servidor**.
- Los endpoints de formulario responden con `303 See Other` (patrón Post/Redirect/Get).

## 10. Estructura

```
src/
  components/      Header, Footer, Logo, Icon, PhotoTile, HeroScene
  layouts/         BaseLayout (web pública) y modo bare para admin
  lib/             site, config, dates, types, env, money, db, availability,
                   bookings, auth, stripe, email
  pages/           páginas públicas, reservas, gestión, admin y API
  styles/          global.css (tema Tailwind 4)
public/            favicon y futuras fotos
data/              SQLite (no versionado)
docs/              este documento
```

## 11. Pendiente / siguientes pasos

- [ ] Sustituir textos y datos de `src/lib/site.ts` por los reales.
- [ ] Sustituir ilustraciones/emojis por fotos reales (crear `public/img/` y adaptar `PhotoTile`).
- [ ] Crear cuenta de Stripe, activar Bizum y probar en modo test.
- [ ] Crear cuenta de Resend y verificar el dominio.
- [ ] Configurar `SITE_URL`, `AUTH_SECRET`, `ADMIN_PASSWORD` y `CRON_SECRET` reales.
- [ ] Revisar legal (aviso, privacidad, condiciones) con los datos fiscales reales.
- [ ] Elegir hosting con disco persistente y configurar backups de `data/funnykids.db`.
- [ ] Configurar cron de recordatorios (48 h y 24 h).
