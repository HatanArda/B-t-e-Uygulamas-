import Dexie, { type EntityTable } from 'dexie';
import type { AktarilanKayit } from './lib/excel';
import { kartMi, VARSAYILAN_KATEGORILER, VARSAYILAN_ODEMELER } from './lib/varsayilanlar';
import { dukkanKategorisiMi, type Ayar, type Fis, type KartEslesme, type Kategori, type Kayit, type OdemeYontemi, type Taksit } from './lib/tipler';

export class ButceDB extends Dexie {
  kayitlar!: EntityTable<Kayit, 'id'>;
  fisler!: EntityTable<Fis, 'id'>;
  taksitler!: EntityTable<Taksit, 'id'>;
  kategoriler!: EntityTable<Kategori, 'ad'>;
  odemeler!: EntityTable<OdemeYontemi, 'ad'>;
  kartlar!: EntityTable<KartEslesme, 'son4'>;
  ayarlar!: EntityTable<Ayar, 'anahtar'>;

  constructor(ad = 'butce') {
    super(ad);
    this.version(1).stores({
      kayitlar: '++id, tarih, kategori, tur, dukkan, odeme, fisId, taksitId, aktarimAnahtari',
      fisler: '++id, tarih',
      taksitler: '++id, odeme',
      kategoriler: '&ad',
      odemeler: '&ad',
      kartlar: '&son4',
      ayarlar: '&anahtar',
    });
    this.on('populate', (tx) => {
      tx.table('kategoriler').bulkAdd(VARSAYILAN_KATEGORILER);
      tx.table('odemeler').bulkAdd(VARSAYILAN_ODEMELER);
    });
  }
}

export const db = new ButceDB();

export async function ayarOku<T>(anahtar: string, varsayilan: T): Promise<T> {
  const a = await db.ayarlar.get(anahtar);
  return a ? (a.deger as T) : varsayilan;
}

export async function ayarYaz(anahtar: string, deger: unknown): Promise<void> {
  await db.ayarlar.put({ anahtar, deger });
}

/** Yeni kategori/ödeme adlarını listelere ekler (varsa dokunmaz). */
export async function listeleriGuncelle(kategoriler: string[], odemeler: string[], d: ButceDB = db): Promise<void> {
  const mevcutK = new Set((await d.kategoriler.toArray()).map((k) => k.ad));
  const mevcutO = new Set((await d.odemeler.toArray()).map((o) => o.ad));
  await d.kategoriler.bulkPut(kategoriler.filter((k) => k && !mevcutK.has(k)).map((ad) => ({ ad, dukkan: dukkanKategorisiMi(ad) })));
  await d.odemeler.bulkPut(odemeler.filter((o) => o && o !== '-' && !mevcutO.has(o)).map((ad) => ({ ad, kart: kartMi(ad) })));
}

export interface AktarimRaporu {
  eklenen: number;
  atlanan: number;
}

/** Excel'den okunan kayıtları ekler; aynı satır (aktarım anahtarı) zaten varsa atlar. */
export async function kayitlariAktar(kayitlar: AktarilanKayit[], d: ButceDB = db): Promise<AktarimRaporu> {
  return d.transaction('rw', d.kayitlar, async () => {
    const anahtarlar = kayitlar.map((k) => k.aktarimAnahtari!).filter(Boolean);
    const mevcut = new Set(
      (await d.kayitlar.where('aktarimAnahtari').anyOf(anahtarlar).toArray()).map((k) => k.aktarimAnahtari),
    );
    const simdi = Date.now();
    const yeni = kayitlar.filter((k) => !mevcut.has(k.aktarimAnahtari)).map((k) => ({ ...k, olusturma: simdi }));
    await d.kayitlar.bulkAdd(yeni);
    return { eklenen: yeni.length, atlanan: kayitlar.length - yeni.length };
  });
}
