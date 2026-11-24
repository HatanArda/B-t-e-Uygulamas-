// Türk market / akaryakıt / kafe fişlerinin OCR metnini kalemlere ayırır.
// Saf fonksiyon: ağ, DOM veya OCR'a bağımlı değildir → birim testlerle doğrulanır.

import { normalize } from './metin';
import { formatSayi } from './para';
import { gecerliTarih } from './tarih';

export interface FisMiktar {
  /** Fişte yazdığı gibi: "1,130" */
  metin: string;
  deger: number;
  birim: 'ad' | 'kg' | 'lt' | 'gr' | '';
  /** Kuruş */
  birimFiyat: number;
}

export interface FisKalemi {
  /** Fişteki (kısaltılmış) ürün adı; okunamazsa "(adı okunamadı)" */
  ad: string;
  okunamadi: boolean;
  /** İndirim sonrası net tutar (kuruş) */
  tutar: number;
  /** İndirim öncesi tutar (kuruş) */
  brut: number;
  /** Uygulanan indirim (kuruş, pozitif) */
  indirim: number;
  kdv?: number;
  miktar?: FisMiktar;
}

export interface FisSonucu {
  satici: string | null;
  /** YYYY-AA-GG */
  tarih: string | null;
  saat: string | null;
  /** Fişteki TOPLAM (kuruş) */
  toplam: number | null;
  /** TOPKDV (kuruş) */
  kdv: number | null;
  kalemler: FisKalemi[];
  /** Kalemlerin net toplamı (kuruş) */
  kalemToplami: number;
  /** toplam - kalemToplami (kuruş); toplam yoksa null */
  fark: number | null;
  odeme: { son4: string | null; nakit: boolean };
}

export const OKUNAMADI = '(adı okunamadı)';

// ---------- yardımcılar ----------

/** OCR'ın rakam içinde yaptığı tipik harf hatalarını düzeltir: "1O0,00" → "100,00" */
function rakamDuzelt(s: string): string {
  return s
    .replace(/(?<=\d)[Oo](?=[\d.,])|(?<=[\d.,])[Oo](?=\d)|(?<=[.,]\d)[Oo](?![\p{L}\d])/gu, '0')
    .replace(/(?<=\d)[lI|](?=[\d.,])|(?<=[\d.,])[lI|](?=\d)/g, '1');
}

