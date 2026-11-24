import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { ayarYaz, db, listeleriGuncelle } from '../db';
import { AltSayfa, Secim, useBildirim } from '../bilesenler/ortak';
import { PinTuslari } from '../bilesenler/Pin';
import { AnaEkranaEkleYonergesi, standaloneMi } from '../bilesenler/Yonergeler';
import { excelIceAktar, kaliciDepolamaIste, tumVeriyiSil, yedekIndir, yedektenYukle, type IceAktarmaSonucu } from '../islemler';
import { formatTL } from '../lib/para';
import { pinOlustur } from '../lib/pin';
import { DUKKAN_ONEKI } from '../lib/tipler';
import { useAyar, useListeler } from '../veri';

export function IceAktarmaRaporu({ r }: { r: IceAktarmaSonucu }) {
  const tutuyor = r.excelToplam === null || r.excelToplam === r.dosyaToplami;
  return (
    <div className={`kart ${tutuyor ? 'iyi' : 'hata'}`}>
      <b>{r.eklenen} kayıt eklendi</b>{r.atlanan > 0 && `, ${r.atlanan} kayıt zaten vardı (atlandı)`}.<br />
      Dosyadaki kayıtların toplamı: <b className="tutar">{formatTL(r.dosyaToplami)}</b><br />
      {r.excelToplam !== null ? (
        <>Excel'deki TOPLAM hücresi: <b className="tutar">{formatTL(r.excelToplam)}</b> {tutuyor ? '✓ birebir aynı' : '✗ farklı!'}</>
      ) : 'Excel\'de TOPLAM hücresi bulunamadı.'}
      {r.uyarilar.length > 0 && <ul className="kucuk">{r.uyarilar.map((u) => <li key={u}>{u}</li>)}</ul>}
    </div>
  );
}

