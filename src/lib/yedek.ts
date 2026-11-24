import type { ButceDB } from '../db';

// JSON yedeği: tüm tablolar. Fiş fotoğrafları isteğe bağlı olarak base64 içine gömülür.

export const YEDEK_SURUMU = 1;

interface YedekDosyasi {
  uygulama: 'butce';
  surum: number;
  tarih: string;
  tablolar: Record<string, unknown[]>;
}

async function blobToDataURL(b: Blob): Promise<string> {
  const buf = new Uint8Array(await b.arrayBuffer());
  let s = '';
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return `data:${b.type || 'image/jpeg'};base64,${btoa(s)}`;
}

function dataURLToBlob(d: string): Blob {
  const [bas, veri] = d.split(',');
  const tip = /data:(.*?);base64/.exec(bas)?.[1] ?? 'image/jpeg';
  return new Blob([Uint8Array.from(atob(veri), (c) => c.charCodeAt(0))], { type: tip });
}

const TABLOLAR = ['kayitlar', 'fisler', 'taksitler', 'kategoriler', 'odemeler', 'kartlar', 'ayarlar'] as const;

export async function yedekOlustur(db: ButceDB, fotograflarDahil: boolean): Promise<string> {
  const tablolar: Record<string, unknown[]> = {};
  for (const t of TABLOLAR) {
    let satirlar = await db.table(t).toArray();
    if (t === 'fisler') {
      satirlar = await Promise.all(
        satirlar.map(async (f) => {
          const { foto, ...geri } = f;
          return fotograflarDahil && foto instanceof Blob ? { ...geri, foto: await blobToDataURL(foto) } : geri;
        }),
      );
    }
    if (t === 'ayarlar') satirlar = satirlar.filter((a) => a.anahtar !== 'pin');
    tablolar[t] = satirlar;
  }
  const dosya: YedekDosyasi = { uygulama: 'butce', surum: YEDEK_SURUMU, tarih: new Date().toISOString(), tablolar };
  return JSON.stringify(dosya);
}

/** Yedeği geri yükler: mevcut verinin TAMAMI silinip yedektekiyle değiştirilir (PIN korunur). */
export async function yedekYukle(db: ButceDB, json: string): Promise<{ kayit: number }> {
  const d = JSON.parse(json) as YedekDosyasi;
  if (d.uygulama !== 'butce' || !d.tablolar) throw new Error('Bu dosya bir Bütçe yedeği değil.');
  await db.transaction('rw', TABLOLAR.map((t) => db.table(t)), async () => {
    for (const t of TABLOLAR) {
      const satirlar = (d.tablolar[t] ?? []) as Array<Record<string, unknown>>;
      if (t === 'ayarlar') {
        await db.table(t).where('anahtar').notEqual('pin').delete();
        await db.table(t).bulkPut(satirlar.filter((a) => a.anahtar !== 'pin'));
        continue;
      }
      await db.table(t).clear();
      const hazir = t === 'fisler'
        ? satirlar.map((f) => (typeof f.foto === 'string' ? { ...f, foto: dataURLToBlob(f.foto) } : f))
        : satirlar;
      await db.table(t).bulkAdd(hazir);
    }
  });
  return { kayit: (d.tablolar.kayitlar ?? []).length };
}
