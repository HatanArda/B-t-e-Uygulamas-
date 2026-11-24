// OCR motorunu (Tesseract.js worker + WASM çekirdeği + Türkçe model) public/ocr altına kopyalar.
// Böylece uygulama çalışırken hiçbir CDN'e istek atılmaz; dosyalar service worker ile önbelleğe alınır.
import { cpSync, mkdirSync, existsSync } from 'node:fs';
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
console.log('OCR dosyaları kopyalandı →', out);
