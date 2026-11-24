import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { excelOku, excelYaz } from '../../src/lib/excel';
import type { Kayit } from '../../src/lib/tipler';

const GERCEK = 'tests/fixtures/harcamalar_13-14-11-2026.xlsx';

describe('Excel içe aktarma — gerçek dosya (tests/fixtures, depoda yok)', () => {
  it.skipIf(!existsSync(GERCEK))('genel toplam Excel\'deki TOPLAM hücresiyle birebir aynı', async () => {
    const r = await excelOku(readFileSync(GERCEK));
    const toplam = r.kayitlar.reduce((t, k) => t + k.tutar, 0);
    expect(r.excelToplam).not.toBeNull();
    expect(toplam).toBe(r.excelToplam);
    expect(toplam).toBe(35323910); // 353.239,10 TL
    expect(r.kayitlar).toHaveLength(173);
    expect(r.uyarilar).toEqual([]);
    // Kategoriler ve ödeme yöntemleri dosyadan çıkarılır
    expect(r.odemeler).toEqual(expect.arrayContaining([
      'Denizbank kredi kartı', 'İş Bankası kredi kartı', 'Annemin kredi kartı', 'Nakit', 'HGS', 'Havale / FAST',
      'İş Bankası Troy Business kartı', 'Maximum Genç kredi kartı',
    ]));
    expect(r.kategoriler).toContain('Dükkân: SGK / Prim');
    expect(r.kategoriler.length).toBe(28);
    // Tarih ve tür alanları
    expect(r.kayitlar[0]).toMatchObject({ tarih: '2026-11-12', tur: 'Dükkân', dukkan: 'GALLİPOLİ OPTİK', tutar: 71500 });
    const karma = r.kayitlar.find((k) => k.tur === 'Karma')!;
    expect(karma).toMatchObject({ dukkan: 'Belirtilmedi', tutar: 733700 });
    // Aynı satırlar (iki kez "5 LT su 54") ayrı anahtar alır
    const anahtarlar = new Set(r.kayitlar.map((k) => k.aktarimAnahtari));
    expect(anahtarlar.size).toBe(173);
  });
});

function ornekKayit(p: Partial<Kayit>): Kayit {
  return {
    tarih: '2026-11-20', kategori: 'Market / Gıda', aciklama: 'Ekmek', tur: 'Kişisel', dukkan: '-',
    tutar: 4000, kaynak: 'Test', odeme: 'Nakit', olusturma: 0, ...p,
  };
}

describe('Excel dışa aktarma → içe aktarma', () => {
  it('aynı sütun düzeni, toplam formül olarak, geri okununca tutarlar aynı', async () => {
    const kayitlar = [
      ornekKayit({ id: 1, tutar: 8211, aciklama: 'Osmar Gıda - Mandalina 1,19 kg x 69,00' }),
      ornekKayit({ id: 2, tarih: '2026-11-19', tutar: 1007000, tur: 'Dükkân', dukkan: 'GALLİPOLİ OPTİK', kategori: 'Dükkân: SGK / Prim', odeme: 'Havale / FAST', aciklama: 'SGK' }),
      ornekKayit({ id: 3, tarih: '2026-11-17', tutar: 733700, tur: 'Karma', dukkan: 'Belirtilmedi', kategori: 'Belediye ödemeleri' }),
      ornekKayit({ id: 4, tutar: 837 }),
    ];
    const buf = await excelYaz(kayitlar);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    const ws = wb.getWorksheet('Harcamalar')!;
    expect((ws.getRow(1).values as unknown[]).slice(1)).toEqual(['Tarih', 'Kategori', 'Açıklama', 'Tür', 'Dükkân', 'Tutar (TL)', 'Kaynak', 'Ödeme']);
    const toplamHucre = ws.getRow(6).getCell(6).value as { formula: string; result: number };
    expect(toplamHucre.formula).toBe('SUM(F2:F5)');
    expect(toplamHucre.result).toBeCloseTo(17497.48, 2);
    expect(ws.getRow(2).getCell(1).numFmt).toBe('DD.MM.YYYY');
    const oz = wb.getWorksheet('Özet')!;
    const formuller: string[] = [];
    oz.eachRow((r) => r.eachCell((c) => { const v = c.value as { formula?: string }; if (v?.formula) formuller.push(v.formula); }));
    expect(formuller.some((f) => f.startsWith('SUMIFS(Harcamalar!$F$2:$F$5,Harcamalar!$E$2:$E$5'))).toBe(true);

    const geri = await excelOku(buf);
    expect(geri.excelToplam).toBe(1749748);
    expect(geri.kayitlar.reduce((t, k) => t + k.tutar, 0)).toBe(1749748);
    expect(geri.kayitlar[0].tarih).toBe('2026-11-17');
  });
});
