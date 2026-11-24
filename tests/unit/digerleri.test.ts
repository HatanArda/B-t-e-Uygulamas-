import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { formatTL, parseTutar } from '../../src/lib/para';
import { isoAyEkle, isoToTR, trToISO } from '../../src/lib/tarih';
import { kalanBorc, taksitPlani } from '../../src/lib/taksit';
import { belirsizKayitlar, filtrele, grupla, toplam } from '../../src/lib/ozet';
import { kalemlereBol, karmaBol } from '../../src/lib/bolme';
import { mukerrerFis, olasiMukerrerler } from '../../src/lib/mukerrer';
import { pinDogrula, pinOlustur } from '../../src/lib/pin';
import { ButceDB, kayitlariAktar } from '../../src/db';
import { yedekOlustur, yedekYukle } from '../../src/lib/yedek';
import type { Kayit } from '../../src/lib/tipler';

const k = (p: Partial<Kayit>): Kayit => ({
  tarih: '2026-11-20', kategori: 'Market / Gıda', aciklama: 'Ekmek', tur: 'Kişisel', dukkan: '-',
  tutar: 4000, kaynak: 'Test', odeme: 'Nakit', olusturma: 0, ...p,
});

describe('para ve tarih biçimleri', () => {
  it('TL biçimi 1.234,56', () => {
    expect(formatTL(123456)).toBe('1.234,56 TL');
    expect(formatTL(35323910)).toBe('353.239,10 TL');
  });
  it('tutar ayrıştırma', () => {
    expect(parseTutar('1.234,56')).toBe(123456);
    expect(parseTutar('10070')).toBe(1007000);
    expect(parseTutar('8,37')).toBe(837);
    expect(parseTutar('12,5')).toBe(1250);
    expect(parseTutar('1.234')).toBe(123400);
    expect(parseTutar('abc')).toBeNull();
  });
  it('tarih GG.AA.YYYY', () => {
    expect(isoToTR('2026-11-05')).toBe('05.11.2026');
    expect(trToISO('5/11/2026')).toBe('2026-11-05');
    expect(trToISO('31.02.2026')).toBeNull();
    expect(isoAyEkle('2026-01-31', 1)).toBe('2026-02-28');
  });
});

describe('taksit', () => {
  it('40.000 TL / 4 taksit planı ve kalan borç', () => {
    const t = { toplam: 4000000, sayi: 4, ilkTaksit: '2026-12-24' };
    const plan = taksitPlani(t, '2027-01-30');
    expect(plan.map((p) => [p.tarih, p.tutar, p.odendi])).toEqual([
      ['2026-12-24', 1000000, true], ['2027-01-24', 1000000, true], ['2027-02-24', 1000000, false], ['2027-03-24', 1000000, false],
    ]);
    expect(kalanBorc(t, '2027-01-30')).toBe(2000000);
  });
  it('kuruş artığı ilk taksite', () => {
    expect(taksitPlani({ toplam: 1000, sayi: 3, ilkTaksit: '2026-12-01' }, '2026-01-01').map((p) => p.tutar)).toEqual([334, 333, 333]);
  });
});

describe('özet ve filtre', () => {
  const kayitlar = [
    k({ tutar: 100, kategori: 'A', tur: 'Dükkân', dukkan: 'Eray Optik 2' }),
    k({ tutar: 200, kategori: 'B', tarih: '2026-10-01' }),
    k({ tutar: 300, kategori: 'A', tur: 'Karma', dukkan: 'Belirtilmedi' }),
    k({ tutar: 50, tur: 'Dükkân', dukkan: 'Belirtilmedi' }),
  ];
  it('filtre ve gruplama', () => {
    expect(toplam(filtrele(kayitlar, { bas: '2026-11-01' }))).toBe(450);
    expect(grupla(kayitlar, (x) => x.kategori)[0]).toEqual({ ad: 'A', tutar: 400, adet: 2 });
    expect(filtrele(kayitlar, { dukkan: 'Eray Optik 2' })).toHaveLength(1);
  });
  it('belirtilmedi / karma uyarı listesi', () => {
    expect(belirsizKayitlar(kayitlar).map((x) => x.tutar)).toEqual([300, 50]);
  });
});

