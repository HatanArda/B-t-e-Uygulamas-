import { useState } from 'react';
import { ayarYaz } from '../db';
import { PinTuslari } from '../bilesenler/Pin';
import { AnaEkranaEkleYonergesi, iosMu, standaloneMi } from '../bilesenler/Yonergeler';
import { excelIceAktar, kaliciDepolamaIste, type IceAktarmaSonucu } from '../islemler';
import { pinOlustur } from '../lib/pin';
import { IceAktarmaRaporu } from './AyarlarEkrani';

type Adim = 'kur' | 'excel' | 'pin';

/** İlk açılış sihirbazı: ana ekrana ekle → Excel içe aktar → PIN. */
export function Kurulum({ bitti }: { bitti: () => void }) {
  const [adim, setAdim] = useState<Adim>(iosMu() && !standaloneMi() ? 'kur' : 'excel');
  const [rapor, setRapor] = useState<IceAktarmaSonucu | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [mesgul, setMesgul] = useState(false);
  const [pinIlk, setPinIlk] = useState<string | null>(null);
  const [pinHata, setPinHata] = useState<string | null>(null);

  const bitir = async () => {
    await kaliciDepolamaIste();
    await ayarYaz('kurulumTamam', true);
    bitti();
  };

  return (
    <div className="sayfa">
      <h1>Hoş geldiniz</h1>
      {adim === 'kur' && (
        <>
          <AnaEkranaEkleYonergesi />
          <div className="kart kucuk">
            <b>Önemli:</b> Safari'de girdiğiniz veriler ana ekrandaki uygulamaya <u>taşınmaz</u> (ikisi ayrı depolama kullanır).
            Önce ana ekrana ekleyip <b>oradan açın</b>, Excel'i orada içe aktarın.
          </div>
          <button className="btn tam" onClick={() => setAdim('excel')}>Yine de burada devam et</button>
        </>
      )}

      {adim === 'excel' && (
        <>
          <h2>1. Mevcut harcamalarınız</h2>
          <p className="soluk">Excel dosyanızı (ör. <i>harcamalar_13-14-11-2026.xlsx</i>) seçin. Dosya yalnızca bu cihazda okunur, hiçbir yere gönderilmez.
            iPhone'da dosyayı önce <b>Dosyalar</b> uygulamasına (iCloud Drive) kaydedin.</p>
          <label className="btn ana tam" style={{ position: 'relative' }}>
            {mesgul ? 'İçe aktarılıyor…' : 'Excel dosyasını seç'}
            <input
              type="file"
              className="gizli-dosya"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              disabled={mesgul}
              onChange={async (e) => {
                const d = e.target.files?.[0];
                if (!d) return;
                setMesgul(true);
                setHata(null);
                try { setRapor(await excelIceAktar(d)); } catch (er) { setHata((er as Error).message); } finally { setMesgul(false); }
              }}
            />
          </label>
          {hata && <div className="kart hata">{hata}</div>}
          {rapor && <IceAktarmaRaporu r={rapor} />}
          <button className="btn tam" style={{ marginTop: 10 }} onClick={() => setAdim('pin')}>{rapor ? 'Devam' : 'Boş başla (sonra Ayarlar\'dan aktarabilirsiniz)'}</button>
        </>
      )}

      {adim === 'pin' && (
        <>
          <h2>2. PIN koruması</h2>
          <div className="kart">
            <PinTuslari
              key={pinIlk ? 2 : 1}
              baslik={pinIlk ? 'PIN\'i tekrar girin' : '4 haneli PIN belirleyin'}
              hata={pinHata}
              tamam={async (p) => {
                if (!pinIlk) { setPinIlk(p); setPinHata(null); return; }
                if (p !== pinIlk) { setPinIlk(null); setPinHata('Eşleşmedi, baştan girin'); return; }
                await ayarYaz('pin', { ...(await pinOlustur(p)), uzunluk: 4 });
                await bitir();
              }}
            />
          </div>
          <button className="btn tam" onClick={bitir}>Şimdilik PIN'siz devam et</button>
        </>
      )}
    </div>
  );
}
