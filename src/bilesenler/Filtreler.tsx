import { useState } from 'react';
import type { Filtre } from '../lib/ozet';
import { bugunISO, isoAyEkle, isoGunEkle } from '../lib/tarih';
import { BELIRTILMEDI, DUKKANLAR } from '../lib/tipler';
import { Secim } from './ortak';

export type DonemKodu = 'buay' | 'gecenay' | 'son3' | 'buyil' | 'tumu' | 'ozel';

export function donemAraligi(kod: DonemKodu, bugun = bugunISO()): { bas?: string; bit?: string } {
  const ayBasi = bugun.slice(0, 8) + '01';
  switch (kod) {
    case 'buay': return { bas: ayBasi, bit: isoGunEkle(isoAyEkle(ayBasi, 1), -1) };
    case 'gecenay': return { bas: isoAyEkle(ayBasi, -1), bit: isoGunEkle(ayBasi, -1) };
    case 'son3': return { bas: isoAyEkle(ayBasi, -2) };
    case 'buyil': return { bas: bugun.slice(0, 4) + '-01-01', bit: bugun.slice(0, 4) + '-12-31' };
    default: return {};
  }
}

const DONEMLER: Array<[DonemKodu, string]> = [['buay', 'Bu ay'], ['gecenay', 'Geçen ay'], ['son3', 'Son 3 ay'], ['buyil', 'Bu yıl'], ['tumu', 'Tümü'], ['ozel', 'Özel']];

export function Filtreler({ filtre, degisti, kategoriler, odemeler, donem, donemDegisti, dukkanGizle }: {
  filtre: Filtre;
  degisti: (f: Filtre) => void;
  kategoriler: string[];
  odemeler: string[];
  donem: DonemKodu;
  donemDegisti: (d: DonemKodu) => void;
  dukkanGizle?: boolean;
}) {
  const [acik, setAcik] = useState(false);
  const aktif = [filtre.dukkan, filtre.kategori, filtre.odeme, filtre.tur].filter(Boolean).length;
  return (
    <div>
      <div className="cipler">
        {DONEMLER.map(([k, ad]) => (
          <button key={k} className="cip" aria-pressed={donem === k} onClick={() => {
            donemDegisti(k);
            if (k !== 'ozel') degisti({ ...filtre, ...donemAraligi(k), ...(k === 'tumu' ? { bas: undefined, bit: undefined } : {}) });
          }}>{ad}</button>
        ))}
        <button className="cip" aria-pressed={acik || aktif > 0} onClick={() => setAcik(!acik)}>Filtre{aktif ? ` (${aktif})` : ''}</button>
      </div>
      {donem === 'ozel' && (
        <div className="satir">
          <label className="alan"><span>Başlangıç</span><input type="date" value={filtre.bas ?? ''} onChange={(e) => degisti({ ...filtre, bas: e.target.value || undefined })} /></label>
          <label className="alan"><span>Bitiş</span><input type="date" value={filtre.bit ?? ''} onChange={(e) => degisti({ ...filtre, bit: e.target.value || undefined })} /></label>
        </div>
      )}
      {acik && (
        <div className="kart">
          <Secim etiket="Tür" deger={filtre.tur ?? ''} bos="Hepsi" secenekler={['Kişisel', 'Dükkân', 'Karma']} degisti={(v) => degisti({ ...filtre, tur: v || undefined })} />
          {!dukkanGizle && <Secim etiket="Dükkân" deger={filtre.dukkan ?? ''} bos="Hepsi" secenekler={[...DUKKANLAR, BELIRTILMEDI]} degisti={(v) => degisti({ ...filtre, dukkan: v || undefined })} />}
          <Secim etiket="Kategori" deger={filtre.kategori ?? ''} bos="Hepsi" secenekler={kategoriler} degisti={(v) => degisti({ ...filtre, kategori: v || undefined })} />
          <Secim etiket="Ödeme yöntemi" deger={filtre.odeme ?? ''} bos="Hepsi" secenekler={[...odemeler, '-']} degisti={(v) => degisti({ ...filtre, odeme: v || undefined })} />
          {aktif > 0 && <button className="btn tam" onClick={() => degisti({ bas: filtre.bas, bit: filtre.bit, arama: filtre.arama })}>Filtreleri temizle</button>}
        </div>
      )}
    </div>
  );
}
