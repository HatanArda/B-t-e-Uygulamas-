import { ayarOku, ayarYaz, db, kayitlariAktar, listeleriGuncelle } from './db';
import { excelOku, excelYaz } from './lib/excel';
import { karmaBol, kalemlereBol, type Parca } from './lib/bolme';
import { varsayilanIlkTaksit } from './lib/taksit';
import { yedekOlustur, yedekYukle } from './lib/yedek';
import type { Fis, Kayit, Taksit } from './lib/tipler';
import { bugunISO } from './lib/tarih';

export interface IceAktarmaSonucu {
  eklenen: number;
  atlanan: number;
  dosyaToplami: number;
  excelToplam: number | null;
  uyarilar: string[];
}

export async function excelIceAktar(dosya: Blob): Promise<IceAktarmaSonucu> {
  const r = await excelOku(await dosya.arrayBuffer());
  await listeleriGuncelle(r.kategoriler, r.odemeler);
  const rapor = await kayitlariAktar(r.kayitlar);
  return {
    ...rapor,
    dosyaToplami: r.kayitlar.reduce((t, k) => t + k.tutar, 0),
    excelToplam: r.excelToplam,
    uyarilar: r.uyarilar,
  };
}

export async function excelDisaAktar(kayitlar: Kayit[], dosyaAdi: string, not?: string): Promise<void> {
  const veri = await excelYaz(kayitlar, not);
  await dosyaVer(new Blob([veri as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), dosyaAdi);
}

/** iPhone'da paylaşım sayfası (Dosyalar'a kaydet), diğerlerinde indirme. */
export async function dosyaVer(blob: Blob, ad: string): Promise<void> {
  const dosya = new File([blob], ad, { type: blob.type });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (/iPhone|iPad|iPod/.test(navigator.userAgent) && nav.canShare?.({ files: [dosya] })) {
    try {
      await navigator.share({ files: [dosya], title: ad });
      return;
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = ad;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export async function kayitKaydet(k: Kayit, taksit?: { sayi: number; ilkTaksit?: string }): Promise<number> {
  return db.transaction('rw', db.kayitlar, db.taksitler, db.kategoriler, db.odemeler, async () => {
    await listeleriGuncelle([k.kategori], [k.odeme]);
    const simdi = Date.now();
    if (k.id) {
      await db.kayitlar.put({ ...k, guncelleme: simdi });
      if (k.taksitId) await db.taksitler.update(k.taksitId, { toplam: k.tutar, odeme: k.odeme, aciklama: k.aciklama, alisTarihi: k.tarih });
      return k.id;
    }
    const id = (await db.kayitlar.add({ ...k, olusturma: simdi })) as number;
    if (taksit && taksit.sayi > 1) {
      const t: Taksit = {
        aciklama: k.aciklama,
        toplam: k.tutar,
        sayi: taksit.sayi,
        odeme: k.odeme,
        alisTarihi: k.tarih,
        ilkTaksit: taksit.ilkTaksit ?? varsayilanIlkTaksit(k.tarih),
        kayitId: id,
        olusturma: simdi,
      };
      const tid = (await db.taksitler.add(t)) as number;
      await db.kayitlar.update(id, { taksitId: tid });
    }
    return id;
  });
}

export async function kayitSil(id: number): Promise<void> {
  await db.transaction('rw', db.kayitlar, db.taksitler, db.fisler, async () => {
    const k = await db.kayitlar.get(id);
    await db.kayitlar.delete(id);
    if (k?.taksitId) await db.taksitler.delete(k.taksitId);
    if (k?.fisId && (await db.kayitlar.where('fisId').equals(k.fisId).count()) === 0) await db.fisler.delete(k.fisId);
  });
}

export async function karmaKaydiBol(k: Kayit, dukkanTutari: number, dukkan: string): Promise<void> {
  const { kisisel, dukkanKaydi } = karmaBol(k, dukkanTutari, dukkan);
  await db.transaction('rw', db.kayitlar, db.kategoriler, db.odemeler, async () => {
    await listeleriGuncelle([kisisel.kategori, dukkanKaydi.kategori], []);
    if (kisisel.tutar > 0) await db.kayitlar.put(kisisel);
    else await db.kayitlar.delete(k.id!);
    await db.kayitlar.add(dukkanKaydi);
  });
}

export async function kaydiKalemlereBol(k: Kayit, parcalar: Parca[]): Promise<void> {
  const yeni = kalemlereBol(k, parcalar);
  await db.transaction('rw', db.kayitlar, db.kategoriler, db.odemeler, async () => {
    await listeleriGuncelle(parcalar.map((p) => p.kategori), []);
    await db.kayitlar.bulkPut(yeni);
  });
}

export async function fisKaydet(fis: Fis, kayitlar: Kayit[], kart?: { son4: string; odeme: string }): Promise<void> {
  await db.transaction('rw', [db.fisler, db.kayitlar, db.kartlar, db.kategoriler, db.odemeler], async () => {
    const fisId = (await db.fisler.add(fis)) as number;
    const simdi = Date.now();
    await listeleriGuncelle([...new Set(kayitlar.map((k) => k.kategori))], [...new Set(kayitlar.map((k) => k.odeme))]);
    await db.kayitlar.bulkAdd(kayitlar.map((k) => ({ ...k, fisId, olusturma: simdi })));
    if (kart) await db.kartlar.put(kart);
  });
}

export async function yedekIndir(fotograflarDahil: boolean): Promise<void> {
  const json = await yedekOlustur(db, fotograflarDahil);
  await dosyaVer(new Blob([json], { type: 'application/json' }), `butce-yedek-${bugunISO()}.json`);
  await ayarYaz('sonYedek', Date.now());
}

export async function yedektenYukle(dosya: Blob): Promise<number> {
  const r = await yedekYukle(db, await dosya.text());
  return r.kayit;
}

export async function yedekGerekli(): Promise<boolean> {
  const son = await ayarOku<number>('sonYedek', 0);
  const adet = await db.kayitlar.count();
  return adet > 0 && Date.now() - son > 7 * 24 * 3600 * 1000;
}

export async function kaliciDepolamaIste(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export async function tumVeriyiSil(): Promise<void> {
  await db.delete();
  location.reload();
}