describe('bölme', () => {
  it('karma kaydı dükkân ve kişisel kısma böler', () => {
    const karma = k({ id: 7, tutar: 733700, tur: 'Karma', dukkan: 'Belirtilmedi', kategori: 'Belediye ödemeleri', aciklama: 'Belediye ödemeleri' });
    const { kisisel, dukkanKaydi } = karmaBol(karma, 400000, 'GALLİPOLİ OPTİK');
    expect(kisisel).toMatchObject({ id: 7, tur: 'Kişisel', dukkan: '-', tutar: 333700, kategori: 'Belediye ödemeleri' });
    expect(dukkanKaydi).toMatchObject({ tur: 'Dükkân', dukkan: 'GALLİPOLİ OPTİK', tutar: 400000, kategori: 'Dükkân: Belediye ödemeleri', bolunenId: 7 });
    expect(dukkanKaydi.id).toBeUndefined();
    expect(() => karmaBol(karma, 800000, 'Eray Optik 2')).toThrow();
  });
  it('fişi kalemlere böler, toplam tutmalı', () => {
    const fis = k({ id: 3, tutar: 116500, aciklama: 'Market' });
    const parcalar = kalemlereBol(fis, [
      { aciklama: 'Market - Peynir', tutar: 50000, kategori: 'Market / Gıda' },
      { aciklama: 'Market - Deterjan', tutar: 66500, kategori: 'Ev / Temizlik' },
    ]);
    expect(parcalar[0].id).toBe(3);
    expect(parcalar[1].id).toBeUndefined();
    expect(() => kalemlereBol(fis, [{ aciklama: 'x', tutar: 1, kategori: 'y' }])).toThrow();
  });
});

describe('mükerrer', () => {
  it('aynı gün, aynı tutar, benzer açıklama', () => {
    const mevcut = [k({ id: 1, aciklama: 'Migros - SEK Quark protein 16', tutar: 8790 }), k({ id: 2, aciklama: 'Berber', tutar: 8790 })];
    expect(olasiMukerrerler(k({ aciklama: 'SEK QUARK PROTEIN 16', tutar: 8790 }), mevcut).map((m) => m.id)).toEqual([1]);
    expect(olasiMukerrerler(k({ aciklama: 'Berber', tutar: 8790, tarih: '2026-11-21' }), mevcut)).toEqual([]);
  });
  it('aynı fiş (tarih + saat + toplam)', () => {
    const fisler = [{ id: 1, tarih: '2026-11-18', saat: '14:32', toplam: 77269 }];
    expect(mukerrerFis({ tarih: '2026-11-18', saat: '14:32', toplam: 77269 }, fisler)?.id).toBe(1);
    expect(mukerrerFis({ tarih: '2026-11-18', saat: '14:33', toplam: 77269 }, fisler)).toBeUndefined();
  });
});

describe('PIN', () => {
  it('özetlenir ve doğrulanır', async () => {
    const p = await pinOlustur('4826');
    expect(p.ozet).not.toContain('4826');
    expect(await pinDogrula('4826', p)).toBe(true);
    expect(await pinDogrula('4827', p)).toBe(false);
  });
});

describe('veritabanı: içe aktarma ve yedek', () => {
  it('aynı satırları ikinci kez eklemez; yedek geri yüklenir', async () => {
    const d = new ButceDB('test-' + Math.random());
    await d.open();
    expect(await d.kategoriler.count()).toBeGreaterThan(10);
    const satirlar = [
      { ...k({}), aktarimAnahtari: 'a|1' },
      { ...k({}), aktarimAnahtari: 'a|2' },
    ];
    expect(await kayitlariAktar(satirlar, d)).toEqual({ eklenen: 2, atlanan: 0 });
    expect(await kayitlariAktar(satirlar, d)).toEqual({ eklenen: 0, atlanan: 2 });
    await d.fisler.add({ tarih: '2026-11-20', toplam: 100, satici: 'X', hamMetin: '', olusturma: 0, foto: new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' }) });
    await d.ayarlar.put({ anahtar: 'pin', deger: { tuz: 'a', ozet: 'b' } });
    const json = await yedekOlustur(d, true);
    expect(json).not.toContain('"ozet":"b"');
    await d.kayitlar.clear();
    await d.fisler.clear();
    expect(await yedekYukle(d, json)).toEqual({ kayit: 2 });
    expect(await d.kayitlar.count()).toBe(2);
    const fis = (await d.fisler.toArray())[0];
    expect(fis.foto).toBeInstanceOf(Blob);
    expect(new Uint8Array(await fis.foto!.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
    expect((await d.ayarlar.get('pin'))?.deger).toEqual({ tuz: 'a', ozet: 'b' });
  });
});
