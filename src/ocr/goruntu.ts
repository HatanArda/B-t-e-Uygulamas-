// Fiş fotoğrafı ön işleme — saf fonksiyonlar (gri tonlu Uint8Array üzerinde).
// Canvas'a bağımlı kısımlar onIsleme.ts içinde.

export interface Gri {
  w: number;
  h: number;
  d: Uint8Array;
}

export function griyeCevir(rgba: Uint8ClampedArray, w: number, h: number): Gri {
  const d = new Uint8Array(w * h);
  for (let i = 0, j = 0; i < d.length; i++, j += 4) {
    d[i] = (rgba[j] * 77 + rgba[j + 1] * 150 + rgba[j + 2] * 29) >> 8;
  }
  return { w, h, d };
}

export function otsu(d: Uint8Array): number {
  const hist = new Array<number>(256).fill(0);
  for (const v of d) hist[v]++;
  const n = d.length;
  let toplam = 0;
  for (let i = 0; i < 256; i++) toplam += i * hist[i];
  let sB = 0, wB = 0, enIyi = 0, esik = 127;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (!wB) continue;
    const wF = n - wB;
    if (!wF) break;
    sB += t * hist[t];
    const mB = sB / wB, mF = (toplam - sB) / wF;
    const ara = wB * wF * (mB - mF) ** 2;
    if (ara > enIyi) { enIyi = ara; esik = t; }
  }
  return esik;
}

/** Fişin (açık renkli kâğıt) sınır kutusunu bulur; bulunamazsa null. */
export function fisKutusu(g: Gri): { x: number; y: number; w: number; h: number } | null {
  const esik = otsu(g.d);
  const sutun = new Float64Array(g.w);
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (g.d[y * g.w + x] > esik) sutun[x]++;
  for (let x = 0; x < g.w; x++) sutun[x] /= g.h;
  const enUzun = (dizi: Float64Array, oran: number) => {
    let bas = -1, enBas = 0, enSon = -1;
    for (let i = 0; i <= dizi.length; i++) {
      if (i < dizi.length && dizi[i] >= oran) { if (bas < 0) bas = i; }
      else if (bas >= 0) { if (i - bas > enSon - enBas) { enBas = bas; enSon = i; } bas = -1; }
    }
    return enSon > enBas ? [enBas, enSon] as const : null;
  };
  const xs = enUzun(sutun, 0.45);
  if (!xs) return null;
  const satir = new Float64Array(g.h);
  for (let y = 0; y < g.h; y++) {
    let n = 0;
    for (let x = xs[0]; x < xs[1]; x++) if (g.d[y * g.w + x] > esik) n++;
    satir[y] = n / (xs[1] - xs[0]);
  }
  const ys = enUzun(satir, 0.45);
  if (!ys) return null;
  const kutu = { x: xs[0], y: ys[0], w: xs[1] - xs[0], h: ys[1] - ys[0] };
  const alan = (kutu.w * kutu.h) / (g.w * g.h);
  // Çok küçük ya da neredeyse tüm görüntüyse kırpmaya gerek yok
  if (alan < 0.15 || alan > 0.92) return null;
  const pay = Math.round(Math.min(g.w, g.h) * 0.01);
  return {
    x: Math.max(0, kutu.x - pay),
    y: Math.max(0, kutu.y - pay),
    w: Math.min(g.w - Math.max(0, kutu.x - pay), kutu.w + 2 * pay),
    h: Math.min(g.h - Math.max(0, kutu.y - pay), kutu.h + 2 * pay),
  };
}

/**
 * Eğiklik açısını (derece) yatay izdüşüm varyansıyla bulur.
 * Satırlar yatay olduğunda koyu piksellerin satır toplamlarının varyansı en yüksektir.
 */
