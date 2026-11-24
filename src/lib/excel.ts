import type ExcelJSNs from 'exceljs';
import { tlToKurus } from './para';
import { dateToISO, trToISO } from './tarih';
import { BELIRTILMEDI, DUKKAN_YOK, ODEME_YOK, type Kayit, type Tur } from './tipler';

// exceljs büyük bir kütüphane; yalnızca içe/dışa aktarırken yüklenir.
async function exceljs(): Promise<typeof ExcelJSNs> {
  const m = await import('exceljs');
  return ((m as unknown as { default?: typeof ExcelJSNs }).default ?? m) as typeof ExcelJSNs;
}

export const SUTUNLAR = ['Tarih', 'Kategori', 'Açıklama', 'Tür', 'Dükkân', 'Tutar (TL)', 'Kaynak', 'Ödeme'] as const;

export type AktarilanKayit = Omit<Kayit, 'id' | 'olusturma'>;

export interface AktarimSonucu {
  kayitlar: AktarilanKayit[];
  /** Excel'deki "TOPLAM" hücresinin değeri (kuruş), bulunamazsa null */
  excelToplam: number | null;
  kategoriler: string[];
  odemeler: string[];
  uyarilar: string[];
}

type Hucre = ExcelJSNs.CellValue;

function hucreDegeri(v: Hucre): unknown {
  if (v && typeof v === 'object' && !(v instanceof Date)) {
    if ('result' in v) return (v as { result: unknown }).result;
    if ('richText' in v) return (v as ExcelJSNs.CellRichTextValue).richText.map((r) => r.text).join('');
    if ('text' in v) return (v as { text: unknown }).text;
  }
  return v;
}

function metin(v: Hucre): string {
  const d = hucreDegeri(v);
  return d === null || d === undefined ? '' : String(d).trim();
}

function tarihOku(v: Hucre): string | null {
  const d = hucreDegeri(v);
  if (d instanceof Date) return dateToISO(d, true);
  if (typeof d === 'number' && d > 20000 && d < 80000) {
    // Excel seri tarihi
    return dateToISO(new Date(Date.UTC(1899, 11, 30) + d * 86400000), true);
  }
  if (typeof d === 'string') return trToISO(d.trim());
  return null;
}

function tutarOku(v: Hucre): number | null {
  const d = hucreDegeri(v);
  if (typeof d === 'number') return tlToKurus(d);
  if (typeof d === 'string' && d.trim()) {
    const n = Number(d.replace(/\./g, '').replace(',', '.'));
    return Number.isFinite(n) ? tlToKurus(n) : null;
  }
  return null;
}

function turOku(s: string): Tur {
  const n = s.toLocaleLowerCase('tr-TR');
  if (n.startsWith('dük') || n.startsWith('duk')) return 'Dükkân';
  if (n.startsWith('karma')) return 'Karma';
  return 'Kişisel';
}

/** Excel dosyasını ("Harcamalar" sayfası, aynı sütun düzeni) okur. */
export async function excelOku(veri: ArrayBuffer | Uint8Array): Promise<AktarimSonucu> {
  const ExcelJS = await exceljs();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(veri as ArrayBuffer);
  const ws = wb.getWorksheet('Harcamalar') ?? wb.worksheets[0];
  if (!ws) throw new Error('Excel dosyasında sayfa bulunamadı.');

  // Başlık satırını bul
  let baslikSatiri = 0;
  const kolon: Record<string, number> = {};
  for (let r = 1; r <= Math.min(10, ws.rowCount); r++) {
    const row = ws.getRow(r);
    const adlar: string[] = [];
    row.eachCell((c, col) => (adlar[col] = metin(c.value)));
    if (adlar.some((a) => a === 'Tarih') && adlar.some((a) => a?.startsWith('Tutar'))) {
      baslikSatiri = r;
      adlar.forEach((a, col) => {
        if (!a) return;
        if (a.startsWith('Tutar')) kolon['Tutar'] = col;
        else kolon[a] = col;
      });
      break;
    }
  }
  if (!baslikSatiri) throw new Error('"Tarih" ve "Tutar (TL)" başlıkları bulunamadı. Sütun düzeni farklı olabilir.');
  const zorunlu = ['Tarih', 'Kategori', 'Açıklama', 'Tutar'];
  for (const z of zorunlu) if (!kolon[z]) throw new Error(`"${z}" sütunu bulunamadı.`);

  const kayitlar: AktarilanKayit[] = [];
  const uyarilar: string[] = [];
  let excelToplam: number | null = null;
  const sayac = new Map<string, number>();

  for (let r = baslikSatiri + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const al = (ad: string) => (kolon[ad] ? row.getCell(kolon[ad]).value : null);

    // TOPLAM satırı
    let toplamSatiri = false;
    row.eachCell((c) => {
      if (metin(c.value).toLocaleUpperCase('tr-TR') === 'TOPLAM') toplamSatiri = true;
    });
    if (toplamSatiri) {
      const t = tutarOku(al('Tutar'));
      if (t !== null) excelToplam = t;
      continue;
    }

    const tarih = tarihOku(al('Tarih'));
    const tutar = tutarOku(al('Tutar'));
    if (!tarih) {
      if (tutar !== null && metin(al('Açıklama'))) uyarilar.push(`${r}. satır: tarih okunamadı, atlandı.`);
      continue;
    }
    if (tutar === null) {
      uyarilar.push(`${r}. satır: tutar okunamadı, atlandı.`);
      continue;
    }
    const tur = turOku(metin(al('Tür')));
    let dukkan = metin(al('Dükkân')) || (tur === 'Kişisel' ? DUKKAN_YOK : BELIRTILMEDI);
    if (tur !== 'Kişisel' && dukkan === DUKKAN_YOK) dukkan = BELIRTILMEDI;
    const aciklama = metin(al('Açıklama'));
    const temelAnahtar = `${tarih}|${aciklama}|${tutar}`;
    const n = (sayac.get(temelAnahtar) ?? 0) + 1;
    sayac.set(temelAnahtar, n);
    kayitlar.push({
      tarih,
      kategori: metin(al('Kategori')) || 'Diğer',
      aciklama,
      tur,
      dukkan,
      tutar,
      kaynak: metin(al('Kaynak')) || 'Excel',
      odeme: metin(al('Ödeme')) || ODEME_YOK,
      aktarimAnahtari: `${temelAnahtar}|${n}`,
    });
  }

  const kategoriler = [...new Set(kayitlar.map((k) => k.kategori))];
  const odemeler = [...new Set(kayitlar.map((k) => k.odeme))].filter((o) => o !== ODEME_YOK);
  return { kayitlar, excelToplam, kategoriler, odemeler, uyarilar };
}

function isoToExcelDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

const TL_FORMAT = '#,##0.00';

/**
 * Kayıtları Excel'e yazar: aynı sütun düzeni, TOPLAM satırı ve "Özet" sayfasında formüller (SUMIFS).
 */
export async function excelYaz(kayitlar: Kayit[], baslik?: string): Promise<Uint8Array> {
  const ExcelJS = await exceljs();
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Bütçe';
  const ws = wb.addWorksheet('Harcamalar', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = [
    { header: 'Tarih', key: 'tarih', width: 12, style: { numFmt: 'DD.MM.YYYY' } },
    { header: 'Kategori', key: 'kategori', width: 26 },
    { header: 'Açıklama', key: 'aciklama', width: 50 },
    { header: 'Tür', key: 'tur', width: 10 },
    { header: 'Dükkân', key: 'dukkan', width: 18 },
    { header: 'Tutar (TL)', key: 'tutar', width: 14, style: { numFmt: TL_FORMAT } },
    { header: 'Kaynak', key: 'kaynak', width: 16 },
    { header: 'Ödeme', key: 'odeme', width: 28 },
  ];
  ws.getRow(1).font = { bold: true };
  const sirali = [...kayitlar].sort((a, b) => a.tarih.localeCompare(b.tarih) || (a.id ?? 0) - (b.id ?? 0));
  for (const k of sirali) {
    ws.addRow({
      tarih: isoToExcelDate(k.tarih),
      kategori: k.kategori,
      aciklama: k.aciklama,
      tur: k.tur,
      dukkan: k.dukkan,
      tutar: k.tutar / 100,
      kaynak: k.kaynak,
      odeme: k.odeme,
    });
  }
  const son = sirali.length + 1;
  const genel = sirali.reduce((t, k) => t + k.tutar, 0);
  const toplamSatir = ws.addRow({});
  toplamSatir.getCell(5).value = 'TOPLAM';
  toplamSatir.getCell(6).value = { formula: `SUM(F2:F${Math.max(2, son)})`, result: genel / 100 };
  toplamSatir.font = { bold: true };
  if (baslik) {
    ws.addRow([]);
    ws.addRow([baslik]);
  }

  // Özet sayfası (formüllü)
  const oz = wb.addWorksheet('Özet');
  oz.getColumn(1).width = 34;
  oz.getColumn(2).width = 16;
  oz.getColumn(2).numFmt = TL_FORMAT;
  const aralik = (sutun: string) => `Harcamalar!$${sutun}$2:$${sutun}$${Math.max(2, son)}`;
  const bolum = (ad: string, sutun: string, etiket: string, degerler: string[], toplamAdi = 'Genel toplam') => {
    const bas = oz.addRow([ad]);
    bas.font = { bold: true, size: 12 };
    const b = oz.addRow([etiket, 'Tutar (TL)']);
    b.font = { bold: true };
    const ilk = oz.rowCount + 1;
    for (const d of degerler) {
      const r = oz.addRow([d]);
      const sonuc = sirali
        .filter((k) => ({ B: k.kategori, D: k.tur, E: k.dukkan, H: k.odeme } as Record<string, string>)[sutun] === d)
        .reduce((t, k) => t + k.tutar, 0);
      r.getCell(2).value = { formula: `SUMIFS(${aralik('F')},${aralik(sutun)},A${r.number})`, result: sonuc / 100 };
    }
    const sonSatir = oz.rowCount;
    const t = oz.addRow([toplamAdi]);
    t.font = { bold: true };
    const tsonuc = sirali
      .filter((k) => degerler.includes(({ B: k.kategori, D: k.tur, E: k.dukkan, H: k.odeme } as Record<string, string>)[sutun]))
      .reduce((s, k) => s + k.tutar, 0);
    t.getCell(2).value = { formula: `SUM(B${ilk}:B${sonSatir})`, result: tsonuc / 100 };
    oz.addRow([]);
    oz.addRow([]);
  };
  const benzersiz = (f: (k: Kayit) => string) => [...new Set(sirali.map(f))];
  bolum('Kategoriye Göre Özet', 'B', 'Kategori', benzersiz((k) => k.kategori));
  bolum('Türe Göre Özet', 'D', 'Tür', ['Kişisel', 'Dükkân', 'Karma']);
  bolum('Dükkâna Göre Özet (yalnızca dükkân giderleri)', 'E', 'Dükkân', benzersiz((k) => k.dukkan).filter((d) => d !== DUKKAN_YOK), 'Dükkân toplamı');
  bolum('Ödeme Yöntemine Göre Özet', 'H', 'Ödeme', benzersiz((k) => k.odeme));

  const buf = await wb.xlsx.writeBuffer();
  return new Uint8Array(buf as ArrayBuffer);
}
