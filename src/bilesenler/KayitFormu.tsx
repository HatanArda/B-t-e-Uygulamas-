import { useMemo, useState } from 'react';
import { kartMi } from '../lib/varsayilanlar';
import { olasiMukerrerler } from '../lib/mukerrer';
import { formatTL } from '../lib/para';
import { isoToTR } from '../lib/tarih';
import { taksitPlani, varsayilanIlkTaksit } from '../lib/taksit';
import { BELIRTILMEDI, DUKKAN_ONEKI, DUKKANLAR, DUKKAN_YOK, ODEME_YOK, dukkanKategorisiMi, type Kayit, type Tur } from '../lib/tipler';
import { Secim, TutarGirdi } from './ortak';

export interface FormSonucu {
  kayit: Kayit;
  taksit?: { sayi: number; ilkTaksit: string };
}

const YENI = '__yeni__';

/** Tür değişince kategoriyi karşılığına çevirir ("Ulaşım" ↔ "Dükkân: Ulaşım"). */
function kategoriUyarla(kategori: string, tur: Tur, kategoriler: string[]): string {
  if (!kategori || tur === 'Karma') return kategori;
  const temel = kategori.replace(/^Dükkân:\s*/, '');
  const hedef = tur === 'Dükkân' ? `${DUKKAN_ONEKI}${temel}` : temel;
  if (tur === 'Dükkân' && dukkanKategorisiMi(kategori)) return kategori;
  if (tur === 'Kişisel' && !dukkanKategorisiMi(kategori)) return kategori;
  return kategoriler.includes(hedef) ? hedef : '';
}

