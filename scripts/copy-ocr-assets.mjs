// OCR motorunu (Tesseract.js worker + WASM çekirdeği + Türkçe model) public/ocr altına kopyalar.
// Böylece uygulama çalışırken hiçbir CDN'e istek atılmaz; dosyalar service worker ile önbelleğe alınır.
import { cpSync, mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const out = join(process.cwd(), 'public', 'ocr');
mkdirSync(out, { recursive: true });

const pkgDir = (name) => dirname(require.resolve(`${name}/package.json`));
const tess = pkgDir('tesseract.js');
const core = pkgDir('tesseract.js-core');
const tur = pkgDir('@tesseract.js-data/tur');

const files = [
  [join(tess, 'dist', 'worker.min.js'), 'worker.min.js'],
  // Yalnızca LSTM motoru (oem=1) kullanıyoruz; üç CPU varyantını da paketliyoruz.
  [join(core, 'tesseract-core-lstm.wasm.js'), 'tesseract-core-lstm.wasm.js'],
  [join(core, 'tesseract-core-simd-lstm.wasm.js'), 'tesseract-core-simd-lstm.wasm.js'],
  [join(core, 'tesseract-core-relaxedsimd-lstm.wasm.js'), 'tesseract-core-relaxedsimd-lstm.wasm.js'],
  [join(tur, '4.0.0_best_int', 'tur.traineddata.gz'), 'tur.traineddata.gz'],
];
for (const [src, name] of files) {
  if (!existsSync(src)) { console.error('OCR dosyası bulunamadı:', src); process.exit(1); }
  cpSync(src, join(out, name));
}

// Yama: tesseract.js, dil verisi nesne olarak ({code, data}) verildiğinde başlatırken dil adı yerine
// veriyi (t.data) kullanıyor. Doğrusu t.code. Dil verisini ana sayfadan (service worker önbelleğinden)
// verebilmek için bu düzeltme gerekli.
const workerYolu = join(out, 'worker.min.js');
const hatali = '"string"==typeof t?t:t.data})).join("+")';
let w = readFileSync(workerYolu, 'utf8');
if (w.includes(hatali)) {
  w = w.replace(hatali, '"string"==typeof t?t:t.code})).join("+")');
  writeFileSync(workerYolu, w);
} else if (!w.includes('"string"==typeof t?t:t.code})).join("+")')) {
  console.error('tesseract.js worker yaması uygulanamadı (sürüm değişmiş olabilir). scripts/copy-ocr-assets.mjs dosyasını kontrol edin.');
  process.exit(1);
}
console.log('OCR dosyaları kopyalandı →', out);
