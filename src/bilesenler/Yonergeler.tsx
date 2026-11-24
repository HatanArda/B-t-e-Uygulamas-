import { useState } from 'react';

export function standaloneMi(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export const iosMu = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export function AnaEkranaEkleYonergesi({ kisa = false }: { kisa?: boolean }) {
  const [acik, setAcik] = useState(!kisa);
  return (
    <div className="kart uyari">
      <b>📲 Ana ekrana ekleyin</b>
      <div className="kucuk">
        iPhone, ana ekrana eklenmemiş sitelerin verilerini bir süre kullanılmazsa silebilir. Verilerinizin kalıcı olması ve
        internetsiz çalışması için uygulamayı ana ekrana ekleyin.
      </div>
      {kisa && !acik && <button className="btn kucuk" style={{ marginTop: 8 }} onClick={() => setAcik(true)}>Nasıl?</button>}
      {acik && (
        <ol className="adimlar kucuk">
          <li>Bu sayfayı <b>Safari</b>'de açın (Chrome vb. değil).</li>
          <li>Alttaki <b>Paylaş</b> düğmesine (kare içinde yukarı ok ⬆︎) dokunun.</li>
          <li>Listeyi kaydırıp <b>“Ana Ekrana Ekle”</b>yi seçin, sonra <b>Ekle</b>'ye dokunun.</li>
          <li>Ana ekrandaki <b>Bütçe</b> simgesinden açın. Veriler o uygulamada tutulur.</li>
        </ol>
      )}
    </div>
  );
}
