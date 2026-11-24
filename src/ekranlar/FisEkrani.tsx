import { useEffect, useMemo, useRef, useState } from 'react';
import { db } from '../db';
import { fisKaydet } from '../islemler';
import { kategoriOner } from '../lib/kategoriTahmin';
import { farkDuzeltmeOnerisi, fisAyristir, kalemAciklamasi, OKUNAMADI, type FisSonucu } from '../lib/fisAyristir';
import { mukerrerFis } from '../lib/mukerrer';
import { formatTL } from '../lib/para';
import { bugunISO, isoToTR } from '../lib/tarih';
import { BELIRTILMEDI, DUKKANLAR, DUKKAN_YOK, ODEME_YOK, dukkanKategorisiMi, type Fis, type Kayit, type Tur } from '../lib/tipler';
import { Secim, TutarGirdi, useBildirim } from '../bilesenler/ortak';
import { useAyar, useGecmis, useKayitlar, useListeler } from '../veri';
import type { Ilerleme, OcrSonucu } from '../ocr/ocr';

interface Satir {
  secili: boolean;
  ad: string;
  detay: string;
  tutar: number;
  kategori: string;
  tur: Tur;
  dukkan: string;
  okunamadi: boolean;
}

interface Durum {
  ocr: OcrSonucu | null;
  hamMetin: string;
  fis: FisSonucu;
  satici: string;
  tarih: string;
  saat: string;
  toplam: number | null;
  odeme: string;
  son4: string | null;
  kartiHatirla: boolean;
  satirlar: Satir[];
}

const DUSUK_GUVEN = 60;
const DUSUK_NETLIK = 60;

function detayCikar(k: FisSonucu['kalemler'][number]): string {
  const tam = kalemAciklamasi(null, k);
  return tam.startsWith(k.ad + ' (') ? tam.slice(k.ad.length + 2, -1) : '';
}

