import { DUKKAN_ONEKI, DUKKAN_YOK, dukkanKategorisiMi, type Kayit } from './tipler';

/**
 * Karma kaydı ikiye böler: girilen tutar dükkâna, kalanı kişisele.
 * Asıl kayıt kişisel kısım olarak güncellenir, dükkân kısmı yeni kayıt olur.
 */
export function karmaBol(kayit: Kayit, dukkanTutari: number, dukkan: string): { kisisel: Kayit; dukkanKaydi: Kayit } {
  if (dukkanTutari <= 0 || dukkanTutari > kayit.tutar) throw new Error('Dükkân tutarı 0 ile kayıt tutarı arasında olmalı.');
  const temelKategori = kayit.kategori.replace(/^Dükkân:\s*/, '');
  const simdi = Date.now();
  const kisisel: Kayit = {
    ...kayit,
    tur: 'Kişisel',
    dukkan: DUKKAN_YOK,
    kategori: dukkanKategorisiMi(kayit.kategori) ? temelKategori : kayit.kategori,
    tutar: kayit.tutar - dukkanTutari,
    aciklama: `${kayit.aciklama} (kişisel kısım)`,
    guncelleme: simdi,
  };
  const { id: _id, aktarimAnahtari: _a, ...geri } = kayit;
  const dukkanKaydi: Kayit = {
    ...geri,
    tur: 'Dükkân',
    dukkan,
    kategori: dukkanKategorisiMi(kayit.kategori) ? kayit.kategori : `${DUKKAN_ONEKI}${temelKategori}`,
    tutar: dukkanTutari,
    aciklama: `${kayit.aciklama} (dükkân kısmı)`,
    bolunenId: kayit.id,
    olusturma: simdi,
  };
  return { kisisel, dukkanKaydi };
}

export interface Parca {
  aciklama: string;
  tutar: number;
  kategori: string;
}

/** Bir fiş kaydını kalemlere böler; kalemlerin toplamı asıl tutara eşit olmalı. */
export function kalemlereBol(kayit: Kayit, parcalar: Parca[]): Kayit[] {
  const toplam = parcalar.reduce((t, p) => t + p.tutar, 0);
  if (toplam !== kayit.tutar) throw new Error('Kalemlerin toplamı kayıt tutarına eşit olmalı.');
  if (parcalar.some((p) => p.tutar <= 0)) throw new Error('Her kalemin tutarı sıfırdan büyük olmalı.');
  const { id: _id, aktarimAnahtari: _a, ...geri } = kayit;
  const simdi = Date.now();
  return parcalar.map((p, i) => ({
    ...(i === 0 ? kayit : geri),
    aciklama: p.aciklama,
    tutar: p.tutar,
    kategori: p.kategori,
    guncelleme: simdi,
    olusturma: i === 0 ? kayit.olusturma : simdi,
  }));
}
