import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { db } from '../db';
import { Filtreler, donemAraligi, type DonemKodu } from '../bilesenler/Filtreler';
import { KayitDuzenle } from '../bilesenler/KayitDuzenle';
import { KayitListesi } from '../bilesenler/KayitListesi';
import { Cubuklar, Secim, turRengi, useBildirim } from '../bilesenler/ortak';
import { excelDisaAktar } from '../islemler';
import { aylik, filtrele, grupla, toplam, type Filtre } from '../lib/ozet';
import { formatTL } from '../lib/para';
import { aylikTaksitYuku, kalanBorc, taksitPlani } from '../lib/taksit';
import { AY_ADLARI, ayEtiketi, bugunISO, isoToTR } from '../lib/tarih';
import { BELIRTILMEDI, DUKKANLAR, DUKKAN_YOK, type Kayit } from '../lib/tipler';
import { useKayitlar, useListeler } from '../veri';

type Alt = 'genel' | 'dukkan' | 'taksit';

export function OzetEkrani() {
  const [alt, setAlt] = useState<Alt>('genel');
  return (
    <div className="sayfa">
      <h1>Özet</h1>
      <div className="sekme-ici">
        <button aria-pressed={alt === 'genel'} onClick={() => setAlt('genel')}>Genel</button>
        <button aria-pressed={alt === 'dukkan'} onClick={() => setAlt('dukkan')}>Dükkân raporu</button>
        <button aria-pressed={alt === 'taksit'} onClick={() => setAlt('taksit')}>Taksitler</button>
      </div>
      {alt === 'genel' && <Genel />}
      {alt === 'dukkan' && <DukkanRaporu />}
      {alt === 'taksit' && <Taksitler />}
    </div>
  );
}

function aralikMetni(f: Filtre) {
  if (!f.bas && !f.bit) return 'Tüm zamanlar';
  return `${f.bas ? isoToTR(f.bas) : '…'} – ${f.bit ? isoToTR(f.bit) : '…'}`;
}

function Genel() {
  const kayitlar = useKayitlar();
  const { kategoriler, odemeler } = useListeler();
  const bildir = useBildirim();
  const [donem, setDonem] = useState<DonemKodu>('buay');
  const [filtre, setFiltre] = useState<Filtre>(donemAraligi('buay'));
  const [liste, setListe] = useState<{ baslik: string; kayitlar: Kayit[] } | null>(null);
  const [duzenlenen, setDuzenlenen] = useState<Kayit | null>(null);
  const s = useMemo(() => filtrele(kayitlar, filtre), [kayitlar, filtre]);
  const genel = toplam(s);
  const aylar = useMemo(() => aylik(filtrele(kayitlar, { ...filtre, bas: undefined, bit: undefined })).slice(-12), [kayitlar, filtre]);
  const enAy = Math.max(1, ...aylar.map((a) => a.tutar));
  const ac = (baslik: string, f: (k: Kayit) => boolean) =>
    setListe({ baslik, kayitlar: s.filter(f).sort((a, b) => b.tarih.localeCompare(a.tarih)) });

  return (
    <>
      <Filtreler filtre={filtre} degisti={setFiltre} kategoriler={kategoriler} odemeler={odemeler} donem={donem} donemDegisti={setDonem} />
      <div className="kart">
        <div className="soluk kucuk">{aralikMetni(filtre)} · {s.length} kayıt</div>
        <div className="ozet-sayi tutar">{formatTL(genel)}</div>
        <button className="btn tam" style={{ marginTop: 8 }} disabled={!s.length} onClick={async () => {
          await excelDisaAktar(s, `harcamalar_${(filtre.bas ?? 'tum').replace(/-/g, '')}-${(filtre.bit ?? bugunISO()).replace(/-/g, '')}.xlsx`, `Filtre: ${aralikMetni(filtre)}`);
          bildir('Excel hazırlandı');
        }}>⬇ Excel olarak dışa aktar</button>
      </div>

      <h2>Aylık toplam</h2>
      <div className="kart">
        <div className="aylik">
          {aylar.map((a) => (
            <div className="sutun" key={a.ad} title={`${ayEtiketi(a.ad)}: ${formatTL(a.tutar)}`}>
              <span className="tutar" style={{ fontSize: 10 }}>{Math.round(a.tutar / 100000)}b</span>
              <div className="dolu" style={{ height: `${(a.tutar / enAy) * 100}%` }} />
              <span>{AY_ADLARI[+a.ad.slice(5) - 1].slice(0, 3)}</span>
            </div>
          ))}
          {!aylar.length && <span className="soluk">Veri yok</span>}
        </div>
        <div className="kucuk soluk" style={{ marginTop: 6 }}>Son 12 ay, filtreler (tarih hariç) uygulanmış; b = bin TL.</div>
      </div>

      <h2>Türe göre</h2>
      <div className="kart"><Cubuklar veriler={grupla(s, (k) => k.tur)} renk={turRengi} tikla={(ad) => ac(ad, (k) => k.tur === ad)} /></div>
      <h2>Dükkâna göre (dükkân + karma giderleri)</h2>
      <div className="kart"><Cubuklar veriler={grupla(s.filter((k) => k.dukkan !== DUKKAN_YOK), (k) => k.dukkan)} renk={(a) => (a === BELIRTILMEDI ? 'var(--hata)' : 'var(--dukkan)')} tikla={(ad) => ac(ad, (k) => k.dukkan === ad)} /></div>
      <h2>Kategoriye göre</h2>
      <div className="kart"><Cubuklar veriler={grupla(s, (k) => k.kategori)} tikla={(ad) => ac(ad, (k) => k.kategori === ad)} /></div>
      <h2>Ödeme yöntemine göre</h2>
      <div className="kart"><Cubuklar veriler={grupla(s, (k) => (k.odeme === '-' ? 'Belirtilmemiş' : k.odeme))} tikla={(ad) => ac(ad, (k) => (k.odeme === '-' ? 'Belirtilmemiş' : k.odeme) === ad)} /></div>

      {liste && !duzenlenen && (
        <div className="perde" onClick={(e) => e.target === e.currentTarget && setListe(null)}>
          <div className="alt-sayfa">
            <div className="tutamak" />
            <div className="alt-sayfa-ust"><h2>{liste.baslik} · {formatTL(toplam(liste.kayitlar))}</h2><button className="btn kucuk" onClick={() => setListe(null)}>Kapat</button></div>
            <KayitListesi kayitlar={liste.kayitlar} sec={setDuzenlenen} />
          </div>
        </div>
      )}
      {duzenlenen && (
        <KayitDuzenle kayit={duzenlenen} kapat={() => { setDuzenlenen(null); setListe(null); }} kategoriler={kategoriler} odemeler={odemeler} tumKayitlar={kayitlar} />
      )}
    </>
  );
}

