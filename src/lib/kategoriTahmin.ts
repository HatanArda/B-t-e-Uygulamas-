import { benzerlik, kelimeler, kok, normalize } from './metin';
import { dukkanKategorisiMi, type Tur } from './tipler';

export interface GecmisOrnek {
  aciklama: string;
  kategori: string;
  tur: Tur;
}

export type Guven = 'kesin' | 'tahmin' | 'yok';

export interface KategoriOnerisi {
  kategori: string | null;
  guven: Guven;
  /** Kullanıcıya sunulacak diğer adaylar (en olası önce) */
  adaylar: string[];
}

/** "Migros (23.11) - Sek Quark protein 16" → "Sek Quark protein 16" (satıcı öneki atılır) */
export function urunKismi(aciklama: string): string {
  const i = aciklama.indexOf(' - ');
  return i > 0 ? aciklama.slice(i + 3) : aciklama;
}

/** "Migros (23.11) - ..." → "Migros" */
export function saticiKismi(aciklama: string): string | null {
  const i = aciklama.indexOf(' - ');
  if (i <= 0) return null;
  return aciklama.slice(0, i).replace(/\s*\(.*?\)\s*/g, '').trim();
}

/**
 * Geçmiş kayıtlardan öğrenerek kategori önerir.
 * - Aynı açıklama daha önce kullanıldıysa → kesin
 * - Açıklamadaki bir kelime kategori adında geçiyorsa (ör. "SGK" → "Dükkân: SGK / Prim") → kesin
 * - Benzer açıklamalar → tahmin (oy çokluğu)
 * - Satıcının geçmişteki en sık kategorisi → tahmin
 * Tür "Dükkân" ise yalnızca "Dükkân: " kategorileri, "Kişisel" ise diğerleri aday olur.
 */
export function kategoriOner(
  aciklama: string,
  tur: Tur,
  gecmis: GecmisOrnek[],
  kategoriler: string[],
  satici?: string | null,
): KategoriOnerisi {
  const uygun = (k: string) => (tur === 'Dükkân' ? dukkanKategorisiMi(k) : tur === 'Kişisel' ? !dukkanKategorisiMi(k) : true);
  const urun = urunKismi(aciklama);
  const hedef = normalize(urun);
  const puan = new Map<string, number>();
  const ekle = (k: string, p: number) => uygun(k) && puan.set(k, (puan.get(k) ?? 0) + p);

  // 1) Birebir aynı açıklama
  const ayni = gecmis.filter((g) => uygun(g.kategori) && normalize(urunKismi(g.aciklama)) === hedef && hedef !== '');
  if (ayni.length) {
    const say = new Map<string, number>();
    for (const g of ayni) say.set(g.kategori, (say.get(g.kategori) ?? 0) + 1);
    const sirali = [...say.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
    return { kategori: sirali[0], guven: 'kesin', adaylar: sirali };
  }

  // 2) Açıklama kelimesi kategori adında geçiyor mu
  const urunKokleri = new Set(kelimeler(urun).map(kok));
  for (const k of kategoriler) {
    if (!uygun(k)) continue;
    const adKelimeleri = kelimeler(k.replace(/^Dükkân:\s*/, ''));
    if (adKelimeleri.some((w) => urunKokleri.has(kok(w)))) ekle(k, 3);
  }
  const kategoriAdiEslesen = [...puan.keys()];

  // 3) Benzer açıklamalar
  for (const g of gecmis) {
    const b = benzerlik(urun, urunKismi(g.aciklama));
    if (b >= 0.5) ekle(g.kategori, b * 2);
  }

  // 4) Aynı satıcı
  const sat = satici ? normalize(satici) : null;
  if (sat) {
    const say = new Map<string, number>();
    let toplam = 0;
    for (const g of gecmis) {
      const gs = saticiKismi(g.aciklama);
      if (gs && normalize(gs) === sat && uygun(g.kategori)) {
        say.set(g.kategori, (say.get(g.kategori) ?? 0) + 1);
        toplam++;
      }
    }
    for (const [k, n] of say) ekle(k, n / toplam);
  }

  const sirali = [...puan.entries()].sort((a, b) => b[1] - a[1]);
  if (sirali.length === 0) return { kategori: null, guven: 'yok', adaylar: [] };
  const [enIyi, enIyiPuan] = sirali[0];
  const ikinci = sirali[1]?.[1] ?? 0;
  let guven: Guven = 'tahmin';
  if (kategoriAdiEslesen.length === 1 && kategoriAdiEslesen[0] === enIyi) guven = 'kesin';
  else if (enIyiPuan >= 1.8 && enIyiPuan >= ikinci * 2) guven = 'kesin';
  return { kategori: enIyi, guven, adaylar: sirali.map(([k]) => k) };
}
