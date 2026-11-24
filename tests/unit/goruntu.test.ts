import { describe, expect, it } from 'vitest';
import { egiklikBul, fisKutusu, kontrastArtir, type Gri } from '../../src/ocr/goruntu';

/** Beyaz zeminde, verilen açıyla eğik "metin satırları" (koyu kesik çizgiler). */
function egikSatirlar(w: number, h: number, aci: number): Gri {
  const d = new Uint8Array(w * h).fill(240);
  const t = Math.tan((aci * Math.PI) / 180);
  for (let satir = 40; satir < h - 40; satir += 28) {
    for (let x = 20; x < w - 20; x++) {
      if (x % 14 > 9) continue; // harf boşlukları
      for (let k = 0; k < 6; k++) {
        const y = Math.round(satir + k + x * t);
        if (y >= 0 && y < h) d[y * w + x] = 20;
      }
    }
  }
  return { w, h, d };
}

describe('görüntü ön işleme', () => {
  it.each([0, 2, -3, 5])('eğiklik %d° bulunur', (aci) => {
    expect(egiklikBul(egikSatirlar(400, 500, aci))).toBeCloseTo(aci, 0);
  });
  it('koyu zemindeki açık renkli fiş kırpılır', () => {
    const w = 300, h = 400;
    const d = new Uint8Array(w * h).fill(50);
    for (let y = 50; y < 350; y++) for (let x = 80; x < 220; x++) d[y * w + x] = 235;
    const k = fisKutusu({ w, h, d })!;
    expect(k.x).toBeGreaterThanOrEqual(75);
    expect(k.x).toBeLessThanOrEqual(80);
    expect(k.w).toBeGreaterThanOrEqual(140);
    expect(k.w).toBeLessThanOrEqual(150);
    expect(k.y).toBeLessThanOrEqual(50);
    expect(k.h).toBeGreaterThanOrEqual(300);
  });
  it('gölgeli zeminde metin koyu, kâğıt açık kalır', () => {
    const w = 200, h = 200;
    const d = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) d[y * w + x] = x < 100 ? 120 : 230; // sol yarı gölgede
    for (let x = 20; x < 180; x++) for (let y = 98; y < 102; y++) d[y * w + x] = x < 100 ? 40 : 80;
    const c = kontrastArtir({ w, h, d });
    expect(c.d[30 * w + 30]).toBeGreaterThan(200); // gölgedeki kâğıt açıldı
    expect(c.d[100 * w + 50]).toBeLessThan(100); // gölgedeki metin koyu
  });
});