function DukkanRaporu() {
  const kayitlar = useKayitlar();
  const { kategoriler, odemeler } = useListeler();
  const bildir = useBildirim();
  const [dukkan, setDukkan] = useState<string>(DUKKANLAR[0]);
  const [donem, setDonem] = useState<DonemKodu>('buay');
  const [filtre, setFiltre] = useState<Filtre>(donemAraligi('buay'));
  const s = useMemo(
    () => filtrele(kayitlar, { ...filtre, dukkan, tur: 'Dükkân' }).sort((a, b) => a.tarih.localeCompare(b.tarih)),
    [kayitlar, filtre, dukkan],
  );
  const kategoriGrup = grupla(s, (k) => k.kategori);
  const odemeGrup = grupla(s, (k) => (k.odeme === '-' ? 'Belirtilmemiş' : k.odeme));
  const belirsizSayisi = filtrele(kayitlar, { ...filtre, dukkan: BELIRTILMEDI }).length + filtrele(kayitlar, { ...filtre, tur: 'Karma' }).length;

  return (
    <>
      <Secim etiket="Dükkân" deger={dukkan} secenekler={DUKKANLAR} degisti={setDukkan} />
      <Filtreler filtre={filtre} degisti={setFiltre} kategoriler={kategoriler} odemeler={odemeler} donem={donem} donemDegisti={setDonem} dukkanGizle />
      <div className="kart">
        <div className="soluk kucuk">{dukkan} · {aralikMetni(filtre)}</div>
        <div className="ozet-sayi tutar">{formatTL(toplam(s))}</div>
        <div className="soluk kucuk">{s.length} gider kaydı</div>
        <button className="btn ana tam" style={{ marginTop: 8 }} disabled={!s.length} onClick={async () => {
          await excelDisaAktar(s, `${dukkan.replace(/\s+/g, '_')}_gider_${(filtre.bas ?? 'tum').replace(/-/g, '')}-${(filtre.bit ?? bugunISO()).replace(/-/g, '')}.xlsx`, `${dukkan} gider raporu · ${aralikMetni(filtre)}`);
          bildir('Muhasebe raporu hazırlandı');
        }}>⬇ Muhasebe için Excel</button>
      </div>
      {belirsizSayisi > 0 && <div className="kart uyari kucuk">Bu dönemde dükkânı belirtilmemiş / karma {belirsizSayisi} kayıt var; rapora dahil değiller. Ana ekrandan düzeltebilirsiniz.</div>}
      <h2>Kategoriye göre</h2>
      <div className="kart">
        <table className="tablo">
          <thead><tr><th>Kategori</th><th className="sag">Adet</th><th className="sag">Tutar</th></tr></thead>
          <tbody>{kategoriGrup.map((g) => <tr key={g.ad}><td>{g.ad.replace(/^Dükkân:\s*/, '')}</td><td className="tutar">{g.adet}</td><td className="tutar">{formatTL(g.tutar)}</td></tr>)}</tbody>
          <tfoot><tr><td>Toplam</td><td className="tutar">{s.length}</td><td className="tutar">{formatTL(toplam(s))}</td></tr></tfoot>
        </table>
      </div>
      <h2>Ödeme yöntemine göre</h2>
      <div className="kart"><Cubuklar veriler={odemeGrup} /></div>
      <h2>Kayıtlar</h2>
      <div className="kart" style={{ padding: '0 12px' }}><KayitListesi kayitlar={[...s].reverse()} sec={() => undefined} /></div>
    </>
  );
}

