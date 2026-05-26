import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Web app first; PWA configuration makes it installable on Windows / Chrome /
// Edge with offline support for the app shell and aggressive caching of
// PokéAPI responses (immutable data).
export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Pokedex',
        short_name: 'Pokedex',
        description:
          'Personal Pokémon reference, team builder and collection tracker.',
        theme_color: '#0b0f17',
        background_color: '#0b0f17',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        // SVG icon — Chrome / Edge accept this for PWA install on Windows.
        // PNG icons (192/512 + maskable) are a follow-up; once generated,
        // add them here alongside the SVG.
        icons: [
          {
            src: 'favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        // PokéAPI data is immutable so we cache it for a long time. Sprites
        // come from raw.githubusercontent.com / pokeapi sprite repo.
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin === 'https://pokeapi.co',
            handler: 'CacheFirst',
            options: {
              cacheName: 'pokeapi',
              expiration: {
                maxEntries: 5000,
                maxAgeSeconds: 60 * 60 * 24 * 60, // 60 days
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ url }) =>
              url.host === 'raw.githubusercontent.com' &&
              url.pathname.startsWith('/PokeAPI/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'pokeapi-sprites',
              expiration: {
                maxEntries: 5000,
                maxAgeSeconds: 60 * 60 * 24 * 60,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
});