export function FisEkrani() {
  const kayitlar = useKayitlar();
  const { kategoriler, odemeler } = useListeler();
  const gecmis = useGecmis(kayitlar);
  const fotoSakla = useAyar('fisFotoSakla', true);
  const bildir = useBildirim();
  const kameraRef = useRef<HTMLInputElement>(null);
  const galeriRef = useRef<HTMLInputElement>(null);
  const [ilerleme, setIlerleme] = useState<Ilerleme | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [d, setD] = useState<Durum | null>(null);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [mukerrer, setMukerrer] = useState<Fis | undefined>();
  const [fotoyuSakla, setFotoyuSakla] = useState(true);
  const [mesgul, setMesgul] = useState(false);

  useEffect(() => setFotoyuSakla(fotoSakla), [fotoSakla]);
  useEffect(() => {
    // Motoru önceden yükle (ilk okuma hızlansın)
    import('../ocr/ocr').then((m) => m.ocrIsit()).catch(() => undefined);
  }, []);
  useEffect(() => {
    if (!d?.ocr) { setFotoUrl(null); return; }
    const u = URL.createObjectURL(d.ocr.onIsleme.foto);
    setFotoUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [d?.ocr]);
  useEffect(() => {
    if (!d) return;
    db.fisler.toArray().then((f) => setMukerrer(mukerrerFis({ tarih: d.tarih, saat: d.saat || undefined, toplam: d.toplam }, f)));
  }, [d?.tarih, d?.saat, d?.toplam]); // eslint-disable-line react-hooks/exhaustive-deps

  const kategoriBul = (ad: string, tur: Tur, satici: string) => {
    const o = kategoriOner(ad, tur, gecmis, kategoriler, satici);
    return o.kategori ?? '';
  };

  const hazirla = async (ocr: OcrSonucu | null, hamMetin: string) => {
    const fis = fisAyristir(hamMetin);
    const kartlar = await db.kartlar.toArray();
    const eslesen = fis.odeme.son4 ? kartlar.find((k) => k.son4 === fis.odeme.son4)?.odeme : undefined;
    const odeme = eslesen ?? (fis.odeme.nakit ? 'Nakit' : '');
    const satici = fis.satici ?? '';
    setD({
      ocr,
      hamMetin,
      fis,
      satici,
      tarih: fis.tarih ?? bugunISO(),
      saat: fis.saat ?? '',
      toplam: fis.toplam,
      odeme,
      son4: fis.odeme.son4,
      kartiHatirla: !!fis.odeme.son4 && !eslesen,
      satirlar: fis.kalemler.map((k) => ({
        secili: true,
        ad: k.ad,
        detay: detayCikar(k),
        tutar: k.tutar,
        kategori: k.okunamadi ? '' : kategoriBul(k.ad, 'Kişisel', satici),
        tur: 'Kişisel' as Tur,
        dukkan: DUKKAN_YOK,
        okunamadi: k.okunamadi,
      })),
    });
  };

  const dosyaSecildi = async (dosya: File | undefined) => {
    if (!dosya) return;
    setHata(null);
    setD(null);
    setIlerleme({ asama: 'hazirlik', oran: 0, mesaj: 'Başlıyor…' });
    try {
      const { fisOku } = await import('../ocr/ocr');
      const sonuc = await fisOku(dosya, setIlerleme);
      await hazirla(sonuc, sonuc.metin);
    } catch (e) {
      setHata(`Fiş okunamadı: ${(e as Error).message}`);
    } finally {
      setIlerleme(null);
      if (kameraRef.current) kameraRef.current.value = '';
      if (galeriRef.current) galeriRef.current.value = '';
    }
  };

  const guncelle = (p: Partial<Durum>) => setD((o) => (o ? { ...o, ...p } : o));
  const satirGuncelle = (i: number, p: Partial<Satir>) =>
    setD((o) => (o ? { ...o, satirlar: o.satirlar.map((s, j) => (j === i ? { ...s, ...p } : s)) } : o));
  const topluUygula = (p: (s: Satir) => Partial<Satir>) =>
    setD((o) => (o ? { ...o, satirlar: o.satirlar.map((s) => (s.secili ? { ...s, ...p(s) } : s)) } : o));

  const turAyarla = (s: Satir, tur: Tur, dukkan: string): Partial<Satir> => {
    const uygun = (k: string) => (tur === 'Dükkân' ? dukkanKategorisiMi(k) : !dukkanKategorisiMi(k));
    return { tur, dukkan, kategori: s.kategori && uygun(s.kategori) ? s.kategori : kategoriBul(s.ad, tur, d?.satici ?? '') };
  };

  const secililer = d?.satirlar.filter((s) => s.secili) ?? [];
  const kalemToplami = secililer.reduce((t, s) => t + s.tutar, 0);
  const tumToplam = d?.satirlar.reduce((t, s) => t + s.tutar, 0) ?? 0;
  const fark = d && d.toplam !== null ? d.toplam - tumToplam : null;
  const zayif = d?.ocr
    ? d.ocr.guven < DUSUK_GUVEN || d.ocr.onIsleme.netlik < DUSUK_NETLIK || d.fis.toplam === null || d.satirlar.length === 0
    : false;
  const oneri = d && d.toplam !== null && fark !== 0 ? farkDuzeltmeOnerisi(d.satirlar.map((x) => x.tutar), d.toplam) : null;
  const eksikKategori = secililer.some((s) => !s.kategori);
  const uygunKategoriler = useMemo(() => ({
    Kişisel: kategoriler.filter((k) => !dukkanKategorisiMi(k)),
    Dükkân: kategoriler.filter((k) => dukkanKategorisiMi(k)),
    Karma: kategoriler,
  }), [kategoriler]);

  const kaydet = async () => {
    if (!d || secililer.length === 0) return;
    setMesgul(true);
    try {
      const fis: Fis = {
        tarih: d.tarih,
        saat: d.saat || undefined,
        toplam: d.toplam,
        satici: d.satici,
        hamMetin: d.hamMetin,
        foto: fotoyuSakla && d.ocr ? d.ocr.onIsleme.foto : undefined,
        olusturma: Date.now(),
      };
      const odeme = d.odeme || ODEME_YOK;
      const yeni: Kayit[] = secililer.map((s) => ({
        tarih: d.tarih,
        saat: d.saat || undefined,
        kategori: s.kategori,
        aciklama: `${d.satici ? d.satici + ' - ' : ''}${s.ad}${s.detay ? ` (${s.detay})` : ''}`,
        tur: s.tur,
        dukkan: s.tur === 'Kişisel' ? DUKKAN_YOK : s.dukkan,
        tutar: s.tutar,
        kaynak: 'Fiş fotoğrafı',
        odeme,
        olusturma: 0,
      }));
      await fisKaydet(fis, yeni, d.kartiHatirla && d.son4 && d.odeme ? { son4: d.son4, odeme: d.odeme } : undefined);
      bildir(`${yeni.length} kalem kaydedildi (${formatTL(kalemToplami)})`);
      setD(null);
    } finally {
      setMesgul(false);
    }
  };

  return (
    <div className="sayfa">
      <h1>Fiş okuma</h1>
      <input ref={kameraRef} className="gizli-dosya" type="file" accept="image/*" capture="environment" onChange={(e) => dosyaSecildi(e.target.files?.[0])} aria-label="Fotoğraf çek" />
      <input ref={galeriRef} className="gizli-dosya" type="file" accept="image/*" onChange={(e) => dosyaSecildi(e.target.files?.[0])} aria-label="Galeriden seç" data-testid="galeri" />

      {!d && !ilerleme && (
        <>
          <div className="btn-grup">
            <button className="btn ana" onClick={() => kameraRef.current?.click()}>📷 Fotoğraf çek</button>
            <button className="btn" onClick={() => galeriRef.current?.click()}>🖼 Galeriden seç</button>
          </div>
          <div className="kart kucuk soluk">
            Fiş tamamen telefonunuzda okunur; fotoğraf ve metin hiçbir yere gönderilmez, uçak modunda da çalışır.
            <ul className="adimlar">
              <li>Fişi koyu bir zemine düz koyun, tamamı kadrajda olsun.</li>
              <li>Gölge düşürmeyin, flaşı kapatın, telefonu fişe paralel tutun.</li>
              <li>Uzun fişleri iki parçada çekebilirsiniz.</li>
            </ul>
          </div>
          <details>
            <summary>Fiş metnini elle yapıştır</summary>
            <MetinGirisi gonder={(m) => hazirla(null, m)} />
          </details>
        </>
      )}

      {ilerleme && (
        <div className="kart" aria-live="polite">
          <div style={{ marginBottom: 8 }}>{ilerleme.mesaj}</div>
          <div className="ilerleme"><div style={{ width: `${Math.round((ilerleme.asama === 'okuma' ? 0.3 + ilerleme.oran * 0.7 : ilerleme.oran * 0.3) * 100)}%` }} /></div>
          <div className="kucuk soluk" style={{ marginTop: 6 }}>Ekranı kullanmaya devam edebilirsiniz.</div>
        </div>
      )}
      {hata && <div className="kart hata">{hata}</div>}

      {d && (
        <>
          {zayif && (
            <div className="kart uyari">
              <b>Okuma zayıf görünüyor.</b> {d.ocr && d.ocr.onIsleme.netlik < DUSUK_NETLIK ? 'Fotoğraf bulanık. ' : ''}
              Kırışık/soluk termal fişlerde sonuç kötü olabilir. Fişi düzleştirip, iyi ışıkta tekrar çekmeyi deneyin.
              <button className="btn tam" style={{ marginTop: 8 }} onClick={() => { setD(null); kameraRef.current?.click(); }}>📷 Tekrar çek</button>
            </div>
          )}
          {mukerrer && (
            <div className="kart uyari" role="alert">
              <b>Bu fiş daha önce okutulmuş olabilir:</b> {mukerrer.satici} · {isoToTR(mukerrer.tarih)} {mukerrer.saat} · {formatTL(mukerrer.toplam ?? 0)}
            </div>
          )}

          <div className="kart">
            <label className="alan"><span>Satıcı (açıklamanın başına yazılır)</span>
              <input type="text" value={d.satici} onChange={(e) => guncelle({ satici: e.target.value })} />
            </label>
            <div className="satir">
              <label className="alan"><span>Tarih</span><input type="date" value={d.tarih} onChange={(e) => e.target.value && guncelle({ tarih: e.target.value })} /></label>
              <label className="alan"><span>Saat</span><input type="time" value={d.saat} onChange={(e) => guncelle({ saat: e.target.value })} /></label>
            </div>
            <TutarGirdi etiket="Fişteki TOPLAM" deger={d.toplam} degisti={(t) => guncelle({ toplam: t })} />
            {d.fis.kdv !== null && <div className="kucuk soluk">TOPKDV: {formatTL(d.fis.kdv)}</div>}
            <Secim etiket={d.son4 ? `Ödeme — kart son 4 hane: ${d.son4}` : 'Ödeme'} deger={d.odeme} bos="— Seçin —" secenekler={[...odemeler, ODEME_YOK]} degisti={(o) => guncelle({ odeme: o })} />
            {d.son4 && !d.odeme && <div className="kart uyari kucuk">…{d.son4} ile biten kart tanınmadı. Hangi kart olduğunu seçin.</div>}
            {d.son4 && (
              <label className="onay kucuk">
                <input type="checkbox" checked={d.kartiHatirla} onChange={(e) => guncelle({ kartiHatirla: e.target.checked })} />
                …{d.son4} kartını bu ödeme yöntemi olarak hatırla
              </label>
            )}
          </div>

          <div className={`kart ${fark === null ? 'uyari' : fark === 0 ? 'iyi' : 'hata'}`} role="status">
            Kalemler: <b className="tutar">{formatTL(tumToplam)}</b>
            {d.toplam !== null && <> · Fiş: <b className="tutar">{formatTL(d.toplam)}</b></>}
            <br />
            {fark === null ? 'Fişte TOPLAM okunamadı; lütfen girin.' : fark === 0 ? 'Toplam tutuyor ✓' : <><b>Fark: {formatTL(fark)}</b> — eksik/yanlış okunan kalem olabilir. Kaydetmeye engel değil.</>}
            {oneri && (
              <button className="btn tam" style={{ marginTop: 8 }} onClick={() => satirGuncelle(oneri.index, { tutar: oneri.yeni })}>
                Düzeltme önerisi: “{d.satirlar[oneri.index].ad}” {formatTL(oneri.eski)} → {formatTL(oneri.yeni)}
              </button>
            )}
          </div>

          <h2>Toplu işlem (seçili {secililer.length} kalem)</h2>
          <div className="cipler">
            <button className="cip" onClick={() => setD({ ...d, satirlar: d.satirlar.map((s) => ({ ...s, secili: secililer.length !== d.satirlar.length })) })}>
              {secililer.length === d.satirlar.length ? 'Seçimi kaldır' : 'Tümünü seç'}
            </button>
            <button className="cip" onClick={() => topluUygula((s) => turAyarla(s, 'Kişisel', DUKKAN_YOK))}>Hepsi kişisel</button>
            {DUKKANLAR.map((dk) => (
              <button key={dk} className="cip" onClick={() => topluUygula((s) => turAyarla(s, 'Dükkân', dk))}>Hepsi {dk}</button>
            ))}
            <button className="cip" onClick={() => topluUygula((s) => turAyarla(s, 'Dükkân', BELIRTILMEDI))}>Hepsi dükkân (belirtilmedi)</button>
          </div>
          <TopluKategori kategoriler={kategoriler} uygula={(k) => topluUygula(() => ({ kategori: k }))} />

          {d.satirlar.map((s, i) => (
            <div key={i} className={`fis-kalemi ${s.secili ? 'secili' : ''} ${s.okunamadi && s.ad === OKUNAMADI ? 'okunamadi' : ''}`}>
              <div className="ust">
                <input type="checkbox" checked={s.secili} onChange={(e) => satirGuncelle(i, { secili: e.target.checked })} aria-label="Kaydedilsin" />
                <input type="text" value={s.ad} onChange={(e) => satirGuncelle(i, { ad: e.target.value, okunamadi: false })} aria-label="Ürün adı" />
              </div>
              {s.detay && <div className="kucuk soluk" style={{ margin: '4px 0 0 32px' }}>{s.detay}</div>}
              <div className="satir">
                <TutarGirdi deger={s.tutar} degisti={(t) => satirGuncelle(i, { tutar: t ?? 0 })} />
                <label className="alan">
                  <span>Kategori</span>
                  <select value={s.kategori} onChange={(e) => satirGuncelle(i, { kategori: e.target.value })} style={!s.kategori ? { borderColor: 'var(--hata)' } : undefined}>
                    <option value="">— Seçin —</option>
                    {uygunKategoriler[s.tur].map((k) => <option key={k}>{k}</option>)}
                  </select>
                </label>
              </div>
              <div className="satir">
                <Secim etiket="Tür" deger={s.tur} secenekler={['Kişisel', 'Dükkân', 'Karma']} degisti={(t) => satirGuncelle(i, turAyarla(s, t as Tur, t === 'Kişisel' ? DUKKAN_YOK : s.dukkan === DUKKAN_YOK ? DUKKANLAR[0] : s.dukkan))} />
                {s.tur !== 'Kişisel' && <Secim etiket="Dükkân" deger={s.dukkan} secenekler={[...DUKKANLAR, BELIRTILMEDI]} degisti={(dk) => satirGuncelle(i, { dukkan: dk })} />}
              </div>
              <button className="btn kucuk tehlike" onClick={() => setD({ ...d, satirlar: d.satirlar.filter((_, j) => j !== i) })}>Kalemi sil</button>
            </div>
          ))}
          <button className="btn tam" onClick={() => setD({ ...d, satirlar: [...d.satirlar, { secili: true, ad: '', detay: '', tutar: fark && fark > 0 ? fark : 0, kategori: '', tur: 'Kişisel', dukkan: DUKKAN_YOK, okunamadi: false }] })}>
            + Kalem ekle{fark && fark > 0 ? ` (fark: ${formatTL(fark)})` : ''}
          </button>

          {fotoUrl && (
            <details>
              <summary>Fotoğraf {d.ocr ? `(güven %${Math.round(d.ocr.guven)}, eğiklik ${d.ocr.onIsleme.egiklik.toFixed(1)}°${d.ocr.onIsleme.kirpildi ? ', kırpıldı' : ''})` : ''}</summary>
              <img className="foto-onizleme" src={fotoUrl} alt="Fiş" />
            </details>
          )}
          <details>
            <summary>Okunan ham metin / elle düzelt</summary>
            <MetinGirisi ilk={d.hamMetin} gonder={(m) => hazirla(d.ocr, m)} etiket="Yeniden ayrıştır" />
          </details>
          {d.ocr && (
            <label className="onay">
              <input type="checkbox" checked={fotoyuSakla} onChange={(e) => setFotoyuSakla(e.target.checked)} />
              Fiş fotoğrafını kayıtla birlikte cihazda sakla
            </label>
          )}

          {eksikKategori && <div className="kart uyari kucuk">Kategorisi seçilmemiş kalemler var (kırmızı çerçeveli).</div>}
          <div className="btn-grup" style={{ marginTop: 8 }}>
            <button className="btn" onClick={() => setD(null)}>Vazgeç</button>
            <button className="btn ana" disabled={mesgul || secililer.length === 0 || eksikKategori || secililer.some((s) => s.tutar <= 0)} onClick={kaydet}>
              {secililer.length} kalemi kaydet
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function MetinGirisi({ ilk = '', gonder, etiket = 'Ayrıştır' }: { ilk?: string; gonder: (m: string) => void; etiket?: string }) {
  const [m, setM] = useState(ilk);
  useEffect(() => setM(ilk), [ilk]);
  return (
    <div>
      <textarea value={m} onChange={(e) => setM(e.target.value)} rows={10} style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 13 }} placeholder="Fiş metni…" />
      <button className="btn tam" style={{ marginTop: 6 }} disabled={!m.trim()} onClick={() => gonder(m)}>{etiket}</button>
    </div>
  );
}

function TopluKategori({ kategoriler, uygula }: { kategoriler: string[]; uygula: (k: string) => void }) {
  return (
    <label className="alan">
      <span>Seçili kalemlerin kategorisini değiştir</span>
      <select value="" onChange={(e) => e.target.value && uygula(e.target.value)}>
        <option value="">— Kategori seçin —</option>
        {kategoriler.map((k) => <option key={k}>{k}</option>)}
      </select>
    </label>
  );
}
