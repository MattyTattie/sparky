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
import { readRow, mergeWords, classify, fixLabelWord, isLabelWord, attachLabels } from './cuscan.js';
const VENDOR = new URL('../vendor/', import.meta.url).href;
let workerP = null; let onProg = null;
// v0.13: timing counters (shown by tests/scan_photo.py) - how many reads, and how long each kind took.
const ST = { reads: 0, ms: 0, px: 0, by: {} };
export const stats = () => JSON.parse(JSON.stringify(ST));
export const resetStats = () => { ST.reads = 0; ST.ms = 0; ST.px = 0; ST.by = {}; };
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
// v0.13: sy (optional) scales the crop's height separately: label tape fonts are tall and narrow, and
// stretching them along the line of text makes them read much better.
function prepare(bmp, r, s, rot, mode, sy = s) {
  const w = Math.max(1, Math.round(r.w * s)), hh = Math.max(1, Math.round(r.h * sy));
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
function unmap(b, r, s, rot, w, hh, sy = s) {
  let x0, x1, y0, y1;
  if (!rot) { x0 = b.x0; x1 = b.x1; y0 = b.y0; y1 = b.y1; }
  else if (rot === 90) { x0 = b.y0; x1 = b.y1; y0 = hh - b.x1; y1 = hh - b.x0; }
  else { x0 = w - b.y1; x1 = w - b.y0; y0 = b.x0; y1 = b.x1; }
  return { x0: r.x + x0 / s, x1: r.x + x1 / s, y0: r.y + y0 / sy, y1: r.y + y1 / sy };
}
let lastPsm = null;
async function words(bmp, r, { s, sy = s, rot = 0, mode = 'stretch', psm = 11, tag = 'other' }) {
  const w = await worker();
  const t0 = performance.now();
  const { canvas, w: cw, hh } = prepare(bmp, r, s, rot, mode, sy);
  if (lastPsm !== psm) { await w.setParameters({ tessedit_pageseg_mode: String(psm), preserve_interword_spaces: '0' }); lastPsm = psm; }
  const { data } = await w.recognize(canvas, {}, { blocks: true });
  const ms = performance.now() - t0; ST.reads++; ST.ms += ms; ST.px += canvas.width * canvas.height;
  const b = (ST.by[tag] = ST.by[tag] || { n: 0, ms: 0 }); b.n++; b.ms += Math.round(ms);
  const out = []; let order = 0;
  for (const bl of data.blocks || []) for (const pa of bl.paragraphs || []) for (const l of pa.lines || []) for (const wd of l.words || []) {
    const bb = unmap(wd.bbox, r, s, rot, cw, hh, sy); out.push({ text: wd.text, conf: wd.confidence ?? wd.conf, bbox: bb, cx: (bb.x0 + bb.x1) / 2, order: order++ });
  }
  return out;
}
const FACE_H = 500;
const clampRect = (r, W, H) => { const x = Math.max(0, Math.round(r.x)), y = Math.max(0, Math.round(r.y)); return { x, y, w: Math.max(1, Math.min(W - x, Math.round(r.w))), h: Math.max(1, Math.min(H - y, Math.round(r.h))) }; };

// Read one row of breakers inside rect (photo pixels). Label strips are
// looked for in the band just below it (or labelRect if given).
export async function readRowRect(bmp, rect, { labelRect = null, labels = true } = {}) {
  const r = clampRect(rect, bmp.width, bmp.height); const out0 = {};
  // Scale so the row is ~650 px tall: breaker text then ends up ~40-60 px high.
  // v0.13: ~500 px tall (was 650) and the second (thresholded) pass only when the first one read few ratings.
  const s = Math.max(0.4, Math.min(2.5, FACE_H / r.h, 4200 / r.w));
  const face = await words(bmp, r, { s, mode: 'thresh', tag: 'face' });
  const useful = (ws) => mergeWords(ws).map(classify).filter((x) => x && ['model', 'marking', 'ma'].includes(x.kind)).length;
  const rated = (ws) => readRow(ws).ways.filter((w) => w.rating).length, ways1 = readRow(face).ways;
  if (!ways1.length || rated(face) < ways1.length * 0.85) face.push(...await words(bmp, r, { s, mode: 'stretch', tag: 'face2' }));
  // Hardly anything read? The text may be much bigger or smaller than usual for its row: try other sizes.
  // (Hard printed boxes round the text can also throw the sparse-text mode; block mode copes.)
  if (useful(face) < 3) for (const [k, psm] of [[0.4, 11], [1, 6], [2, 11]]) { const s2 = Math.max(0.3, Math.min(4, s * k, 6000 / r.w)); if (psm === 11 && Math.abs(s2 - s) / s < 0.2) continue; const more = await words(bmp, r, { s: s2, mode: 'stretch', psm, tag: 'retry' }); if (useful(more) > useful(face)) face.push(...more); if (useful(face) >= 3) break; }
  let lab = []; out0.labelRects = [];
  if (labels) {
    const pitch0 = readRow(face).pitch || r.w / 12;
    const st = await readStickers(bmp, r, pitch0, { box: labelRect }); lab = st.words; out0.labelRects = st.rects; out0.labelBox = st.box;
  }
  // No separate stickers found: fall back to reading the whole strip (one long printed strip, say).
  if (labels && !out0.labelRects.length) {
    const lr = clampRect(labelRect || { x: r.x, y: r.y + r.h * 0.9, w: r.w, h: r.h * 1.8 }, bmp.width, bmp.height);
    if (lr.h > 20) {
      const ls = Math.max(0.5, Math.min(2.5, 1400 / lr.h, 5000 / lr.w));
      const a = await words(bmp, lr, { s: ls, rot: -90, tag: 'label' }), b = await words(bmp, lr, { s: ls, rot: 90, tag: 'label' });
      const score = (ws) => ws.filter((w) => (w.conf ?? 0) >= 60 && /^[A-Za-z]{3,}$/.test(w.text)).length;
      lab = score(a) >= score(b) ? a : b;
      if (score(lab) === 0) lab = await words(bmp, lr, { s: ls, rot: 0, tag: 'label' });
    }
  }
  // Labels written on the breakers themselves (or a strip inside the box) count too.
  const { labelFor } = await import('./cuscan.js');
  const onFace = face.filter((w) => (w.conf ?? 0) >= 60 && /^[A-Za-z]{3,}$/.test(w.text) && labelFor(w.text) && !lab.some((l) => Math.abs(l.cx - w.cx) < 5));
  const out = Object.assign(readRow(face.filter((w) => !onFace.includes(w)), [...lab, ...onFace], { centre: bmp.width / 2 }), out0);
  out.rect = r; out.nWords = face.length;
  // v0.13: the 'SPD's MCB' guess (plain MCB next to the main switch) gets a close-up: if it shows an RCBO model code or mA, it's a circuit after all.
  for (const o of out.board.filter((x) => x.kind === 'spdmcb')) {
    const p = out.pitch || r.w / 12; const cr = clampRect({ x: o.cx - p * 0.55, y: r.y, w: p * 1.1, h: r.h }, bmp.width, bmp.height);
    const it = mergeWords(await words(bmp, cr, { s: Math.min(3, s * 1.6), mode: 'thresh', psm: 6, tag: 'column' })).map(classify).filter(Boolean);
    if (it.some((x) => x.kind === 'model' || x.kind === 'ma' || x.kind === 'rcbo')) {
      out.board.splice(out.board.indexOf(o), 1); const m = it.find((x) => x.kind === 'model') || {};
      const w = { ...o, kind: 'way', rcbo: true, idn: m.idn || '30', why: 'RCBO next to the main switch' };
      const at = out.ways.findIndex((x) => x.cx > o.cx); out.ways.splice(at < 0 ? out.ways.length : at, 0, w);
    } else out.spdMcb = o;
  }
  // v0.13: a way with no rating read gets a second, close-up look at just its own column (quick: one breaker wide).
  for (const w of out.ways.filter((x) => !x.rating).slice(0, 6)) {
    const p = out.pitch || r.w / 12; const cr = clampRect({ x: w.cx - p * 0.6, y: r.y, w: p * 1.2, h: r.h }, bmp.width, bmp.height);
    for (const mode of ['stretch', 'thresh']) {
      const got = readRow(await words(bmp, cr, { s: Math.min(3, s * 1.6), mode, psm: 6, tag: 'column' })).ways.filter((x) => x.rating);
      if (got.length) { const g = got.sort((a2, b2) => Math.abs(a2.cx - w.cx) - Math.abs(b2.cx - w.cx))[0]; Object.assign(w, { type: g.type, rating: g.rating, idn: w.idn || g.idn, rcbo: w.rcbo || g.rcbo, brand: w.brand || g.brand, ka: w.ka || g.ka, sure: g.sure, why: (g.why || '') + ' (close-up re-read)' }); break; }
    }
  }
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
  // v0.13: one quick read of the whole photo at ~2000 px wide is usually enough to find the rows (was 5 full-res bands).
  const quick = rowsFrom(await words(bmp, { x: 0, y: 0, w: W, h: H }, { s: Math.min(1, 2000 / Math.max(W, H)), tag: 'find' }), W, H);
  if (quick.length) return quick;
  const nb = bandH >= H ? 1 : 5;
  for (let i = 0; i < nb; i++) {
    const y = nb === 1 ? 0 : Math.round((i * (H - bandH)) / (nb - 1)); const r = { x: 0, y, w: W, h: bandH };
    all.push(...await words(bmp, r, { s: Math.min(1.5, 4000 / W), tag: "find" }));
  }
  return rowsFrom(all, W, H);
}
function rowsFrom(all, W, H) {
  const items = mergeWords(all).map(classify).filter((x) => x && ['model', 'marking', 'ma', 'face'].includes(x.kind));
  if (!items.length) return [];
  const hMed = items.map((i) => i.h).sort((a, b) => a - b)[Math.floor(items.length / 2)];
  const rows = [];
  for (const it of items.sort((a, b) => a.cy - b.cy)) { const r = rows.find((x) => Math.abs(x.cy - it.cy) < hMed * 6); if (r) { r.ys.push(it.cy); r.cy = (r.cy * (r.ys.length - 1) + it.cy) / r.ys.length; r.x0 = Math.min(r.x0, it.bbox.x0); r.x1 = Math.max(r.x1, it.bbox.x1); } else rows.push({ cy: it.cy, ys: [it.cy], x0: it.bbox.x0, x1: it.bbox.x1 }); }
  return rows.filter((r) => r.ys.length >= 3).map((r) => { const y0 = Math.min(...r.ys) - hMed * 3, y1 = Math.max(...r.ys) + hMed * 3; return clampRect({ x: r.x0 - hMed * 10, y: y0, w: r.x1 - r.x0 + hMed * 20, h: y1 - y0 }, W, H); });
}

// parts: [{ file|bmp, rects: [ {x,y,w,h} … ] }] in board order.
// Returns rows in order (photo 1 row 1, photo 1 row 2, photo 2 …).
export async function readBoard(parts, progress = () => {}) {
  const rows = []; let done = 0; resetStats();
  const jobs = [];
  for (const [pi, p] of parts.entries()) { p.bmp = p.bmp || await loadPhoto(p.file); jobs.push({ p, pi }); }
  const total = parts.reduce((n, p) => n + Math.max(1, (p.rects || []).length), 0);
  let phase = 'Reading the breakers…';
  onProg = { step: (f) => progress((done + Math.min(0.95, f * 0.6)) / total, phase), msg: (m) => { phase = m; progress((done + 0.7) / total, m); } };
  for (const { p, pi } of jobs) {
    let rects = p.rects && p.rects.length ? p.rects : null;
    if (!rects) { progress(done / total, 'Finding the rows of breakers…'); rects = await findRows(p.bmp); if (!rects.length) rects = [{ x: 0, y: 0, w: p.bmp.width, h: p.bmp.height }]; p.autoRects = rects; }
    for (const [ri, r] of rects.entries()) {
      phase = `Reading the breakers${rects.length > 1 ? ' (row ' + (ri + 1) + ')' : ''}…`;
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

// ---------- v0.13: label stickers under (or over) the breakers ----------
// Small grey copy of a region (for finding things, not for reading).
function grayOf(bmp, R, sc) {
  const W = Math.max(1, Math.round(R.w * sc)), H = Math.max(1, Math.round(R.h * sc));
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(bmp, R.x, R.y, R.w, R.h, 0, 0, W, H); const p = g.getImageData(0, 0, W, H).data; const gr = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) gr[i] = (p[i * 4] * 77 + p[i * 4 + 1] * 150 + p[i * 4 + 2] * 29) >> 8;
  return { W, H, gr };
}
// Where are the stickers? Text on a sticker is a narrow upright column of dark "ink" on a light strip.
// Returns rects (photo pixels) - pure image maths, no reading, so it's quick.
export function findStickerRects(bmp, r, pitch, below = true, given = null) {
  const span = pitch * 5.5;
  const R = given ? clampRect(given, bmp.width, bmp.height) : clampRect(below ? { x: r.x - pitch * 0.5, y: r.y + r.h * 0.5, w: r.w + pitch, h: r.h * 0.5 + span } : { x: r.x - pitch * 0.5, y: r.y - span, w: r.w + pitch, h: span + r.h * 0.2 }, bmp.width, bmp.height);
  if (R.h < pitch) return { box: R, rects: [] };
  const sc = Math.min(1, 40 / pitch); const { W, H, gr } = grayOf(bmp, R, sc);
  // 1. skip the dark toggles/handles right under the breakers (rows that are mostly dark)
  const sorted = Uint8Array.from(gr).sort(); const med = sorted[sorted.length >> 1]; const dark = med * 0.55;
  let start = 0; if (below && !given) { const lim = Math.round((r.h * 0.5 + pitch * 2.2) * sc); for (let y = 0; y < Math.min(H, lim); y++) { let n = 0; for (let x = 0; x < W; x++) if (gr[y * W + x] < dark) n++; if (n > W * 0.12) start = y + 1; } }
  // 2. ink = clearly darker than the 9x9 neighbourhood mean, but not big solid black (cables, toggles)
  const I = new Float64Array((W + 1) * (H + 1));
  for (let y = 0; y < H; y++) { let row = 0; for (let x = 0; x < W; x++) { row += gr[y * W + x]; I[(y + 1) * (W + 1) + x + 1] = I[y * (W + 1) + x + 1] + row; } }
  const mean = (x0, y0, x1, y1) => (I[y1 * (W + 1) + x1] - I[y0 * (W + 1) + x1] - I[y1 * (W + 1) + x0] + I[y0 * (W + 1) + x0]) / ((x1 - x0) * (y1 - y0));
  const k = Math.max(3, Math.round(pitch * sc * 0.25)); const ink = new Uint8Array(W * H);
  for (let y = start; y < H; y++) for (let x = 0; x < W; x++) { const m = mean(Math.max(0, x - k), Math.max(0, y - k), Math.min(W, x + k + 1), Math.min(H, y + k + 1)); const v = gr[y * W + x]; if (v < m - 22 && m > med * 0.7) ink[y * W + x] = 1; }
  // 3. columns of ink: x profile over the band where stickers sit
  const band = Math.min(H, start + Math.round(pitch * 3.2 * sc)); const prof = new Float32Array(W);
  for (let x = 0; x < W; x++) { let n = 0; for (let y = start; y < band; y++) n += ink[y * W + x]; prof[x] = n; }
  const thr = Math.max(2, (band - start) * 0.03); const rects = [];
  for (let x = 0; x < W;) {
    if (prof[x] < thr) { x++; continue; } let x1 = x; let gap = 0;
    while (x1 + 1 < W && (prof[x1 + 1] >= thr || (gap < 2 && ++gap))) { x1++; if (prof[x1] >= thr) gap = 0; }
    const wpx = (x1 - x + 1) / sc;
    if (wpx >= pitch * 0.08 && wpx <= pitch * 0.75) {
      // vertical extent of this column's ink: from the first ink row, until a long gap
      // (split into runs at long gaps; keep the run with the most ink - stray marks above or below don't count)
      const segs = []; let cur = null, gapY = 0;
      for (let y = start; y < H; y++) { let n = 0; for (let xx = x; xx <= x1; xx++) n += ink[y * W + xx];
        if (n) { if (!cur) segs.push((cur = { y0: y, y1: y, ink: 0 })); cur.y1 = y; cur.ink += n; gapY = 0; } else if (cur && ++gapY > pitch * sc * 0.45) cur = null; }
      const best = segs.sort((a2, b2) => b2.ink - a2.ink)[0]; const y0 = best ? best.y0 : -1, y1 = best ? best.y1 : -1;
      const hpx = (y1 - y0 + 1) / sc;
      if (y0 >= 0 && hpx >= pitch * 0.35 && hpx <= pitch * 5.5) rects.push(clampRect({ x: R.x + x / sc - pitch * 0.12, y: R.y + y0 / sc - pitch * 0.12, w: wpx + pitch * 0.24, h: hpx + pitch * 0.24 }, bmp.width, bmp.height));
    }
    x = x1 + 1;
  }
  return { box: R, rects };
}
// Read each sticker on its own (one line of text, turned upright), trying both ways round.
let stickerRot = -90;
async function readSticker(bmp, sr, firstRot) {
  // letters ~40 px high, and twice as long along the line (tall narrow tape fonts read far better stretched)
  const s = Math.max(0.2, Math.min(3, 40 / (sr.w * 0.62))), sy = s * 2;
  const score = (ws) => ws.filter((w) => /[A-Za-z]{2,}/.test(w.text)).reduce((a, w) => a + (w.conf ?? 0) * Math.min(1, w.text.length / 4), 0) / Math.max(1, ws.length);
  const a = await words(bmp, sr, { s, sy, rot: firstRot, psm: 7, tag: 'sticker' });
  if (score(a) >= 72) return { ws: a, rot: firstRot };
  const b = await words(bmp, sr, { s, sy, rot: -firstRot, psm: 7, tag: 'sticker' });
  return score(b) > score(a) ? { ws: b, rot: -firstRot } : { ws: a, rot: firstRot };
}
export async function readStickers(bmp, r, pitch, { box = null } = {}) {
  let found = findStickerRects(bmp, r, pitch, true, box);
  if (!found.rects.length && !box) { const up = findStickerRects(bmp, r, pitch, false); if (up.rects.length) found = up; }
  const all = []; let order = 0;
  for (const [i, sr] of found.rects.slice(0, 40).entries()) {
    if (onProg && onProg.msg) onProg.msg(`Reading label ${i + 1} of ${Math.min(40, found.rects.length)}`);
    const { ws, rot } = await readSticker(bmp, sr, stickerRot); stickerRot = rot;
    const t = (w) => String(w.text || '').replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, '');
    const good = ws.filter((w) => t(w) && ((w.conf ?? 0) >= 45 || (t(w).length >= 3 && fixLabelWord(t(w)) !== t(w)) || isLabelWord(t(w))));
    // one sticker = one label at the sticker's x (not each word's)
    const cx = sr.x + sr.w / 2; const id = all.length ? all[all.length - 1].sticker + 1 : 1;
    for (const w of good) all.push({ ...w, text: t(w), conf: Math.max(60, w.conf ?? 0), cx, order: order++, sticker: id, srect: sr });
  }
  return { words: all, rects: found.rects, box: found.box };
}

// v0.13: re-read one row's labels from a label box you drew in the review (photo pixels).
// Labels you typed yourself are kept; ones taken from stickers are replaced.
export async function relabelRow(bmp, row, box) {
  const pitch = row.pitch || row.rect.w / Math.max(1, row.ways.length);
  const st = await readStickers(bmp, row.rect, pitch, { box });
  for (const w of row.ways) if (!w.descTyped) { w.desc = ''; w.labelFrom = null; }
  attachLabels(row.ways, st.words, { centre: bmp.width / 2 });
  row.labelBox = st.box; row.labelRects = st.rects; row.labelUser = true;
  return st.rects.length;
}
