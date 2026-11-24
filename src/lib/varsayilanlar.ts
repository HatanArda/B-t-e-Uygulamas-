import type { Kategori, OdemeYontemi } from './tipler';
import { dukkanKategorisiMi } from './tipler';

// İlk kurulumda (Excel içe aktarılmadan da) hızlı girişin çalışması için başlangıç listeleri.
// Excel içe aktarılınca dosyadaki kategoriler ve ödeme yöntemleri bunlara eklenir.
const KATEGORI_ADLARI = [
  'Market / Gıda', 'Kafe / Yeme-İçme', 'Ulaşım', 'Kişisel bakım', 'Elektronik', 'Kırtasiye', 'Hediye', 'Spor', 'Kitap',
  'Ev / Temizlik', 'Ev / Malzeme', 'Aile', 'Belediye ödemeleri', 'Diğer',
  'Dükkân: Tadilat', 'Dükkân: Banka masrafı', 'Dükkân: Kahve / Su', 'Dükkân: Temizlik / Sarf', 'Dükkân: Su / Fatura',
  'Dükkân: Elektrik', 'Dükkân: Reklam', 'Dükkân: Temizlik hizmeti', 'Dükkân: SGK / Prim', 'Dükkân: Sigorta',
  'Dükkân: Çalışan yemeği', 'Dükkân: Ulaşım', 'Dükkân: Yeme-İçme', 'Dükkân: Abonelik / Yazılım',
];

export const VARSAYILAN_KATEGORILER: Kategori[] = KATEGORI_ADLARI.map((ad) => ({ ad, dukkan: dukkanKategorisiMi(ad) }));

export const VARSAYILAN_ODEMELER: OdemeYontemi[] = [
  { ad: 'Denizbank kredi kartı', kart: true },
  { ad: 'İş Bankası kredi kartı', kart: true },
  { ad: 'İş Bankası Troy Business kartı', kart: true },
  { ad: 'Maximum Genç kredi kartı', kart: true },
  { ad: 'Annemin kredi kartı', kart: true },
  { ad: 'Nakit', kart: false },
  { ad: 'Havale / FAST', kart: false },
  { ad: 'HGS', kart: false },
];

export function kartMi(ad: string): boolean {
  return /kart/i.test(ad);
}
