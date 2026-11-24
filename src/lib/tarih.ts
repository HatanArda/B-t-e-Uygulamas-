// Tarihler uygulama içinde "YYYY-AA-GG" (ISO) metin olarak, ekranda GG.AA.YYYY olarak tutulur.

const pad = (n: number) => String(n).padStart(2, '0');

export function bugunISO(simdi: Date = new Date()): string {
  return `${simdi.getFullYear()}-${pad(simdi.getMonth() + 1)}-${pad(simdi.getDate())}`;
}

export function isoToTR(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

export function gecerliTarih(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1990 || y > 2200) return false;
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

/** "18.11.2026", "18/11/2026", "18-11-26", "18.11" (yıl yoksa referans yılı) → ISO */
export function trToISO(s: string, referansYil?: number): string | null {
  const m = s.trim().match(/^(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2}|\d{4}))?$/);
  if (!m) return null;
  const d = +m[1];
  const ay = +m[2];
  let y = m[3] ? +m[3] : (referansYil ?? new Date().getFullYear());
  if (y < 100) y += 2000;
  if (!gecerliTarih(y, ay, d)) return null;
  return `${y}-${pad(ay)}-${pad(d)}`;
}

export function dateToISO(d: Date, utc = false): string {
  return utc
    ? `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
    : bugunISO(d);
}

export function isoGunEkle(iso: string, gun: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + gun));
  return dateToISO(t, true);
}

/** Ay ekler; ayın günü yoksa ay sonuna sabitler (31 Ocak + 1 ay = 28/29 Şubat). */
export function isoAyEkle(iso: string, ay: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const hedef = new Date(Date.UTC(y, m - 1 + ay, 1));
  const sonGun = new Date(Date.UTC(hedef.getUTCFullYear(), hedef.getUTCMonth() + 1, 0)).getUTCDate();
  hedef.setUTCDate(Math.min(d, sonGun));
  return dateToISO(hedef, true);
}

export const AY_ADLARI = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

/** "2026-11" → "Kasım 2026" */
export function ayEtiketi(yyyyAa: string): string {
  const [y, m] = yyyyAa.split('-').map(Number);
  return `${AY_ADLARI[m - 1]} ${y}`;
}
