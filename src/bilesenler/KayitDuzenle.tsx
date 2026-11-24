import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { db } from '../db';
import { kaydiKalemlereBol, karmaKaydiBol, kayitKaydet, kayitSil } from '../islemler';
import type { Parca } from '../lib/bolme';
import { formatTL } from '../lib/para';
import { DUKKANLAR, dukkanKategorisiMi, type Kayit } from '../lib/tipler';
import { KayitFormu } from './KayitFormu';
import { AltSayfa, Secim, TutarGirdi, useBildirim } from './ortak';

type Mod = 'duzenle' | 'bol' | 'karma';

export function KayitDuzenle({ kayit, kapat, kategoriler, odemeler, tumKayitlar, baslangicModu = 'duzenle' }: {
  kayit: Kayit;
  kapat: () => void;
  kategoriler: string[];
  odemeler: string[];
  tumKayitlar: Kayit[];
  baslangicModu?: Mod;
}) {
  const bildir = useBildirim();
  const [mod, setMod] = useState<Mod>(baslangicModu);
  const fis = useLiveQuery(() => (kayit.fisId ? db.fisler.get(kayit.fisId) : undefined), [kayit.fisId]);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!fis?.foto) return;
    const u = URL.createObjectURL(fis.foto);
    setFotoUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [fis]);

  const sil = async () => {
    if (!confirm(`"${kayit.aciklama}" (${formatTL(kayit.tutar)}) silinsin mi?`)) return;
    await kayitSil(kayit.id!);
    bildir('Kayıt silindi');
    kapat();
  };

  return (
    <AltSayfa baslik={mod === 'bol' ? 'Kalemlere böl' : mod === 'karma' ? 'Dükkân / kişisel olarak böl' : 'Kaydı düzenle'} kapat={kapat}>
      {mod === 'duzenle' && (
        <>
          {kayit.tur === 'Karma' && (
            <div className="kart uyari kucuk">
              Bu karma bir harcama. Dükkân payını girerek ikiye bölebilirsiniz.
              <button className="btn tam" style={{ marginTop: 8 }} onClick={() => setMod('karma')}>Dükkân / kişisel olarak böl</button>
            </div>
          )}
          <KayitFormu
            baslangic={kayit}
            kategoriler={kategoriler}
            odemeler={odemeler}
            tumKayitlar={tumKayitlar}
            kaydet={async ({ kayit: k }) => {
              await kayitKaydet(k);
              bildir('Kaydedildi');
              kapat();
            }}
            ek={
              <div className="btn-grup" style={{ marginTop: 10 }}>
                <button className="btn" onClick={() => setMod('bol')}>Kalemlere böl</button>
                {kayit.tur !== 'Karma' && <button className="btn" onClick={() => setMod('karma')}>Dükkân payı ayır</button>}
                <button className="btn tehlike" onClick={sil}>Sil</button>
              </div>
            }
          />
          <p className="kucuk soluk">Kaynak: {kayit.kaynak}{kayit.saat ? ` · Saat ${kayit.saat}` : ''}{kayit.taksitId ? ' · Taksitli' : ''}</p>
          {fotoUrl && (
            <details>
              <summary>Fiş fotoğrafı</summary>
              <img className="foto-onizleme" src={fotoUrl} alt="Fiş fotoğrafı" />
            </details>
          )}
        </>
      )}
      {mod === 'bol' && (
        <KalemlereBol kayit={kayit} kategoriler={kategoriler} bitti={() => { bildir('Kayıt kalemlere bölündü'); kapat(); }} geri={() => setMod('duzenle')} />
      )}
      {mod === 'karma' && (
        <KarmaBol kayit={kayit} bitti={() => { bildir('Kayıt bölündü'); kapat(); }} geri={() => setMod('duzenle')} />
      )}
    </AltSayfa>
  );
}

