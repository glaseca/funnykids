// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://funnykids.es',
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  // Astro 7 usa reglas JSX para el whitespace; mantenemos el comportamiento HTML
  // clásico para no perder espacios entre elementos inline.
  compressHTML: true,
  vite: {
    plugins: [tailwindcss()],
  },
  server: {
    host: true,
    port: 4321,
  },
});
