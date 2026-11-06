# Funny Kids — web y reservas

Web de marketing y motor de reservas para una sala de fiestas infantiles en Getafe.
Astro 7 (SSR) + Tailwind 4 + SQLite (`node:sqlite`) + Stripe + Resend.

> **Todo el contenido actual es de demostración.** Textos, precios, dirección, teléfono, reseñas e imágenes son inventados y están pensados para sustituirse por los reales. Ver `docs/DECISIONES.md`.

---

## Arrancar en local

Requisitos:

- **Node ≥ 22.12** (probado con 24.13).
- npm 10+.

```bash
npm install
cp .env.example .env   # opcional en modo demo
npm run dev
```

Abre http://localhost:4321.

No hace falta configurar nada para probar:

- Los pagos se **simulan** en `/pago-demo/[referencia]`.
- Los emails se **guardan en la base de datos** y se ven en `/admin`.
- El panel está en `/admin` con la contraseña **`demo1234`**.

### Scripts

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo con HMR en el puerto 4321 |
| `npm run build` | Build de producción (SSR) |
| `npm run start` | Arranca el build con `node ./dist/server/entry.mjs` |
| `npm run preview` | Previsualiza el build |
| `npm run check` | Comprobación de tipos de Astro/TypeScript |

---

## Configuración

Copia `.env.example` a `.env`. Todas las variables son opcionales en demo.

| Variable | Uso |
| --- | --- |
| `SITE_URL` | URL pública. Se usa en redirects de Stripe y enlaces de emails. |
| `STRIPE_SECRET_KEY` | Clave secreta de Stripe. Sin ella, modo demo. |
| `STRIPE_WEBHOOK_SECRET` | Secreto del webhook (`whsec_...`). |
| `RESEND_API_KEY` | API key de Resend. Sin ella, emails simulados. |
| `EMAIL_FROM` | Remitente verificado, p. ej. `Funny Kids <reservas@tudominio.es>`. |
| `ADMIN_EMAIL` | Recibe un aviso de cada nueva reserva. |
| `ADMIN_PASSWORD` | Contraseña del panel. Por defecto `demo1234`. |
| `AUTH_SECRET` | Cadena larga aleatoria para firmar la cookie de admin. |
| `DB_PATH` | Ruta del SQLite. Por defecto `./data/funnykids.db`. |
| `CRON_SECRET` | Secreto para `/api/cron/reminders`. |

### Activar Stripe

1. Crea la cuenta y activa **Bizum** en Stripe (pagos únicos en EUR).
2. Copia la clave secreta en `STRIPE_SECRET_KEY`.
3. En local, escucha webhooks:

   ```bash
   stripe listen --forward-to localhost:4321/api/webhooks/stripe
   ```

   Copia el `whsec_...` en `STRIPE_WEBHOOK_SECRET`.
4. En producción, crea el endpoint `https://TU-DOMINIO/api/webhooks/stripe` y suscríbete a:
   - `checkout.session.completed`
   - `checkout.session.expired`

No se fija `payment_method_types` a propósito: así Stripe ofrece tarjeta, Bizum y wallets automáticamente.

### Activar emails (Resend)

1. Crea la cuenta y verifica el dominio.
2. Rellena `RESEND_API_KEY` y `EMAIL_FROM`.
3. Ajusta `ADMIN_EMAIL`.

Plantillas incluidas: confirmación de reserva, aviso al negocio, recordatorio 48 h / 24 h, recibo de saldo y cancelación.

### Recordatorios automáticos

```bash
curl -H "x-cron-secret: $CRON_SECRET" https://TU-DOMINIO/api/cron/reminders
```

Programa una llamada diaria (cron, GitHub Actions, EasyCron, etc.). También se pueden lanzar a mano desde el panel.

---

## Cómo cambiar el contenido

### Textos y datos del negocio

Casi todo está en **`src/lib/site.ts`**: nombre, dirección, teléfono, email, redes, horarios, salas, FAQ, testimonios y galería.

### Precios y reglas

En **`src/lib/config.ts`**:

```ts
export const TURNS = { AM: {...}, PM: {...} };
export const RULES = { minChildren: 10, maxChildren: 50, leadDays: 3, ... };
export const PRICING = { perChild2h: 1500, perChild3h: 2000, cleaning: 2000, deposit: 5000 };
```

Los importes están en **céntimos**.

### Fotos

Ahora mismo las “fotos” son ilustraciones SVG y tarjetas con emoji (`PhotoTile.astro` y `HeroScene.astro`), para que la demo no dependa de imágenes externas.