function KalemlereBol({ kayit, kategoriler, bitti, geri }: { kayit: Kayit; kategoriler: string[]; bitti: () => void; geri: () => void }) {
  const onek = kayit.aciklama.includes(' - ') ? kayit.aciklama.split(' - ')[0] + ' - ' : kayit.aciklama + ' - ';
  const [parcalar, setParcalar] = useState<Parca[]>([
    { aciklama: onek, tutar: 0, kategori: kayit.kategori },
    { aciklama: onek, tutar: 0, kategori: kayit.kategori },
  ]);
  const toplam = parcalar.reduce((t, p) => t + p.tutar, 0);
  const kalan = kayit.tutar - toplam;
  const uygun = kategoriler.filter((c) => (kayit.tur === 'Dükkân' ? dukkanKategorisiMi(c) : kayit.tur === 'Kişisel' ? !dukkanKategorisiMi(c) : true));
  const degis = (i: number, p: Partial<Parca>) => setParcalar((l) => l.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const [hata, setHata] = useState('');

  return (
    <div>
      <p className="soluk kucuk">Toplam {formatTL(kayit.tutar)}. Her kalem ayrı kayıt olur; tarih, tür, dükkân ve ödeme aynı kalır.</p>
      {parcalar.map((p, i) => (
        <div className="fis-kalemi" key={i}>
          <label className="alan"><span>{i + 1}. kalem açıklaması</span>
            <input type="text" value={p.aciklama} onChange={(e) => degis(i, { aciklama: e.target.value })} />
          </label>
          <div className="satir">
            <TutarGirdi deger={p.tutar || null} degisti={(t) => degis(i, { tutar: t ?? 0 })} />
            <Secim etiket="Kategori" deger={p.kategori} secenekler={uygun} degisti={(c) => degis(i, { kategori: c })} />
          </div>
          {parcalar.length > 2 && <button className="btn kucuk tehlike" onClick={() => setParcalar((l) => l.filter((_, j) => j !== i))}>Kalemi kaldır</button>}
        </div>
      ))}
      <div className="btn-grup">
        <button className="btn" onClick={() => setParcalar((l) => [...l, { aciklama: onek, tutar: 0, kategori: kayit.kategori }])}>+ Kalem ekle</button>
        <button className="btn" disabled={kalan <= 0} onClick={() => {
          const i = parcalar.findIndex((p) => p.tutar === 0);
          const hedef = i >= 0 ? i : parcalar.length - 1;
          degis(hedef, { tutar: parcalar[hedef].tutar + kalan });
        }}>Kalanı doldur</button>
      </div>
      <div className={`kart ${kalan === 0 ? 'iyi' : 'hata'}`}>
        Kalemler: <b className="tutar">{formatTL(toplam)}</b> · {kalan === 0 ? 'Toplam tutuyor ✓' : <>Fark: <b className="tutar">{formatTL(kalan)}</b></>}
      </div>
      {hata && <div className="kart hata">{hata}</div>}
      <div className="btn-grup">
        <button className="btn" onClick={geri}>Geri</button>
        <button className="btn ana" disabled={kalan !== 0 || parcalar.some((p) => !p.aciklama.trim() || p.tutar <= 0)} onClick={async () => {
          try { await kaydiKalemlereBol(kayit, parcalar); bitti(); } catch (e) { setHata((e as Error).message); }
        }}>Böl ve kaydet</button>
      </div>
    </div>
  );
}

function KarmaBol({ kayit, bitti, geri }: { kayit: Kayit; bitti: () => void; geri: () => void }) {
  const [dukkanTutari, setDukkanTutari] = useState<number | null>(null);
  const [dukkan, setDukkan] = useState<string>(DUKKANLAR.includes(kayit.dukkan as never) ? kayit.dukkan : DUKKANLAR[0]);
  const gecerli = dukkanTutari !== null && dukkanTutari > 0 && dukkanTutari <= kayit.tutar;
  return (
    <div>
      <p>{kayit.aciklama} — <b className="tutar">{formatTL(kayit.tutar)}</b></p>
      <TutarGirdi etiket="Dükkân payı (TL)" deger={dukkanTutari} degisti={setDukkanTutari} otomatikOdak />
      <Secim etiket="Hangi dükkân" deger={dukkan} secenekler={DUKKANLAR} degisti={setDukkan} />
      {gecerli && (
        <div className="kart kucuk">
          Dükkân ({dukkan}): <b className="tutar">{formatTL(dukkanTutari!)}</b><br />
          Kişisel: <b className="tutar">{formatTL(kayit.tutar - dukkanTutari!)}</b>
        </div>
      )}
      {dukkanTutari !== null && dukkanTutari > kayit.tutar && <div className="kart hata">Dükkân payı toplamdan büyük olamaz.</div>}
      <div className="btn-grup">
        <button className="btn" onClick={geri}>Geri</button>
        <button className="btn ana" disabled={!gecerli} onClick={async () => { await karmaKaydiBol(kayit, dukkanTutari!, dukkan); bitti(); }}>Böl ve kaydet</button>
      </div>
    </div>
  );
}
