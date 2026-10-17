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
export const VALUE = [11, 42, 111];   // filled-in values: dark navy, like a pen
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
  wrap(text, w, size = 8, bold = false) { this.font(size, bold); return this.doc.splitTextToSize(String(text ?? ''), w); }
  lh(size) { return size * 0.3528 * 1.2; } // line height in mm
  t(text, x, y, { size = 8, bold = false, color = INK, align = 'left', angle = 0, maxW = 0 } = {}) {
    if (this.dry) return; this.font(size, bold, color);
    const s = String(text ?? '');
    if (maxW && this.doc.getTextWidth(s) > maxW) { // shrink to fit, then clip
      let sz = size; while (sz > 4.5 && (this.font(sz, bold, color), this.doc.getTextWidth(s) > maxW)) sz -= 0.25;
    }
    this.doc.text(s, x, y, { align, angle, baseline: 'alphabetic' });
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
  // "Label ........ value" across width w. Returns height used.
  field(label, value, x, y, w, { size = 7.5, vsize = 8.5, unit = '', lines = 1 } = {}) {
    const lw = label ? this.tw(label, size) + 1.5 : 0;
    const vw = Math.max(8, w - lw - (unit ? this.tw(unit, size) + 1.5 : 0));
    const vl = value ? this.wrap(value, vw - 1, vsize) : [];
    const n = Math.max(lines, vl.length || 1);
    const step = this.lh(vsize) + 0.6;
    if (label) this.t(label, x, y, { size });
    for (let i = 0; i < n; i++) this.line(x + lw, y + 0.9 + i * step, x + lw + vw, y + 0.9 + i * step, { w: 0.15, color: [150, 150, 150], dash: [0.4, 0.6] });
    vl.forEach((s, i) => this.t(s, x + lw + 0.5, y - 0.2 + i * step, { size: vsize, color: VALUE }));
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
  image(dataUrl, x, y, w, h, fmt = 'JPEG') { if (!this.dry && dataUrl) { try { this.doc.addImage(dataUrl, fmt, x, y, w, h, undefined, 'FAST'); } catch {} } }
  // Footer on every page: "Page n of N" etc.
  footers(certNo = '') {
    const n = this.doc.getNumberOfPages();
    for (let i = 1; i <= n; i++) {
      this.doc.setPage(i);
      const ps = this.doc.internal.pageSize; const W = ps.getWidth(), H = ps.getHeight();
      this.font(6.5, false, GREY);
      this.doc.text(this.footerText, 10, H - 5);
      this.doc.text(`${certNo ? certNo + '   ' : ''}Page ${i} of ${n}`, W - 10, H - 5, { align: 'right' });
    }
  }
  blob() { return this.doc.output('blob'); }
}