export function egiklikBul(g: Gri, araliik = 8, adim = 0.25): number {
  const esik = otsu(g.d);
  const noktalar: number[] = [];
  // Seyrek örnekleme (hız için)
  const atla = Math.max(1, Math.round(Math.sqrt((g.w * g.h) / 250000)));
  for (let y = 0; y < g.h; y += atla) for (let x = 0; x < g.w; x += atla) if (g.d[y * g.w + x] <= esik) noktalar.push(x, y);
  if (noktalar.length < 200) return 0;
  let enIyiAci = 0, enIyiPuan = -1;
  const kova = new Float64Array(g.h + g.w * 2);
  for (let a = -araliik; a <= araliik + 1e-9; a += adim) {
    const t = Math.tan((a * Math.PI) / 180);
    kova.fill(0);
    for (let i = 0; i < noktalar.length; i += 2) {
      const yy = Math.round(noktalar[i + 1] - noktalar[i] * t) + g.w;
      if (yy >= 0 && yy < kova.length) kova[yy]++;
    }
    let puan = 0;
    for (const v of kova) puan += v * v;
    if (puan > enIyiPuan) { enIyiPuan = puan; enIyiAci = a; }
  }
  return Math.abs(enIyiAci) < 0.3 ? 0 : enIyiAci;
}

/**
 * Gölge/ışık farkını giderir (arka planı büyük bir bulanıklaştırmayla tahmin edip böler)
 * ve kontrastı germe ile artırır.
 */
export function kontrastArtir(g: Gri): Gri {
  const { w, h, d } = g;
  // İntegral görüntü ile kutu bulanıklığı
  const r = Math.max(8, Math.round(Math.min(w, h) / 30));
  const ig = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let satir = 0;
    for (let x = 0; x < w; x++) {
      satir += d[y * w + x];
      ig[(y + 1) * (w + 1) + x + 1] = ig[y * (w + 1) + x + 1] + satir;
    }
  }
  const cikti = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r), y1 = Math.min(h, y + r + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r), x1 = Math.min(w, x + r + 1);
      const s = ig[y1 * (w + 1) + x1] - ig[y0 * (w + 1) + x1] - ig[y1 * (w + 1) + x0] + ig[y0 * (w + 1) + x0];
      const ort = s / ((y1 - y0) * (x1 - x0));
      // Arka plan biraz daha açık kabul edilir ki metin koyu kalsın
      const v = (d[y * w + x] / Math.max(1, ort * 1.05)) * 255;
      cikti[y * w + x] = v > 255 ? 255 : v;
    }
  }
  // %1–%99 yüzdelik germe
  const hist = new Array<number>(256).fill(0);
  for (const v of cikti) hist[v]++;
  const n = cikti.length;
  let alt = 0, ust = 255, birikim = 0;
  for (let i = 0; i < 256; i++) { birikim += hist[i]; if (birikim >= n * 0.01) { alt = i; break; } }
  birikim = 0;
  for (let i = 255; i >= 0; i--) { birikim += hist[i]; if (birikim >= n * 0.01) { ust = i; break; } }
  const olcek = 255 / Math.max(1, ust - alt);
  for (let i = 0; i < n; i++) {
    const v = (cikti[i] - alt) * olcek;
    cikti[i] = v < 0 ? 0 : v > 255 ? 255 : v;
  }
  return { w, h, d: cikti };
}

/** Netlik ölçüsü (Laplace varyansı). Düşükse fotoğraf bulanık. */
export function netlik(g: Gri): number {
  const { w, h, d } = g;
  let toplam = 0, kare = 0, n = 0;
  for (let y = 1; y < h - 1; y += 2) {
    for (let x = 1; x < w - 1; x += 2) {
      const i = y * w + x;
      const l = 4 * d[i] - d[i - 1] - d[i + 1] - d[i - w] - d[i + w];
      toplam += l; kare += l * l; n++;
    }
  }
  if (!n) return 0;
  const ort = toplam / n;
  return kare / n - ort * ort;
}
