import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { formatTL, kurusToGirdi, parseTutar } from '../lib/para';

// ---------- Bildirim (toast) ----------
const BildirimCtx = createContext<(m: string) => void>(() => undefined);
export const useBildirim = () => useContext(BildirimCtx);

export function BildirimSaglayici({ children }: { children: ReactNode }) {
  const [mesaj, setMesaj] = useState<string | null>(null);
  useEffect(() => {
    if (!mesaj) return;
    const t = setTimeout(() => setMesaj(null), 3200);
    return () => clearTimeout(t);
  }, [mesaj]);
  return (
    <BildirimCtx.Provider value={setMesaj}>
      {children}
      {mesaj && <div className="bildirim" role="status">{mesaj}</div>}
    </BildirimCtx.Provider>
  );
}

// ---------- Alt sayfa (modal) ----------
export function AltSayfa({ baslik, kapat, children }: { baslik: string; kapat: () => void; children: ReactNode }) {
  useEffect(() => {
    const onceki = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && kapat();
    window.addEventListener('keydown', esc);
    return () => {
      document.body.style.overflow = onceki;
      window.removeEventListener('keydown', esc);
    };
  }, [kapat]);
  return (
    <div className="perde" onClick={(e) => e.target === e.currentTarget && kapat()}>
      <div className="alt-sayfa" role="dialog" aria-modal="true" aria-label={baslik}>
        <div className="tutamak" />
        <div className="alt-sayfa-ust">
          <h2>{baslik}</h2>
          <button className="btn kucuk" onClick={kapat}>Kapat</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ---------- Tutar girişi (Türkçe biçim) ----------
export function TutarGirdi({ deger, degisti, etiket = 'Tutar (TL)', otomatikOdak }: {
  deger: number | null;
  degisti: (k: number | null) => void;
  etiket?: string;
  otomatikOdak?: boolean;
}) {
  const [metin, setMetin] = useState(deger === null ? '' : kurusToGirdi(deger));
  useEffect(() => {
    const mevcut = parseTutar(metin);
    if (mevcut !== deger) setMetin(deger === null ? '' : kurusToGirdi(deger));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deger]);
  return (
    <label className="alan">
      <span>{etiket}</span>
      <input
        inputMode="decimal"
        autoFocus={otomatikOdak}
        value={metin}
        placeholder="0,00"
        onChange={(e) => {
          setMetin(e.target.value);
          degisti(parseTutar(e.target.value));
        }}
      />
    </label>
  );
}

// ---------- Seçim kutusu ----------
export function Secim({ etiket, deger, secenekler, degisti, bos }: {
  etiket: string;
  deger: string;
  secenekler: readonly string[];
  degisti: (v: string) => void;
  bos?: string;
}) {
  const liste = deger && !secenekler.includes(deger) ? [deger, ...secenekler] : secenekler;
  return (
    <label className="alan">
      <span>{etiket}</span>
      <select value={deger} onChange={(e) => degisti(e.target.value)}>
        {bos !== undefined && <option value="">{bos}</option>}
        {liste.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
    </label>
  );
}

// ---------- Çubuk grafik ----------
export function Cubuklar({ veriler, renk, sinir = 12, tikla }: {
  veriler: Array<{ ad: string; tutar: number }>;
  renk?: (ad: string) => string;
  sinir?: number;
  tikla?: (ad: string) => void;
}) {
  const [hepsi, setHepsi] = useState(false);
  const en = Math.max(1, ...veriler.map((v) => v.tutar));
  const toplam = veriler.reduce((t, v) => t + v.tutar, 0) || 1;
  const gosterilen = hepsi ? veriler : veriler.slice(0, sinir);
  return (
    <div className="cubuklar">
      {gosterilen.map((v) => (
        <div key={v.ad} className="cubuk" onClick={tikla ? () => tikla(v.ad) : undefined} role={tikla ? 'button' : undefined}>
          <div className="ust">
            <span>{v.ad}</span>
            <span className="tutar">{formatTL(v.tutar)} <span className="soluk kucuk">%{Math.round((v.tutar / toplam) * 100)}</span></span>
          </div>
          <div className="iz"><div className="dolu" style={{ width: `${(v.tutar / en) * 100}%`, background: renk?.(v.ad) }} /></div>
        </div>
      ))}
      {veriler.length > sinir && (
        <button className="btn kucuk" onClick={() => setHepsi(!hepsi)}>{hepsi ? 'Daha az göster' : `Tümünü göster (${veriler.length})`}</button>
      )}
    </div>
  );
}

export const turRengi = (t: string) =>
  t === 'Dükkân' ? 'var(--dukkan)' : t === 'Karma' ? 'var(--karma)' : 'var(--kisisel)';

// ---------- Simgeler ----------
const yol: Record<string, string> = {
  ana: 'M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  liste: 'M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01',
  fis: 'M6 2h12v20l-3-2-3 2-3-2-3 2zM9 7h6M9 11h6M9 15h4',
  ozet: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  ayar: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  arti: 'M12 5v14M5 12h14',
};

export function Ikon({ ad }: { ad: keyof typeof yol | string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={yol[ad]} />
    </svg>
  );
}
