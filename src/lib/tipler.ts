export type Tur = 'Kişisel' | 'Dükkân' | 'Karma';

export const DUKKANLAR = ['GALLİPOLİ OPTİK', 'Eray Optik 2'] as const;
export const BELIRTILMEDI = 'Belirtilmedi';
export const DUKKAN_YOK = '-';
export const ODEME_YOK = '-';

/** Bir harcama satırı (Excel'deki bir satırın karşılığı). */
export interface Kayit {
  id?: number;
  /** YYYY-AA-GG */
  tarih: string;
  /** SS:DD (isteğe bağlı, fişten okunur) */
  saat?: string;
  kategori: string;
  aciklama: string;
  tur: Tur;
  /** GALLİPOLİ OPTİK / Eray Optik 2 / Belirtilmedi / - */
  dukkan: string;
  /** Kuruş */
  tutar: number;
  kaynak: string;
  odeme: string;
  fisId?: number;
  taksitId?: number;
  /** Karma kayıt bölündüyse, bölünen asıl kaydın id'si */
  bolunenId?: number;
  /** İçe aktarma sırasında aynı satırın iki kez eklenmesini önler */
  aktarimAnahtari?: string;
  olusturma: number;
  guncelleme?: number;
}

export interface Fis {
  id?: number;
  tarih: string;
  saat?: string;
  /** Kuruş */
  toplam: number | null;
  satici: string;
  hamMetin: string;
  foto?: Blob;
  olusturma: number;
}

export interface Taksit {
  id?: number;
  aciklama: string;
  /** Kuruş, toplam tutar */
  toplam: number;
  sayi: number;
  /** Kart / ödeme yöntemi */
  odeme: string;
  /** Alış tarihi (YYYY-AA-GG) */
  alisTarihi: string;
  /** İlk taksitin tarihi (YYYY-AA-GG) */
  ilkTaksit: string;
  kayitId?: number;
  olusturma: number;
}

export interface Kategori {
  ad: string;
  /** "Dükkân: " ile başlayanlar dükkân kategorisidir */
  dukkan: boolean;
}

export interface OdemeYontemi {
  ad: string;
  /** Kredi kartı mı (taksit seçilebilir) */
  kart: boolean;
}

export interface KartEslesme {
  son4: string;
  odeme: string;
}

export interface Ayar {
  anahtar: string;
  deger: unknown;
}

export const DUKKAN_ONEKI = 'Dükkân: ';

export function dukkanKategorisiMi(ad: string): boolean {
  return ad.startsWith(DUKKAN_ONEKI);
}
