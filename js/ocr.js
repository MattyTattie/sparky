// =====================================================================
// ocr.js — reads consumer unit photos on the phone (bundled Tesseract).
// Nothing leaves the phone.
//  - Works on the FULL-resolution photo: it crops each row and scales the
//    crop so the small breaker text is a good size for the reader (the old
//    version shrank the whole photo first, and the text got too small).
//  - Two passes per row (contrast-stretched and locally thresholded, for
//    glare and shadows), in "sparse text" mode, then the votes are combined.
//  - The label strips under the breakers are read sideways (rotated).
// =====================================================================
import { readRow, mergeWords, classify } from './cuscan.js';
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
      logger: (m) => onProg && m.status === 'recognizing text' && onProg.step(m.progress),
    });
  })().catch((e) => { workerP = null; throw e; });
  return workerP;
}
export async function loadPhoto(file) {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => createImageBitmap(file));
  return bmp;
}
// Crop rect (photo pixels) → canvas scaled by s, rotated by rot (0, 90, -90), cleaned up.
function prepare(bmp, r, s, rot, mode) {
  const w = Math.max(1, Math.round(r.w * s)), hh = Math.max(1, Math.round(r.h * s));
  const c = document.createElement('canvas');
  if (rot) { c.width = hh; c.height = w; } else { c.width = w; c.height = hh; }
  const g = c.getContext('2d', { willReadFrequently: true }); g.imageSmoothingQuality = 'high';
  if (rot === 90) { g.translate(hh, 0); g.rotate(Math.PI / 2); } else if (rot === -90) { g.translate(0, w); g.rotate(-Math.PI / 2); }
  g.drawImage(bmp, r.x, r.y, r.w, r.h, 0, 0, w, hh);
  g.setTransform(1, 0, 0, 1, 0, 0);
  const W = c.width, H = c.height, d = g.getImageData(0, 0, W, H), p = d.data, n = W * H;
  const gray = new Float32Array(n);
  for (let i = 0; i < n; i++) gray[i] = 0.299 * p[i * 4] + 0.587 * p[i * 4 + 1] + 0.114 * p[i * 4 + 2];
  const hist = new Uint32Array(256); for (let i = 0; i < n; i++) hist[gray[i] | 0]++;
  let lo = 0, hi = 255, acc = 0; for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc > n * 0.02) { lo = v; break; } }
  acc = 0; for (let v = 255; v >= 0; v--) { acc += hist[v]; if (acc > n * 0.02) { hi = v; break; } }
  if (hi - lo < 100) lo = Math.max(0, hi - 180); // mostly-plain picture: don't stretch the background into black
  for (let i = 0; i < n; i++) gray[i] = Math.max(0, Math.min(255, ((gray[i] - lo) * 255) / (hi - lo || 1)));
  if (mode === 'thresh') { // local mean threshold: copes with glare and shadow across the row
    const I = new Float64Array((W + 1) * (H + 1));
    for (let y = 0; y < H; y++) { let row = 0; for (let x = 0; x < W; x++) { row += gray[y * W + x]; I[(y + 1) * (W + 1) + x + 1] = I[y * (W + 1) + x + 1] + row; } }
    const rad = Math.max(8, Math.round(Math.min(W, H) / 8)); const out = new Uint8ClampedArray(n);
    for (let y = 0; y < H; y++) { const y0 = Math.max(0, y - rad), y1 = Math.min(H, y + rad); for (let x = 0; x < W; x++) { const x0 = Math.max(0, x - rad), x1 = Math.min(W, x + rad); const sum = I[y1 * (W + 1) + x1] - I[y0 * (W + 1) + x1] - I[y1 * (W + 1) + x0] + I[y0 * (W + 1) + x0]; out[y * W + x] = gray[y * W + x] < sum / ((x1 - x0) * (y1 - y0)) - 12 ? 0 : 255; } }
    for (let i = 0; i < n; i++) gray[i] = out[i];
  }
  for (let i = 0; i < n; i++) p[i * 4] = p[i * 4 + 1] = p[i * 4 + 2] = gray[i];
  g.putImageData(d, 0, 0);
  return { canvas: c, w, hh };
}
// Back from the prepared canvas to photo pixels.
function unmap(b, r, s, rot, w, hh) {
  let x0, x1, y0, y1;
  if (!rot) { x0 = b.x0; x1 = b.x1; y0 = b.y0; y1 = b.y1; }
  else if (rot === 90) { x0 = b.y0; x1 = b.y1; y0 = hh - b.x1; y1 = hh - b.x0; }
  else { x0 = w - b.y1; x1 = w - b.y0; y0 = b.x0; y1 = b.x1; }
  return { x0: r.x + x0 / s, x1: r.x + x1 / s, y0: r.y + y0 / s, y1: r.y + y1 / s };
}
async function words(bmp, r, { s, rot = 0, mode = 'stretch', psm = 11 }) {
  const w = await worker();
  const { canvas, w: cw, hh } = prepare(bmp, r, s, rot, mode);
  await w.setParameters({ tessedit_pageseg_mode: String(psm), preserve_interword_spaces: '0' });
  const { data } = await w.recognize(canvas, {}, { blocks: true });
  const out = []; let order = 0;
  for (const bl of data.blocks || []) for (const pa of bl.paragraphs || []) for (const l of pa.lines || []) for (const wd of l.words || []) {
    const bb = unmap(wd.bbox, r, s, rot, cw, hh); out.push({ text: wd.text, conf: wd.confidence ?? wd.conf, bbox: bb, cx: (bb.x0 + bb.x1) / 2, order: order++ });
  }
  return out;
}
const clampRect = (r, W, H) => { const x = Math.max(0, Math.round(r.x)), y = Math.max(0, Math.round(r.y)); return { x, y, w: Math.max(1, Math.min(W - x, Math.round(r.w))), h: Math.max(1, Math.min(H - y, Math.round(r.h))) }; };

