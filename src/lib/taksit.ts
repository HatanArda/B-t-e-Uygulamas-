import { isoAyEkle } from './tarih';
import type { Taksit } from './tipler';

export interface TaksitSatiri {
  no: number;
  tarih: string;
  tutar: number;
  odendi: boolean;
}

/** Toplamı taksitlere böler; kuruş artığı ilk taksite eklenir. */
export function taksitTutarlari(toplam: number, sayi: number): number[] {
  const temel = Math.floor(toplam / sayi);
  const artik = toplam - temel * sayi;
  return Array.from({ length: sayi }, (_, i) => temel + (i === 0 ? artik : 0));
}

export function taksitPlani(t: Pick<Taksit, 'toplam' | 'sayi' | 'ilkTaksit'>, bugun: string): TaksitSatiri[] {
  return taksitTutarlari(t.toplam, t.sayi).map((tutar, i) => {
    const tarih = isoAyEkle(t.ilkTaksit, i);
    return { no: i + 1, tarih, tutar, odendi: tarih <= bugun };
  });
}

export function kalanBorc(t: Pick<Taksit, 'toplam' | 'sayi' | 'ilkTaksit'>, bugun: string): number {
  return taksitPlani(t, bugun).filter((s) => !s.odendi).reduce((a, s) => a + s.tutar, 0);
}

/** Varsayılan ilk taksit tarihi: alıştan bir ay sonra. */
export function varsayilanIlkTaksit(alis: string): string {
  return isoAyEkle(alis, 1);
}

/** Ay bazında (YYYY-AA) tüm taksitlerin toplamı — gelecek ayların kart yükünü görmek için. */
export function aylikTaksitYuku(taksitler: Taksit[], bugun: string): Array<{ ay: string; tutar: number; kartlar: Record<string, number> }> {
  const harita = new Map<string, { tutar: number; kartlar: Record<string, number> }>();
  for (const t of taksitler) {
    for (const s of taksitPlani(t, bugun)) {
      if (s.odendi) continue;
      const ay = s.tarih.slice(0, 7);
      const g = harita.get(ay) ?? { tutar: 0, kartlar: {} };
      g.tutar += s.tutar;
      g.kartlar[t.odeme] = (g.kartlar[t.odeme] ?? 0) + s.tutar;
      harita.set(ay, g);
    }
  }
  return [...harita.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([ay, g]) => ({ ay, ...g }));
}
