import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { db } from './db';
import type { GecmisOrnek } from './lib/kategoriTahmin';
import type { Kayit } from './lib/tipler';

const BOS: never[] = [];

export function useKayitlar(): Kayit[] {
  return useLiveQuery(() => db.kayitlar.toArray(), [], BOS as Kayit[]);
}

export function useListeler() {
  const kategoriler = useLiveQuery(async () => (await db.kategoriler.toArray()).map((k) => k.ad).sort((a, b) => a.localeCompare(b, 'tr')), [], BOS as string[]);
  const odemeler = useLiveQuery(async () => (await db.odemeler.toArray()).map((o) => o.ad), [], BOS as string[]);
  return { kategoriler, odemeler };
}

export function useGecmis(kayitlar: Kayit[]): GecmisOrnek[] {
  return useMemo(() => kayitlar.map((k) => ({ aciklama: k.aciklama, kategori: k.kategori, tur: k.tur })), [kayitlar]);
}

export function useAyar<T>(anahtar: string, varsayilan: T): T {
  return useLiveQuery(async () => {
    const a = await db.ayarlar.get(anahtar);
    return a ? (a.deger as T) : varsayilan;
  }, [anahtar], varsayilan) as T;
}
