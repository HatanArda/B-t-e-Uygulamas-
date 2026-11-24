# Bütçe — kişisel ve dükkân harcamaları (PWA)

GALLİPOLİ OPTİK ve Eray Optik 2 dükkân giderlerini kişisel harcamalardan ayrı tutan, iPhone'da ana ekrana
eklenip **internetsiz** çalışan bütçe uygulaması. Tüm veriler **yalnızca telefonda** (IndexedDB) durur;
fiş fotoğrafları da cihazda okunur, hiçbir yere gönderilmez.

## Özellikler

| | |
|---|---|
| **Hızlı giriş** | `Berber 600 nakit`, `Eray Optik 2 - Kargo 150 Denizbank`, `GALLİPOLİ OPTİK SGK 10070 havale`. Dükkân adı başta yazılırsa Tür = Dükkân. Tarih yazılmazsa bugün (`13.11`, `dün` de yazılabilir). `4 taksit` yazılırsa taksit planı açılır. Kategori geçmiş kayıtlardan tahmin edilir, emin değilse sorulur. Kaydetmeden önce bütün alanlar gösterilir. |
| **Fiş okuma** | Kamera ya da galeri. Ön işleme: küçültme, gri ton, kırpma, eğiklik düzeltme, gölge giderme, kontrast. Tesseract.js `tur` modeli cihazda çalışır. Kalemler, indirimler (önceki kaleme uygulanır), adet/kilo satırları, TOPLAM, TOPKDV, tarih/saat, satıcı ve kartın son 4 hanesi okunur. |
| **Doğrulama ekranı** | Kalemler fiş toplamını tutmazsa kırmızı uyarı ve fark gösterilir (kaydetmeye engel değil). Fark tek bir rakam hatasından geliyorsa düzeltme önerilir. Tek dokunuşla "hepsi Eray Optik 2" seçilebilir. Aynı fiş ikinci kez okutulursa uyarı verilir. Kart son 4 hane → ödeme yöntemi eşleştirmesi hatırlanır. |
| **Kayıtlar** | Elle giriş, düzenleme, silme. Bir fiş kaydını kalemlere bölme. Karma kayıtları dükkân ve kişisel kısma bölme. Olası mükerrer kayıt uyarısı (aynı gün, aynı tutar, benzer açıklama). |
| **Ana ekran** | Bu ayın toplamı (Kişisel / Dükkân / Karma), **Belirtilmedi / Karma uyarı listesi**, son kayıtlar, haftalık yedek hatırlatması. |
| **Özet** | Tarih aralığı, tür, dükkân, kategori ve ödeme filtresi. Aylık grafik, dağılımlar. **Dükkân bazında muhasebe raporu**. Taksitler (aylık plan, karta göre kalan borç). |
| **Excel** | Aynı sütun düzeniyle içe ve dışa aktarma. Dışa aktarmada TOPLAM ve Özet sayfası **formül** (`SUM`, `SUMIFS`) olarak yazılır. Aynı dosya ikinci kez aktarılırsa satırlar tekrar eklenmez. |
| **Güvenlik** | 4 haneli PIN (PBKDF2 ile özetlenir), arka plana geçince otomatik kilit, yayın sürümünde sıkı CSP (uygulama dış hiçbir adrese bağlanamaz), JSON yedek. |

## Teknoloji

- **Vite + React + TypeScript:** hızlı derlenir, tip güvenliği verir, PWA araçları olgun.
- **Dexie (IndexedDB):** cihazda kalıcı ve sorgulanabilir veri için en sade katman.
- **vite-plugin-pwa (Workbox):** OCR modeli ve WASM dahil tüm dosyaları önbelleğe alır; uygulama uçak modunda açılır.
- **Tesseract.js 7 + `tur` (best_int, 2 MB):** WASM, Web Worker'da çalışır. Dosyalar `public/ocr` içine paketlenir.
  OCR dosyaları ana sayfadan (service worker önbelleğinden) okunup worker'a blob olarak verilir. Böylece iOS'ta
  worker isteklerinin önbellekten geçip geçmediğine bağlı kalınmaz.
- **exceljs:** formüllü .xlsx okuma ve yazma. Yalnızca Excel işlemi sırasında yüklenir.
- Tutarlar **kuruş cinsinden tam sayı** olarak tutulur. Kayan nokta hatası olmaz, toplamlar kuruşu kuruşuna tutar.

## Geliştirme

