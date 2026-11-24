import { describe, expect, it } from 'vitest';
import { hizliAyristir, type HizliBaglam } from '../../src/lib/hizliGiris';

// Excel'deki gerçek kayıtlara benzeyen küçük bir geçmiş (fixture olmadan da test çalışsın diye).
const baglam: HizliBaglam = {
  bugun: '2026-11-24',
  kategoriler: [
    'Kişisel bakım', 'Market / Gıda', 'Ulaşım', 'Elektronik', 'Kafe / Yeme-İçme', 'Diğer',
    'Dükkân: SGK / Prim', 'Dükkân: Kahve / Su', 'Dükkân: Temizlik / Sarf', 'Dükkân: Tadilat', 'Dükkân: Ulaşım',
  ],
  odemeler: [
    'Denizbank kredi kartı', 'Annemin kredi kartı', 'İş Bankası kredi kartı', 'İş Bankası Troy Business kartı',
    'Maximum Genç kredi kartı', 'Havale / FAST', 'Nakit', 'HGS', '-',
  ],
  gecmis: [
    { aciklama: 'Berber', kategori: 'Kişisel bakım', tur: 'Kişisel' },
    { aciklama: 'SGK prim ödemesi', kategori: 'Dükkân: SGK / Prim', tur: 'Dükkân' },
    { aciklama: 'Otopark', kategori: 'Ulaşım', tur: 'Kişisel' },
    { aciklama: 'Otopark', kategori: 'Dükkân: Ulaşım', tur: 'Dükkân' },
    { aciklama: 'Osmar Gıda - 5 LT su', kategori: 'Dükkân: Kahve / Su', tur: 'Dükkân' },
    { aciklama: 'Türk kahvesi', kategori: 'Dükkân: Kahve / Su', tur: 'Dükkân' },
  ],
};

describe('hızlı giriş — kabul örnekleri', () => {
  it('"Berber 600 nakit"', () => {
    const r = hizliAyristir('Berber 600 nakit', baglam);
    expect(r).toMatchObject({
      tarih: '2026-11-24', tur: 'Kişisel', dukkan: '-', aciklama: 'Berber', tutar: 60000,
      odeme: 'Nakit', kategori: 'Kişisel bakım', kategoriGuven: 'kesin',
    });
    expect(r.sorulacaklar).toEqual([]);
  });

  it('"Eray Optik 2 - Kargo 150 Denizbank"', () => {
    const r = hizliAyristir('Eray Optik 2 - Kargo 150 Denizbank', baglam);
    expect(r).toMatchObject({
      tarih: '2026-11-24', tur: 'Dükkân', dukkan: 'Eray Optik 2', aciklama: 'Kargo', tutar: 15000,
      odeme: 'Denizbank kredi kartı',
    });
    // "Kargo" geçmişte yok → kategori kullanıcıya sorulmalı
    expect(r.kategoriGuven).toBe('yok');
    expect(r.sorulacaklar).toContain('kategori');
  });

  it('"GALLİPOLİ OPTİK SGK 10070 havale"', () => {
    const r = hizliAyristir('GALLİPOLİ OPTİK SGK 10070 havale', baglam);
    expect(r).toMatchObject({
      tarih: '2026-11-24', tur: 'Dükkân', dukkan: 'GALLİPOLİ OPTİK', aciklama: 'SGK', tutar: 1007000,
      odeme: 'Havale / FAST', kategori: 'Dükkân: SGK / Prim', kategoriGuven: 'kesin',
    });
  });
});

describe('hızlı giriş — ek durumlar', () => {
  it('küçük harfle dükkân adı ve kısaltma', () => {
    const r = hizliAyristir('gallipoli otopark 220', baglam);
    expect(r).toMatchObject({ tur: 'Dükkân', dukkan: 'GALLİPOLİ OPTİK', aciklama: 'Otopark', tutar: 22000, kategori: 'Dükkân: Ulaşım' });
    const r2 = hizliAyristir('eray 2: türk kahvesi 200', baglam);
    expect(r2).toMatchObject({ dukkan: 'Eray Optik 2', aciklama: 'Türk kahvesi', kategori: 'Dükkân: Kahve / Su' });
  });

  it('kişisel otopark kişisel kategoriye gider', () => {
    expect(hizliAyristir('Otopark 300', baglam)).toMatchObject({ tur: 'Kişisel', kategori: 'Ulaşım', odeme: '-' });
  });

  it('tarih, ondalık ve binlik ayıraç', () => {
    expect(hizliAyristir('13.11 Market 1.165,50 denizbank', baglam)).toMatchObject({
      tarih: '2026-11-13', aciklama: 'Market', tutar: 116550, odeme: 'Denizbank kredi kartı',
    });
    expect(hizliAyristir('dün ekmek 40 tl nakit', baglam)).toMatchObject({ tarih: '2026-11-23', aciklama: 'Ekmek', tutar: 4000 });
    expect(hizliAyristir('Market 600tl', baglam).tutar).toBe(60000);
  });

  it('açıklamadaki sayı korunur, son sayı tutardır', () => {
    expect(hizliAyristir('2 ekmek 40 nakit', baglam)).toMatchObject({ aciklama: '2 ekmek', tutar: 4000, odeme: 'Nakit' });
  });

  it('taksit ve çok kelimeli ödeme', () => {
    expect(hizliAyristir('Bilgisayar 40000 4 taksit iş bankası', baglam)).toMatchObject({
      aciklama: 'Bilgisayar', tutar: 4000000, taksitSayisi: 4, odeme: 'İş Bankası kredi kartı',
    });
    expect(hizliAyristir('Pizza 205 annemin kartı', baglam).odeme).toBe('Annemin kredi kartı');
  });

  it('tutar yoksa sorar', () => {
    expect(hizliAyristir('Berber nakit', baglam).sorulacaklar).toContain('tutar');
  });
});
