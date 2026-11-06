/**
 * Datos de marca y contenido editorial (DEMO).
 * Cuando tengas los datos reales, este es el único archivo que hay que tocar
 * para textos, contacto y redes sociales.
 */

export const BUSINESS = {
  name: 'Funny Kids',
  legalName: 'Funny Kids Eventos S.L. (demo)',
  tagline: 'Fiestas infantiles en Getafe',
  claim: 'El cumpleaños que van a recordar. Y tú, sin organizar nada.',
  description:
    'Una sala de fiestas infantiles con piscina de bolas, futbolín, zona de merienda y espacio para las familias. Tú traes la tarta, nosotros ponemos el resto.',
  address: 'Calle de la Alegría, 24 · 28901 Getafe, Madrid',
  addressShort: 'Getafe, Madrid',
  phone: '+34 600 123 456',
  phoneHref: 'tel:+34600123456',
  whatsapp: 'https://wa.me/34600123456',
  email: 'hola@funnykids.es',
  mapsUrl: 'https://maps.google.com/?q=Getafe+Madrid',
  instagram: 'https://instagram.com/funnykids',
  tiktok: 'https://tiktok.com/@funnykids',
  facebook: 'https://facebook.com/funnykids',
  hours: [
    { days: 'Viernes', time: '17:00 – 20:30' },
    { days: 'Sábado y domingo', time: '10:30 – 14:00 · 16:30 – 20:00' },
    { days: 'Lunes a jueves', time: 'Cerrado (reservas privadas bajo petición)' },
  ],
  capacity: 50,
} as const;

export const NAV = [
  { href: '/', label: 'Inicio' },
  { href: '/salas', label: 'Las salas' },
  { href: '/precios', label: 'Precios' },
  { href: '/reservas', label: 'Reservas' },
  { href: '/contacto', label: 'Contacto' },
] as const;

export const FEATURES = [
  {
    icon: 'ball',
    title: 'Piscina de bolas',
    text: 'La sala principal, con tobogán, rampa y zona de saltos. Controlada y con suelo acolchado.',
    color: 'mint',
  },
  {
    icon: 'foosball',
    title: 'Futbolín y juegos',
    text: 'Futbolín, dianas y rincones de juego para todas las edades. Sin pantallas de por medio.',
    color: 'sun',
  },
  {
    icon: 'cake',
    title: 'Zona de merienda',
    text: 'Mesas, microondas, nevera y fregadero. Trae la tarta y lo que necesites, aquí lo preparas.',
    color: 'coral',
  },
  {
    icon: 'sofa',
    title: 'Zona de familias',
    text: 'Sofás y mesas altas junto a la sala, con visibilidad directa. Los adultos también caben.',
    color: 'lilac',
  },
] as const;

export const ROOMS = [
  {
    id: 'principal',
    name: 'Sala principal',
    kicker: 'El corazón de Funny Kids',
    text: 'Más de 120 m² diáfanos con piscina de bolas, tobogán y suelo acolchado. Es donde ocurre la fiesta: carreras, saltos y risas. La sala se reserva en exclusiva para tu grupo, sin otros cumpleaños dentro.',
    bullets: [
      'Piscina de bolas con tobogán y rampa',
      'Suelo acolchado y protecciones en paredes',
      'Aforo para 50 niños y acompañantes',
      'Música y megafonía incluidas',
    ],
    color: 'mint',
    emoji: '🎈',
  },
  {
    id: 'futbolin',
    name: 'Sala de juegos',
    kicker: 'Para los que no paran',
    text: 'Una sala auxiliar con futbolín, diana y juegos de mesa. Perfecta para los que se cansan de la piscina de bolas o para los hermanos mayores que ya no suben al tobogán.',
    bullets: [
      'Futbolín profesional',
      'Diana de velcro y juegos de puntería',
      'Rincón de juegos de mesa',
      'Iluminación cálida y sin ruido',
    ],
    color: 'sun',
    emoji: '⚽',
  },
  {
    id: 'merienda',
    name: 'Zona de merienda',
    kicker: 'Tarta, sandwiches y lo que traigas',
    text: 'Mesas largas, sillas a la altura de los peques y todo lo necesario para servir. No vendemos comida: tú traes la tarta, los sandwiches o las patatas, y aquí lo preparas con tranquilidad.',
    bullets: [
      'Microondas, nevera y congelador',
      'Fregadero y menaje básico',
      'Mesas y sillas para 50 personas',
      'Fuente de agua y vasos reutilizables',
    ],
    color: 'coral',
    emoji: '🎂',
  },
  {
    id: 'familias',
    name: 'Zona de familias',
    kicker: 'Los adultos también tienen su sitio',
    text: 'Sofás, mesas altas y cafetera. Está junto a la sala principal, con visibilidad directa, para que puedas estar tranquilo sin perder de vista a los peques.',
    bullets: [
      'Sofás y mesas altas',
      'Cafetera y agua caliente',
      'Visibilidad directa a la sala principal',
      'Enchufes y wifi',
    ],
    color: 'lilac',
    emoji: '☕',
  },
  {
    id: 'banos',
    name: 'Baños y cambiador',
    kicker: 'Pensado para los más pequeños',
    text: 'Dos baños completos, uno de ellos con cambiador y altura adaptada. Con dispensadores de jabón, secamanos y todo lo necesario para una tarde larga.',
    bullets: [
      'Baño adaptado con cambiador',
      'Dispensadores y secamanos',
      'Acceso directo desde la sala',
      'Limpieza entre reservas',
    ],
    color: 'sky',
    emoji: '🧼',
  },
] as const;

