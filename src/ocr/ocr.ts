import type { Worker as TWorker } from 'tesseract.js';
import { simd, relaxedSimd } from 'wasm-feature-detect';
import { onIsle, type OnIslemeSonucu } from './onIsleme';

// Tüm OCR dosyaları uygulamayla birlikte paketlenir (public/ocr) ve service worker önbelleğinden gelir.
// Dosyaları ANA sayfadan alıp worker'a blob olarak veriyoruz: iOS'ta worker içindeki isteklerin
// service worker'dan geçeceği garanti olmadığı için, uçak modunda da çalışmasının en sağlam yolu bu.
const OCR_YOLU = `${import.meta.env.BASE_URL}ocr/`;

export interface Ilerleme {
  asama: 'hazirlik' | 'onisleme' | 'okuma';
  oran: number;
  mesaj: string;
}

let workerSozu: Promise<TWorker> | null = null;
let ilerlemeDinleyici: ((i: Ilerleme) => void) | null = null;

async function cekirdekDosyasi(): Promise<string> {
  if (await relaxedSimd()) return 'tesseract-core-relaxedsimd-lstm.wasm.js';
  if (await simd()) return 'tesseract-core-simd-lstm.wasm.js';
  return 'tesseract-core-lstm.wasm.js';
}

function zamanAsimi<T>(s: Promise<T>, ms: number, mesaj: string): Promise<T> {
  return new Promise<T>((ok, hata) => {
    const t = setTimeout(() => hata(new Error(`${mesaj} (zaman aşımı)`)), ms);
    s.then((v) => { clearTimeout(t); ok(v); }, (e) => { clearTimeout(t); hata(e); });
  });
}

async function al(ad: string): Promise<Response> {
  const r = await fetch(OCR_YOLU + ad);
  if (!r.ok) throw new Error(`OCR dosyası yüklenemedi: ${ad} (${r.status})`);
  return r;
}

function workerHazirla(): Promise<TWorker> {
  if (workerSozu) return workerSozu;
  workerSozu = (async () => {
    ilerlemeDinleyici?.({ asama: 'hazirlik', oran: 0.05, mesaj: 'OCR motoru yükleniyor…' });
    const [cekirdek, workerJs, dil] = await Promise.all([
      cekirdekDosyasi().then(al).then((r) => r.text()),
      al('worker.min.js').then((r) => r.text()),
      al('tur.traineddata.gz').then((r) => r.arrayBuffer()),
    ]);
    // Çekirdek (global TesseractCore tanımlar) + worker betiği tek bir blob'da
    const url = URL.createObjectURL(new Blob([cekirdek, '\n;\n', workerJs], { type: 'text/javascript' }));
    const { createWorker, OEM } = await import('tesseract.js');
    const w = await zamanAsimi(createWorker([{ code: 'tur', data: new Uint8Array(dil) }], OEM.LSTM_ONLY, {
      workerPath: url,
      workerBlobURL: false,
      corePath: OCR_YOLU, // kullanılmaz (çekirdek zaten yüklü) ama CDN'e düşmesin diye verilir
      langPath: OCR_YOLU,
      cacheMethod: 'none',
      errorHandler: (e) => console.error('OCR hatası', e),
      logger: (m) => {
        if (m.status === 'recognizing text') ilerlemeDinleyici?.({ asama: 'okuma', oran: m.progress, mesaj: 'Metin okunuyor…' });
      },
    }), 90_000, 'OCR motoru başlatılamadı');
    await w.setParameters({
      tessedit_pageseg_mode: '6' as never,
      preserve_interword_spaces: '1',
      user_defined_dpi: '300',
    });
    ilerlemeDinleyici?.({ asama: 'hazirlik', oran: 1, mesaj: 'OCR motoru hazır' });
    return w;
  })();
  workerSozu.catch(() => (workerSozu = null));
  return workerSozu;
}

async function onIsleWorkerde(dosya: Blob): Promise<OnIslemeSonucu> {
  // OffscreenCanvas varsa ayrı iş parçacığında; yoksa ana iş parçacığında.
  if (typeof OffscreenCanvas !== 'undefined' && typeof Worker !== 'undefined') {
    try {
      return await new Promise<OnIslemeSonucu>((ok, hata) => {
        const w = new Worker(new URL('./onIsleme.worker.ts', import.meta.url), { type: 'module' });
        w.onmessage = (e) => { w.terminate(); e.data.ok ? ok(e.data.sonuc) : hata(new Error(e.data.hata)); };
        w.onerror = (e) => { w.terminate(); hata(new Error(e.message)); };
        w.postMessage({ dosya });
      });
    } catch {
      // ana iş parçacığına düş
    }
  }
  const bmp = await createImageBitmap(dosya, { imageOrientation: 'from-image' });
  try {
    return await onIsle(bmp);
  } finally {
    bmp.close();
  }
}

export interface OcrSonucu {
  metin: string;
  /** Tesseract ortalama güveni (0–100) */
  guven: number;
  onIsleme: OnIslemeSonucu;
}

/** Motoru önceden ısıtır (Fiş ekranı açılınca). */
export function ocrIsit(): void {
  workerHazirla().catch(() => undefined);
}

export async function fisOku(dosya: Blob, ilerleme?: (i: Ilerleme) => void): Promise<OcrSonucu> {
  ilerlemeDinleyici = ilerleme ?? null;
  const motor = workerHazirla();
  ilerleme?.({ asama: 'onisleme', oran: 0.1, mesaj: 'Fotoğraf hazırlanıyor (kırpma, eğiklik, kontrast)…' });
  const on = await onIsleWorkerde(dosya);
  const w = await motor;
  ilerleme?.({ asama: 'okuma', oran: 0, mesaj: 'Metin okunuyor…' });
  const { data } = await zamanAsimi(w.recognize(on.goruntu), 120_000, 'Fiş okunamadı');
  return { metin: data.text, guven: data.confidence, onIsleme: on };
}
