import { describe, expect, it } from 'vitest';
import { fisAyristir, kalemAciklamasi, OKUNAMADI } from '../../src/lib/fisAyristir';
import * as F from './fisOrnekleri';

describe('fiş ayrıştırıcı — her fişte kalemler toplamı fiş toplamına eşit', () => {
  const ornekler = Object.entries(F);
  it.each(ornekler)('%s', (_ad, metin) => {
    const r = fisAyristir(metin);
    expect(r.toplam).not.toBeNull();
    expect(r.kalemToplami).toBe(r.toplam);
    expect(r.fark).toBe(0);
    expect(r.tarih).not.toBeNull();
    expect(r.saat).not.toBeNull();
  });
  it('en az 5 örnek fiş var', () => expect(ornekler.length).toBeGreaterThanOrEqual(5));
});

describe('Migros adetli + kilolu', () => {
  const r = fisAyristir(F.MIGROS_ADET_KILO);
  it('başlık bilgileri', () => {
    expect(r).toMatchObject({ satici: 'Migros', tarih: '2026-11-18', saat: '14:32', toplam: 77269, kdv: 812 });
    expect(r.odeme).toEqual({ son4: '1234', nakit: false });
  });
  it('kalemler', () => {
    expect(r.kalemler.map((k) => [k.ad, k.tutar, k.kdv])).toEqual([
      ['A.FIST JUMBO', 29990, 1],
      ['SEK QUARK CILEK 140', 6790, 1],
      ['SEK QUARK PROTEIN 16', 17580, 1],
      ['MUZ ITHAL', 15814, 1],
      ['AVOKADO', 6995, 1],
      ['PLASTIK POSET', 100, 20],
    ]);
  });
  it('miktar satırı yanındaki ürüne bağlanır', () => {
    expect(r.kalemler[2].miktar).toMatchObject({ deger: 2, birim: 'ad', birimFiyat: 8790 });
    expect(r.kalemler[3].miktar).toMatchObject({ metin: '1,130', deger: 1.13, birim: 'kg', birimFiyat: 13995 });
    expect(kalemAciklamasi(r.satici, r.kalemler[3])).toBe('Migros - MUZ ITHAL (1,130 kg x 139,95)');
    expect(kalemAciklamasi(r.satici, r.kalemler[2])).toBe('Migros - SEK QUARK PROTEIN 16 (2 ad x 87,90)');
  });
});

describe('Migros indirimli', () => {
  const r = fisAyristir(F.MIGROS_INDIRIM);
  it('indirim önceki kaleme uygulanır, net tutar yazılır', () => {
    const oneo = r.kalemler[0];
    expect(oneo).toMatchObject({ ad: 'ULKER ONEO NANE ARO', brut: 7595, indirim: 2350, tutar: 5245 });
    const makas = r.kalemler.find((k) => k.ad === 'LIONESSE ET MAKASI')!;
    expect(makas).toMatchObject({ brut: 47995, indirim: 19198, tutar: 28797 });
    expect(kalemAciklamasi(r.satici, oneo)).toBe('Migros - ULKER ONEO NANE ARO (75,95 - 23,50 indirim)');
  });
  it('ARA TOPLAM / TOPLAM İNDİRİM toplam sanılmaz', () => {
    expect(r.toplam).toBe(101207);
    expect(r.kalemler).toHaveLength(6);
  });
  it('tarih GG/AA/YYYY, kart maskeli 16 hane', () => {
    expect(r.tarih).toBe('2026-11-19');
    expect(r.odeme.son4).toBe('1234');
  });
});

describe('Osmar nakit', () => {
  const r = fisAyristir(F.OSMAR_NAKIT);
  it('satıcı adı temizlenir, tarih GG-AA-YYYY, nakit', () => {
    expect(r.satici).toBe('Osmar Gıda');
    expect(r.tarih).toBe('2026-11-21');
    expect(r.saat).toBe('09:41');
    expect(r.odeme).toEqual({ son4: null, nakit: true });
  });
  it('adet satırı', () => {
    expect(r.kalemler[1]).toMatchObject({ ad: 'TEKLİ EKMEK', tutar: 4000, miktar: { deger: 2, birimFiyat: 2000 } });
  });
});

describe('Akaryakıt', () => {
  const r = fisAyristir(F.AKARYAKIT);
  it('litreli kalem, binlik ayraçlı tutar', () => {
    expect(r.kalemler).toHaveLength(1);
    expect(r.kalemler[0]).toMatchObject({ ad: 'MOTORİN', tutar: 400064, kdv: 20, miktar: { metin: '41,630', birim: 'lt', birimFiyat: 9610 } });
  });
  it('POS slibindeki banka adına değil, kartın son 4 hanesine bakılır', () => {
    expect(r.odeme.son4).toBe('4321');
    expect(r.satici).toBe('Memocan Petrol');
  });
});

