import { normalize } from './metin';

/**
 * Serbest metindeki ödeme sözcüğünü ("nakit", "Denizbank", "havale") ödeme yöntemi adına çevirir.
 * Sabit eş anlamlıların yanında, ödeme yöntemi adlarının ilk kelimesi de otomatik eşleşir
 * (Excel'den yeni bir yöntem gelirse ek ayar gerekmez).
 */
const ES_ANLAMLI: Array<[string[], string]> = [
  [['nakit', 'nakıt', 'cash', 'elden'], 'Nakit'],
  [['havale', 'fast', 'eft', 'havale fast'], 'Havale / FAST'],
  [['hgs', 'ogs'], 'HGS'],
  [['denizbank', 'deniz', 'deniz kart', 'denizbank kart'], 'Denizbank kredi kartı'],
  [['is bankasi', 'isbankasi', 'isbank', 'is bank', 'is kart', 'maximum kart'], 'İş Bankası kredi kartı'],
  [['troy', 'business', 'is troy', 'troy business', 'sirket karti'], 'İş Bankası Troy Business kartı'],
  [['maximum genc', 'genc', 'genc kart'], 'Maximum Genç kredi kartı'],
  [['annem', 'annemin', 'annemin karti', 'annemin kredi karti', 'annem kart'], 'Annemin kredi kartı'],
];

export interface OdemeEslesme {
  odeme: string;
  /** Eşleşen kelimeler (metinden çıkarılmak üzere) */
  eslesen: string;
}

/** Bilinen ödeme yöntemleri listesi verildiğinde sözlük oluşturur (en uzun ifade önce). */
export function odemeSozlugu(odemeler: string[]): Array<[string, string]> {
  const sozluk = new Map<string, string>();
  const varMi = (ad: string) => odemeler.length === 0 || odemeler.includes(ad);
  for (const [esler, ad] of ES_ANLAMLI) if (varMi(ad)) for (const e of esler) sozluk.set(e, ad);
  for (const ad of odemeler) {
    const n = normalize(ad);
    if (!n || n === '-') continue;
    if (!sozluk.has(n)) sozluk.set(n, ad);
    const ilk = n.split(' ')[0];
    if (ilk.length >= 3 && !sozluk.has(ilk) && !['kredi', 'banka'].includes(ilk)) sozluk.set(ilk, ad);
  }
  return [...sozluk.entries()].sort((a, b) => b[0].split(' ').length - a[0].split(' ').length || b[0].length - a[0].length);
}

/**
 * Kelime listesinin SONUNDAN başlayarak ödeme ifadesi arar (WhatsApp'ta ödeme genelde sona yazılır).
 * Bulamazsa herhangi bir konumda arar. Bulunan kelimelerin indekslerini döndürür.
 */
export function odemeBul(kelimeler: string[], sozluk: Array<[string, string]>): { odeme: string; bas: number; uzunluk: number } | null {
  const norm = kelimeler.map((k) => normalize(k));
  const dene = (bas: number) => {
    for (const [ifade, ad] of sozluk) {
      const parca = ifade.split(' ');
      if (bas + parca.length > norm.length) continue;
      let tamam = true;
      for (let i = 0; i < parca.length; i++) if (norm[bas + i] !== parca[i]) { tamam = false; break; }
      if (tamam) return { odeme: ad, bas, uzunluk: parca.length };
    }
    return null;
  };
  for (let bas = norm.length - 1; bas >= 0; bas--) {
    const r = dene(bas);
    if (r) return r;
  }
  return null;
}
