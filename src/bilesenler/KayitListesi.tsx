import { Fragment } from 'react';
import { formatTL } from '../lib/para';
import { isoToTR } from '../lib/tarih';
import { BELIRTILMEDI, DUKKAN_YOK, type Kayit } from '../lib/tipler';

export function KayitListesi({ kayitlar, sec, gunlereAyir = true }: { kayitlar: Kayit[]; sec: (k: Kayit) => void; gunlereAyir?: boolean }) {
  const gunToplami = new Map<string, number>();
  for (const k of kayitlar) gunToplami.set(k.tarih, (gunToplami.get(k.tarih) ?? 0) + k.tutar);
  return (
    <ul className="liste">
      {kayitlar.map((k, i) => (
        <Fragment key={k.id ?? i}>
          {gunlereAyir && (i === 0 || kayitlar[i - 1].tarih !== k.tarih) && (
            <li className="gun-basligi" style={{ borderBottom: 0 }}>
              <span>{isoToTR(k.tarih)}</span>
              <span className="tutar">{formatTL(gunToplami.get(k.tarih)!)}</span>
            </li>
          )}
          <li>
            <button className="kayit-satiri" onClick={() => sec(k)}>
              <div className="ic">
                <div className="baslik">{k.aciklama}</div>
                <div className="alt">
                  <span className={`etiket ${k.tur}`}>{k.tur}</span>{' '}
                  {k.dukkan !== DUKKAN_YOK && (k.dukkan === BELIRTILMEDI ? <span className="etiket hata">Belirtilmedi</span> : k.dukkan)}
                  {' · '}{k.kategori}{k.odeme !== '-' ? ` · ${k.odeme}` : ''}{!gunlereAyir ? ` · ${isoToTR(k.tarih)}` : ''}
                </div>
              </div>
              <div className="tutar">{formatTL(k.tutar)}</div>
            </button>
          </li>
        </Fragment>
      ))}
    </ul>
  );
}
