import { egiklikBul, fisKutusu, griyeCevir, kontrastArtir, netlik, type Gri } from './goruntu';

// Hem Web Worker'da (OffscreenCanvas) hem ana iş parçacığında (HTMLCanvasElement) çalışır.

type Tuval = OffscreenCanvas | HTMLCanvasElement;
type Baglam = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;

export interface OnIslemeSonucu {
  /** OCR'a gidecek görüntü (PNG) */
  goruntu: Blob;
  /** Saklanacak fotoğraf (JPEG, küçültülmüş) */
  foto: Blob;
  genislik: number;
  yukseklik: number;
  egiklik: number;
  kirpildi: boolean;
  netlik: number;
}

const OCR_GENISLIK = 1300;
const ANALIZ_GENISLIK = 500;
const FOTO_UZUN_KENAR = 1600;

function tuvalYap(w: number, h: number): Tuval {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function ctx(t: Tuval): Baglam {
  const c = t.getContext('2d', { willReadFrequently: true }) as Baglam | null;
  if (!c) throw new Error('Canvas desteklenmiyor.');
  return c;
}

async function blobYap(t: Tuval, tip: string, kalite?: number): Promise<Blob> {
  if ('convertToBlob' in t) return t.convertToBlob({ type: tip, quality: kalite });
  return new Promise((ok, hata) => (t as HTMLCanvasElement).toBlob((b) => (b ? ok(b) : hata(new Error('toBlob'))), tip, kalite));
}

function griOku(kaynak: CanvasImageSource, sw: number, sh: number, w: number, h: number, sx = 0, sy = 0): Gri {
  const t = tuvalYap(w, h);
  const c = ctx(t);
  c.drawImage(kaynak, sx, sy, sw, sh, 0, 0, w, h);
  return griyeCevir(c.getImageData(0, 0, w, h).data, w, h);
}

export async function onIsle(kaynak: ImageBitmap): Promise<OnIslemeSonucu> {
  const W = kaynak.width, H = kaynak.height;

  // Saklanacak foto (küçültülmüş JPEG)
  const fo = Math.min(1, FOTO_UZUN_KENAR / Math.max(W, H));
  const ft = tuvalYap(Math.round(W * fo), Math.round(H * fo));
  ctx(ft).drawImage(kaynak, 0, 0, ft.width, ft.height);
  const foto = await blobYap(ft, 'image/jpeg', 0.8);

  // 1) Küçük kopyada fişi bul (kırpma)
  const ao = Math.min(1, ANALIZ_GENISLIK / W);
  const kucuk = griOku(kaynak, W, H, Math.round(W * ao), Math.round(H * ao));
  const kutu = fisKutusu(kucuk);
  const kx = kutu ? kutu.x / ao : 0, ky = kutu ? kutu.y / ao : 0;
  const kw = kutu ? kutu.w / ao : W, kh = kutu ? kutu.h / ao : H;

  // 2) Eğikliği kırpılmış küçük kopyada ölç
  const ao2 = Math.min(1, ANALIZ_GENISLIK / kw);
  const kucuk2 = griOku(kaynak, kw, kh, Math.max(1, Math.round(kw * ao2)), Math.max(1, Math.round(kh * ao2)), kx, ky);
  const aci = egiklikBul(kucuk2);

  // 3) OCR boyutuna ölçekle + döndür
  const o = Math.min(2, OCR_GENISLIK / kw);
  const ow = Math.round(kw * o), oh = Math.round(kh * o);
  const rad = (-aci * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad)), sin = Math.abs(Math.sin(rad));
  const rw = Math.round(ow * cos + oh * sin), rh = Math.round(ow * sin + oh * cos);
  const rt = tuvalYap(rw, rh);
  const rc = ctx(rt);
  rc.fillStyle = '#fff';
  rc.fillRect(0, 0, rw, rh);
  rc.translate(rw / 2, rh / 2);
  rc.rotate(rad);
  rc.imageSmoothingQuality = 'high';
  rc.drawImage(kaynak, kx, ky, kw, kh, -ow / 2, -oh / 2, ow, oh);
  rc.setTransform(1, 0, 0, 1, 0, 0);

  // 4) Gri ton + gölge giderme + kontrast
  const veri = rc.getImageData(0, 0, rw, rh);
  const gri = kontrastArtir(griyeCevir(veri.data, rw, rh));
  const net = netlik(gri);
  for (let i = 0, j = 0; i < gri.d.length; i++, j += 4) {
    veri.data[j] = veri.data[j + 1] = veri.data[j + 2] = gri.d[i];
    veri.data[j + 3] = 255;
  }
  rc.putImageData(veri, 0, 0);
  const goruntu = await blobYap(rt, 'image/png');
  return { goruntu, foto, genislik: rw, yukseklik: rh, egiklik: aci, kirpildi: !!kutu, netlik: net };
}
