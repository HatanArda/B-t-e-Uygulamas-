import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState } from 'react';
import { db } from './db';
import { BildirimSaglayici, Ikon } from './bilesenler/ortak';
import { KilitEkrani } from './bilesenler/Pin';
import { AnaEkran } from './ekranlar/AnaEkran';
import { AyarlarEkrani } from './ekranlar/AyarlarEkrani';
import { FisEkrani } from './ekranlar/FisEkrani';
import { KayitlarEkrani } from './ekranlar/KayitlarEkrani';
import { Kurulum } from './ekranlar/Kurulum';
import { OzetEkrani } from './ekranlar/OzetEkrani';
import { kaliciDepolamaIste } from './islemler';
import type { PinKaydi } from './lib/pin';
import { useAyar } from './veri';

const SEKMELER = [
  ['ana', 'Ana', 'ana'],
  ['kayitlar', 'Kayıtlar', 'liste'],
  ['fis', 'Fiş', 'fis'],
  ['ozet', 'Özet', 'ozet'],
  ['ayarlar', 'Ayarlar', 'ayar'],
] as const;
type Sekme = (typeof SEKMELER)[number][0];

const sekmeOku = (): Sekme => {
  const h = location.hash.replace('#', '') as Sekme;
  return SEKMELER.some((s) => s[0] === h) ? h : 'ana';
};

export function App() {
  const [sekme, setSekme] = useState<Sekme>(sekmeOku);
  const tema = useAyar<string>('tema', 'sistem');
  const durum = useLiveQuery(async () => ({
    kurulum: (await db.ayarlar.get('kurulumTamam'))?.deger === true,
    pin: ((await db.ayarlar.get('pin'))?.deger ?? null) as (PinKaydi & { uzunluk?: number }) | null,
    kilitSuresi: ((await db.ayarlar.get('kilitSuresi'))?.deger as number | undefined) ?? 60,
  }), []);
  const [kilitli, setKilitli] = useState(true);
  const gizlenme = useRef<number | null>(null);

  useEffect(() => {
    const f = () => setSekme(sekmeOku());
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);

  useEffect(() => {
    if (tema === 'sistem') document.documentElement.removeAttribute('data-tema');
    else document.documentElement.setAttribute('data-tema', tema);
  }, [tema]);

  useEffect(() => {
    if (durum?.kurulum) kaliciDepolamaIste();
  }, [durum?.kurulum]);

  // Arka plana geçince belirli süre sonra kilitle
  useEffect(() => {
    const f = () => {
      if (document.visibilityState === 'hidden') gizlenme.current = Date.now();
      else if (gizlenme.current !== null && durum?.pin) {
        if (Date.now() - gizlenme.current >= durum.kilitSuresi * 1000) setKilitli(true);
        gizlenme.current = null;
      }
    };
    document.addEventListener('visibilitychange', f);
    return () => document.removeEventListener('visibilitychange', f);
  }, [durum?.pin, durum?.kilitSuresi]);

  if (!durum) return null;
  if (!durum.kurulum) return <BildirimSaglayici><Kurulum bitti={() => setKilitli(false)} /></BildirimSaglayici>;
  if (durum.pin && kilitli) return <KilitEkrani kayit={durum.pin} acildi={() => setKilitli(false)} />;

  const git = (s: Sekme) => {
    history.replaceState(null, '', `#${s}`);
    setSekme(s);
    window.scrollTo(0, 0);
  };

  return (
    <BildirimSaglayici>
      <main>
        {sekme === 'ana' && <AnaEkran />}
        {sekme === 'kayitlar' && <KayitlarEkrani />}
        {sekme === 'fis' && <FisEkrani />}
        {sekme === 'ozet' && <OzetEkrani />}
        {sekme === 'ayarlar' && <AyarlarEkrani />}
      </main>
      <nav className="sekmeler" aria-label="Ana menü">
        {SEKMELER.map(([k, ad, ikon]) => (
          <button key={k} aria-current={sekme === k ? 'page' : undefined} onClick={() => git(k)}>
            <Ikon ad={ikon} />
            {ad}
          </button>
        ))}
      </nav>
    </BildirimSaglayici>
  );
}
