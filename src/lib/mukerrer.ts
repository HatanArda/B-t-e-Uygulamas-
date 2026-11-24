import { benzerlik, normalize } from './metin';
import { urunKismi } from './kategoriTahmin';

interface Karsilastirilabilir {
  id?: number;
  tarih: string;
  tutar: number;
  aciklama: string;
}

/** Aynı gün, aynı tutar ve benzer açıklama → olası mükerrer. */
export function olasiMukerrerler<T extends Karsilastirilabilir>(yeni: Karsilastirilabilir, mevcut: T[]): T[] {
  const a = normalize(urunKismi(yeni.aciklama));
  return mevcut.filter((m) => {
    if (m.id !== undefined && m.id === yeni.id) return false;
    if (m.tarih !== yeni.tarih || m.tutar !== yeni.tutar) return false;
    const b = normalize(urunKismi(m.aciklama));
    if (!a || !b) return true;
    return a === b || a.includes(b) || b.includes(a) || benzerlik(a, b) >= 0.5;
  });
}

interface FisOzeti {
  id?: number;
  tarih: string;
  saat?: string;
  toplam: number | null;
}

/** Aynı fiş ikinci kez okutulduysa (aynı tarih, saat ve toplam). */
export function mukerrerFis<T extends FisOzeti>(yeni: FisOzeti, fisler: T[]): T | undefined {
  if (yeni.toplam === null) return undefined;
  return fisler.find(
    (f) => f.tarih === yeni.tarih && f.toplam === yeni.toplam && (f.saat ?? '') === (yeni.saat ?? ''),
  );
}
