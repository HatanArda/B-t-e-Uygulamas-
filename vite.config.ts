/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages gibi alt klasörde yayınlanırsa BASE=/depo-adi/ verin. Netlify/Cloudflare için "/" yeterli.
const base = process.env.BASE ?? '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['apple-touch-icon.png', 'favicon.svg'],
      manifest: {
        name: 'Bütçe — Kişisel ve Dükkân',
        short_name: 'Bütçe',
        description: 'Kişisel ve dükkân harcamaları, internetsiz.',
        lang: 'tr',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0f1419',
        theme_color: '#0f1419',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // OCR modeli ve WASM çekirdekleri dahil her şey önceden önbelleğe alınır → uçak modunda çalışır.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest,gz,wasm}'],
        maximumFileSizeToCacheInBytes: 12 * 1024 * 1024,
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  build: { target: 'es2020', chunkSizeWarningLimit: 1500 },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
    testTimeout: 30000,
  },
});