const TUTAR_SON = /(-)?\s*[*¥#]?\s*(-)?\s*((?:\d{1,3}(?:[.\s]\d{3})+|\d+)[.,]\d{2})\s*(?:TL|₺)?\s*$/i;

function tutarMetniCoz(m: string): number {
  const temiz = m.replace(/\s/g, '');
  const ayrac = Math.max(temiz.lastIndexOf(','), temiz.lastIndexOf('.'));
  const tam = temiz.slice(0, ayrac).replace(/[.,]/g, '');
  const ondalik = temiz.slice(ayrac + 1);
  return parseInt(tam || '0', 10) * 100 + parseInt(ondalik, 10);
}

/** Satır sonundaki tutarı bulur. */
function sondakiTutar(satir: string): { tutar: number; bas: number } | null {
  const m = TUTAR_SON.exec(satir);
  if (!m) return null;
  const negatif = !!(m[1] || m[2]);
  const t = tutarMetniCoz(m[3]);
  return { tutar: negatif ? -t : t, bas: m.index };
}

const MIKTAR = /(\d+(?:[.,]\d{1,3})?)\s*(AD(?:ET)?|KG|LT|L|GR|G)?\.?\s*[Xx×]\s*(\d+(?:[.,]\d{3})*[.,]\d{2})/i;

function birimCoz(b: string | undefined): FisMiktar['birim'] {
  const n = (b ?? '').toLowerCase();
  if (n.startsWith('ad')) return 'ad';
  if (n === 'kg') return 'kg';
  if (n === 'lt' || n === 'l') return 'lt';
  if (n === 'gr' || n === 'g') return 'gr';
  return '';
}

function miktarBul(satir: string): { miktar: FisMiktar; bas: number; son: number } | null {
  const m = MIKTAR.exec(satir);
  if (!m) return null;
  const metin = m[1];
  const deger = parseFloat(metin.replace(',', '.'));
  let birim = birimCoz(m[2]);
  if (!birim) birim = /[.,]\d{3}$/.test(metin) ? 'kg' : 'ad';
  return {
    miktar: { metin, deger, birim, birimFiyat: tutarMetniCoz(m[3]) },
    bas: m.index,
    son: m.index + m[0].length,
  };
}

function kdvBul(satir: string): number | undefined {
  const m = /%\s?(\d{1,2})\b/.exec(satir);
  return m ? parseInt(m[1], 10) : undefined;
}

function harfSayisi(s: string): number {
  return (s.match(/\p{L}/gu) ?? []).length;
}

/** Ürün adını temizler: KDV, tutar, barkod ve baştaki işaretleri atar. */
function adTemizle(s: string): string {
  return s
    .replace(/%\s?\d{1,2}\b/g, ' ')
    .replace(/\b\d{8,}\b/g, ' ')
    .replace(/[*¥#~_=|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s.,:;-]+|[\s.,:;-]+$/g, '')
    .trim();
}

// ---------- satır sınıflandırma (normalize edilmiş metin üzerinde) ----------

const TOPLAM_SATIRI = /^(genel toplam|toplam|top|odenecek( kdv dahil)? tutar|kdv dahil tutar|odenecek tutar)\b/;
const TOPLAM_DEGIL = /^(toplam|top) ?(kdv|indirim|tasarruf|kazanc|puan|miktar|adet|urun)|^ara ?top/;
const KDV_SATIRI = /^(top ?kdv|toplam kdv|kdv toplam|topkdv)/;
const INDIRIM = /(indirim|indir\b|\bind\b|promosyon|\bpromo\b|money|kampanya|kupon|iskonto|\bisk\b)/;
const YOKSAY = [
  /^ara ?top/, /^kdv\b/, /^matrah/, /\bmatrah\b/, /^fis\b/, /^fis no/, /^z no/, /^eku/, /^tarih\b/, /^saat\b/,
  /\bvergi\b/, /\bv ?d\b/, /^tel\b/, /\btel no\b/, /^adres/, /\bmersis\b/, /^onay/, /provizyon/, /^terminal/,
  /^isyeri/, /^batch/, /^stan\b/, /^ref\b/, /^rrn\b/, /^kasiyer/, /^kasa\b/, /para ustu/, /paraustu/,
  /kredi karti/, /banka karti/, /temassiz/, /^satis\b/, /^tutar\b/, /^nakit\b/, /tasarruf/, /kazandiniz/,
  /\bpuan\b/, /tesekkur/, /^iade/, /bilgi fisi/, /\bmali\b/, /\bettn\b/, /e arsiv/, /\bwww\b/, /\bsicil\b/,
  /\bmah\b/, /\bmahallesi\b/, /\bcad\b/, /\bcaddesi\b/, /\bsok\b/, /\bsokak\b/, /^no\b/, /^pos\b/,
  /^islem/, /hos ?geldiniz/, /^urun adedi/, /^toplam urun/, /^musteri/, /^imza/, /^kart no/, /^aid\b/,
];

const ZINCIRLER: Array<[RegExp, string]> = [
  [/\bmigros\b/, 'Migros'], [/^bim\b|\bbim birlesik/, 'BİM'], [/\ba ?101\b/, 'A101'], [/\bsok marketler|^sok\b/, 'ŞOK'],
  [/\bcarrefour/, 'CarrefourSA'], [/\bfile\b/, 'File Market'], [/\bdecathlon\b/, 'Decathlon'], [/\bmedia ?markt\b/, 'MediaMarkt'],
  [/\bd ?& ?r\b|\bd r\b/, 'D&R'], [/\bpetrol ofisi\b/, 'Petrol Ofisi'], [/\bopet\b/, 'Opet'], [/\bshell\b/, 'Shell'],
  [/\bbp\b/, 'BP'], [/\btotal ?energies\b/, 'TotalEnergies'], [/\bstarbucks\b/, 'Starbucks'], [/\bkahve dunyasi\b/, 'Kahve Dünyası'],
];

// Şirket unvanı bu kelimelerden birine gelince kesilir: "OSMAR GIDA SAN. VE TİC. LTD. ŞTİ." → "Osmar Gıda"
const SIRKET_EKI = new Set([
  'san', 'sanayi', 'tic', 'ticaret', 'ltd', 'sti', 'as', 've', 'ith', 'ihr', 'paz', 'pazarlama', 'anonim', 'limited',
  'sirketi', 'urunleri', 'urun', 'ins', 'insaat', 'turizm', 'nak', 'nakliyat', 'ltdsti', 'aş',
]);

function saticiTemizle(satir: string): string {
  const n = normalize(satir);
  for (const [re, ad] of ZINCIRLER) if (re.test(n)) return ad;
  const kelimeler = satir.replace(/[^\p{L}\d&' ]/gu, ' ').split(/\s+/).filter(Boolean);
  const sonuc: string[] = [];
  for (const k of kelimeler) {
    const kn = normalize(k).replace(/ /g, '');
    if (SIRKET_EKI.has(kn) || (sonuc.length > 0 && kn.length === 1)) break;
    sonuc.push(k);
    if (sonuc.length === 3) break;
  }
  return sonuc
    .join(' ')
    .toLocaleLowerCase('tr-TR')
    .replace(/(^|\s)(\p{L})/gu, (_m, a: string, b: string) => a + b.toLocaleUpperCase('tr-TR'));
}

// ---------- ana fonksiyon ----------

type Oge =
  | { tip: 'kalem'; kalem: FisKalemi }
  | { tip: 'miktar'; miktar: FisMiktar }
  | { tip: 'indirim'; tutar: number };

export function fisAyristir(hamMetin: string): FisSonucu {
  const satirlar = hamMetin.split(/\r?\n/).map((s) => rakamDuzelt(s.replace(/\t/g, ' ')).trim());
  let satici: string | null = null;
  let tarih: string | null = null;
  let saat: string | null = null;
  let toplam: number | null = null;
  let kdv: number | null = null;
  let son4: string | null = null;
  let nakit = false;
  let toplamBekleniyor = false;
  let toplamBulundu = false;
  let oncekiSadeceAd: string | null = null;
  const ogeler: Oge[] = [];

  for (let i = 0; i < satirlar.length; i++) {
    const satir = satirlar[i];
    if (!satir) { oncekiSadeceAd = null; continue; }
    const n = normalize(satir);
    const buyuk = satir.toLocaleUpperCase('tr-TR');
    const sadeceAd = oncekiSadeceAd;
    oncekiSadeceAd = null;

    // Tarih / saat (fişin herhangi bir yerinde)
    if (!tarih) {
      const m = /(?<!\d)(\d{1,2})\s?[./-]\s?(\d{1,2})\s?[./-]\s?(\d{4}|\d{2})(?!\d)/.exec(satir);
      if (m) {
        let y = +m[3];
        if (y < 100) y += 2000;
        if (gecerliTarih(y, +m[2], +m[1])) tarih = `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
      }
    }
    if (!saat) {
      const m = /(?<!\d)([01]?\d|2[0-3])\s?:\s?([0-5]\d)(?::[0-5]\d)?(?!\d)/.exec(satir)
        ?? (/\bsaat\b/.test(n) ? /(?<![\d,])([01]?\d|2[0-3])[.]([0-5]\d)(?![\d,])/.exec(satir) : null);
      if (m) saat = `${m[1].padStart(2, '0')}:${m[2]}`;
    }

    // Kartın son 4 hanesi (bankanın adına güvenmiyoruz)
    const kart = /[*X#•]{2,}[\s*X#•-]*(\d{4})(?![\d,.])/.exec(buyuk) ?? (/^kart no/.test(n) ? /(\d{4})\s*$/.exec(satir) : null);
    if (kart) son4 = kart[1];
    if (/\bnakit\b/.test(n) && !/iade/.test(n)) nakit = true;

    // Satıcı: ilk anlamlı satır
    if (!satici && ogeler.length === 0 && harfSayisi(satir) >= 3 && !YOKSAY.some((r) => r.test(n)) && !sondakiTutar(satir)) {
      satici = saticiTemizle(satir);
      continue;
    }

    if (toplamBulundu) {
      if (KDV_SATIRI.test(n) && kdv === null) kdv = sondakiTutar(satir)?.tutar ?? null;
      continue;
    }

    if (toplamBekleniyor) {
      const t = sondakiTutar(satir);
      if (t) { toplam = Math.abs(t.tutar); toplamBulundu = true; continue; }
      toplamBekleniyor = false;
    }

    if (KDV_SATIRI.test(n)) {
      kdv = sondakiTutar(satir)?.tutar ?? kdv;
      continue;
    }
    if (TOPLAM_SATIRI.test(n) && !TOPLAM_DEGIL.test(n)) {
      const t = sondakiTutar(satir);
      if (t) { toplam = Math.abs(t.tutar); toplamBulundu = true; } else toplamBekleniyor = true;
      continue;
    }

    // "ARA TOPLAM", "TOPLAM İNDİRİM" gibi satırlar ne kalem ne indirimdir
    if (TOPLAM_DEGIL.test(n)) continue;

    const tutar = sondakiTutar(satir);

    // İndirim satırı → önceki kaleme uygulanır
    if (tutar && (tutar.tutar < 0 || INDIRIM.test(n)) && ogeler.some((o) => o.tip === 'kalem')) {
      ogeler.push({ tip: 'indirim', tutar: Math.abs(tutar.tutar) });
      continue;
    }

    if (YOKSAY.some((r) => r.test(n))) continue;

    const mik = miktarBul(satir);
    if (mik) {
      const geri = satir.slice(0, mik.bas) + ' ' + satir.slice(mik.son);
      const geriTutar = sondakiTutar(geri);
      if (geriTutar && geriTutar.tutar > 0) {
        // "2 AD X 109,00   %10   *218,00" — miktar ve tutar aynı satırda
        const adParca = adTemizle(geri.slice(0, geriTutar.bas));
        const ad = harfSayisi(adParca) >= 2 ? adParca : sadeceAd ?? '';
        ogeler.push({ tip: 'kalem', kalem: kalemOlustur(ad, geriTutar.tutar, kdvBul(geri), mik.miktar) });
      } else {
        ogeler.push({ tip: 'miktar', miktar: mik.miktar });
        if (sadeceAd) oncekiSadeceAd = sadeceAd; // ad → miktar → tutar sıralaması
      }
      continue;
    }

    if (tutar && tutar.tutar > 0) {
      const adParca = adTemizle(satir.slice(0, tutar.bas));
      const ad = harfSayisi(adParca) >= 2 ? adParca : sadeceAd ?? '';
      ogeler.push({ tip: 'kalem', kalem: kalemOlustur(ad, tutar.tutar, kdvBul(satir)) });
      continue;
    }

    // Tutarsız, harf içeren satır: bir sonraki satırın ürün adı olabilir
    if (harfSayisi(satir) >= 2) oncekiSadeceAd = adTemizle(satir);
  }

  // Miktar satırlarını yanındaki kaleme bağla
  for (let i = 0; i < ogeler.length; i++) {
    const o = ogeler[i];
    if (o.tip !== 'miktar') continue;
    const sonraki = ogeler[i + 1]?.tip === 'kalem' ? (ogeler[i + 1] as { kalem: FisKalemi }).kalem : null;
    const onceki = ogeler[i - 1]?.tip === 'kalem' ? (ogeler[i - 1] as { kalem: FisKalemi }).kalem : null;
    const beklenen = Math.round(o.miktar.deger * o.miktar.birimFiyat);
    const uyar = (k: FisKalemi | null) => !!k && !k.miktar && Math.abs(k.brut - beklenen) <= 2;
    const hedef = uyar(sonraki) ? sonraki : uyar(onceki) ? onceki : sonraki && !sonraki.miktar ? sonraki : onceki && !onceki.miktar ? onceki : null;
    if (hedef) hedef.miktar = o.miktar;
  }

  // İndirimleri önceki kaleme uygula
  const kalemler: FisKalemi[] = [];
  for (const o of ogeler) {
    if (o.tip === 'kalem') kalemler.push(o.kalem);
    else if (o.tip === 'indirim' && kalemler.length) {
      const k = kalemler[kalemler.length - 1];
      k.indirim += o.tutar;
      k.tutar = k.brut - k.indirim;
    }
  }

  const kalemToplami = kalemler.reduce((t, k) => t + k.tutar, 0);
  return {
    satici,
    tarih,
    saat,
    toplam,
    kdv,
    kalemler,
    kalemToplami,
    fark: toplam === null ? null : toplam - kalemToplami,
    odeme: { son4, nakit: nakit && !son4 },
  };
}

function kalemOlustur(ad: string, tutar: number, kdv?: number, miktar?: FisMiktar): FisKalemi {
  const okunamadi = harfSayisi(ad) < 2;
  return { ad: okunamadi ? OKUNAMADI : ad, okunamadi, tutar, brut: tutar, indirim: 0, kdv, miktar };
}

/** Kalemin kayıt açıklaması: "Migros - MUZ ITHAL (1,130 kg x 139,95)" */
export function kalemAciklamasi(satici: string | null, k: FisKalemi): string {
  const detay: string[] = [];
  if (k.miktar && !(k.miktar.birim === 'ad' && k.miktar.deger === 1)) {
    detay.push(`${k.miktar.metin} ${k.miktar.birim || 'ad'} x ${formatSayi(k.miktar.birimFiyat)}`);
  }
  if (k.indirim > 0) detay.push(`${formatSayi(k.brut)} - ${formatSayi(k.indirim)} indirim`);
  const govde = detay.length ? `${k.ad} (${detay.join('; ')})` : k.ad;
  return satici ? `${satici} - ${govde}` : govde;
}