export function KayitFormu({
  baslangic, kategoriler, odemeler, tumKayitlar, kaydet, vurgula = [], kategoriAdaylari = [], kaydetEtiketi = 'Kaydet', ek,
}: {
  baslangic: Kayit;
  kategoriler: string[];
  odemeler: string[];
  tumKayitlar: Kayit[];
  kaydet: (s: FormSonucu) => void | Promise<void>;
  vurgula?: string[];
  kategoriAdaylari?: string[];
  kaydetEtiketi?: string;
  ek?: React.ReactNode;
}) {
  const [k, setK] = useState<Kayit>(baslangic);
  const [yeniKategori, setYeniKategori] = useState<string | null>(null);
  const [taksitli, setTaksitli] = useState(false);
  const [taksitSayisi, setTaksitSayisi] = useState(3);
  const [ilkTaksit, setIlkTaksit] = useState(varsayilanIlkTaksit(baslangic.tarih));
  const [mesgul, setMesgul] = useState(false);
  const guncelle = (p: Partial<Kayit>) => setK((o) => ({ ...o, ...p }));

  const uygunKategoriler = useMemo(
    () => kategoriler.filter((c) => (k.tur === 'Dükkân' ? dukkanKategorisiMi(c) : k.tur === 'Kişisel' ? !dukkanKategorisiMi(c) : true)),
    [kategoriler, k.tur],
  );
  const mukerrer = useMemo(
    () => (k.tutar > 0 ? olasiMukerrerler(k, tumKayitlar) : []),
    [k, tumKayitlar],
  );
  const kategoriSorulsun = vurgula.includes('kategori') && !k.kategori;
  const kart = kartMi(k.odeme);
  const kategoriSon = yeniKategori !== null
    ? (k.tur === 'Dükkân' && !yeniKategori.startsWith(DUKKAN_ONEKI) ? DUKKAN_ONEKI : '') + yeniKategori.trim()
    : k.kategori;
  const gecerli = k.tutar > 0 && k.aciklama.trim() !== '' && kategoriSon !== '' && !!k.tarih;

  const turSec = (tur: Tur) => {
    const dukkan = tur === 'Kişisel' ? DUKKAN_YOK : k.dukkan === DUKKAN_YOK ? (tur === 'Karma' ? BELIRTILMEDI : DUKKANLAR[0]) : k.dukkan;
    guncelle({ tur, dukkan, kategori: kategoriUyarla(k.kategori, tur, kategoriler) });
  };

  const gonder = async () => {
    if (!gecerli) return;
    setMesgul(true);
    try {
      await kaydet({
        kayit: { ...k, kategori: kategoriSon, aciklama: k.aciklama.trim() },
        taksit: taksitli && !k.id && kart && taksitSayisi > 1 ? { sayi: taksitSayisi, ilkTaksit } : undefined,
      });
    } finally {
      setMesgul(false);
    }
  };

  return (
    <div>
      <div className="satir">
        <label className="alan">
          <span>Tarih</span>
          <input type="date" value={k.tarih} onChange={(e) => e.target.value && guncelle({ tarih: e.target.value })} />
        </label>
        <TutarGirdi deger={k.tutar || null} degisti={(t) => guncelle({ tutar: t ?? 0 })} otomatikOdak={vurgula.includes('tutar')} />
      </div>
      <label className="alan">
        <span>Açıklama</span>
        <input type="text" value={k.aciklama} onChange={(e) => guncelle({ aciklama: e.target.value })} autoFocus={vurgula.includes('aciklama')} />
      </label>

      <div className="alan">
        <span>Tür</span>
        <div className="sekme-ici">
          {(['Kişisel', 'Dükkân', 'Karma'] as Tur[]).map((t) => (
            <button key={t} type="button" aria-pressed={k.tur === t} onClick={() => turSec(t)}>{t}</button>
          ))}
        </div>
      </div>
      {k.tur !== 'Kişisel' && (
        <Secim etiket="Dükkân" deger={k.dukkan} secenekler={[...DUKKANLAR, BELIRTILMEDI]} degisti={(d) => guncelle({ dukkan: d })} />
      )}

      {kategoriSorulsun && (
        <div className="kart uyari kucuk">
          Kategoriden emin değilim. Lütfen seçin{kategoriAdaylari.length ? ' (öneriler aşağıda)' : ''}.
          {kategoriAdaylari.length > 0 && (
            <div className="cipler" style={{ marginTop: 8 }}>
              {kategoriAdaylari.slice(0, 5).map((a) => (
                <button key={a} className="cip" onClick={() => { setYeniKategori(null); guncelle({ kategori: a }); }}>{a}</button>
              ))}
            </div>
          )}
        </div>
      )}
      {yeniKategori === null ? (
        <label className="alan">
          <span>Kategori</span>
          <select
            value={k.kategori}
            onChange={(e) => (e.target.value === YENI ? setYeniKategori(k.aciklama ? k.aciklama.split(' ')[0] : '') : guncelle({ kategori: e.target.value }))}
          >
            <option value="">— Seçin —</option>
            {k.kategori && !uygunKategoriler.includes(k.kategori) && <option value={k.kategori}>{k.kategori}</option>}
            {uygunKategoriler.map((c) => <option key={c} value={c}>{c}</option>)}
            <option value={YENI}>+ Yeni kategori…</option>
          </select>
        </label>
      ) : (
        <label className="alan">
          <span>Yeni kategori adı {k.tur === 'Dükkân' && '(başına "Dükkân: " eklenir)'}</span>
          <div className="hizli">
            <input type="text" value={yeniKategori} autoFocus onChange={(e) => setYeniKategori(e.target.value)} />
            <button className="btn kucuk" onClick={() => setYeniKategori(null)}>Vazgeç</button>
          </div>
        </label>
      )}

      <Secim etiket="Ödeme" deger={k.odeme} secenekler={[...odemeler, ODEME_YOK]} degisti={(o) => guncelle({ odeme: o })} />

      {!k.id && kart && (
        <div className="kart">
          <label className="onay">
            <input type="checkbox" checked={taksitli} onChange={(e) => setTaksitli(e.target.checked)} />
            Taksitli alım
          </label>
          {taksitli && (
            <>
              <div className="satir">
                <label className="alan">
                  <span>Taksit sayısı</span>
                  <input inputMode="numeric" value={taksitSayisi} onChange={(e) => setTaksitSayisi(Math.max(1, Math.min(36, +e.target.value.replace(/\D/g, '') || 1)))} />
                </label>
                <label className="alan">
                  <span>İlk taksit</span>
                  <input type="date" value={ilkTaksit} onChange={(e) => e.target.value && setIlkTaksit(e.target.value)} />
                </label>
              </div>
              {k.tutar > 0 && taksitSayisi > 1 && (
                <p className="kucuk soluk">
                  Aylık {formatTL(taksitPlani({ toplam: k.tutar, sayi: taksitSayisi, ilkTaksit }, '')[1]?.tutar ?? k.tutar)} ×{' '}
                  {taksitSayisi}. Harcama, toplam tutarla alış tarihine yazılır; taksit planı Özet › Taksitler'de izlenir.
                </p>
              )}
            </>
          )}
        </div>
      )}

      {mukerrer.length > 0 && (
        <div className="kart uyari kucuk" role="alert">
          <b>Olası mükerrer kayıt:</b> aynı gün, aynı tutar ve benzer açıklama ile kayıt var:
          <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
            {mukerrer.slice(0, 3).map((m) => <li key={m.id}>{isoToTR(m.tarih)} · {m.aciklama} · {formatTL(m.tutar)}</li>)}
          </ul>
          Yine de kaydedebilirsiniz.
        </div>
      )}

      <button className="btn ana tam" disabled={!gecerli || mesgul} onClick={gonder} style={{ marginTop: 8 }}>
        {kaydetEtiketi}
      </button>
      {ek}
    </div>
  );
}