Para poner fotos reales:

1. Crea `public/img/` y sube las fotos (JPG/WebP optimizados).
2. Sustituye los `<PhotoTile ... />` por, por ejemplo:

   ```astro
   <img src="/img/piscina-bolas.webp" alt="Piscina de bolas" class="h-64 w-full rounded-[2rem] object-cover" loading="lazy" />
   ```

3. Los sitios donde se usan están en `src/pages/index.astro`, `salas.astro`, `contacto.astro` y `src/lib/site.ts` (galería).

### Páginas legales

`src/pages/legal/[slug].astro` contiene aviso legal, privacidad y condiciones. Son textos de demo: **revísalos y adapta los datos fiscales reales antes de publicar**.

---

## Cómo funciona el motor de reservas

1. `/reservas` calcula la disponibilidad del mes en servidor (`src/lib/availability.ts`).
2. El usuario elige día, franja y duración; el precio se actualiza en vivo con JS.
3. `POST /api/bookings` valida, crea la reserva en estado `pending` y bloquea la franja 35 minutos.
4. Si Stripe está configurado, redirige a Checkout; si no, a `/pago-demo/[referencia]`.
5. El pago (webhook o demo) llama a `registerPayment`, marca la reserva como `confirmed` y envía los emails.
6. El cliente recibe un enlace con token para **gestionar** aforo, pagar el saldo o cancelar.
7. El panel `/admin` permite confirmar, cancelar, marcar pagos, cerrar días y ver la bandeja de emails simulados.

### Estados de una reserva

| Estado | Significado |
| --- | --- |
| `pending` | Creada, esperando la señal. Bloquea la franja hasta `hold_expires_at`. |
| `confirmed` | Señal cobrada. |
| `completed` | Evento celebrado (marcado a mano). |
| `cancelled` | Cancelada por el cliente o el negocio. Libera la franja. |
| `expired` | Se agotó el tiempo de pago. Libera la franja. |

### Base de datos

- Fichero: `data/funnykids.db` (WAL). **No se versiona.**
- Tablas: `bookings`, `payments`, `closures`, `emails`, `webhook_events`.
- Índice único parcial `ux_slot_active` para impedir dos reservas activas en la misma franja.
- Al borrar el fichero, se recrea solo con 2 reservas de ejemplo.

> Haz **backup** de este fichero en producción. Es toda la operativa del negocio.

---

## Despliegue

La app necesita:

- Proceso **Node persistente**.
- **Disco persistente** para el SQLite.

Opciones recomendadas: VPS, Railway, Render con disco, Fly.io con volumen o Docker.
No encaja en serverless con filesystem efímero (Vercel/Netlify/Cloudflare) sin migrar la base de datos a Turso/libSQL o Postgres.

```bash
npm ci
npm run build
SITE_URL=https://tudominio.es node ./dist/server/entry.mjs
```

Checklist antes de publicar:

- [ ] `SITE_URL` con el dominio real.
- [ ] `AUTH_SECRET` y `ADMIN_PASSWORD` fuertes.
- [ ] Stripe en modo live + Bizum activo + webhook verificado.
- [ ] Resend con dominio verificado.
- [ ] Cron de recordatorios configurado.
- [ ] Backup diario de `data/funnykids.db`.
- [ ] Textos legales y datos fiscales reales.
- [ ] Fotos y textos definitivos.

---

## Estructura

```
src/
  components/   Header, Footer, Logo, Icon, PhotoTile, HeroScene
  layouts/      BaseLayout (público y modo bare de admin)
  lib/          site, config, dates, types, env, money, db, availability,
                bookings, auth, stripe, email
  pages/
    index, salas, precios, contacto, reservas
    legal/[slug]
    reserva/[reference]                confirmación
    reserva/[reference]/gestionar      gestión con token
    pago-demo/[reference]              pago simulado
    admin/                             panel y login
    api/                               bookings, pay, demo-pay, manage, auth,
                                       admin, webhooks/stripe, cron, ics
  styles/       global.css
public/         favicon y futuras fotos
data/           SQLite (ignorado por git)
docs/           decisiones del proyecto
```

## Notas

- `node:sqlite` emite un `ExperimentalWarning` al arrancar; es normal y no afecta al funcionamiento.
- Los precios se guardan en céntimos para evitar errores de coma flotante.
- Las fechas se manejan como `YYYY-MM-DD` y en UTC internamente; la zona de negocio es `Europe/Madrid`.
- Verifactu y la facturación fiscal están **fuera de alcance** en esta fase.