export function AyarlarEkrani() {
  const bildir = useBildirim();
  const { kategoriler, odemeler } = useListeler();
  const kartlar = useLiveQuery(() => db.kartlar.toArray(), [], []);
  const tema = useAyar<string>('tema', 'sistem');
  const pin = useAyar<unknown>('pin', null);
  const kilitSuresi = useAyar<number>('kilitSuresi', 60);
  const fisFotoSakla = useAyar('fisFotoSakla', true);
  const yedekFotograf = useAyar('yedekFotograf', false);
  const sonYedek = useAyar<number>('sonYedek', 0);
  const [kalici, setKalici] = useState<boolean | null>(null);
  const [kota, setKota] = useState<string>('');
  const [aktarim, setAktarim] = useState<IceAktarmaSonucu | null>(null);
  const [pinModu, setPinModu] = useState<null | { adim: 1 | 2; ilk?: string }>(null);
  const [pinHata, setPinHata] = useState<string | null>(null);
  const [yeniKart, setYeniKart] = useState({ son4: '', odeme: '' });
  const [yeniKategori, setYeniKategori] = useState('');
  const [yeniOdeme, setYeniOdeme] = useState('');

  useEffect(() => {
    navigator.storage?.persisted?.().then(setKalici).catch(() => setKalici(null));
    navigator.storage?.estimate?.().then((e) => setKota(`${((e.usage ?? 0) / 1048576).toFixed(1)} MB kullanılıyor`)).catch(() => undefined);
  }, []);

  const dosyaSec = (accept: string, f: (d: File) => void) => {
    const i = document.createElement('input');
    i.type = 'file';
    i.accept = accept;
    i.onchange = () => i.files?.[0] && f(i.files[0]);
    i.click();
  };

  return (
    <div className="sayfa">
      <h1>Ayarlar</h1>

      <h2>Görünüm</h2>
      <div className="kart">
        <div className="sekme-ici">
          {[['sistem', 'Sistem'], ['acik', 'Açık'], ['koyu', 'Koyu']].map(([k, ad]) => (
            <button key={k} aria-pressed={tema === k} onClick={() => ayarYaz('tema', k)}>{ad}</button>
          ))}
        </div>
      </div>

      <h2>Güvenlik</h2>
      <div className="kart">
        {pin ? (
          <>
            <div>PIN koruması <b style={{ color: 'var(--iyi)' }}>açık</b>.</div>
            <Secim etiket="Arka plana geçince kilitle" deger={String(kilitSuresi)} secenekler={['0', '60', '300', '900']} degisti={(v) => ayarYaz('kilitSuresi', +v)} />
            <div className="kucuk soluk" style={{ marginTop: -6, marginBottom: 8 }}>saniye sonra (0 = hemen)</div>
            <div className="btn-grup">
              <button className="btn" onClick={() => { setPinHata(null); setPinModu({ adim: 1 }); }}>PIN'i değiştir</button>
              <button className="btn tehlike" onClick={async () => { if (confirm('PIN koruması kaldırılsın mı?')) { await db.ayarlar.delete('pin'); bildir('PIN kaldırıldı'); } }}>PIN'i kaldır</button>
            </div>
          </>
        ) : (
          <>
            <div>PIN koruması <b style={{ color: 'var(--hata)' }}>kapalı</b>. Finansal veriler için açmanız önerilir.</div>
            <button className="btn ana tam" style={{ marginTop: 8 }} onClick={() => { setPinHata(null); setPinModu({ adim: 1 }); }}>PIN oluştur</button>
          </>
        )}
        <p className="kucuk soluk">PIN cihazda yalnızca özetlenmiş (PBKDF2) olarak saklanır. PIN'i unutursanız: Ayarlar'a giremezsiniz; uygulamayı silip yeniden kurar ve JSON yedeğinizi yüklersiniz.</p>
      </div>

      <h2>Kart eşleştirme (fiş okuma)</h2>
      <div className="kart">
        <p className="kucuk soluk" style={{ marginTop: 0 }}>POS slibindeki banka adı işyerinin bankasıdır; bu yüzden kartı son 4 hanesinden tanırız.</p>
        {kartlar.length > 0 && (
          <table className="tablo">
            <tbody>{kartlar.map((k) => (
              <tr key={k.son4}><td>…{k.son4}</td><td>{k.odeme}</td><td style={{ width: 60 }}><button className="btn kucuk tehlike" onClick={() => db.kartlar.delete(k.son4)}>Sil</button></td></tr>
            ))}</tbody>
          </table>
        )}
        <div className="satir" style={{ alignItems: 'flex-end' }}>
          <label className="alan" style={{ flex: '0 0 90px' }}><span>Son 4 hane</span>
            <input inputMode="numeric" maxLength={4} value={yeniKart.son4} onChange={(e) => setYeniKart({ ...yeniKart, son4: e.target.value.replace(/\D/g, '').slice(0, 4) })} />
          </label>
          <Secim etiket="Ödeme yöntemi" deger={yeniKart.odeme} bos="— Seçin —" secenekler={odemeler} degisti={(o) => setYeniKart({ ...yeniKart, odeme: o })} />
        </div>
        <button className="btn tam" disabled={yeniKart.son4.length !== 4 || !yeniKart.odeme} onClick={async () => { await db.kartlar.put(yeniKart); setYeniKart({ son4: '', odeme: '' }); bildir('Kart eklendi'); }}>Eşleştirme ekle</button>
      </div>

      <h2>Fiş fotoğrafları</h2>
      <div className="kart">
        <label className="onay"><input type="checkbox" checked={fisFotoSakla} onChange={(e) => ayarYaz('fisFotoSakla', e.target.checked)} /> Fiş fotoğrafını kayıtla birlikte cihazda sakla</label>
        <button className="btn kucuk tehlike" onClick={async () => {
          if (!confirm('Kayıtlı tüm fiş fotoğrafları silinsin mi? (Kayıtlar kalır)')) return;
          await db.fisler.toCollection().modify((f) => { delete f.foto; });
          bildir('Fotoğraflar silindi');
        }}>Kayıtlı fotoğrafları sil</button>
      </div>

      <h2>Veri</h2>
      <div className="kart">
        <button className="btn tam" onClick={() => dosyaSec('.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', async (d) => {
          try { setAktarim(await excelIceAktar(d)); } catch (e) { alert(`İçe aktarılamadı: ${(e as Error).message}`); }
        })}>Excel'den içe aktar (.xlsx)</button>
        <p className="kucuk soluk">“Harcamalar” sayfası, aynı sütunlar: Tarih, Kategori, Açıklama, Tür, Dükkân, Tutar (TL), Kaynak, Ödeme. Daha önce aktarılan satırlar tekrar eklenmez.</p>
        {aktarim && <IceAktarmaRaporu r={aktarim} />}
      </div>
      <div className="kart">
        <b>Yedek (JSON)</b>
        <div className="kucuk soluk">Son yedek: {sonYedek ? new Date(sonYedek).toLocaleString('tr-TR') : 'hiç alınmadı'}. Haftada bir hatırlatılır. Yedeği iCloud Drive'a kaydedin.</div>
        <label className="onay kucuk"><input type="checkbox" checked={yedekFotograf} onChange={(e) => ayarYaz('yedekFotograf', e.target.checked)} /> Fiş fotoğraflarını yedeğe dahil et (dosya büyür)</label>
        <div className="btn-grup">
          <button className="btn ana" onClick={async () => { await yedekIndir(yedekFotograf); bildir('Yedek hazırlandı'); }}>Yedek al</button>
          <button className="btn" onClick={() => dosyaSec('application/json,.json', async (d) => {
            if (!confirm('Yedek yüklenince cihazdaki TÜM veriler yedektekiyle değiştirilir. Devam edilsin mi?')) return;
            try { const n = await yedektenYukle(d); bildir(`${n} kayıt geri yüklendi`); } catch (e) { alert((e as Error).message); }
          })}>Yedekten geri yükle</button>
        </div>
      </div>

      <h2>Kategoriler ve ödeme yöntemleri</h2>
      <div className="kart">
        <details><summary>{kategoriler.length} kategori</summary><div className="kucuk">{kategoriler.join(' · ')}</div></details>
        <div className="hizli" style={{ marginTop: 6 }}>
          <input type="text" placeholder={`Yeni kategori (dükkân için "${DUKKAN_ONEKI}..." )`} value={yeniKategori} onChange={(e) => setYeniKategori(e.target.value)} />
          <button className="btn" disabled={!yeniKategori.trim()} onClick={async () => { await listeleriGuncelle([yeniKategori.trim()], []); setYeniKategori(''); }}>Ekle</button>
        </div>
        <details style={{ marginTop: 8 }}><summary>{odemeler.length} ödeme yöntemi</summary><div className="kucuk">{odemeler.join(' · ')}</div></details>
        <div className="hizli" style={{ marginTop: 6 }}>
          <input type="text" placeholder="Yeni ödeme yöntemi" value={yeniOdeme} onChange={(e) => setYeniOdeme(e.target.value)} />
          <button className="btn" disabled={!yeniOdeme.trim()} onClick={async () => { await listeleriGuncelle([], [yeniOdeme.trim()]); setYeniOdeme(''); }}>Ekle</button>
        </div>
      </div>

      <h2>Depolama</h2>
      <div className="kart">
        <div>Kalıcı depolama: <b>{kalici === null ? 'bilinmiyor' : kalici ? 'açık ✓' : 'kapalı'}</b> {kota && <span className="soluk kucuk">· {kota}</span>}</div>
        {!kalici && <button className="btn kucuk" style={{ marginTop: 6 }} onClick={async () => setKalici(await kaliciDepolamaIste())}>Kalıcı depolama iste</button>}
        <div className="kucuk soluk" style={{ marginTop: 6 }}>Uygulama {standaloneMi() ? 'ana ekrandan açılmış ✓' : 'tarayıcıda açık — ana ekrana ekleyin'}.</div>
      </div>
      {!standaloneMi() && <AnaEkranaEkleYonergesi />}

      <h2>Tehlikeli bölge</h2>
      <div className="kart">
        <button className="btn tehlike tam" onClick={async () => {
          if (prompt('Tüm veriler silinecek. Onaylamak için SİL yazın') === 'SİL') await tumVeriyiSil();
        }}>Tüm verileri sil</button>
      </div>
      <p className="kucuk soluk" style={{ textAlign: 'center' }}>Bütçe {__SURUM__} · Veriler yalnızca bu cihazda</p>

      {pinModu && (
        <AltSayfa baslik="PIN" kapat={() => setPinModu(null)}>
          <PinTuslari
            key={pinModu.adim}
            baslik={pinModu.adim === 1 ? 'Yeni 4 haneli PIN' : 'PIN\'i tekrar girin'}
            hata={pinHata}
            tamam={async (p) => {
              if (pinModu.adim === 1) { setPinHata(null); setPinModu({ adim: 2, ilk: p }); return; }
              if (p !== pinModu.ilk) { setPinHata('PIN\'ler eşleşmedi, baştan girin'); setPinModu({ adim: 1 }); return; }
              await ayarYaz('pin', { ...(await pinOlustur(p)), uzunluk: 4 });
              setPinModu(null);
              bildir('PIN ayarlandı');
            }}
          />
        </AltSayfa>
      )}
    </div>
  );
}
