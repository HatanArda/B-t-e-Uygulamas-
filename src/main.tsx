import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import './stil.css';

declare global {
  const __SURUM__: string;
}

// Service worker: tüm uygulama + OCR dosyaları önbelleğe alınır → uçak modunda açılır.
const guncelle = registerSW({
  immediate: true,
  onNeedRefresh() {
    if (confirm('Uygulamanın yeni sürümü hazır. Şimdi yenilensin mi?')) guncelle(true);
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
