// Türkçe metin karşılaştırma yardımcıları (yalnızca eşleştirme için; ekrana yazılan metin değişmez).

const HARF: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', â: 'a', î: 'i', û: 'u' };

/** "GALLİPOLİ Optik" → "gallipoli optik" (aksansız, küçük harf, tek boşluk) */
export function normalize(s: string): string {
  return s
    .toLocaleLowerCase('tr-TR')
    .replace(/̇/g, '')
    .replace(/[çğıöşüâîû]/g, (c) => HARF[c] ?? c)
    .replace(/[^a-z0-9%&]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

const ETKISIZ = new Set(['ve', 'ile', 'icin', 'bir', 'x', 'ad', 'adet', 'kg', 'gr', 'g', 'lt', 'l', 'ml', 'li', 'lu', 'lik', 'luk', 'tl', 'the', 'de', 'da']);

/** Anlamlı kelimeler (sayılar ve kısa ekler atılır). */
export function kelimeler(s: string): string[] {
  return normalize(s)
    .split(' ')
    .filter((k) => k.length >= 2 && !ETKISIZ.has(k) && !/^\d+$/.test(k));
}

/** Türkçe ekleri kabaca yok saymak için kelime kökü: ilk 5 harf. */
export function kok(k: string): string {
  return k.length > 5 ? k.slice(0, 5) : k;
}

/** İki metnin kelime benzerliği (0–1, Dice katsayısı, köke göre). */
export function benzerlik(a: string, b: string): number {
  const ka = [...new Set(kelimeler(a).map(kok))];
  const kb = new Set(kelimeler(b).map(kok));
  if (ka.length === 0 || kb.size === 0) return 0;
  let ortak = 0;
  for (const k of ka) if (kb.has(k)) ortak++;
  return (2 * ortak) / (ka.length + kb.size);
}

/** "MUZ İTHAL" → "Muz İthal" */
export function basHarfBuyuk(s: string): string {
  return s
    .toLocaleLowerCase('tr-TR')
    .replace(/(^|[\s(/-])(\p{L})/gu, (_m, a: string, b: string) => a + b.toLocaleUpperCase('tr-TR'));
}

/** Yalnızca ilk harfi büyütür: "berber" → "Berber" */
export function ilkHarfBuyuk(s: string): string {
  return s ? s.charAt(0).toLocaleUpperCase('tr-TR') + s.slice(1) : s;
}
