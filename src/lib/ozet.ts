import { BELIRTILMEDI, type Kayit } from './tipler';

export interface Filtre {
  bas?: string;
  bit?: string;
  dukkan?: string;
  kategori?: string;
  odeme?: string;
  tur?: string;
  arama?: string;
}

export function filtrele(kayitlar: Kayit[], f: Filtre): Kayit[] {
  const ara = f.arama?.toLocaleLowerCase('tr-TR').trim();
  return kayitlar.filter(
    (k) =>
      (!f.bas || k.tarih >= f.bas) &&
      (!f.bit || k.tarih <= f.bit) &&
      (!f.dukkan || k.dukkan === f.dukkan) &&
      (!f.kategori || k.kategori === f.kategori) &&
      (!f.odeme || k.odeme === f.odeme) &&
      (!f.tur || k.tur === f.tur) &&
      (!ara || k.aciklama.toLocaleLowerCase('tr-TR').includes(ara) || k.kategori.toLocaleLowerCase('tr-TR').includes(ara)),
  );
}

export function toplam(kayitlar: Kayit[]): number {
  return kayitlar.reduce((t, k) => t + k.tutar, 0);
}

export interface Grup {
  ad: string;
  tutar: number;
  adet: number;
}

export function grupla(kayitlar: Kayit[], anahtar: (k: Kayit) => string): Grup[] {
  const h = new Map<string, Grup>();
  for (const k of kayitlar) {
    const a = anahtar(k);
    const g = h.get(a) ?? { ad: a, tutar: 0, adet: 0 };
    g.tutar += k.tutar;
    g.adet++;
    h.set(a, g);
  }
  return [...h.values()].sort((a, b) => b.tutar - a.tutar);
}

export const aylik = (kayitlar: Kayit[]) =>
  grupla(kayitlar, (k) => k.tarih.slice(0, 7)).sort((a, b) => a.ad.localeCompare(b.ad));

/** Dükkânı belli olmayan ya da karma olup bölünmemiş kayıtlar (ana ekranda uyarı). */
export function belirsizKayitlar(kayitlar: Kayit[]): Kayit[] {
  return kayitlar.filter((k) => k.tur === 'Karma' || (k.tur === 'Dükkân' && k.dukkan === BELIRTILMEDI));
}