export const STEPS = [
  {
    n: '01',
    title: 'Elige día y hora',
    text: 'Consulta el calendario en tiempo real. Verás al instante qué mañanas y tardes están libres.',
  },
  {
    n: '02',
    title: 'Reserva con 50 €',
    text: 'Dejas una señal de 50 € con tarjeta o Bizum. El resto lo pagas cuando quieras, antes del cumple.',
  },
  {
    n: '03',
    title: 'Trae la tarta',
    text: 'Nosotros ponemos el espacio y la limpieza. Tú traes la tarta, la merienda y las ganas.',
  },
] as const;

export const FAQ = [
  {
    q: '¿Podemos llevar comida y bebida?',
    a: 'Sí. No vendemos comida: puedes traer tarta, sandwiches, patatas, refrescos y lo que necesites. La zona de merienda tiene microondas, nevera, congelador, fregadero y menaje básico.',
  },
  {
    q: '¿Cuántos niños entran?',
    a: 'El aforo máximo es de 50 niños. El mínimo para reservar es de 10 niños. Si venís menos, el precio mínimo se calcula sobre 10 niños.',
  },
  {
    q: '¿La sala es solo para nosotros?',
    a: 'Sí. Cada franja se reserva en exclusiva: no compartirás la sala con otro cumpleaños. Hay una franja de mañana y otra de tarde por día.',
  },
  {
    q: '¿Qué pasa si llueve o surge un imprevisto?',
    a: 'Al ser una sala cubierta, la lluvia no afecta. Si necesitas cambiar la fecha, puedes hacerlo sin coste hasta 7 días antes, sujeto a disponibilidad.',
  },
  {
    q: '¿Puedo cancelar?',
    a: 'Puedes cancelar con devolución íntegra de la señal hasta 7 días antes del evento. A partir de ahí, la señal no es reembolsable porque la franja ya está bloqueada.',
  },
  {
    q: '¿Hay que llevar algo especial?',
    a: 'Recomendamos calcetines antideslizantes para la piscina de bolas (los peques se lo pasan mejor y es más seguro). Nosotros ponemos el resto: mesas, sillas, menaje y limpieza.',
  },
  {
    q: '¿Se puede entrar antes para montar?',
    a: 'La franja incluye 30 minutos antes para que puedas decorar y montar la merienda con calma. Te lo contamos todo en el email de confirmación.',
  },
  {
    q: '¿Cómo se paga el resto?',
    a: 'Con un enlace de pago seguro que te enviamos por email. Puedes pagarlo cuando quieras antes del cumpleaños, con tarjeta o Bizum. También puedes pagarlo en el local el mismo día.',
  },
] as const;

export const TESTIMONIALS = [
  {
    quote:
      'Reservamos en dos minutos y el día del cumple solo tuvimos que llegar con la tarta. La sala estaba impecable y los niños no querían irse.',
    author: 'Marta R.',
    detail: 'Cumpleaños de 7 años · Getafe',
  },
  {
    quote:
      'Lo mejor, que la sala es solo para ti. Pudimos estar los padres tranquilamente mientras los peques saltaban. Repetiremos seguro.',
    author: 'Javier y Ana',
    detail: 'Cumpleaños de 5 años · Leganés',
  },
  {
    quote:
      'El futbolín fue un éxito total, incluso para los mayores. Y la zona de merienda con microondas nos salvó con la tarta.',
    author: 'Lucía P.',
    detail: 'Cumpleaños de 9 años · Fuenlabrada',
  },
] as const;

export const GALLERY = [
  { label: 'Piscina de bolas', emoji: '🟡', color: 'mint', span: 'lg:col-span-2 lg:row-span-2' },
  { label: 'Tobogán', emoji: '🎢', color: 'sun', span: '' },
  { label: 'Futbolín', emoji: '⚽', color: 'coral', span: '' },
  { label: 'Zona de merienda', emoji: '🎂', color: 'lilac', span: 'lg:col-span-2' },
  { label: 'Rincón de juegos', emoji: '🧩', color: 'sky', span: '' },
  { label: 'Zona de familias', emoji: '☕', color: 'mint', span: '' },
] as const;

export const SOCIALS = [
  { label: 'Instagram', href: BUSINESS.instagram, icon: 'instagram' },
  { label: 'TikTok', href: BUSINESS.tiktok, icon: 'tiktok' },
  { label: 'Facebook', href: BUSINESS.facebook, icon: 'facebook' },
] as const;
