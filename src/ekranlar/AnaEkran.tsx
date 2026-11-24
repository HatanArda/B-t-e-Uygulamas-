import { useEffect, useMemo, useState } from 'react';
import { KayitDuzenle } from '../bilesenler/KayitDuzenle';
import { KayitFormu } from '../bilesenler/KayitFormu';
import { AltSayfa, turRengi, useBildirim } from '../bilesenler/ortak';
import { KayitListesi } from '../bilesenler/KayitListesi';
import { AnaEkranaEkleYonergesi, standaloneMi } from '../bilesenler/Yonergeler';
import { kayitKaydet, yedekGerekli, yedekIndir } from '../islemler';
import { hizliAyristir, type HizliSonuc } from '../lib/hizliGiris';
import { belirsizKayitlar, toplam } from '../lib/ozet';
import { formatTL } from '../lib/para';
import { ayEtiketi, bugunISO } from '../lib/tarih';
import type { Kayit } from '../lib/tipler';
import { useAyar, useGecmis, useKayitlar, useListeler } from '../veri';

const ORNEKLER = ['Berber 600 nakit', 'Eray Optik 2 - Kargo 150 Denizbank', 'GALLİPOLİ OPTİK SGK 10070 havale'];

export function AnaEkran() {
  const kayitlar = useKayitlar();
  const { kategoriler, odemeler } = useListeler();
  const gecmis = useGecmis(kayitlar);
  const bildir = useBildirim();
  const [metin, setMetin] = useState('');
  const [onizleme, setOnizleme] = useState<{ sonuc: HizliSonuc; kayit: Kayit } | null>(null);
  const [duzenlenen, setDuzenlenen] = useState<Kayit | null>(null);
  const [yedekUyarisi, setYedekUyarisi] = useState(false);
  const fotoDahil = useAyar('yedekFotograf', false);

  useEffect(() => {
    yedekGerekli().then(setYedekUyarisi);
  }, [kayitlar.length]);

  const buAy = bugunISO().slice(0, 7);
  const ayKayitlari = useMemo(() => kayitlar.filter((k) => k.tarih.startsWith(buAy)), [kayitlar, buAy]);
  const ayToplam = toplam(ayKayitlari);
  const turler = (['Kişisel', 'Dükkân', 'Karma'] as const).map((t) => ({ ad: t, tutar: toplam(ayKayitlari.filter((k) => k.tur === t)) }));
  const belirsiz = useMemo(() => belirsizKayitlar(kayitlar).sort((a, b) => b.tarih.localeCompare(a.tarih)), [kayitlar]);
  const sonKayitlar = useMemo(
    () => [...kayitlar].sort((a, b) => b.tarih.localeCompare(a.tarih) || (b.id ?? 0) - (a.id ?? 0)).slice(0, 15),
    [kayitlar],
  );

  const ayristir = () => {
    if (!metin.trim()) return;
    const sonuc = hizliAyristir(metin, { kategoriler, odemeler, gecmis });
    setOnizleme({
      sonuc,
      kayit: {
        tarih: sonuc.tarih,
        kategori: sonuc.kategoriGuven === 'kesin' ? sonuc.kategori ?? '' : '',
        aciklama: sonuc.aciklama,
        tur: sonuc.tur,
        dukkan: sonuc.dukkan,
        tutar: sonuc.tutar ?? 0,
        kaynak: 'Hızlı giriş',
        odeme: sonuc.odeme,
        olusturma: 0,
      },
    });
  };

  return (
    <div className="sayfa">
      <h1>Bütçe</h1>
      {!standaloneMi() && <AnaEkranaEkleYonergesi kisa />}

      <form className="kart" onSubmit={(e) => { e.preventDefault(); ayristir(); }}>
        <label htmlFor="hizli" className="kucuk soluk">Hızlı giriş — WhatsApp'a yazar gibi yazın</label>
        <div className="hizli" style={{ marginTop: 6 }}>
          <input
            id="hizli"
            type="text"
            enterKeyHint="go"
            autoComplete="off"
            autoCorrect="off"
            placeholder="Berber 600 nakit"
            value={metin}
            onChange={(e) => setMetin(e.target.value)}
          />
          <button className="btn ana" type="submit" disabled={!metin.trim()}>Ekle</button>
        </div>
        <div className="cipler" style={{ marginTop: 8 }}>
          {ORNEKLER.map((o) => <button type="button" key={o} className="cip" onClick={() => setMetin(o)}>{o}</button>)}
        </div>
      </form>

      {yedekUyarisi && (
        <div className="kart uyari">
          Son yedeğin üzerinden 1 haftadan fazla geçti. Telefon kaybolursa ya da veriler silinirse yedek gerekir.
          <button className="btn tam" style={{ marginTop: 8 }} onClick={async () => { await yedekIndir(fotoDahil); setYedekUyarisi(false); bildir('Yedek hazırlandı — Dosyalar\'a kaydedin'); }}>
            Şimdi yedek al (JSON)
          </button>
        </div>
      )}

      <div className="kart">
        <div className="soluk kucuk">{ayEtiketi(buAy)} toplamı</div>
        <div className="ozet-sayi tutar">{formatTL(ayToplam)}</div>
        <div className="yigin">
          {turler.map((t) => t.tutar > 0 && <div key={t.ad} style={{ width: `${(t.tutar / (ayToplam || 1)) * 100}%`, background: turRengi(t.ad) }} />)}
        </div>
        <div className="satir kucuk">
          {turler.map((t) => (
            <div key={t.ad}><span style={{ color: turRengi(t.ad) }}>●</span> {t.ad}<br /><b className="tutar">{formatTL(t.tutar)}</b></div>
          ))}
        </div>
      </div>

      {belirsiz.length > 0 && (
        <div className="kart uyari">
          <b>⚠ Belirtilmedi / Karma: {belirsiz.length} kayıt</b>
          <div className="kucuk">Dükkânı belli olmayan ya da dükkân + ev karışık harcamalar. Dokunup dükkânı seçin veya bölün.</div>
          <KayitListesi kayitlar={belirsiz.slice(0, 8)} sec={setDuzenlenen} gunlereAyir={false} />
        </div>
      )}

      <h2>Son kayıtlar</h2>
      {kayitlar.length === 0 ? (
        <p className="soluk">Henüz kayıt yok. Yukarıya yazarak ya da Fiş sekmesinden ekleyin; Excel'i Ayarlar'dan içe aktarabilirsiniz.</p>
      ) : (
        <div className="kart" style={{ padding: '0 12px' }}>
          <KayitListesi kayitlar={sonKayitlar} sec={setDuzenlenen} />
        </div>
      )}

      {onizleme && (
        <AltSayfa baslik="Kontrol edip kaydedin" kapat={() => setOnizleme(null)}>
          <p className="kucuk soluk" style={{ marginTop: 0 }}>“{metin}” şöyle anlaşıldı. Gerekirse düzeltin.</p>
          <KayitFormu
            key={metin}
            baslangic={onizleme.kayit}
            kategoriler={kategoriler}
            odemeler={odemeler}
            tumKayitlar={kayitlar}
            vurgula={onizleme.sonuc.sorulacaklar}
            kategoriAdaylari={onizleme.sonuc.kategoriAdaylari}
            kaydet={async ({ kayit, taksit }) => {
              const t = taksit ?? (onizleme.sonuc.taksitSayisi ? { sayi: onizleme.sonuc.taksitSayisi } : undefined);
              await kayitKaydet(kayit, t);
              setOnizleme(null);
              setMetin('');
              bildir(`Kaydedildi: ${kayit.aciklama} ${formatTL(kayit.tutar)}`);
            }}
          />
        </AltSayfa>
      )}
      {duzenlenen && (
        <KayitDuzenle kayit={duzenlenen} kapat={() => setDuzenlenen(null)} kategoriler={kategoriler} odemeler={odemeler} tumKayitlar={kayitlar} />
      )}
    </div>
  );
}
