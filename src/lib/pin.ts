// PIN asla düz metin saklanmaz: PBKDF2-SHA256 (150.000 tur) ile özetlenir.

const TUR = 150_000;

function b64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function b64Coz(s: string): Uint8Array {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

export interface PinKaydi {
  tuz: string;
  ozet: string;
}

async function ozetle(pin: string, tuz: Uint8Array): Promise<string> {
  const anahtar = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bitler = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: tuz as BufferSource, iterations: TUR }, anahtar, 256);
  return b64(bitler);
}

export async function pinOlustur(pin: string): Promise<PinKaydi> {
  const tuz = crypto.getRandomValues(new Uint8Array(16));
  return { tuz: b64(tuz), ozet: await ozetle(pin, tuz) };
}

export async function pinDogrula(pin: string, kayit: PinKaydi): Promise<boolean> {
  const ozet = await ozetle(pin, b64Coz(kayit.tuz));
  // sabit zamanlı karşılaştırma
  if (ozet.length !== kayit.ozet.length) return false;
  let fark = 0;
  for (let i = 0; i < ozet.length; i++) fark |= ozet.charCodeAt(i) ^ kayit.ozet.charCodeAt(i);
  return fark === 0;
}

export const pinGecerli = (pin: string) => /^\d{4,8}$/.test(pin);
