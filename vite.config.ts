/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import type { Plugin } from 'vite';

// Yayın sürümünde sıkı içerik güvenliği politikası: yalnızca kendi adresimize istek atılabilir.
// Böylece çalışma anında hiçbir CDN'e/dış sunucuya bağlanılamaz (tarayıcı engeller).
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval' blob:",
  "worker-src 'self' blob:",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "connect-src 'self' blob: data:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

function csp(): Plugin {
  return {
    name: 'csp',
    apply: 'build',
    transformIndexHtml: (html) =>
      html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`),
  };
}

// GitHub Pages gibi alt klasörde yayınlanırsa BASE=/depo-adi/ verin. Netlify/Cloudflare için "/" yeterli.
const base = process.env.BASE ?? '/';

export default defineConfig({
  base,
  define: { __SURUM__: JSON.stringify(process.env.npm_package_version ?? '1.0.0') },
  worker: { format: 'es' },
  plugins: [
    react(),
    csp(),
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