// Read one row of breakers inside rect (photo pixels). Label strips are
// looked for in the band just below it (or labelRect if given).
export async function readRowRect(bmp, rect, { labelRect = null, labels = true } = {}) {
  const r = clampRect(rect, bmp.width, bmp.height);
  // Scale so the row is ~650 px tall: breaker text then ends up ~40-60 px high.
  const s = Math.max(0.5, Math.min(3, 650 / r.h, 5000 / r.w));
  const face = [...await words(bmp, r, { s, mode: 'stretch' }), ...await words(bmp, r, { s, mode: 'thresh' })];
  // Hardly anything read? The text may be much bigger or smaller than usual for its row: try other sizes.
  const useful = (ws) => mergeWords(ws).map(classify).filter((x) => x && ['model', 'marking', 'ma'].includes(x.kind)).length;
  // (Hard printed boxes round the text can also throw the sparse-text mode; block mode copes.)
  if (useful(face) < 3) for (const [k, psm] of [[0.4, 11], [1, 6], [2, 11]]) { const s2 = Math.max(0.3, Math.min(4, s * k, 6000 / r.w)); if (psm === 11 && Math.abs(s2 - s) / s < 0.2) continue; const more = await words(bmp, r, { s: s2, mode: 'stretch', psm }); if (useful(more) > useful(face)) face.push(...more); if (useful(face) >= 3) break; }
  let lab = [];
  if (labels) {
    const lr = clampRect(labelRect || { x: r.x, y: r.y + r.h * 0.9, w: r.w, h: r.h * 1.8 }, bmp.width, bmp.height);
    if (lr.h > 20) {
      const ls = Math.max(0.5, Math.min(2.5, 1400 / lr.h, 5000 / lr.w));
      const a = await words(bmp, lr, { s: ls, rot: -90 }), b = await words(bmp, lr, { s: ls, rot: 90 });
      const score = (ws) => ws.filter((w) => (w.conf ?? 0) >= 60 && /^[A-Za-z]{3,}$/.test(w.text)).length;
      lab = score(a) >= score(b) ? a : b;
      if (score(lab) === 0) lab = await words(bmp, lr, { s: ls, rot: 0 });
    }
  }
  // Labels written on the breakers themselves (or a strip inside the box) count too.
  const { labelFor } = await import('./cuscan.js');
  const onFace = face.filter((w) => (w.conf ?? 0) >= 60 && /^[A-Za-z]{3,}$/.test(w.text) && labelFor(w.text) && !lab.some((l) => Math.abs(l.cx - w.cx) < 5));
  const out = readRow(face.filter((w) => !onFace.includes(w)), [...lab, ...onFace]);
  out.rect = r; out.nWords = face.length;
  // Unread devices that are mostly orange are very likely the surge protector (SPD): not a circuit.
  for (const o of out.board) if (o.kind === 'other' && orangeShare(bmp, r, o.cx, out.pitch || r.w / 12) > 0.25) { o.kind = 'spd'; o.why = 'Orange, no rating: looks like the surge protector (SPD)'; }
  // Nothing read right of the main switch? Look there for an orange SPD anyway, so it's shown (not as a circuit).
  const main = out.board.find((o) => o.kind === 'main'), pitch = out.pitch || r.w / 12;
  if (main && !out.board.some((o) => o.kind === 'spd')) {
    const base = out.ways.map((w) => orangeShare(bmp, r, w.cx, pitch)).sort((a, b) => a - b)[Math.floor(out.ways.length / 2)] || 0;
    for (let k = 1; main.cx + k * pitch < r.x + r.w - pitch * 0.15; k += 0.5) { const cx = Math.min(main.cx + k * pitch, r.x + r.w - pitch * 0.35); if (orangeShare(bmp, r, cx, pitch) > Math.max(0.12, base * 3)) { out.board.push({ kind: 'spd', cx, items: [], why: 'Orange, right of the main switch: looks like the surge protector (SPD)' }); break; } }
  }
  for (const w of out.ways) if (!w.rating && orangeShare(bmp, r, w.cx, out.pitch || r.w / 12) > 0.25) { w.maybeSpd = true; w.why = 'No rating read, and it\u2019s orange: probably the SPD, not a circuit'; w.keep = false; }
  return out;
}