describe('Kafe', () => {
  const r = fisAyristir(F.KAFE);
  it('"ÖDENECEK KDV DAHİL TUTAR" toplamdır', () => {
    expect(r).toMatchObject({ satici: 'My Moon Cafe', toplam: 33000, kdv: 3000 });
    expect(r.odeme.son4).toBe('9876');
    expect(r.kalemler).toEqual([expect.objectContaining({ ad: 'YİYECEK', tutar: 33000, kdv: 10 })]);
  });
});

describe('D&R', () => {
  const r = fisAyristir(F.DR_INDIRIM);
  it('ad satırı + tutar satırı birleşir, indirimler uygulanır', () => {
    expect(r.satici).toBe('D&R');
    expect(r.kalemler.map((k) => [k.ad, k.brut, k.indirim, k.tutar])).toEqual([
      ['RİSKE ÖVGÜ', 37500, 7021, 30479],
      ['GELİRKEN EKMEK AL', 33000, 6179, 26821],
    ]);
  });
});

describe('File Market (OCR hataları)', () => {
  const r = fisAyristir(F.FILE_OCR_HATALI);
  it('ad satırı + "2 AD X 109,00 %10 *218,00" satırı', () => {
    expect(r.kalemler[0]).toMatchObject({ ad: 'ACTISOFT Y.HAVLU 100LU', tutar: 21800, kdv: 10, miktar: { deger: 2 } });
  });
  it('"99,9O" → 99,90 ve okunamayan kalem işaretlenir', () => {
    expect(r.kalemler[2]).toMatchObject({ ad: 'KEREVİZ SAPI', tutar: 9990 });
    expect(r.kalemler[3]).toMatchObject({ ad: OKUNAMADI, okunamadi: true, tutar: 1250 });
    expect(r.satici).toBe('File Market');
  });
});

describe('toplam tutmazsa fark gösterilir', () => {
  it('bir kalem eksik okunduysa', () => {
    const eksik = F.MIGROS_ADET_KILO.replace(/AVOKADO.*\n/, '');
    const r = fisAyristir(eksik);
    expect(r.fark).toBe(6995);
  });
});

describe('gerçek OCR çıktısı (uçtan uca testte Tesseract\'ın okuduğu metin)', () => {
  // Tesseract "%1"i "S1"/"s1", "%20"yi "5520", "Q"yu "O" okudu; satır sonlarında "—" çöpü var.
  const OCR = `MİGROS TİCARET A.Ş.

GELİBOLU / ÇANAKKALE
TARİH:18.11.2026    SAAT:14:32
FİŞ NO:0045
A.FIST JUMBO        S1 — *299,90
SEK OUARK CILEK     S1    *67,90
2 AD X 87,90
SEK OUARK PROTEIN s1   *175,80
1,130 KG X 139,95
MUZ ITHAL           S1 —*158,14
AVOKADO             S1    *69,95
POSET               5520    *1,00
TOPKDV                     *8,12
TOPLAM                   *772,69
KREDİ KARTI              *772,69
KART NO : KKKK KKKK KKKK 1234`;
  const r = fisAyristir(OCR);
  it('KDV ve çöp karakterler addan ayrılır, toplam tutar', () => {
    expect(r.kalemler.map((k) => [k.ad, k.kdv])).toEqual([
      ['A.FIST JUMBO', 1], ['SEK OUARK CILEK', 1], ['SEK OUARK PROTEIN', 1], ['MUZ ITHAL', 1], ['AVOKADO', 1], ['POSET', 20],
    ]);
    expect(r.fark).toBe(0);
    expect(r.odeme.son4).toBe('1234');
  });
  it('ürün adındaki sayı KDV sanılmaz', () => {
    const r2 = fisAyristir('X MARKET\n01.01.2026 10:00\nSEK QUARK PROTEIN 16 %1 *87,90\nERIKLI SU 5 %1 *20,00\nTOPLAM *107,90');
    expect(r2.kalemler.map((k) => k.ad)).toEqual(['SEK QUARK PROTEIN 16', 'ERIKLI SU 5']);
  });
});

describe('fark düzeltme önerisi', () => {
  it('fazladan okunan rakam (299,90 → 2099,90)', async () => {
    const { farkDuzeltmeOnerisi } = await import('../../src/lib/fisAyristir');
    expect(farkDuzeltmeOnerisi([209990, 6790, 17580, 15814, 6995, 100], 77269)).toEqual({ index: 0, eski: 209990, yeni: 29990 });
  });
  it('belirsizse öneri yok', async () => {
    const { farkDuzeltmeOnerisi } = await import('../../src/lib/fisAyristir');
    expect(farkDuzeltmeOnerisi([1000, 1000], 2900)).toBeNull(); // iki kalemden biri olabilir
    expect(farkDuzeltmeOnerisi([1000, 2000], 3000)).toBeNull(); // zaten tutuyor
  });
  it('"820" → %20', () => {
    const r = fisAyristir('X\n01.01.2026 10:00\nPOSET               820 — *1,00\nTOPLAM *1,00');
    expect(r.kalemler[0]).toMatchObject({ ad: 'POSET', kdv: 20 });
  });
});
