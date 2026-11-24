import { useEffect, useState } from 'react';
import { pinDogrula, type PinKaydi } from '../lib/pin';

export function PinTuslari({ baslik, altBaslik, uzunluk = 4, tamam, hata }: {
  baslik: string;
  altBaslik?: string;
  uzunluk?: number;
  tamam: (pin: string) => void;
  hata?: string | null;
}) {
  const [pin, setPin] = useState('');
  useEffect(() => {
    if (pin.length === uzunluk) {
      const p = pin;
      setTimeout(() => { tamam(p); setPin(''); }, 120);
    }
  }, [pin, uzunluk, tamam]);
  useEffect(() => {
    const tus = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) setPin((p) => (p.length < uzunluk ? p + e.key : p));
      if (e.key === 'Backspace') setPin((p) => p.slice(0, -1));
    };
    window.addEventListener('keydown', tus);
    return () => window.removeEventListener('keydown', tus);
  }, [uzunluk]);
  const bas = (r: string) => setPin((p) => (p.length < uzunluk ? p + r : p));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <h2 style={{ margin: 0 }}>{baslik}</h2>
      {altBaslik && <div className="soluk kucuk" style={{ marginTop: 4, textAlign: 'center' }}>{altBaslik}</div>}
      <div className="pin-noktalar" aria-label={`${pin.length} hane girildi`}>
        {Array.from({ length: uzunluk }, (_, i) => <span key={i} className={i < pin.length ? 'dolu' : ''} />)}
      </div>
      {hata && <div style={{ color: 'var(--hata)', marginTop: -14, marginBottom: 12 }} role="alert">{hata}</div>}
      <div className="tus-takimi">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((r) => <button key={r} onClick={() => bas(r)}>{r}</button>)}
        <button className="bos" aria-hidden tabIndex={-1} />
        <button onClick={() => bas('0')}>0</button>
        <button onClick={() => setPin((p) => p.slice(0, -1))} aria-label="Sil" style={{ fontSize: 22 }}>⌫</button>
      </div>
    </div>
  );
}

export function KilitEkrani({ kayit, acildi }: { kayit: PinKaydi & { uzunluk?: number }; acildi: () => void }) {
  const [hata, setHata] = useState<string | null>(null);
  const [deneme, setDeneme] = useState(0);
  const [bekle, setBekle] = useState(0);
  useEffect(() => {
    if (bekle <= 0) return;
    const t = setTimeout(() => setBekle(bekle - 1), 1000);
    return () => clearTimeout(t);
  }, [bekle]);
  return (
    <div className="pin-ekrani">
      {bekle > 0 ? (
        <div className="soluk">Çok fazla hatalı deneme. {bekle} sn bekleyin.</div>
      ) : (
        <PinTuslari
          baslik="🔒 Bütçe kilitli"
          altBaslik="PIN'inizi girin"
          uzunluk={kayit.uzunluk ?? 4}
          hata={hata}
          tamam={async (pin) => {
            if (await pinDogrula(pin, kayit)) { acildi(); return; }
            const n = deneme + 1;
            setDeneme(n);
            setHata('Hatalı PIN');
            if (n % 5 === 0) setBekle(30 * (n / 5));
          }}
        />
      )}
    </div>
  );
}
