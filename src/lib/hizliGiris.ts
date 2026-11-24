import { kategoriOner, type GecmisOrnek, type Guven } from './kategoriTahmin';
import { ilkHarfBuyuk, normalize } from './metin';
import { odemeBul, odemeSozlugu } from './odemeEslestir';
import { parseTutar } from './para';
import { bugunISO, isoGunEkle, trToISO } from './tarih';
import { DUKKANLAR, DUKKAN_YOK, ODEME_YOK, type Tur } from './tipler';

export interface HizliBaglam {
  kategoriler: string[];
  odemeler: string[];
  gecmis: GecmisOrnek[];
  dukkanlar?: readonly string[];
  bugun?: string;
}

export interface HizliSonuc {
  tarih: string;
  tur: Tur;
  dukkan: string;
  aciklama: string;
  tutar: number | null;
  odeme: string;
  kategori: string | null;
  kategoriGuven: Guven;
  kategoriAdaylari: string[];
  taksitSayisi?: number;
  /** Eksik/emin olunmayan alanlar: kullanıcıya sorulur */
  sorulacaklar: Array<'tutar' | 'kategori' | 'aciklama'>;
}

/** Dükkân adının kısaltmaları: "GALLİPOLİ OPTİK" → ["gallipoli optik", "gallipoli"] */
function dukkanTakmaAdlari(dukkan: string): string[] {
  const n = normalize(dukkan);
  const parca = n.split(' ');
  const adlar = new Set([n]);
  if (parca.length > 1) adlar.add(parca[0]);
  // "Eray Optik 2" → "eray 2", "eray2"
  const son = parca[parca.length - 1];
  if (/^\d+$/.test(son)) {
    adlar.add(`${parca[0]} ${son}`);
    adlar.add(`${parca[0]}${son}`);
  }
  return [...adlar].sort((a, b) => b.split(' ').length - a.split(' ').length);
}

const AYRAC = /^[-–—:,;/|]+$/;

export function hizliAyristir(girdi: string, baglam: HizliBaglam): HizliSonuc {
  const bugun = baglam.bugun ?? bugunISO();
  const refYil = +bugun.slice(0, 4);
  let parcalar = girdi.trim().replace(/([^\s])([-–—:])\s/g, '$1 $2 ').split(/\s+/).filter(Boolean);

  // 1) Tarih: "13.11", "13.11.2026", "dün", "bugün"
  let tarih = bugun;
  parcalar = parcalar.filter((p) => {
    const n = normalize(p);
    if (n === 'dun') { tarih = isoGunEkle(bugun, -1); return false; }
    if (n === 'bugun') { tarih = bugun; return false; }
    if (/^\d{1,2}[./]\d{1,2}([./]\d{2,4})?$/.test(p)) {
      const iso = trToISO(p, refYil);
      if (iso) { tarih = iso; return false; }
    }
    return true;
  });

  // 2) Başta dükkân adı
  let tur: Tur = 'Kişisel';
  let dukkan = DUKKAN_YOK;
  const normParca = parcalar.map(normalize);
  dukkanAra: for (const d of baglam.dukkanlar ?? DUKKANLAR) {
    for (const takma of dukkanTakmaAdlari(d)) {
      const k = takma.split(' ');
      if (k.every((w, i) => normParca[i] === w)) {
        tur = 'Dükkân';
        dukkan = d;
        parcalar = parcalar.slice(k.length);
        break dukkanAra;
      }
    }
  }
  while (parcalar.length && AYRAC.test(parcalar[0])) parcalar.shift();

  // 3) Taksit: "4 taksit"
  let taksitSayisi: number | undefined;
  for (let i = 0; i < parcalar.length; i++) {
    const m = parcalar[i].match(/^(\d{1,2})$/);
    if (m && normalize(parcalar[i + 1] ?? '').startsWith('taksit')) {
      taksitSayisi = +m[1];
      parcalar.splice(i, 2);
      break;
    }
    const m2 = normalize(parcalar[i]).match(/^(\d{1,2}) ?taksit/);
    if (m2) { taksitSayisi = +m2[1]; parcalar.splice(i, 1); break; }
  }

  // 4) Ödeme yöntemi
  let odeme = ODEME_YOK;
  const bulunan = odemeBul(parcalar, odemeSozlugu(baglam.odemeler));
  if (bulunan) {
    odeme = bulunan.odeme;
    parcalar.splice(bulunan.bas, bulunan.uzunluk);
  }

  // 5) Tutar: sondan ilk sayı ("600", "1.234,56", "600tl", "600 TL")
  let tutar: number | null = null;
  for (let i = parcalar.length - 1; i >= 0; i--) {
    let p = parcalar[i];
    const sonraki = normalize(parcalar[i + 1] ?? '');
    const tlEki = /^(.*\d)(tl|₺)$/i.exec(p);
    if (tlEki) p = tlEki[1];
    const t = parseTutar(p.replace(/^₺/, ''));
    if (t !== null && t > 0) {
      tutar = t;
      parcalar.splice(i, sonraki === 'tl' ? 2 : 1);
      break;
    }
  }
  // Tutar okunmuş "tl" kelimesi tek kaldıysa at
  parcalar = parcalar.filter((p) => !/^(tl|₺)$/i.test(p));

  // 6) Açıklama
  while (parcalar.length && AYRAC.test(parcalar[parcalar.length - 1])) parcalar.pop();
  while (parcalar.length && AYRAC.test(parcalar[0])) parcalar.shift();
  const aciklama = ilkHarfBuyuk(parcalar.join(' ').trim());

  // 7) Kategori
  const oneri = aciklama
    ? kategoriOner(aciklama, tur, baglam.gecmis, baglam.kategoriler)
    : { kategori: null, guven: 'yok' as Guven, adaylar: [] };

  const sorulacaklar: HizliSonuc['sorulacaklar'] = [];
  if (tutar === null) sorulacaklar.push('tutar');
  if (!aciklama) sorulacaklar.push('aciklama');
  if (oneri.guven !== 'kesin') sorulacaklar.push('kategori');

  return {
    tarih,
    tur,
    dukkan,
    aciklama,
    tutar,
    odeme,
    kategori: oneri.kategori,
    kategoriGuven: oneri.guven,
    kategoriAdaylari: oneri.adaylar,
    taksitSayisi,
    sorulacaklar,
  };
}
