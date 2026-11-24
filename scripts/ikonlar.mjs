// public/favicon.svg → PNG simgeler (bir kez çalıştırılır; çıktılar depoya eklenir)
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { readFileSync } from 'node:fs';
const svg = readFileSync('public/favicon.svg', 'utf8');
const b = await chromium.launch();
const p = await b.newPage();
for (const [ad, boyut, tam] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180, true]]) {
  await p.setViewportSize({ width: boyut, height: boyut });
  // iOS köşeleri kendisi yuvarlar → apple-touch-icon tam kare
  const ic = tam ? svg.replace('rx="112"', 'rx="0"') : svg;
  await p.setContent(`<html><body style="margin:0;background:transparent">${ic.replace('<svg ', `<svg width="${boyut}" height="${boyut}" `)}</body></html>`);
  await p.screenshot({ path: `public/${ad}`, omitBackground: true });
}
await b.close();
