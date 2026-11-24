import { useMemo, useState } from 'react';
import { Filtreler, donemAraligi, type DonemKodu } from '../bilesenler/Filtreler';
import { KayitDuzenle } from '../bilesenler/KayitDuzenle';
import { KayitFormu } from '../bilesenler/KayitFormu';
import { KayitListesi } from '../bilesenler/KayitListesi';
import { AltSayfa, Ikon, useBildirim } from '../bilesenler/ortak';
import { kayitKaydet } from '../islemler';
import { filtrele, toplam, type Filtre } from '../lib/ozet';
import { formatTL } from '../lib/para';
import { bugunISO } from '../lib/tarih';
import type { Kayit } from '../lib/tipler';
import { useKayitlar, useListeler } from '../veri';

const bosKayit = (): Kayit => ({
  tarih: bugunISO(), kategori: '', aciklama: '', tur: 'Kişisel', dukkan: '-', tutar: 0, kaynak: 'Elle giriş', odeme: '-', olusturma: 0,
});

export function KayitlarEkrani() {
  const kayitlar = useKayitlar();
  const { kategoriler, odemeler } = useListeler();
  const bildir = useBildirim();
  const [donem, setDonem] = useState<DonemKodu>('buay');
  const [filtre, setFiltre] = useState<Filtre>(donemAraligi('buay'));
  const [duzenlenen, setDuzenlenen] = useState<Kayit | null>(null);
  const [yeni, setYeni] = useState(false);

  const sonuc = useMemo(
    () => filtrele(kayitlar, filtre).sort((a, b) => b.tarih.localeCompare(a.tarih) || (b.id ?? 0) - (a.id ?? 0)),
    [kayitlar, filtre],
  );

  return (
    <div className="sayfa">
      <h1>Kayıtlar</h1>
      <input type="search" placeholder="Ara: açıklama veya kategori" value={filtre.arama ?? ''} onChange={(e) => setFiltre({ ...filtre, arama: e.target.value })} />
      <div style={{ height: 8 }} />
      <Filtreler filtre={filtre} degisti={setFiltre} kategoriler={kategoriler} odemeler={odemeler} donem={donem} donemDegisti={setDonem} />
      <div className="kart" style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span className="soluk">{sonuc.length} kayıt</span>
        <b className="tutar">{formatTL(toplam(sonuc))}</b>
      </div>
      {sonuc.length > 0 && (
        <div className="kart" style={{ padding: '0 12px' }}>
          <KayitListesi kayitlar={sonuc.slice(0, 500)} sec={setDuzenlenen} />
        </div>
      )}
      {sonuc.length > 500 && <p className="soluk kucuk">İlk 500 kayıt gösteriliyor; filtreyi daraltın.</p>}

      <button
        className="btn ana"
        aria-label="Elle kayıt ekle"
        onClick={() => setYeni(true)}
        style={{ position: 'fixed', right: 16, bottom: 'calc(env(safe-area-inset-bottom) + 76px)', width: 60, height: 60, borderRadius: 30, padding: 0, zIndex: 15, boxShadow: '0 4px 14px rgba(0,0,0,.25)' }}
      >
        <span style={{ width: 28, height: 28, display: 'inline-flex' }}><Ikon ad="arti" /></span>
      </button>

      {yeni && (
        <AltSayfa baslik="Elle kayıt" kapat={() => setYeni(false)}>
          <KayitFormu
            baslangic={bosKayit()}
            kategoriler={kategoriler}
            odemeler={odemeler}
            tumKayitlar={kayitlar}
            vurgula={['aciklama']}
            kaydet={async ({ kayit, taksit }) => {
              await kayitKaydet(kayit, taksit);
              setYeni(false);
              bildir('Kaydedildi');
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
