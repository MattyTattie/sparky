// =====================================================================
// ocr.js — runs the bundled Tesseract reader on a consumer unit photo.
// Everything stays on the phone.
// =====================================================================
import { proposeCircuits } from './cuscan.js';
const VENDOR = new URL('../vendor/', import.meta.url).href;
let workerP = null; let onProg = null;
const loadScript = (src) => new Promise((res, rej) => { if (window.Tesseract) return res(); const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Could not load the reader')); document.head.append(s); });
function hasSimd() { try { return WebAssembly.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11])); } catch { return false; } }
function worker() {
  if (!workerP) workerP = (async () => {
    await loadScript(VENDOR + 'tesseract/tesseract.min.js');
    return window.Tesseract.createWorker('eng', 1, {
      workerPath: VENDOR + 'tesseract/worker.min.js', corePath: VENDOR + 'tesseract/' + (hasSimd() ? 'tesseract-core-simd-lstm.js' : 'tesseract-core-lstm.js'),
      langPath: VENDOR + 'tesseract', workerBlobURL: false, cacheMethod: 'none', gzip: true,
      logger: (m) => onProg && onProg(m.status === 'recognizing text' ? 0.3 + 0.7 * m.progress : 0.3 * (m.progress || 0), m.status === 'recognizing text' ? 'Reading…' : 'Loading the reader…'),
    });
  })().catch((e) => { workerP = null; throw e; });
  return workerP;
}
// Bigger, greyer, higher-contrast copy of the photo reads better.
async function prep(file) {
  const bmp = await createImageBitmap(file); const s = Math.min(2400 / Math.max(bmp.width, bmp.height), 2);
  const c = document.createElement('canvas'); c.width = bmp.width * s; c.height = bmp.height * s;
  const g = c.getContext('2d'); g.filter = 'grayscale(1) contrast(1.4)'; g.drawImage(bmp, 0, 0, c.width, c.height); return c;
}
export async function readBoardPhoto(file, progress) {
  onProg = progress; const w = await worker();
  const { data } = await w.recognize(await prep(file), { rotateAuto: true }, { blocks: true, text: true });
  onProg = null;
  const words = [];
  for (const bl of data.blocks || []) for (const p of bl.paragraphs || []) for (const l of p.lines || []) for (const wd of l.words || []) words.push({ text: wd.text, bbox: wd.bbox });
  // Joined pairs like "B" "32" read as two words.
  for (let i = 0; i < words.length - 1; i++) if (/^[BCD]$/i.test(words[i].text) && /^\d{1,3}A?$/.test(words[i + 1].text)) words.splice(i, 2, { text: words[i].text + words[i + 1].text, bbox: { x0: words[i].bbox.x0, y0: words[i].bbox.y0, x1: words[i + 1].bbox.x1, y1: words[i + 1].bbox.y1 } });
  return { circuits: proposeCircuits(words), text: data.text || '' };
}
