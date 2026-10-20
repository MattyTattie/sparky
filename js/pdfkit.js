// =====================================================================
// pdfkit.js — a small layout helper on top of jsPDF for form-style PDFs.
// =====================================================================
// All drawing goes through these methods so a block can be measured
// first (dry run) and moved to a new page if it won't fit.
import { ARIMO, ARIMO_BOLD, TICKS } from './pdffonts.js';

let loading = null;
export function loadJsPDF(base = './vendor/jspdf/jspdf.umd.min.js') {
  if (globalThis.jspdf) return Promise.resolve(globalThis.jspdf);
  if (!loading) loading = new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = base;
    s.onload = () => res(globalThis.jspdf); s.onerror = () => { loading = null; rej(new Error('Could not load the PDF maker')); };
    document.head.append(s);
  });
  return loading;
}

export const INK = [20, 20, 20];
export const VALUE = [0, 0, 0];   // filled-in values: black
export const GREY = [120, 120, 120];
export const LINE = [90, 90, 90];
export const RED = [190, 30, 30];

export class Kit {
  constructor(jsPDF, { orientation = 'p', brand = null, footer = '' } = {}) {
    this.doc = new jsPDF({ orientation, unit: 'mm', format: 'a4', compress: true });
    const d = this.doc;
    d.addFileToVFS('Arimo.ttf', ARIMO); d.addFont('Arimo.ttf', 'Arimo', 'normal');
    d.addFileToVFS('Arimo-Bold.ttf', ARIMO_BOLD); d.addFont('Arimo-Bold.ttf', 'Arimo', 'bold');
    d.addFileToVFS('Ticks.ttf', TICKS); d.addFont('Ticks.ttf', 'Ticks', 'normal');
    d.setFont('Arimo', 'normal');
    this.brand = brand; this.footerText = footer; this.dry = false;
    this.setPage(orientation);
    this.onNewPage = null;
  }
  setPage(o) { this.o = o; this.W = o === 'l' ? 297 : 210; this.H = o === 'l' ? 210 : 297; this.M = 10; this.x0 = this.M; this.x1 = this.W - this.M; this.y = this.M; }
  addPage(o = this.o) { this.doc.addPage('a4', o); this.setPage(o); if (this.onNewPage) this.onNewPage(this); }
  get cw() { return this.x1 - this.x0; }
  font(size = 8, bold = false, color = INK) { this.doc.setFont('Arimo', bold ? 'bold' : 'normal'); this.doc.setFontSize(size); this.doc.setTextColor(...color); }
  // v0.5: wraps on spaces, and after hyphens and slashes only: never in
  // the middle of a word (jsPDF's own splitter chopped "Switch-disconnector"
  // into "Switc/h-dis/conn/ector"). Only a single word wider than the whole
  // box is broken, as a last resort (callers shrink the text first).
  wrap(text, w, size = 8, bold = false) {
    this.font(size, bold);
    const out = [];
    for (const para of String(text ?? '').split(/\r?\n/)) {
      const parts = para.match(/\d{1,2}\/\d{1,2}\/\d{2,4}|[^\s\-\/]+[\-\/]*|[\-\/]+|\s+/g) || [''];
      let line = '';
      for (const p of parts) {
        const tryL = line + p;
        if (!line || this.doc.getTextWidth(tryL.trimEnd()) <= w) { line = tryL; continue; }
        out.push(line.trimEnd()); line = /^\s+$/.test(p) ? '' : p;
      }
      out.push(line.trimEnd());
      // last resort: a single word wider than the box
      for (let i = 0; i < out.length; i++) {
        if (this.doc.getTextWidth(out[i]) <= w || out[i].length < 2) continue;
        let n = out[i].length; while (n > 1 && this.doc.getTextWidth(out[i].slice(0, n)) > w) n--;
        out.splice(i, 1, out[i].slice(0, n), out[i].slice(n));
      }
    }
    return out.length ? out : [''];
  }
  // True if wrap() would have to break inside a word.
  wordsFit(text, w, size = 8, bold = false) { this.font(size, bold); return (String(text ?? '').match(/\d{1,2}\/\d{1,2}\/\d{2,4}|[^\s\-\/]+[\-\/]*|[\-\/]+/g) || []).every((p) => this.doc.getTextWidth(p) <= w); }
  // Largest size (down to min) at which text fits on ONE line of width w.
  fitSize(text, w, size, min = 6, bold = false) {
    let sz = size; while (sz > min && this.tw(text, sz, bold) > w) sz = Math.round((sz - 0.25) * 100) / 100;
    return this.tw(text, sz, bold) <= w ? sz : 0;
  }
  // Cut text with "…" so it fits w at this size.
  ellipsis(text, w, size, bold = false) {
    let s = String(text ?? ''); if (this.tw(s, size, bold) <= w) return s;
    while (s.length > 1 && this.tw(s + '…', size, bold) > w) s = s.slice(0, -1);
    return s.trimEnd() + '…';
  }
  lh(size) { return size * 0.3528 * 1.2; } // line height in mm
  t(text, x, y, { size = 8, bold = false, color = INK, align = 'left', angle = 0, maxW = 0 } = {}) {
    if (this.dry) return; this.font(size, bold, color);
    const s = String(text ?? '').replace(/\s*\r?\n\s*/g, ' '); // one line only (callers wrap first)
    let out = s;
    if (maxW && this.doc.getTextWidth(s) > maxW) { // shrink to fit (down to 4.5 pt), then cut with "…"
      const sz = this.fitSize(s, maxW, size, 4.5, bold);
      if (sz) this.font(sz, bold, color); else { out = this.ellipsis(s, maxW, 4.5, bold); this.font(4.5, bold, color); }
    }
    this.doc.text(out, x, y, { align, angle, baseline: 'alphabetic' });
  }
  tw(text, size = 8, bold = false) { this.font(size, bold); return this.doc.getTextWidth(String(text ?? '')); }
  line(x1, y1, x2, y2, { w = 0.2, color = LINE, dash = null } = {}) {
    if (this.dry) return; const d = this.doc; d.setDrawColor(...color); d.setLineWidth(w);
    if (dash) d.setLineDashPattern(dash, 0); d.line(x1, y1, x2, y2); if (dash) d.setLineDashPattern([], 0);
  }
  rect(x, y, w, h, { lw = 0.25, color = LINE, fill = null } = {}) {
    if (this.dry) return; const d = this.doc; d.setDrawColor(...color); d.setLineWidth(lw);
    if (fill) { d.setFillColor(...fill); d.rect(x, y, w, h, 'FD'); } else d.rect(x, y, w, h);
  }
  // A tick box. on: true = ✓, 'x' = ✗
  cb(x, y, on, label = '', { size = 7.5 } = {}) {
    const s = 3.2;
    this.rect(x, y - s + 0.6, s, s, { lw: 0.2 });
    if (on && !this.dry) { this.doc.setFont('Ticks', 'normal'); this.doc.setFontSize(9); this.doc.setTextColor(...VALUE); this.doc.text(on === 'x' ? '✗' : '✓', x + 0.35, y + 0.15); }
    if (label) this.t(label, x + s + 1.2, y, { size });
    return x + s + 1.2 + (label ? this.tw(label, size) + 3 : 0);
  }
  // tick/cross text value (used in table cells)
  mark(v, x, y, { size = 8, align = 'center' } = {}) {
    if (this.dry) return; const s = String(v || '');
    if (/^(✓|✔|ok|yes|y|pass)$/i.test(s) || /^(✗|✘|x)$/i.test(s)) {
      this.doc.setFont('Ticks', 'normal'); this.doc.setFontSize(size + 1); this.doc.setTextColor(...(/^(✗|✘|x)$/i.test(s) ? RED : VALUE));
      this.doc.text(/^(✗|✘|x)$/i.test(s) ? '✗' : '✓', x, y, { align });
    } else this.t(s, x, y, { size, color: VALUE, align });
  }
  // "Label ........ value" across width w. Returns the extra height used.
  // v0.5: values never run into the label, the unit or the next field.
  //  - fixed (default): the field keeps ONE line. The value shrinks to fit
  //    (down to 6 pt); if it still won't fit, the label shrinks a little too;
  //    then it goes on two small lines inside the same line (word breaks
  //    only); the very last resort is "…".
  //  - grow: true (used by row(), which moves down by the height returned):
  //    shrink to 6.5 pt first, otherwise wrap on whole words at full size
  //    and draw a dotted line under each line.
  field(label, value, x, y, w, { size = 7.5, vsize = 8.5, unit = '', lines = 1, grow = false } = {}) {
    // v0.16: a typed multi-line value (e.g. an address) wraps line by line on growing
    // fields; on a fixed one-line field the lines are joined with commas.
    const raw = value == null ? '' : String(value).replace(/\r/g, '').replace(/[ \t]*\n+[ \t]*/g, '\n').trim();
    const multi = raw.includes('\n') && (grow || lines > 1);
    const val = multi ? raw : raw.replace(/,?\n/g, ', ');
    const unitW = unit ? this.tw(unit, size) + 1.5 : 0;
    let lsize = size; let lab = label;
    // the label (and unit) must leave at least 10 mm for the value: shrink the label, then cut it
    if (lab) { while (lsize > 5.5 && this.tw(lab, lsize) + 1.5 + unitW + 10 > w) lsize -= 0.25; if (this.tw(lab, lsize) + 1.5 + unitW + 10 > w) lab = this.ellipsis(lab, Math.max(4, w - unitW - 11.5), lsize); }
    let lw = lab ? this.tw(lab, lsize) + 1.5 : 0;
    let vw = Math.max(8, w - lw - unitW);
    const step = this.lh(vsize) + 0.6;
    let vl = []; let vs = vsize; let n = Math.max(1, lines);
    if (val) {
      const one = multi ? 0 : this.fitSize(val, vw - 1, vsize, grow || lines > 1 ? 6.5 : 6);
      if (one) { vl = [val]; vs = one; }
      else if (grow || lines > 1) {
        vs = vsize; while (vs > 6.5 && !this.wordsFit(val, vw - 1, vs)) vs -= 0.25;
        vl = this.wrap(val, vw - 1, vs); n = Math.max(n, vl.length);
      } else {
        // fixed one-line field: give the value more room by shrinking the label (to 6 pt)
        if (lab) { lsize = Math.min(lsize, Math.max(6, size - 1.5)); lw = this.tw(lab, lsize) + 1.5; vw = Math.max(8, w - lw - unitW); }
        const one2 = this.fitSize(val, vw - 1, vsize, 6);
        if (one2) { vl = [val]; vs = one2; }
        else {
          // two small lines inside one line's height, whole words only
          let s2 = Math.min(5.4, vsize);
          while (s2 >= 4.2 && (!this.wordsFit(val, vw - 1, s2) || this.wrap(val, vw - 1, s2).length > 2)) s2 -= 0.2;
          if (s2 >= 4.2) { vl = this.wrap(val, vw - 1, s2); vs = s2; }
          else { vl = [this.ellipsis(val, vw - 1, 6)]; vs = 6; }
        }
      }
    }
    if (lab) this.t(lab, x, y, { size: lsize });
    for (let i = 0; i < n; i++) this.line(x + lw, y + 0.9 + i * step, x + lw + vw, y + 0.9 + i * step, { w: 0.15, color: [150, 150, 150], dash: [0.4, 0.6] });
    if (vl.length === 2 && n === 1) { // two mini lines sit between the line above and the dotted line
      const ms = this.lh(vs) * 0.92;
      vl.forEach((s, i) => this.t(s, x + lw + 0.5, y + 0.45 - (1 - i) * ms, { size: vs, color: VALUE }));
    } else vl.forEach((s, i) => this.t(s, x + lw + 0.5, y - 0.2 + i * step, { size: vs, color: VALUE }));
    if (unit) this.t(unit, x + lw + vw + 1, y, { size });
    return (n - 1) * step;
  }
  para(text, x, y, w, { size = 7.5, bold = false, color = INK, gap = 0.5 } = {}) {
    const ls = this.wrap(text, w, size, bold); const step = this.lh(size);
    ls.forEach((s, i) => this.t(s, x, y + i * step, { size, bold, color }));
    return ls.length * step + gap;
  }
  // Run fn(kit) once dry to measure height, then for real (new page first if it won't fit).
  block(fn, { minGap = 0 } = {}) {
    const y0 = this.y; this.dry = true; fn(this); const h = this.y - y0; this.y = y0; this.dry = false;
    if (this.y + h > this.H - this.M - 8 - minGap && this.y > this.M + 30) this.addPage();
    fn(this);
    return h;
  }
  // A boxed form section with a bold heading.
  section(title, fn, { pad = 1.8, note = '' } = {}) {
    return this.block((k) => {
      const y0 = k.y; k.y += 4.4;
      k.t(title, k.x0 + pad, y0 + 3.6, { size: 8.5, bold: true });
      if (note) k.t(note, k.x0 + pad + k.tw(title, 8.5, true) + 2, y0 + 3.6, { size: 7, color: GREY });
      fn(k, k.x0 + pad, k.cw - pad * 2);
      k.y += 1.2;
      k.rect(k.x0, y0, k.cw, k.y - y0, { lw: 0.35, color: INK });
      k.y += 1.6;
    });
  }
  // v0.18: fit an image inside w x h keeping its shape (left aligned, centred vertically).
  // Returns the size drawn, so text can follow straight after it.
  imageContain(dataUrl, x, y, w, h, fmt = 'JPEG') {
    let iw = w, ih = h;
    try { const pr = this.doc.getImageProperties(dataUrl); if (pr && pr.width && pr.height) { const r = Math.min(w / pr.width, h / pr.height); iw = pr.width * r; ih = pr.height * r; } } catch {}
    this.image(dataUrl, x, y + (h - ih) / 2, iw, ih, fmt);
    return { w: iw, h: ih };
  }
  image(dataUrl, x, y, w, h, fmt = 'JPEG') { if (!this.dry && dataUrl) { try { this.doc.addImage(dataUrl, fmt, x, y, w, h, undefined, 'FAST'); } catch {} } }
  // v0.5: a neat initials mark (rounded square) for businesses with no logo.
  logoMark(name, x, y, size = 11) {
    if (this.dry) return;
    const ini = String(name || '').replace(/\(.*?\)/g, '').split(/\s+/).filter((w) => /^[A-Za-z]/.test(w)).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '•';
    this.doc.setFillColor(...VALUE); this.doc.roundedRect(x, y, size, size, 2.2, 2.2, 'F');
    this.font(size * 1.45, true, [255, 255, 255]); this.doc.text(ini, x + size / 2, y + size * 0.66, { align: 'center' });
  }
  // Footer on every page: a hairline, the form note on the left, and
  // "Certificate No. · Page n of N" on the right (v0.5 layout).
  footers(certNo = '') {
    const n = this.doc.getNumberOfPages();
    for (let i = 1; i <= n; i++) {
      this.doc.setPage(i);
      const ps = this.doc.internal.pageSize; const W = ps.getWidth(), H = ps.getHeight();
      this.doc.setDrawColor(170, 170, 170); this.doc.setLineWidth(0.15); this.doc.line(10, H - 8, W - 10, H - 8);
      const right = `${certNo ? certNo + '   ·   ' : ''}Page ${i} of ${n}`;
      this.font(7, true, INK); const rw = this.doc.getTextWidth(right);
      this.doc.text(right, W - 10, H - 4.6, { align: 'right' });
      this.font(6.3, false, GREY);
      const left = this.ellipsis(this.footerText, W - 20 - rw - 6, 6.3); this.font(6.3, false, GREY);
      this.doc.text(left, 10, H - 4.6);
    }
  }
  blob() { return this.doc.output('blob'); }
}
