/// <reference lib="webworker" />
import { onIsle } from './onIsleme';

// Ön işleme ayrı bir iş parçacığında çalışır; ana ekran kilitlenmez.
self.onmessage = async (e: MessageEvent<{ dosya: Blob }>) => {
  try {
    const bmp = await createImageBitmap(e.data.dosya, { imageOrientation: 'from-image' });
    const sonuc = await onIsle(bmp);
    bmp.close();
    (self as unknown as Worker).postMessage({ ok: true, sonuc });
  } catch (hata) {
    (self as unknown as Worker).postMessage({ ok: false, hata: String(hata) });
  }
};
