// Uçtan uca test: derlenmiş uygulamayı (vite preview) 390 px genişlikte açar,
// kurulum + Excel içe aktarma + PIN yapar, sonra AĞI KESİP (uçak modu) yeniden yükler;
// hızlı giriş ve gerçek OCR ile fiş okuma yapar. Dış adreslere hiç istek atılmadığını doğrular.
//
// Çalıştırma:  npm run build && npm run e2e
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const PORT = 4179;
const URL = `http://localhost:${PORT}/`;
const CIKTI = 'test-results';
mkdirSync(CIKTI, { recursive: true });
const GERCEK_EXCEL = 'tests/fixtures/harcamalar_13-14-11-2026.xlsx';

let hataSayisi = 0;
const dogrula = (kosul, mesaj) => {
  console.log(`${kosul ? '✓' : '✗'} ${mesaj}`);
  if (!kosul) hataSayisi++;
};

const sunucu = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' });
await new Promise((ok) => {
  sunucu.stdout.on('data', (d) => d.toString().includes(String(PORT)) && ok());
  setTimeout(ok, 8000);
});

const tarayici = await chromium.launch();
try {
  // Örnek fiş görüntüsü üret (koyu zemin üzerinde hafif eğik termal fiş)
  const fisSayfasi = await tarayici.newPage({ viewport: { width: 700, height: 1100 } });
  await fisSayfasi.setContent(`
    <body style="margin:0;background:#3b3f45;display:flex;justify-content:center;align-items:flex-start;padding:60px 0">
      <pre style="background:#fbfaf6;color:#111;font:20px/1.35 'DejaVu Sans Mono',monospace;padding:28px 26px;transform:rotate(4deg);margin:0;box-shadow:0 0 8px #000">
      MİGROS TİCARET A.Ş.
  GELİBOLU / ÇANAKKALE

TARİH:18.11.2026    SAAT:14:32
FİŞ NO:0045
A.FIST JUMBO        %1   *299,90
SEK QUARK CILEK     %1    *67,90
2 AD X 87,90
SEK QUARK PROTEIN   %1   *175,80
1,130 KG X 139,95
MUZ ITHAL           %1   *158,14
AVOKADO             %1    *69,95
POSET               %20    *1,00
TOPKDV                     *8,12
TOPLAM                   *772,69
KREDİ KARTI              *772,69
KART NO: **** **** **** 1234
</pre></body>`);
  const fisPng = await fisSayfasi.screenshot({ type: 'png' });
  writeFileSync(`${CIKTI}/ornek-fis.png`, fisPng);
  await fisSayfasi.close();

  const ctx = await tarayici.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    locale: 'tr-TR',
    timezoneId: 'Europe/Istanbul',
  });
  const disIstekler = [];
  ctx.on('request', (r) => {
    const u = r.url();
    if (!u.startsWith(URL) && !u.startsWith('blob:') && !u.startsWith('data:')) disIstekler.push(u);
  });
  const sayfa = await ctx.newPage();
  const konsolHatalari = [];
  sayfa.on('console', (m) => m.type() === 'error' && konsolHatalari.push(m.text()));
  sayfa.on('pageerror', (e) => konsolHatalari.push(String(e)));
  sayfa.on('dialog', (d) => d.accept());

  const tasmaYok = async (ad) => {
    const g = await sayfa.evaluate(() => document.documentElement.scrollWidth);
    dogrula(g <= 390, `${ad}: yatay taşma yok (scrollWidth=${g})`);
  };

  await sayfa.goto(URL);
  await sayfa.getByText('Hoş geldiniz').waitFor();
  await sayfa.screenshot({ path: `${CIKTI}/01-kurulum.png` });

  // Excel içe aktarma
  const excelYolu = existsSync(GERCEK_EXCEL) ? GERCEK_EXCEL : null;
  if (excelYolu) {
    await sayfa.locator('input[type=file]').setInputFiles(excelYolu);
    await sayfa.getByText('kayıt eklendi').waitFor({ timeout: 30000 });
    const rapor = await sayfa.locator('.kart.iyi, .kart.hata').first().innerText();
    dogrula(rapor.includes('173 kayıt eklendi'), 'Excel: 173 kayıt eklendi');
    dogrula(rapor.includes('353.239,10 TL') && rapor.includes('birebir aynı'), 'Excel: genel toplam 353.239,10 TL, TOPLAM hücresiyle birebir aynı');
    await sayfa.screenshot({ path: `${CIKTI}/02-excel-aktarildi.png` });
  } else {
    console.log('(gerçek Excel yok, içe aktarma adımı atlandı)');
  }
  await sayfa.getByRole('button', { name: /Devam|Boş başla/ }).click();

  // PIN: 2580
  const pinGir = async (pin) => { for (const r of pin) await sayfa.getByRole('button', { name: r, exact: true }).click(); };
  await pinGir('2580');
  await sayfa.getByText("PIN'i tekrar girin").waitFor();
  await pinGir('2580');
  await sayfa.getByRole('heading', { name: 'Bütçe', exact: true }).waitFor();
  await tasmaYok('Ana ekran');
  await sayfa.screenshot({ path: `${CIKTI}/03-ana.png`, fullPage: true });
  if (excelYolu) {
    const uyari = await sayfa.getByText(/Belirtilmedi \/ Karma: \d+ kayıt/).innerText();
    dogrula(/: 3 kayıt/.test(uyari), `Ana ekranda Belirtilmedi uyarısı (${uyari})`);
  }

  // Service worker hazır + OCR dosyaları önbellekte mi?
  await sayfa.evaluate(() => navigator.serviceWorker.ready);
  await sayfa.waitForFunction(async () => {
    const adlar = await caches.keys();
    for (const a of adlar) {
      const c = await caches.open(a);
      const k = await c.keys();
      if (k.some((r) => r.url.includes('tur.traineddata.gz')) && k.some((r) => r.url.includes('simd-lstm.wasm.js'))) return true;
    }
    return false;
  }, null, { timeout: 60000 });
  dogrula(true, 'Service worker OCR modelini ve WASM çekirdeğini önbelleğe aldı');

  // ---- UÇAK MODU ----
  await ctx.setOffline(true);
  await sayfa.reload();
  await sayfa.getByText('Bütçe kilitli').waitFor({ timeout: 15000 });
  dogrula(true, 'Çevrimdışı yeniden yüklendi, PIN ekranı açıldı');
  await pinGir('1111');
  await sayfa.getByText('Hatalı PIN').waitFor();
  dogrula(true, 'Yanlış PIN reddedildi');
  await pinGir('2580');
  await sayfa.getByRole('heading', { name: 'Bütçe', exact: true }).waitFor();

  // Hızlı giriş (çevrimdışı)
  await sayfa.locator('#hizli').fill('Eray Optik 2 - Kargo 150 Denizbank');
  await sayfa.getByRole('button', { name: 'Ekle', exact: true }).click();
  await sayfa.getByText('Kontrol edip kaydedin').waitFor();
  await sayfa.getByText('Kategoriden emin değilim').waitFor();
  dogrula(true, 'Bilinmeyen kategori (Kargo) kullanıcıya soruldu');
  await sayfa.screenshot({ path: `${CIKTI}/04-hizli-onizleme.png`, fullPage: true });
  await sayfa.locator('select').filter({ hasText: '+ Yeni kategori' }).selectOption('__yeni__');
  await sayfa.locator('.alt-sayfa input[type=text]').last().fill('Kargo');
  await sayfa.getByRole('button', { name: 'Kaydet' }).click();
  await sayfa.getByText('Kaydedildi: Kargo 150,00 TL').waitFor();
  dogrula(true, 'Çevrimdışı hızlı giriş kaydedildi (Eray Optik 2, Dükkân: Kargo)');

  await sayfa.locator('#hizli').fill('Berber 600 nakit');
  await sayfa.getByRole('button', { name: 'Ekle', exact: true }).click();
  await sayfa.getByText('Kontrol edip kaydedin').waitFor();
  const kat = await sayfa.locator('.alt-sayfa select').nth(0).inputValue().catch(() => '');
  await sayfa.getByRole('button', { name: 'Kaydet' }).click();
  await sayfa.getByText('Kaydedildi: Berber 600,00 TL').waitFor();
  dogrula(true, `"Berber 600 nakit" kaydedildi ${kat ? '' : ''}`);

  // Fiş okuma (çevrimdışı, gerçek OCR)
  await sayfa.locator('nav').getByRole('button', { name: 'Fiş' }).click();
  await sayfa.getByRole('heading', { name: 'Fiş okuma' }).waitFor();
  await tasmaYok('Fiş ekranı');
  const bas = Date.now();
  await sayfa.locator('[data-testid=galeri]').setInputFiles({ name: 'fis.png', mimeType: 'image/png', buffer: fisPng });
  await sayfa.getByText(/Kalemler:/).waitFor({ timeout: 120000 });
  console.log(`  (OCR süresi: ${((Date.now() - bas) / 1000).toFixed(1)} sn)`);
  await sayfa.screenshot({ path: `${CIKTI}/05-fis-dogrulama.png`, fullPage: true });
  const ham = await sayfa.locator('textarea').inputValue();
  writeFileSync(`${CIKTI}/ocr-metni.txt`, ham);
  let durum = await sayfa.locator('[role=status]').filter({ hasText: 'Kalemler:' }).innerText();
  if (durum.includes('Düzeltme önerisi')) {
    console.log('  OCR rakam hatası yaptı; öneri: ' + durum.split('\n').find((s) => s.includes('Düzeltme')));
    await sayfa.getByRole('button', { name: /Düzeltme önerisi/ }).click();
    durum = await sayfa.locator('[role=status]').filter({ hasText: 'Kalemler:' }).innerText();
  }
  console.log('  ' + durum.replace(/\n/g, ' | '));
  dogrula(durum.includes('772,69'), 'OCR: fiş toplamı 772,69 okundu');
  dogrula(durum.includes('Toplam tutuyor'), 'OCR: kalemler toplamı fiş toplamıyla eşleşti');
  const satici = await sayfa.locator('.kart input[type=text]').first().inputValue();
  dogrula(satici === 'Migros', `OCR: satıcı = ${satici}`);
  const tarih = await sayfa.locator('.kart input[type=date]').first().inputValue();
  dogrula(tarih === '2026-11-18', `OCR: tarih = ${tarih}`);
  const kalemSayisi = await sayfa.locator('.fis-kalemi').count();
  dogrula(kalemSayisi === 6, `OCR: ${kalemSayisi} kalem`);
  await sayfa.getByText('…1234 ile biten kart tanınmadı').waitFor();
  dogrula(true, 'Bilinmeyen kart (…1234) için ödeme yöntemi soruldu');
  await sayfa.locator('select').filter({ hasText: 'Denizbank kredi kartı' }).first().selectOption('Denizbank kredi kartı');
  // Kategori seçilmemiş kalem kalmasın
  await sayfa.locator('label:has-text("Seçili kalemlerin kategorisini") select').selectOption('Market / Gıda');
  await sayfa.getByRole('button', { name: /kalemi kaydet/ }).click();
  await sayfa.getByText(/kalem kaydedildi/).waitFor();
  dogrula(true, 'Çevrimdışı fiş kalemleri kaydedildi');

  // Aynı fişi tekrar okut → mükerrer uyarısı
  await sayfa.locator('[data-testid=galeri]').setInputFiles({ name: 'fis.png', mimeType: 'image/png', buffer: fisPng });
  await sayfa.getByText('Bu fiş daha önce okutulmuş olabilir').waitFor({ timeout: 120000 });
  dogrula(true, 'Aynı fiş ikinci kez okutulunca mükerrer uyarısı');
  dogrula(!(await sayfa.getByText('…1234 ile biten kart tanınmadı').isVisible()), 'Kart …1234 artık hatırlanıyor');
  await sayfa.getByRole('button', { name: 'Vazgeç' }).click();

  // Diğer ekranlar 390 px
  for (const [sekme, baslik] of [['Kayıtlar', 'Kayıtlar'], ['Özet', 'Özet'], ['Ayarlar', 'Ayarlar']]) {
    await sayfa.locator('nav').getByRole('button', { name: sekme }).click();
    await sayfa.getByRole('heading', { name: baslik, exact: true }).waitFor();
    await tasmaYok(`${baslik} ekranı`);
    await sayfa.screenshot({ path: `${CIKTI}/06-${sekme}.png`, fullPage: true });
  }
  await sayfa.locator('nav').getByRole('button', { name: 'Özet' }).click();
  await sayfa.getByRole('button', { name: 'Dükkân raporu' }).click();
  await tasmaYok('Dükkân raporu');
  await sayfa.screenshot({ path: `${CIKTI}/07-dukkan-raporu.png`, fullPage: true });
  await sayfa.getByRole('button', { name: 'Taksitler' }).click();
  await sayfa.getByText('Toplam kalan taksit borcu').waitFor();
  await tasmaYok('Taksitler');

  dogrula(disIstekler.length === 0, `Dış adrese istek yok${disIstekler.length ? ': ' + disIstekler.join(', ') : ''}`);
  const anlamli = konsolHatalari.filter((h) => !/Failed to load resource|ERR_INTERNET_DISCONNECTED/.test(h));
  dogrula(anlamli.length === 0, `Konsol hatası yok${anlamli.length ? ': ' + anlamli.join(' | ') : ''}`);
} catch (e) {
  console.error('✗ Test kesildi:', e);
  hataSayisi++;
} finally {
  await tarayici.close();
  sunucu.kill();
}
console.log(hataSayisi === 0 ? '\nTÜM UÇTAN UCA KONTROLLER GEÇTİ' : `\n${hataSayisi} KONTROL BAŞARISIZ`);
process.exit(hataSayisi ? 1 : 0);