```bash
npm install          # OCR dosyalarını public/ocr'a kopyalar (+ küçük bir tesseract.js yaması)
npm run dev          # http://localhost:5173
npm test             # birim testleri (Vitest)
npm run build        # dist/
npm run e2e          # uçtan uca test: 390 px, Excel, PIN, UÇAK MODU, hızlı giriş, gerçek OCR
                     # (Playwright gerekir: NODE_PATH=$(npm root -g) npm run e2e)
```

**Gizlilik:** Gerçek Excel ve fiş fotoğrafları `tests/fixtures/` klasöründe durur. Bu klasör `.gitignore`'da olduğu için depoya
gönderilmez. Excel'e bağlı test, dosya yoksa atlanır. Bu dosya Excel'i uygulamaya gömmez. Excel'i **ilk açılışta telefonda seçersiniz**
ve içe aktarma cihazda yapılır. Excel uygulamaya gömülseydi yayındaki sitede herkesin indirebileceği bir dosya olurdu.

### Test sonuçları (bu sürüm)

- Birim testleri: 58/58. Hızlı girişin 3 kabul örneği; 7 örnek fiş ve 1 gerçek OCR çıktısı (indirimli, kilolu, litreli,
  adetli). Her fişte kalemler toplamı fiş toplamına eşit.
- Gerçek Excel: 173 satır, toplam **353.239,10 TL**, Excel'deki TOPLAM hücresiyle **birebir aynı**.
- Uçtan uca test (Chromium, 390×844, çevrimdışı): sayfa açılıyor, PIN çalışıyor, hızlı giriş kaydediliyor, fiş OCR ile
  yaklaşık 1,5 saniyede okunuyor, toplam tutuyor, mükerrer fiş uyarısı çıkıyor, dış adrese 0 istek gidiyor, hiçbir ekranda
  yatay taşma yok.

## Barındırma: Netlify (ücretsiz)

Önerim: Netlify ya da Cloudflare Pages, **özel (private)** GitHub deposundan. İkisi de ücretsiz ve HTTPS veriyor.
GitHub Pages ücretsiz planda depoyu herkese açık yapmayı gerektirir. O durumda da verileriniz açığa çıkmaz (sitede veri yok),
ama kodu gizli tutmak daha temiz.

1. <https://app.netlify.com> → GitHub ile giriş yapın.
2. **Add new site → Import an existing project → GitHub** → `B-t-e-Uygulamas-` deposunu seçin.
3. Branch: `main` (ya da bu dal). Derleme ayarları `netlify.toml`'dan okunur, bir şey değiştirmeyin → **Deploy**.
4. Birkaç dakika sonra `https://<ad>.netlify.app` adresi hazır olur. **Site configuration → Change site name** ile
   tahmin edilmesi zor bir ad verebilirsiniz.

Site arama motorlarına kapalıdır (`noindex`, `robots.txt`). Adresi bilen biri yalnızca boş bir uygulama görür:
her telefonun verisi kendi içindedir ve PIN ile korunur.

## iPhone'a kurulum (adım adım)

1. iPhone'da **Safari** ile Netlify adresini açın (Chrome değil).
2. Alttaki **Paylaş** düğmesine (kare içinde yukarı ok) dokunun → **Ana Ekrana Ekle** → **Ekle**.
3. Ana ekrandaki **Bütçe** simgesinden açın. Bundan sonra hep buradan açın; Safari'deki sekme ile ana ekran uygulamasının
   depolaması **ayrıdır**.
4. Excel dosyasını önce **Dosyalar** uygulamasına (iCloud Drive) kaydedin. Örneğin e-postadaki eke uzun basıp "Dosyalar'a Kaydet".
5. Uygulamada **Excel dosyasını seç** → `harcamalar_13-14-11-2026.xlsx`. Ekranda
   "353.239,10 TL … ✓ birebir aynı" yazısını görmelisiniz.
6. 4 haneli bir PIN belirleyin.
7. **Ayarlar → Kart eşleştirme:** kartlarınızın son 4 hanesini girin (Denizbank, İş Bankası, Annemin kartı…).
   Girmezseniz ilk fişte sorulur ve "hatırla" ile kaydedilir.
8. **Ayarlar → Yedek al:** JSON dosyasını iCloud Drive'a kaydedin. Uygulama haftada bir hatırlatır.

## Uçak modu testi (iPhone'da elle)

1. Kurulumu yaptıktan sonra uygulamayı **bir kez internet açıkken** açıp 10–20 saniye bekleyin. Bu sürede OCR modeli
   dahil yaklaşık 15 MB önbelleğe alınır. İsterseniz Fiş sekmesine girip bir fiş okutun; böylece hazır olduğundan emin olursunuz.
