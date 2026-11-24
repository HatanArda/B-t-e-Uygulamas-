// Tüm tutarlar uygulama içinde KURUŞ cinsinden tam sayı olarak tutulur (kayan nokta hatası olmasın diye).

const fmt = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** 123456 → "1.234,56" */
export function formatSayi(kurus: number): string {
  return fmt.format(kurus / 100);
}

/** 123456 → "1.234,56 TL" */
export function formatTL(kurus: number): string {
  return `${formatSayi(kurus)} TL`;
}

/** Excel/JS sayısını (TL) kuruşa çevirir. */
export function tlToKurus(tl: number): number {
  return Math.round(tl * 100);
}

/**
 * Türkçe yazılmış tutarı kuruşa çevirir.
 * "1.234,56" → 123456, "600" → 60000, "12,5" → 1250, "4000.64" → 400064, "1.234" → 123400
 */
export function parseTutar(girdi: string): number | null {
  let s = girdi.replace(/\s|₺|tl$/gi, '').replace(/^\*+/, '');
  let negatif = false;
  if (s.startsWith('-')) { negatif = true; s = s.slice(1); }
  if (!/^\d[\d.,]*$/.test(s)) return null;
  const sonVirgul = s.lastIndexOf(',');
  const sonNokta = s.lastIndexOf('.');
  let tam: string;
  let ondalik = '';
  if (sonVirgul >= 0 && sonNokta >= 0) {
    const ayrac = Math.max(sonVirgul, sonNokta);
    tam = s.slice(0, ayrac).replace(/[.,]/g, '');
    ondalik = s.slice(ayrac + 1);
  } else if (sonVirgul >= 0) {
    // Virgül Türkçede ondalık ayıracıdır.
    tam = s.slice(0, sonVirgul).replace(/,/g, '');
    ondalik = s.slice(sonVirgul + 1);
  } else if (sonNokta >= 0) {
    if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
      tam = s.replace(/\./g, '');
    } else {
      tam = s.slice(0, sonNokta).replace(/\./g, '');
      ondalik = s.slice(sonNokta + 1);
    }
  } else {
    tam = s;
  }
  if (ondalik.length > 2 || !/^\d*$/.test(ondalik) || tam === '') return null;
  const kurus = parseInt(tam, 10) * 100 + parseInt((ondalik + '00').slice(0, 2), 10);
  return negatif ? -kurus : kurus;
}

/** Ondalıklı miktar ("1,130" → 1.13). */
export function parseMiktar(s: string): number {
  return parseFloat(s.replace(/\./g, '').replace(',', '.'));
}

/** Kuruşu form alanında gösterilecek metne çevirir: 123456 → "1234,56" */
export function kurusToGirdi(kurus: number): string {
  const n = Math.abs(kurus);
  const s = `${Math.floor(n / 100)},${String(n % 100).padStart(2, '0')}`;
  return kurus < 0 ? `-${s}` : s;
}