// Share of strongly orange pixels in one breaker's slot.
export function orangeShare(bmp, r, cx, pitch) {
  const x = Math.max(0, Math.round(cx - pitch * 0.35)), w = Math.max(4, Math.min(bmp.width - x, Math.round(pitch * 0.7)));
  const c = document.createElement('canvas'); const s = Math.min(1, 120 / w); c.width = Math.max(1, Math.round(w * s)); c.height = Math.max(1, Math.round(r.h * s));
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(bmp, x, r.y, w, r.h, 0, 0, c.width, c.height);
  const p = g.getImageData(0, 0, c.width, c.height).data; let n = 0, o = 0;
  for (let i = 0; i < p.length; i += 4) { const R = p[i], G = p[i + 1], B = p[i + 2]; const mx = Math.max(R, G, B), mn = Math.min(R, G, B); n++; if (mx > 90 && (mx - mn) / mx > 0.45 && R === mx && G > B && (G - B) / (R - B || 1) < 0.75 && (G - B) / (R - B || 1) > 0.15) o++; }
  return n ? o / n : 0;
}
// No box drawn: look for rows of breakers across the whole photo.
export async function findRows(bmp) {
  const W = bmp.width, H = bmp.height, bandH = Math.min(H, Math.max(Math.round(H / 3), 900)), all = [];
  const nb = bandH >= H ? 1 : 5;
  for (let i = 0; i < nb; i++) {
    const y = nb === 1 ? 0 : Math.round((i * (H - bandH)) / (nb - 1)); const r = { x: 0, y, w: W, h: bandH };
    all.push(...await words(bmp, r, { s: Math.min(1.5, 4000 / W) }));
  }
  const items = mergeWords(all).map(classify).filter((x) => x && ['model', 'marking', 'ma', 'face'].includes(x.kind));
  if (!items.length) return [];
  const hMed = items.map((i) => i.h).sort((a, b) => a - b)[Math.floor(items.length / 2)];
  const rows = [];
  for (const it of items.sort((a, b) => a.cy - b.cy)) { const r = rows.find((x) => Math.abs(x.cy - it.cy) < hMed * 6); if (r) { r.ys.push(it.cy); r.cy = (r.cy * (r.ys.length - 1) + it.cy) / r.ys.length; r.x0 = Math.min(r.x0, it.bbox.x0); r.x1 = Math.max(r.x1, it.bbox.x1); } else rows.push({ cy: it.cy, ys: [it.cy], x0: it.bbox.x0, x1: it.bbox.x1 }); }
  return rows.filter((r) => r.ys.length >= 3).map((r) => { const y0 = Math.min(...r.ys) - hMed * 3, y1 = Math.max(...r.ys) + hMed * 3; return clampRect({ x: r.x0 - hMed * 4, y: y0, w: r.x1 - r.x0 + hMed * 8, h: y1 - y0 }, W, H); });
}

// parts: [{ file|bmp, rects: [ {x,y,w,h} … ] }] in board order.
// Returns rows in order (photo 1 row 1, photo 1 row 2, photo 2 …).
export async function readBoard(parts, progress = () => {}) {
  const rows = []; let done = 0;
  const jobs = [];
  for (const [pi, p] of parts.entries()) { p.bmp = p.bmp || await loadPhoto(p.file); jobs.push({ p, pi }); }
  const total = parts.reduce((n, p) => n + Math.max(1, (p.rects || []).length), 0);
  onProg = { step: (f) => progress((done + Math.min(1, f)) / total, 'Reading…') };
  for (const { p, pi } of jobs) {
    let rects = p.rects && p.rects.length ? p.rects : null;
    if (!rects) { progress(done / total, 'Finding the rows of breakers…'); rects = await findRows(p.bmp); if (!rects.length) rects = [{ x: 0, y: 0, w: p.bmp.width, h: p.bmp.height }]; p.autoRects = rects; }
    for (const [ri, r] of rects.entries()) {
      const res = await readRowRect(p.bmp, r);
      rows.push({ ...res, part: pi, row: ri }); done++; progress(done / total, `Read row ${rows.length}`);
    }
  }
  onProg = null;
  return rows;
}
// A small picture of one breaker, to show next to its row in the review.
export function cropUrl(bmp, r, maxH = 150) {
  const s = Math.min(1, maxH / r.h); const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(r.w * s)); c.height = Math.max(1, Math.round(r.h * s));
  c.getContext('2d').drawImage(bmp, r.x, r.y, r.w, r.h, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', 0.8);
}
// One photo, rows found automatically → proposed circuits (older callers/tests).
export async function readBoardPhoto(file, progress) {
  const { mergeRows, toCircuit } = await import('./cuscan.js');
  const rows = await readBoard([{ file }], progress);
  return { rows, circuits: mergeRows(rows).map((w) => ({ num: w.num, ...toCircuit(w), sure: w.sure, source: (w.items || []).map((x) => x.text).join(' ') })), text: '' };
}
export { prepare as _prepare, words as _words }; // for tests