2. Uygulamayı tamamen kapatın: alttan yukarı kaydırıp uygulama kartını yukarı atın.
3. **Denetim Merkezi → Uçak modu AÇIK.** Wi-Fi de kapalı olsun (uçak modunda Wi-Fi açık kalabilir, ayrıca kapatın).
4. Ana ekrandan **Bütçe**'yi açın → PIN ekranı gelmeli → PIN'i girin.
5. Ana ekranda `Berber 600 nakit` yazın → **Ekle** → alanları kontrol edin → **Kaydet**. "Kaydedildi" bildirimi çıkmalı.
6. **Fiş** sekmesi → **Fotoğraf çek** → bir market fişini çekin → **Fotoğrafı Kullan**. İlerleme çubuğundan sonra
   kalemler ve toplamın kontrol ekranı açılmalı. Toplam uyarısını ve kalemleri kontrol edin → **… kalemi kaydet**.
7. **Kayıtlar** sekmesinde iki kaydın da göründüğünü doğrulayın.
8. Uygulamayı kapatıp yeniden açın (uçak modu hâlâ açık): kayıtlar yerinde olmalı.
9. Uçak modunu kapatın.

Sorun çıkarsa: Ayarlar → Depolama bölümünde "Kalıcı depolama: açık ✓" ve "ana ekrandan açılmış ✓" yazmalı.

### Fiş çekme ipuçları

- Fişi koyu bir zemine düz koyun, tamamı kadrajda olsun. Gölge düşürmeyin, flaş kullanmayın.
- Kırışık ya da solmuş termal fişlerde "Okuma zayıf görünüyor" uyarısı çıkar. Düzeltip yeniden çekin.
- Okunan metni **Okunan ham metin / elle düzelt** bölümünden düzeltip yeniden ayrıştırabilirsiniz.

## Aşama 2: telefon ↔ bilgisayar senkronizasyonu (karar sizin)

| Seçenek | Artıları | Eksileri |
|---|---|---|
| **A. Supabase** (Postgres + giriş + satır düzeyi güvenlik) | Ücretsiz katman yeterli. E-posta ile giriş. Bilgisayarda aynı web uygulaması açılır. İleride çok kullanıcı (muhasebeci için yalnızca okuma) mümkün. SQL ile rapor alınabilir. | Veri ilk kez cihaz dışına çıkar (AB bölgesi seçilebilir). Çakışma çözümü yazmak gerekir. Ücretsiz projeler 1 hafta kullanılmazsa duraklatılır. Fotoğraflar için depolama kotası var. |
| **B. Supabase + uçtan uca şifreleme** | A'nın bütün artıları; ek olarak veriler sunucuda PIN'den ya da paroladan türetilen anahtarla şifreli durur, Supabase bile okuyamaz. | Sunucuda SQL raporu alınamaz. Parola unutulursa bulut kopyası kurtarılamaz (yerel JSON yedeği yine işe yarar). |
| **C. Dexie Cloud** | Dexie'ye yerleşik çevrimdışı-öncelikli senkronizasyon; çakışma çözümü hazır, en az kod. | Ücretsiz katman sınırlı (az sayıda kullanıcı/cihaz), üçüncü taraf hizmete bağımlılık. |
| **D. iCloud Drive üzerinden JSON** (sunucusuz) | Hiçbir hizmete veri gitmez; bugünkü yedek özelliğiyle hemen yapılabilir. | Otomatik değil (dışa aktar / içe aktar). Aynı anda iki cihazda kayıt girilirse son yüklenen kazanır. |

**Önerim: B (Supabase + uçtan uca şifreleme, giriş zorunlu).** Finansal veriniz sunucuda okunamaz kalır,
otomatik senkronizasyon da olur. Muhasebe raporu için Excel dışa aktarma zaten var.

## Proje yapısı

```
src/lib/        saf mantık (test edilir): hizliGiris, fisAyristir, excel, kategoriTahmin, taksit, ozet, bolme, pin, yedek
src/ocr/        goruntu (ön işleme algoritmaları), onIsleme (+ worker), ocr (Tesseract sarmalayıcı)
src/ekranlar/   Ana, Kayıtlar, Fiş, Özet, Ayarlar, Kurulum
src/bilesenler/ ortak arayüz parçaları
tests/unit/     Vitest; tests/e2e/run.mjs Playwright
scripts/        OCR dosyalarını kopyalama (+ tesseract.js yaması), simge üretimi
```