function Taksitler() {
  const taksitler = useLiveQuery(() => db.taksitler.toArray(), [], []);
  const bugun = bugunISO();
  const toplamKalan = taksitler.reduce((t, x) => t + kalanBorc(x, bugun), 0);
  const yuk = aylikTaksitYuku(taksitler, bugun);
  const kartBazinda = grupla(
    taksitler.flatMap((t) => taksitPlani(t, bugun).filter((p) => !p.odendi).map((p) => ({ odeme: t.odeme, tutar: p.tutar } as Kayit))),
    (k) => k.odeme,
  );
  return (
    <>
      <div className="kart">
        <div className="soluk kucuk">Toplam kalan taksit borcu</div>
        <div className="ozet-sayi tutar">{formatTL(toplamKalan)}</div>
        <div className="kucuk soluk">Taksit tarihi geçenler ödenmiş sayılır. Yeni taksitli alımı elle girişte ya da hızlı girişte “4 taksit” yazarak ekleyin.</div>
      </div>
      {kartBazinda.length > 0 && (<><h2>Karta göre kalan</h2><div className="kart"><Cubuklar veriler={kartBazinda} /></div></>)}
      {yuk.length > 0 && (
        <>
          <h2>Önümüzdeki aylar</h2>
          <div className="kart">
            <table className="tablo">
              <tbody>{yuk.map((a) => <tr key={a.ay}><td>{ayEtiketi(a.ay)}</td><td className="tutar">{formatTL(a.tutar)}</td></tr>)}</tbody>
            </table>
          </div>
        </>
      )}
      <h2>Taksitli alımlar</h2>
      {taksitler.length === 0 && <p className="soluk">Taksitli alım yok.</p>}
      {taksitler.map((t) => {
        const plan = taksitPlani(t, bugun);
        const odenen = plan.filter((p) => p.odendi).length;
        return (
          <details className="kart" key={t.id}>
            <summary style={{ display: 'block' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <b>{t.aciklama}</b><span className="tutar">{formatTL(t.toplam)}</span>
              </div>
              <div className="kucuk soluk">{t.odeme} · {t.sayi} taksit · {odenen}/{t.sayi} ödendi · kalan <b>{formatTL(kalanBorc(t, bugun))}</b></div>
            </summary>
            <table className="tablo">
              <tbody>{plan.map((p) => (
                <tr key={p.no} style={{ opacity: p.odendi ? 0.55 : 1 }}>
                  <td>{p.no}. taksit</td><td>{isoToTR(p.tarih)}</td><td className="tutar">{formatTL(p.tutar)}</td><td>{p.odendi ? '✓' : ''}</td>
                </tr>
              ))}</tbody>
            </table>
            <button className="btn kucuk" onClick={async () => {
              const yeni = prompt('İlk taksit tarihi (GG.AA.YYYY)', isoToTR(t.ilkTaksit));
              const m = yeni?.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
              if (m) await db.taksitler.update(t.id!, { ilkTaksit: `${m[3]}-${m[2]}-${m[1]}` });
            }}>İlk taksit tarihini değiştir</button>
          </details>
        );
      })}
    </>
  );
}
