import { showRcdType } from './rcdtype.js';
// =====================================================================
// pdf.js — certificates as PDFs, laid out like the IET model forms
// (BS 7671:2018+A4:2026, 15 April 2026). No IET logo (their terms).
// =====================================================================
import { Kit, loadJsPDF, VALUE, GREY, INK, RED } from './pdfkit.js';
import { TYPES, get, eicrOverall, isElectrode, msIsRcd, msIsOcpd, BOND_SERVICES, bondTicked, bondCsaFor, bondNone, sourceRows, isNewInstall, SECTION_I_NA, normaliseCert } from './certmodel.js';
import { EIC_ITEMS, EICR_ITEMS, CODE_TEXT, INTAKE_NOTE_10, INTAKE_NOTES, INTAKE_NOTIFIED, migrateIntake } from './inspections.js';
import { GUIDANCE } from './guidance.js';
import { limitZs, isSpare } from './checks.js';
import { FIELDS, autoNA } from './templates.js';
const AUTO_GREY = [170, 170, 170]; // v0.10: automatic N/A on spare ways
import { STANDARD, deviceById } from './limits.js';
import { noticeFor, withNotices } from './dangermodel.js';

const yes = (v) => v === true || v === 'yes' || v === '✓';
export const fmtDate = (d) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d.split('-').reverse().join('/') : d || '');
export const FOOT = 'Based on the IET model forms for BS 7671:2018+A4:2026 (15th April 2026).';

// The brand strip at the top of the first page of each form.
export function brandStrip(k, profile, title, certNo, sub = '') {
  const p = profile || {};
  let x = k.x0;
  if (p.logo) { const d = k.imageContain(p.logo, k.x0, k.y, 22, 11, p.logo.startsWith('data:image/png') ? 'PNG' : 'JPEG'); x += Math.max(8, d.w) + 3; } // v0.18: never stretched
  else if (p.business || p.name) { k.logoMark(p.business || p.name, k.x0, k.y + 0.5, 11); x += 14; } // v0.5: initials mark when there's no logo
  if (p.business || p.name) {
    k.t(p.business || p.name, x, k.y + 4, { size: 10, bold: true });
    const contact = [[p.address1, p.address2, p.town, p.postcode].filter(Boolean).join(', '), [p.phone, p.email].filter(Boolean).join('  ·  ')].filter(Boolean);
    contact.forEach((s, i) => k.t(s, x, k.y + 8 + i * 3.3, { size: 7, color: GREY }));
  }
  if (p.regNo) k.t(p.regNo, k.x1, k.y + 4, { size: 7, color: GREY, align: 'right' });
  k.y += 15;
  k.line(k.x0, k.y - 1.5, k.x1, k.y - 1.5, { w: 0.4, color: INK });
  formTitle(k, title, certNo, sub);
}
// v0.33: 'Report No.' on the EICR, 'Certificate/Report No.' on the generic schedules (k.noLabel).
function formTitle(k, title, certNo, sub = '', label = k.noLabel || 'Certificate No.') {
  k.t(title, k.x0, k.y + 4, { size: 12, bold: true });
  k.t(label + ': ', k.x1 - k.tw(certNo || '', 9, true) - 1, k.y + 4, { size: 8, align: 'right' });
  k.t(certNo || '', k.x1, k.y + 4, { size: 9, bold: true, color: VALUE, align: 'right' });
  k.y += 6;
  if (sub) { k.y += k.para(sub, k.x0, k.y + 1, k.cw, { size: 7.2 }); }
  k.y += 1.5;
}
// v0.5: continuation/schedule pages carry a tag under the title, e.g.
// "DB/CU: DB1  ·  Sheet 2 of 3" (page X of Y is in the footer).
export function contTitle(k, title, certNo, tag = '', label) {
  formTitle(k, title, certNo, '', label);
  if (tag) { k.t(tag, k.x0, k.y + 1.2, { size: 8, bold: true, color: VALUE, maxW: k.cw * 0.7 }); k.y += 3.6; }
}
const sheetTag = (b, part, parts) => `DB/CU: ${(b && b.ref) || 'DB1'}${b && b.location ? '  (' + b.location + ')' : ''}${parts > 1 ? `   ·   Sheet ${part} of ${parts}${part > 1 ? ' (continuation)' : ''}` : ''}`;
// Measure how tall fn would draw (without drawing).
function measure(k, fn) { const y0 = k.y; const d = k.dry; k.dry = true; fn(); const h = k.y - y0; k.y = y0; k.dry = d; return h; }
const rowFit = (k, headTotal, below, n) => Math.max(4.6, Math.min(6.2, (k.H - 13 - below - k.y - headTotal) / n));

// A row of fields across the section width: [[label, value, fraction, opts], ...]
export function row(k, x, w, items, gap = 3) {
  let cx = x; let extra = 0; const y = k.y + 3.4;
  for (const [label, value, frac, opts] of items) {
    const iw = w * frac - gap;
    extra = Math.max(extra, k.field(label, value, cx, y, iw, { grow: true, ...(opts || {}) }));
    cx += w * frac;
  }
  k.y += 4.6 + extra;
}
export function checks(k, x, list, { label = '', size = 7.5 } = {}) {
  const y = k.y + 3.4; let cx = x;
  if (label) { k.t(label, cx, y, { size }); cx += k.tw(label, size) + 2; }
  for (const [lab, on] of list) cx = k.cb(cx, y, on, lab, { size });
  k.y += 4.8;
}
export function textBlock(k, x, w, label, value, { minLines = 1 } = {}) {
  if (label) { k.t(label, x, k.y + 3.2, { size: 7.5 }); k.y += 3.6; }
  const lines = k.wrap(value || '', w - 1, 8.5);
  const n = Math.max(minLines, lines.length);
  for (let i = 0; i < n; i++) {
    const yy = k.y + 3.6 + i * 4.2;
    k.line(x, yy + 0.9, x + w, yy + 0.9, { w: 0.15, color: [150, 150, 150], dash: [0.4, 0.6] });
    if (lines[i]) k.t(lines[i], x + 0.5, yy - 0.2, { size: 8.5, color: VALUE });
  }
  k.y += n * 4.2 + 1;
}
export function sig(k, x, y, w, s, label = 'Signature') {
  k.t(label + ':', x, y, { size: 7.5 });
  const lx = x + k.tw(label + ':', 7.5) + 1.5;
  k.line(lx, y + 0.9, x + w, y + 0.9, { w: 0.15, color: [150, 150, 150], dash: [0.4, 0.6] });
  if (s && s.img) k.image(s.img, lx + 1, y - 7.2, Math.min(34, w - (lx - x) - 2), 8.5, 'PNG');
}

// ---------- shared sections ----------
function supplySection(k, cert, letter) {
  const s = cert.supply;
  k.section(`SECTION ${letter}: SUPPLY CHARACTERISTICS AND EARTHING ARRANGEMENTS`, (k, x, w) => {
    const y0 = k.y; const c1 = w * 0.2, c2 = w * 0.26, c3 = w * 0.3;
    k.t('Earthing arrangements', x, k.y + 3.2, { size: 7, bold: true });
    k.t('Number and type of live conductors', x + c1, k.y + 3.2, { size: 7, bold: true });
    k.t('Nature of supply parameters', x + c1 + c2, k.y + 3.2, { size: 7, bold: true });
    k.t('Supply protective device', x + c1 + c2 + c3, k.y + 3.2, { size: 7, bold: true });
    let y = k.y + 7.6;
    ['TN-C', 'TN-S', 'TN-C-S (PME)', 'TN-C-S (PNB)', 'TT', 'IT'].forEach((e, i) => k.cb(x, y + i * 4.4, s.earthing === e, e));
    const lc = ['1-phase, 2-wire', '2-phase, 3-wire', '3-phase, 3-wire', '3-phase, 4-wire'];
    const dc = /^DC/.test(s.conductors || '') || s.acdc === 'DC'; const ac = !dc && Boolean(s.conductors || s.acdc); // v0.33: AC / DC header ticks
    k.cb(x + c1, y, ac, 'AC', { size: 7 }); k.cb(x + c1 + c2 * 0.62, y, dc, 'DC', { size: 7 });
    lc.forEach((e, i) => k.cb(x + c1, y + (i + 1) * 4.4, s.conductors === e, e));
    ['DC 2-wire', 'DC 3-wire', 'Other'].forEach((e, i) => k.cb(x + c1 + c2 * 0.62, y + (i + 1) * 4.4, s.conductors === e, e.replace('DC ', '')));
    k.cb(x + c1, y + 5 * 4.4 + 1, yes(s.polarity), 'Confirmation of supply polarity');
    const px = x + c1 + c2, pw = c3 - 3;
    k.field('Nominal voltage, U/U0(1)', s.u, px, y, pw, { unit: 'V' });
    k.field('Nominal frequency, f(1)', s.f, px, y + 4.6, pw, { unit: 'Hz' });
    k.field('Prospective fault current, Ipf(2)', s.ipf, px, y + 9.2, pw, { unit: 'kA' });
    k.field('Ext. loop impedance, Ze(2)', s.ze, px, y + 13.8, pw, { unit: 'Ω' });
    k.t('(Note: (1) by enquiry (2) by enquiry or by measurement)', px, y + 18.4, { size: 6.2, color: GREY });
    const sx = px + c3, sw = w - (sx - x);
    k.field('BS (EN)', s.spBs, sx, y, sw); k.field('Type', s.spType, sx, y + 4.6, sw);
    k.field('Rated current', s.spRating, sx, y + 9.2, sw, { unit: 'A' }); k.field('Breaking capacity', s.spKa, sx, y + 13.8, sw, { unit: 'kA' });
    k.y = y + 6 * 4.4;
    k.cb(x, k.y + 1.5, yes(s.otherSources), 'Other sources of supply (as detailed on attached continuation sheet)');
    k.y += 3.2;
  });
}
function particularsSection(k, cert, letter) {
  const p = cert.parts;
  // v0.8: boxes that don't apply print N/A (electrode unless "Installation earth
  // electrode"; OCPD / RCD boxes unless their tick is on; bonding if none needed).
  const NA = 'N/A';
  const el = isElectrode(cert), ocpd = msIsOcpd(cert), rcd = msIsRcd(cert), none = bondNone(cert);
  const svcs = [...BOND_SERVICES, ['Other', 'other']];
  const ticked = svcs.filter(([sv]) => bondTicked(cert, sv));
  const sizes = [...new Set(ticked.map(([sv]) => bondCsaFor(cert, sv)).filter(Boolean))];
  const mainCsa = none ? NA : sizes.length > 1 ? sizes.join(' / ') : (sizes[0] || p.bondCsa);
  k.section(`SECTION ${letter}: PARTICULARS OF INSTALLATION REFERRED TO IN THE ${cert.type === 'EICR' ? 'REPORT' : 'CERTIFICATE'}`, (k, x, w) => {
    const c = w * 0.28;
    k.t('Means of Earthing', x, k.y + 3.2, { size: 7, bold: true });
    k.t('Maximum Demand', x + c, k.y + 3.2, { size: 7, bold: true });
    let y = k.y + 7.6;
    k.cb(x, y, /Distributor/.test(p.means), 'Distributor\u2019s facility');
    k.cb(x, y + 4.4, el, 'Installation earth electrode');
    { const fw = w - c - 2, un = 'kVA / A (Delete as appropriate)'; k.field('Maximum demand (load)', p.maxDemand, x + c, y, fw, { unit: un });
      // v0.33: the A4 unit "kVA / A": strike through the one not used (only when a value is filled in)
      if (String(p.maxDemand ?? '').trim()) { const ux = x + c + fw - (k.tw(un, 7.5) + 1.5) + 1; const kva = p.mdUnit === 'kVA'; const sx = kva ? ux + k.tw('kVA / ', 7.5) : ux; k.line(sx - 0.3, y - 0.9, sx + k.tw(kva ? 'A' : 'kVA', 7.5) + 0.3, y - 0.9, { w: 0.25, color: INK }); } }
    k.t('Details of Installation Earth Electrode (where applicable)', x + c, y + 4.6, { size: 7, bold: true });
    k.field('Type (rod(s), tape etc)', el ? p.elType : NA, x + c, y + 9.2, w - c - 2);
    k.field('Location', el ? p.elLocation : NA, x + c, y + 13.8, w - c - 2);
    k.field('Electrode resistance/impedance, RA/ZA (delete as appropriate)', el ? p.elRa : NA, x + c, y + 18.4, w - c - 2, { unit: 'Ω' });
    k.y = y + 21;
    k.t('Main Protective Conductors', x, k.y + 3.2, { size: 7, bold: true }); k.y += 3.6;
    row(k, x, w, [['Earthing conductor   Material', p.ecMat, 0.45], ['csa', p.ecCsa, 0.25, { unit: 'mm²' }]]);
    k.cb(x + w * 0.72, k.y - 1.2, yes(p.ecOk), 'Connection / continuity verified');
    row(k, x, w, [['Main protective bonding   Material', none ? NA : p.bondMat, 0.45], ['csa', mainCsa, 0.25, { unit: 'mm²' }]]);
    k.cb(x + w * 0.72, k.y - 1.2, !none && yes(p.bondOk), 'Connection / continuity verified');
    // Each bonded service with its own size (unticked = N/A), three to a line.
    const cols = 3, cw = w / cols; const ys = k.y + 3.4;
    BOND_SERVICES.forEach(([sv, name], i) => {
      const on = !none && bondTicked(cert, sv); const cx = x + (i % cols) * cw, cy = ys + Math.floor(i / cols) * 4.6;
      const nx = k.cb(cx, cy, on, 'To ' + name, { size: 7 });
      const v = on ? (bondCsaFor(cert, sv) ? bondCsaFor(cert, sv) + ' mm²' : '') : NA;
      if (v) k.t(v, nx - 1.5, cy, { size: 7.5, color: on ? VALUE : GREY, maxW: cx + cw - nx - 1 });
    });
    k.y = ys + Math.ceil(BOND_SERVICES.length / cols) * 4.6 - 3.4;
    const oth = !none && bondTicked(cert, 'Other');
    row(k, x, w, [['To other   Specify', oth ? p.bondOther : NA, 0.72], ['csa', oth ? bondCsaFor(cert, 'Other') : NA, 0.28, { unit: 'mm²' }]]);
    k.t('Main switch (Isolation device / Switch-fuse / Circuit-breaker / RCD etc.)', x, k.y + 3.4, { size: 7, bold: true }); k.y += 3.8;
    const a = w / 3; y = k.y + 3.4;
    k.field('Location', p.msLocation, x, y, a - 3); k.field('BS (EN)', p.msBs, x, y + 4.6, a - 3); k.field('No of poles', p.msPoles, x, y + 9.2, a - 3);
    k.field('Current rating', p.msCurrent, x, y + 13.8, a - 3, { unit: 'A' }); k.field('Voltage rating', p.msVoltage, x, y + 18.4, a - 3, { unit: 'V' });
    k.t('If overcurrent protective device', x + a, y, { size: 7, bold: true });
    k.field('Device type MCCB / ACB / Fuse(s) / other', ocpd ? p.msType : NA, x + a, y + 4.6, a - 3); k.field('Device rating/setting', ocpd ? p.msRating : NA, x + a, y + 9.2, a - 3, { unit: 'A' }); k.field('Breaking capacity', ocpd ? p.msKa : NA, x + a, y + 13.8, a - 3, { unit: 'kA' });
    k.t('If RCD main switch', x + 2 * a, y, { size: 7, bold: true });
    k.field('RCD Type AC / A / F / B / other', rcd ? showRcdType(p.rcdType) : NA, x + 2 * a, y + 4.6, a); k.field('Rated residual operating current (IΔn)', rcd ? p.rcdIdn : NA, x + 2 * a, y + 9.2, a, { unit: 'mA' });
    k.field('Rated time delay', rcd ? p.rcdDelay : NA, x + 2 * a, y + 13.8, a, { unit: 'ms' }); k.field('Measured operating time', rcd ? p.rcdMs : NA, x + 2 * a, y + 18.4, a, { unit: 'ms' });
    k.field('Breaking capacity', rcd ? (p.rcdKa || '') : NA, x + 2 * a, y + 23, a, { unit: 'kA' }); // v0.33
    k.para('Attach protective device settings where applicable on separate continuation sheet(s).', x + a, y + 19.2, a - 4, { size: 6.6 });
    k.y = y + 24.6;
  });
}

// ---------- Schedules (landscape) ----------
const WIRING = [['A', 'Thermoplastic insulated/ sheathed cables'], ['B', 'Thermoplastic cables in metallic conduit'], ['C', 'Thermoplastic cables in non-metallic conduit'], ['D', 'Thermoplastic cables in metallic trunking'], ['E', 'Thermoplastic cables in non-metallic trunking'], ['F', 'Thermoplastic SWA cables'], ['G', 'Thermosetting SWA cables'], ['H', 'Mineral insulated cables'], ['O', 'Other - please state']];

// v0.33.1: long text in a cell wraps in full (no '…'); the row grows to fit.
// Lines for a left-aligned text cell: always the normal 7.5 pt (never shrunk); long text wraps and the row grows.
const TXT_SZ = 7.5; const txtLh = (sz) => sz * 0.3528 * 1.12;
function cellLines(k, v, w) { const t = String(v ?? ''); if (!t) return null; if (k.tw(t, TXT_SZ) <= w && !/\n/.test(t)) return null; return k.wrap(t, w, TXT_SZ); }
export function rowHeights(k, cols, rows, rowH) {
  return rows.map((r) => { let h = rowH; for (const c of cols) { if (!c.left) continue; const v = r[c.k]; const cell = typeof v === 'object' && v ? v : { v }; if (cell.auto) continue; const ls = cellLines(k, cell.v, c.ww - 2); if (ls) h = Math.max(h, ls.length * txtLh(TXT_SZ) + 1.6); } return h; });
}
function tableGrid(k, cols, rows0, { headH = 26, rowH = 6.2, top, numbered = true, groups = [], bottom = null }) {
  const x = k.x0; let y = top;
  const W = cols.reduce((a, c) => a + c.w, 0); const scale = k.cw / W;
  cols.forEach((c) => (c.ww = c.w * scale));
  // v0.33.1: rows grow for long text; blank padding rows are dropped first if space runs out,
  // and any real rows that still can't fit come back in 'rest' for a continuation sheet.
  let rows = rows0.slice(); let hs = rowHeights(k, cols, rows, rowH);
  const gh0 = groups.length ? 5 : 0; const start = top + gh0 + headH + (numbered ? 3.6 : 0);
  const isBlank = (r) => !r || !Object.keys(r).length;
  if (bottom != null) while (rows.length && start + hs.reduce((a, b) => a + b, 0) > bottom && isBlank(rows[rows.length - 1])) { rows.pop(); hs.pop(); }
  // v0.33.1: before splitting, squeeze the normal (one-line) rows down to 4.6 mm so a tall remark row costs as few other rows as possible
  if (bottom != null && start + hs.reduce((a, b) => a + b, 0) > bottom) { const over = start + hs.reduce((a, b) => a + b, 0) - bottom; const nn = hs.filter((h) => h <= rowH).length; const nh = Math.max(4.6, rowH - over / Math.max(1, nn)); hs = hs.map((h) => (h <= rowH ? nh : h)); }
  let rest = [];
  if (bottom != null) { let tot = 0, n = 0; for (; n < rows.length; n++) { if (n && start + tot + hs[n] > bottom) break; tot += hs[n]; } if (n < rows.length) { rest = rows.slice(n).filter((r) => !isBlank(r)); rows = rows.slice(0, n); hs = hs.slice(0, n); } }
  const rowsTotal = hs.reduce((a, b) => a + b, 0); const ys = []; { let a = 0; for (const h of hs) { ys.push(a); a += h; } }
  // group headers
  const gh = groups.length ? 5 : 0;
  k.rect(x, y, k.cw, headH + gh + (numbered ? 3.6 : 0) + rowsTotal, { lw: 0.35, color: INK });
  let cx = x;
  const colX = []; cols.forEach((c) => { colX.push(cx); cx += c.ww; });
  for (const g of groups) {
    const gx = colX[g.from], gw = colX[g.to] + cols[g.to].ww - gx;
    k.rect(gx, y, gw, g.level === 2 ? gh * 2 : gh, { lw: 0.2 });
    k.t(g.label, gx + gw / 2, y + 3.4 + (g.level === 2 ? gh : 0), { size: 6.8, bold: true, align: 'center', maxW: gw - 1 });
  }
  const hy = y + gh;
  cols.forEach((c, i) => {
    const top2 = c.sub ? hy + gh : hy;
    k.line(colX[i], top2, colX[i], hy + headH + (numbered ? 3.6 : 0) + rowsTotal, { w: 0.2 });
    if (c.vertical) k.t(c.label, colX[i] + c.ww / 2 + 1.1, hy + headH - 1.5, { size: 6.2, angle: 90, maxW: headH - (c.sub ? gh : 0) - 3 });
    else { const ls = k.wrap(c.label, c.ww - 1, 6.4); ls.forEach((s, j) => k.t(s, colX[i] + c.ww / 2, top2 + 4 + j * 2.7, { size: 6.4, align: 'center' })); }
  });
  let ry = hy + headH;
  if (numbered) { k.line(x, ry, x + k.cw, ry, { w: 0.2 }); cols.forEach((c, i) => k.t(String(c.n || ''), colX[i] + c.ww / 2, ry + 2.6, { size: 5.8, color: GREY, align: 'center' })); ry += 3.6; }
  k.line(x, ry, x + k.cw, ry, { w: 0.35, color: INK });
  rows.forEach((r, ri) => {
    const yy = ry + ys[ri]; const rowH = hs[ri];
    if (ri) k.line(x, yy, x + k.cw, yy, { w: 0.15 });
    cols.forEach((c, i) => {
      const v = r[c.k];
      const cell = typeof v === 'object' && v ? v : { v };
      if (cell.flag) k.rect(colX[i] + 0.3, yy + 0.3, c.ww - 0.6, rowH - 0.6, { lw: 0, color: cell.flag === 'red' ? [235, 160, 160] : [240, 205, 140], fill: cell.flag === 'red' ? [252, 225, 225] : [253, 240, 210] });
      if (cell.auto) k.t(cell.v, c.left ? colX[i] + 1 : colX[i] + c.ww / 2, yy + rowH / 2 + 0.75, { size: 7, color: AUTO_GREY, align: c.left ? 'left' : 'center', maxW: c.ww - 1.2 });
      else if (c.tick) k.mark(cell.v, colX[i] + c.ww / 2, yy + rowH / 2 + 0.75, { size: 7.5 });
      else if (c.left && cellLines(k, cell.v, c.ww - 2)) {
        // v0.33.1: wraps in full, whole words only; the row has already grown to fit every line
        const sz = TXT_SZ; const ls = cellLines(k, cell.v, c.ww - 2);
        const lh = txtLh(sz); const y1 = yy + rowH / 2 - (ls.length * lh) / 2 + lh * 0.8;
        ls.forEach((s, j) => k.t(s, colX[i] + 1, y1 + j * lh, { size: sz, color: VALUE }));
      } else k.t(cell.v ?? '', c.left ? colX[i] + 1 : colX[i] + c.ww / 2, yy + rowH / 2 + 0.75, { size: 7.5, color: cell.flag === 'red' ? RED : VALUE, align: c.left ? 'left' : 'center', maxW: c.ww - 1.2 });
    });
  });
  return { end: ry + rowsTotal, rest };
}

function boardHeaderDetails(k, cert, b, certNo) {
  k.y += 1;
  const y0 = k.y; const x = k.x0 + 2;
  k.t('Distribution board/Consumer unit details', x, k.y + 3.6, { size: 8, bold: true }); k.y += 4.2;
  const w = k.cw - 4;
  row(k, x, w, [['DB/CU reference:', b.ref, 0.3], ['Location:', b.location, 0.35], ['Supplied from:', b.suppliedFrom, 0.35]]);
  row(k, x, w, [['Distribution circuit OCPD: BS (EN):', b.ocpdBs, 0.45], ['Type:', b.ocpdType, 0.2], ['Rating/Setting:', b.ocpdRating, 0.35, { unit: 'A' }]]);
  checks(k, x, [['T1', b.spdT1], ['T2', b.spdT2], ['T3†', b.spdT3], ['N/A', b.spdNA]], { label: 'SPD Details: Type(s)*:' });
  row(k, x, w, [['RCD:  BS (EN)', b.rcdBs, 0.3], ['Type', showRcdType(b.rcdType), 0.15], ['Rating', b.rcdRating, 0.18, { unit: 'A' }], ['Rated residual operating current (IΔn):', b.rcdIdn, 0.37, { unit: 'mA' }]]);
  // v0.32: optional per-board maximum demand (only printed when filled in).
  if (String(b.maxDemand ?? '').trim()) row(k, x, w, [['Maximum demand (this board):', b.maxDemand, 0.4, { unit: 'A' }]]);
  k.rect(k.x0, y0, k.cw, k.y - y0 + 0.5, { lw: 0.35, color: INK });
  k.y += 2;
}
function circuitDetailsPage(k, cert, b, certNo, rows, part = 1, parts = 1, cont = false) {
  k.addPage('l');
  contTitle(k, 'GENERIC SCHEDULE OF CIRCUIT DETAILS' + (cont ? ' (continued)' : ''), certNo, sheetTag(b, part, parts), 'Certificate/Report No.');
  boardHeaderDetails(k, cert, b, certNo);
  const cols = [
    { k: 'num', label: 'Circuit number', n: 1, w: 9, vertical: true },
    { k: 'desc', label: 'Circuit description', n: 2, w: 48, left: true },
    { k: 'wiring', label: 'Type of wiring', n: 3, w: 9, vertical: true, sub: 1 },
    { k: 'ref', label: 'Reference method‡', n: 4, w: 9, vertical: true, sub: 1 },
    { k: 'points', label: 'Number of points served', n: 5, w: 9, vertical: true, sub: 1 },
    { k: 'live', label: 'Live (mm²)', n: 6, w: 10, vertical: true, sub: 2 },
    { k: 'cpc', label: 'CPC (mm²)', n: 7, w: 10, vertical: true, sub: 2 },
    { k: 'bs', label: 'BS (EN)', n: 8, w: 14, vertical: true, sub: 1 },
    { k: 'type', label: 'Type', n: 9, w: 9, vertical: true, sub: 1 },
    { k: 'rating', label: 'Rating (A)', n: 10, w: 9, vertical: true, sub: 1 },
    { k: 'bka', label: 'Breaking capacity (kA)', n: 11, w: 9, vertical: true, sub: 1 },
    { k: 'maxZs', label: 'Maximum permitted Zs (Ω)§', n: 12, w: 12, vertical: true, sub: 1 },
    { k: 'rcdBs', label: 'BS (EN)', n: 13, w: 14, vertical: true, sub: 1 },
    { k: 'rcdType', label: 'Type', n: 14, w: 9, vertical: true, sub: 1 },
    { k: 'rcdIdn', label: 'IΔn (mA)', n: 15, w: 9, vertical: true, sub: 1 },
    { k: 'rcdRating', label: 'Rating (A)', n: 16, w: 9, vertical: true, sub: 1 },
  ];
  const groups = [{ label: 'Conductor details', from: 2, to: 6 }, { label: 'Overcurrent protective device', from: 7, to: 11 }, { label: 'RCD', from: 12, to: 15 }];
  const top = k.y;
  const notes = ['* SPD Type. Where a combined T1 + T2 or T2 + T3 device is installed, indicate by ticking both Type boxes.', '† Where a T3 SPD is installed to protect sensitive equipment, enter details in \u2018Remarks\u2019, column 31, of the Schedule of Test Results. (See Section 534 of BS 7671:2018+A4:2026.)', '‡ See Table 4A2 of Appendix 4 of BS 7671:2018+A4:2026.', '§ Where the maximum permitted earth fault loop impedance value stated in column 12 is taken from a source other than the tabulated values given in Chapter 41 of BS 7671:2018+A4:2026, state the source of the data in the appropriate cell for the circuit in the \u2018Remarks\u2019, column 31, of the Schedule of Test Results.'];
  const below = 2 + 4 + 10.5 + measure(k, () => notes.forEach((s) => { k.y += k.para(s, k.x0, k.y + 2, k.cw, { size: 5.8, gap: 0 }); }));
  const rowH = rowFit(k, 5 + 34 + 3.6, below, rows.length);
  // second-level "csa" label
  const { end, rest } = tableGrid(k, cols, rows, { top, groups, headH: 34, rowH, bottom: k.H - 13 - below });
  // csa sub-heading
  const W = cols.reduce((a, c) => a + c.ww, 0); let cx = k.x0; const xs = cols.map((c) => { const v = cx; cx += c.ww; return v; });
  k.rect(xs[5], top + 5, cols[5].ww + cols[6].ww, 4.5, { lw: 0.2 }); k.t('csa', xs[5] + (cols[5].ww + cols[6].ww) / 2, top + 8.4, { size: 6.5, bold: true, align: 'center' });
  k.y = end + 2;
  // wiring codes
  k.t('CODES FOR TYPES OF WIRING', k.x0 + k.cw / 2, k.y + 3, { size: 7, bold: true, align: 'center' }); k.y += 4;
  const cw = k.cw / WIRING.length;
  k.rect(k.x0, k.y, k.cw, 9, { lw: 0.25 });
  WIRING.forEach(([c, t], i) => { if (i) k.line(k.x0 + i * cw, k.y, k.x0 + i * cw, k.y + 9); k.t(c, k.x0 + i * cw + cw / 2, k.y + 3, { size: 7, bold: true, align: 'center' }); k.wrap(t, cw - 2, 5.8).slice(0, 2).forEach((s, j) => k.t(s, k.x0 + i * cw + cw / 2, k.y + 5.6 + j * 2.4, { size: 5.8, align: 'center' })); });
  k.y += 10.5;
  notes.forEach((s) => { k.y += k.para(s, k.x0, k.y + 2, k.cw, { size: 5.8, gap: 0 }); });
  if (rest.length) circuitDetailsPage(k, cert, b, certNo, rest, part, parts, true);
}
function testResultsPage(k, cert, b, certNo, rows, part = 1, parts = 1, cont = false) {
  k.addPage('l');
  contTitle(k, 'GENERIC SCHEDULE OF TEST RESULTS' + (cont ? ' (continued)' : ''), certNo, sheetTag(b, part, parts), 'Certificate/Report No.');
  // header box: left board details, right instruments
  const y0 = k.y + 1; k.y = y0; const x = k.x0 + 2; const lw = k.cw * 0.6;
  k.t('Distribution board/Consumer unit details', x, k.y + 3.6, { size: 8, bold: true }); k.y += 4.2;
  row(k, x, lw - 4, [['DB/CU reference:', b.ref, 0.34], ['Zdb', b.zdb, 0.33, { unit: 'Ω' }], ['Ipf', b.ipf, 0.33, { unit: 'kA' }]]);
  checks(k, x, [['Correct polarity', b.polOk], ['Phase sequence', b.phaseSeq]], { label: 'Confirmed:' });
  checks(k, x, [['Operational status confirmed¶', b.spdOk], ['N/A', !!(b.spdNA || b.spdStatusNA)]], { label: 'SPD:' });
  const yL = k.y; k.y = y0;
  const ix = k.x0 + lw + 2, iw = k.cw - lw - 4; const ins = cert.instruments || {};
  k.t('Details of test instruments used (serial and/or asset numbers)', ix, k.y + 3.6, { size: 7.5, bold: true }); k.y += 4;
  for (const [lab, key] of [['Multifunction:', 'multi'], ['Continuity:', 'continuity'], ['Insulation resistance:', 'ir'], ['Earth fault loop impedance:', 'efli'], ['RCD:', 'rcd'], ['Earth electrode resistance:', 'electrode']]) { k.field(lab, ins[key] || '', ix, k.y + 3, iw, { size: 6.8, vsize: 7.5 }); k.y += 3.9; }
  k.y = Math.max(yL, k.y) + 1;
  k.line(k.x0 + lw, y0, k.x0 + lw, k.y, { w: 0.25 });
  k.rect(k.x0, y0, k.cw, k.y - y0, { lw: 0.35, color: INK });
  k.y += 2;
  const cols = [
    { k: 'num', label: 'Circuit number', n: 17, w: 9, vertical: true },
    { k: 'desc', label: 'Circuit description', n: '', w: 30, left: true }, // v0.33.1: same as column 2 of the circuit details, to find your way
    { k: 'r1', label: 'r1 (line)', n: 18, w: 11, vertical: true, sub: 2 },
    { k: 'rn', label: 'rn (neutral)', n: 19, w: 11, vertical: true, sub: 2 },
    { k: 'r2', label: 'r2 (CPC)', n: 20, w: 11, vertical: true, sub: 2 },
    { k: 'r1r2', label: '(R1 + R2)', n: 21, w: 11, vertical: true, sub: 2 },
    { k: 'R2', label: 'R2', n: 22, w: 10, vertical: true, sub: 2 },
    { k: 'irV', label: 'Test voltage‡‡  V', n: 23, w: 10, vertical: true, sub: 1 },
    { k: 'irLL', label: 'Live - Live  (MΩ)', n: 24, w: 11, vertical: true, sub: 1 },
    { k: 'irLE', label: 'Live - Earth  (MΩ)', n: 25, w: 11, vertical: true, sub: 1 },
    { k: 'pol', label: 'Polarity#', n: 26, w: 9, vertical: true, tick: true },
    { k: 'zs', label: 'Maximum measured', n: 27, w: 12, vertical: true, sub: 1 },
    { k: 'rcdMs', label: 'Disconnection time (ms)**', n: 28, w: 12, vertical: true, sub: 1 },
    { k: 'rcdBtn', label: 'Test button operation', n: 29, w: 10, vertical: true, sub: 1, tick: true },
    { k: 'afddBtn', label: 'Manual test button operation††', n: 30, w: 11, vertical: true, sub: 1, tick: true },
    { k: 'remarks', label: 'Remarks — include details of circuits and/or installed equipment vulnerable to damage when testing (continue on additional page(s) if necessary)', n: 31, w: 32, left: true },
  ];
  const groups = [{ label: 'Continuity (Ω)', from: 2, to: 6 }, { label: 'Insulation resistance', from: 7, to: 9 }, { label: 'Zs (Ω)', from: 11, to: 11 }, { label: 'RCD', from: 12, to: 13 }, { label: 'AFDD', from: 14, to: 14 }];
  const top = k.y;
  const rowH = rowFit(k, 5 + 30 + 3.6, 2 + 7 + 5 * 2.5 + 1, rows.length);
  const below = 2 + 7 + 5 * 2.5 + 1;
  const { end, rest } = tableGrid(k, cols, rows, { top, groups, headH: 30, rowH, bottom: k.H - 13 - below });
  let cx = k.x0; const xs = cols.map((c) => { const v = cx; cx += c.ww; return v; });
  k.rect(xs[2], top + 5, cols[2].ww * 3, 4.5, { lw: 0.2 }); k.t('Ring final circuit', xs[2] + cols[2].ww * 1.5, top + 8.4, { size: 6.2, bold: true, align: 'center' });
  k.rect(xs[5], top + 5, cols[5].ww + cols[6].ww, 4.5, { lw: 0.2 }); k.t('(R1 + R2) or R2', xs[5] + (cols[5].ww + cols[6].ww) / 2, top + 8.4, { size: 6, bold: true, align: 'center' });
  k.y = end + 2;
  // v0.33: the EIC 'same person' case signs as the designer; use that signature and name
  const same = cert.type === 'EIC' && yes((cert.eic || {}).samePerson); const SG = cert.sigs || {};
  const s = (same ? SG.designer : SG.inspector) || SG.inspector || SG.designer || SG.mw || {};
  const PP = cert.people || {}; const tb = ((same ? PP.designer : PP.inspector) || PP.inspector || {}).name || '';
  k.field('Tested by name (Capitals):', tb.toUpperCase(), k.x0, k.y + 4, 110);
  sig(k, k.x0 + 120, k.y + 4, 80, s); k.field('Date:', fmtDate(s.date), k.x0 + 205, k.y + 4, 40);
  k.y += 7;
  ['¶ Not all SPDs have visible functionality indication.', '# An \u2018X\u2019, denoting incorrect polarity, cannot be entered on to this schedule when issued with an Electrical Installation Certificate.', '** RCD effectiveness is verified using an alternating current test at rated residual operating current (IΔn).', '‡‡ Where this schedule forms part of an Electrical Installation Certificate, insulation resistance testing should be performed at the test voltage stated in Table 64.', '†† Not all AFDDs have a test button.'].forEach((t) => { k.t(t, k.x0, k.y + 2, { size: 5.8 }); k.y += 2.5; });
  if (rest.length) testResultsPage(k, cert, b, certNo, rest, part, parts, true); // v0.33.1: only if a row couldn't fit at all
}
// v0.25: adjustable breakers: the settings go in the circuit's Remarks (col 31), e.g. "MCCB Ir 200 A, Im 2000 A".
// That's also where the form asks for the source of a max Zs that isn't from the Chapter 41 tables.
export function adjRemark(c) {
  const d = deviceById(c && c.device); if (!d || !d.adj || isSpare(c)) return '';
  const n = (v) => String(v ?? '').trim(); const ok = (v) => n(v) && !/^n\/?a$/i.test(n(v));
  const parts = [ok(c.rating) ? `${d.adj === 'mpcb' ? 'set' : 'Ir'} ${n(c.rating)} A` : '', ok(c.im) ? `Im ${n(c.im)} A` : '',
    d.adj === 'mccb' && ok(c.ig) ? `Ig ${n(c.ig)} A` : '', d.adj === 'mccb' && ok(c.ig) && ok(c.tg) ? `tg ${n(c.tg)} s` : ''].filter(Boolean);
  if (!ok(c.im) && !(d.adj === 'mccb' && ok(c.ig))) return '';
  return `${d.adj === 'mpcb' ? 'MPCB' : 'MCCB'} ${parts.join(', ')}`;
}
export function scheduleRows(cert, b, flags = false) {
  const ctx = { earthing: cert.supply && cert.supply.earthing, zdb: b.zdb };
  return b.circuits.map((c) => {
    const spare = isSpare(c);
    const lim = spare ? { value: null } : limitZs(c, ctx);
    const r = { ...c, maxZs: spare ? (c.maxZsOverride || '') : (lim.value != null ? lim.value.toFixed(2) : (c.maxZsOverride || '')) };
    // v0.10: spare way: empty boxes print an automatic N/A in light grey (typed values as typed).
    // v0.18.4: also the ring boxes (r1, rn, r2) of a circuit that isn't a ring final.
    for (const f of FIELDS) if (autoNA(c, f.k)) r[f.k] = { v: 'N/A', auto: true };
    { const ar = adjRemark(c); if (ar && !String(c.remarks || '').includes(ar)) r.remarks = [String(c.remarks || '').trim().replace(/\.$/, ''), ar].filter(Boolean).join('. '); }
    if (typeof r.rcdType === 'string') r.rcdType = showRcdType(r.rcdType); // v0.35.2: 'A-S' prints 'A S'
    if (r.type === 'adj') r.type = ''; // v0.20: MPCB/MCCB 'adj' is an app code, not a form Type
    if (flags && !spare) {
      const zs = parseFloat(c.zs);
      if (lim.value != null && !isNaN(zs) && zs > lim.value) r.zs = { v: c.zs, flag: 'red' };
    }
    return r;
  });
}
function pad(rows, n) { const out = rows.slice(); while (out.length < n) out.push({}); return out; }
// Schedules (v0.16 order): board by board; within a board all its Circuit
// Details sheets, then its Test Results sheets in the same order, so
// sheet n of one matches sheet n of the other. 16 circuits a sheet.
export const PER_SHEET = 16;
export function scheduleSheets(cert) {
  const out = [];
  for (const b of cert.boards || []) {
    const rows = scheduleRows(cert, b, !!cert.pdfFlags);
    const parts = Math.max(1, Math.ceil(rows.length / PER_SHEET));
    for (let i = 0; i < parts; i++) out.push({ b, rows: pad(rows.slice(i * PER_SHEET, (i + 1) * PER_SHEET), 12), part: i + 1, parts });
  }
  return out;
}
// Page order for the schedules: [{ kind: 'cd' | 'tr', b, rows, part, parts }].
export function scheduleOrder(cert) {
  const sheets = scheduleSheets(cert); const out = [];
  for (const b of cert.boards || []) {
    const mine = sheets.filter((s) => s.b === b);
    for (const s of mine) out.push({ kind: 'cd', ...s });
    for (const s of mine) out.push({ kind: 'tr', ...s });
  }
  return out;
}
function schedules(k, cert, certNo) {
  // v0.16: board by board — all of DB1 (its circuit details sheets, then its test
  // results sheets), then all of DB2, and so on. Before, every board's circuit
  // details came first and the test results followed, so the boards were mixed.
  for (const g of scheduleOrder(cert)) {
    if (g.kind === 'cd') circuitDetailsPage(k, cert, g.b, certNo, g.rows, g.part, g.parts);
    else testResultsPage(k, cert, g.b, certNo, g.rows, g.part, g.parts);
  }
  bondingSchedule(k, cert, certNo);
  sourcesSheet(k, cert, certNo);
}
// v0.5: Schedule of supplementary bonding. The IET model forms record
// supplementary bonding only as an inspection item, so this is printed as
// a continuation sheet after the test results (certificate number and
// page X of Y on every page). Printed only when something is recorded.
export const bondRows = (cert) => (cert.bondingNA ? [] : (cert.bonding || []).filter((b) => b && (b.location || b.parts || b.reading)));
function bondingSchedule(k, cert, certNo) {
  const list = bondRows(cert); if (!list.length) return;
  const cols = [['No.', 10], ['Location', 34], ['Parts bonded (extraneous / exposed-conductive-parts)', 74], ['Conductor csa (mm²)', 18], ['Material', 18], ['Continuity (Ω)', 18], ['Verified', 18]];
  const W = cols.reduce((a, c) => a + c[1], 0);
  let part = 0;
  const start = () => {
    k.addPage('p'); part++;
    contTitle(k, 'SCHEDULE OF SUPPLEMENTARY BONDING', certNo, 'Continuation sheet' + (part > 1 ? ` ${part}` : '') + ' · Regulation 415.2 and Part 7 (e.g. Section 701)');
    const y = k.y; const sc = k.cw / W; let x = k.x0;
    k.rect(k.x0, y, k.cw, 9, { lw: 0.35, color: INK, fill: [238, 238, 238] });
    cols.forEach(([lab, w]) => { const ls = k.wrap(lab, w * sc - 2, 6.8, true); ls.slice(0, 2).forEach((s, j) => k.t(s, x + (w * sc) / 2, y + 3.8 + j * 2.9 - (ls.length > 1 ? 0.9 : -0.6), { size: 6.8, bold: true, align: 'center' })); if (x > k.x0) k.line(x, y, x, y + 9, { w: 0.2 }); x += w * sc; });
    k.y = y + 9;
  };
  start();
  const sc = k.cw / W;
  list.forEach((b, i) => {
    const vals = [String(i + 1), b.location || '', b.parts || '', b.csa || '', b.material || '', b.reading || '', b.verified ? '✓' : ''];
    const wrapped = vals.map((v, j) => (j === 1 || j === 2 ? k.wrap(v, cols[j][1] * sc - 2.4, 8) : [v]));
    const h = Math.max(7, Math.max(...wrapped.map((l) => l.length)) * 3.6 + 2.6);
    if (k.y + h > k.H - 22) start();
    k.rect(k.x0, k.y, k.cw, h, { lw: 0.2 });
    let x = k.x0;
    cols.forEach(([, w], j) => {
      const ww = w * sc; if (j) k.line(x, k.y, x, k.y + h, { w: 0.2 });
      if (j === 6) k.mark(vals[6], x + ww / 2, k.y + 4.6, { size: 8 });
      else if (j === 1 || j === 2) wrapped[j].forEach((s, n) => k.t(s, x + 1.2, k.y + 4.6 + n * 3.6, { size: 8, color: VALUE }));
      else k.t(vals[j], x + ww / 2, k.y + 4.6, { size: 8, color: VALUE, align: 'center', maxW: ww - 2 });
      x += ww;
    });
    k.y += h;
  });
  k.y += 3;
  k.y += k.para('Supplementary bonding conductors: minimum csa per Regulation 544.2 (2.5 mm² copper with mechanical protection, otherwise 4 mm²). Resistance R between simultaneously accessible parts must satisfy Regulation 415.2.2: R ≤ 50 V / Ia (for RCD-protected circuits, Ia = IΔn).', k.x0, k.y + 2, k.cw, { size: 6.6, color: GREY });
  const s = (cert.sigs || {}).inspector || (cert.sigs || {}).designer || {};
  const nm = ((cert.people && (cert.people.inspector || cert.people.designer)) || {}).name || '';
  k.y += 4;
  k.field('Tested by name (Capitals):', nm.toUpperCase(), k.x0, k.y + 4, 92);
  sig(k, k.x0 + 96, k.y + 4, 60, s); k.field('Date:', fmtDate(s.date), k.x0 + 160, k.y + 4, 30); k.y += 7;
}
// v0.14: other sources of supply (Section F/I tick "as detailed on attached
// continuation sheet"): one block per source, SRC_PER_PAGE to a page.
export const SRC_PER_PAGE = 4;
export const sourceSheetCount = (cert) => (sourceRows(cert).length ? Math.ceil(sourceRows(cert).length / SRC_PER_PAGE) : 0);
function sourcesSheet(k, cert, certNo) {
  const list = sourceRows(cert); if (!list.length) return;
  const total = sourceSheetCount(cert);
  const labW = 52;
  list.forEach((o, i) => {
    if (i % SRC_PER_PAGE === 0) {
      const part = i / SRC_PER_PAGE + 1;
      k.addPage('p');
      contTitle(k, 'OTHER SOURCES OF SUPPLY (continuation sheet)', certNo, 'Continuation sheet' + (total > 1 ? ` ${part} of ${total}` : '') + ' · as referred to under Supply characteristics and earthing arrangements');
    }
    const type = o.type === 'Other' && o.typeOther ? 'Other: ' + o.typeOther : o.type;
    const rows = [['Type of source', type, 1], ['Make and model', o.make, 1], ['Rating', o.kw ? o.kw + ' kW' : '', 1], ['Means of isolation and location', o.isolation, 2], ['G98 / G99 notification ref.', o.ref, 1], ['Notes', o.notes, 2]];
    k.rect(k.x0, k.y, k.cw, 7, { lw: 0.35, color: INK, fill: [238, 238, 238] });
    k.t('Source ' + (i + 1), k.x0 + 2, k.y + 4.8, { size: 8.5, bold: true });
    k.y += 7;
    for (const [lab, v, maxL] of rows) {
      const val = String(v ?? '').trim();
      const lines = val ? k.wrap(val, k.cw - labW - 4, 8).slice(0, maxL) : [];
      const rh = maxL > 1 ? 10.5 : 7;
      k.rect(k.x0, k.y, k.cw, rh, { lw: 0.2 });
      k.line(k.x0 + labW, k.y, k.x0 + labW, k.y + rh, { w: 0.2 });
      k.t(lab, k.x0 + 1.5, k.y + 4.6, { size: 7.2, maxW: labW - 3 });
      if (lines.length) lines.forEach((l, n) => k.t(l, k.x0 + labW + 2, k.y + 4.6 + n * 3.6, { size: 8, color: VALUE }));
      else k.t('N/A', k.x0 + labW + 2, k.y + 4.6, { size: 8, color: AUTO_GREY });
      k.y += rh;
    }
    k.y += 5;
    if ((i + 1) % SRC_PER_PAGE === 0 || i === list.length - 1) {
      k.y += k.para('Where an installation has an additional source of supply (e.g. PV, battery storage or a generator), Chapter 55 and Section 551 apply; warning notices at the origin, meter position and consumer unit (Regulation 514.15) and isolation of every source (Chapter 46 / Section 537) should be confirmed. Generating units are notified to the DNO under ENA EREC G98 or G99.', k.x0, k.y, k.cw, { size: 6.6, color: GREY });
    }
  });
}
const contSheets = (cert) => (cert.extraSheets || 0) + (bondRows(cert).length ? Math.ceil(bondRows(cert).length / 25) : 0) + sourceSheetCount(cert);
const contWhat = (cert, iCont = 0) => { const w = [iCont ? 'Section I comments' : '', bondRows(cert).length ? 'supplementary bonding' : '', sourceRows(cert).length ? 'other sources of supply' : ''].filter(Boolean); return w.length ? ` (incl. ${w.join(' and ')})` : ''; };

// v0.33: a paragraph with **bold** parts, wrapped word by word. Returns its height.
function richPara(k, text, x, y, w, size) {
  const words = []; text.split('**').forEach((part, i) => part.split(/\s+/).filter(Boolean).forEach((t) => words.push([t, i % 2 === 1])));
  const step = k.lh(size); const sp = k.tw(' ', size); let cx = x, line = 0;
  for (const [t, b] of words) { const tw = k.tw(t, size, b); if (cx > x && cx + tw > x + w) { line++; cx = x; } k.t(t, cx, y + line * step, { size, bold: b }); cx += tw + sp; }
  return (line + 1) * step;
}
function guidancePage(k, kind) {
  const g = GUIDANCE[kind];
  k.addPage('p');
  k.t(g.title, k.x0, k.y + 5, { size: 12, bold: true }); k.y += 9;
  if (g.notes) { k.t(g.notes.heading, k.x0, k.y + 3, { size: 9, bold: true }); k.y += 5; for (const p of g.notes.paras) k.y += k.para(p, k.x0, k.y + 2, k.cw, { size: 8.4, gap: 1.6 }); k.y += 3; } // v0.33: MW notes, as on the A4 form
  k.t(g.heading, k.x0, k.y + 3, { size: 9, bold: true }); k.y += 6;
  for (const p of g.paras) { k.y += (p.includes('**') ? richPara(k, p, k.x0, k.y + 2, k.cw, 8.4) + 1.6 : k.para(p, k.x0, k.y + 2, k.cw, { size: 8.4, gap: 1.6 })); if (k.y > k.H - 20) { k.addPage('p'); } }
}
function photosPages(k, photos, certNo) {
  if (!photos || !photos.length) return;
  k.addPage('p'); contTitle(k, 'PHOTOGRAPHS', certNo);
  let col = 0; const w = (k.cw - 6) / 2, h = w * 0.75;
  for (const p of photos) {
    if (k.y + h + 8 > k.H - 14) { k.addPage('p'); contTitle(k, 'PHOTOGRAPHS (continued)', certNo); col = 0; }
    const x = k.x0 + col * (w + 6);
    k.image(p.dataUrl, x, k.y, w, h, 'JPEG'); k.rect(x, k.y, w, h, { lw: 0.2 });
    if (p.caption) k.t(p.caption, x, k.y + h + 3.5, { size: 7.5, maxW: w });
    if (col) k.y += h + 7; col = 1 - col;
  }
}

// ---------- EIC ----------
function eic(k, cert, profile) {
  const no = cert.number; const E = cert.eic; const P = cert.people; const S = cert.sigs || {};
  brandStrip(k, profile, 'ELECTRICAL INSTALLATION CERTIFICATE', no, '(See the guidance for recipients included with this certificate)');
  k.section('SECTION A: DETAILS OF THE CLIENT', (k, x, w) => textBlock(k, x, w, '', [cert.client.name, cert.client.address].filter(Boolean).join(', ')));
  k.section('SECTION B: INSTALLATION DETAILS', (k, x, w) => {
    k.t('INSTALLATION ADDRESS', x, k.y + 3.2, { size: 7, bold: true }); k.y += 3.4;
    textBlock(k, x, w, '', [cert.install.address, cert.install.postcode].filter(Boolean).join(', '));
    k.t('DESCRIPTION AND EXTENT OF THE INSTALLATION', x, k.y + 3.2, { size: 7, bold: true }); k.y += 3.4;
    const yb = k.y; const tw = w * 0.74;
    textBlock(k, x, tw, 'Description of installation:', cert.install.description);
    textBlock(k, x, tw, 'Extent of installation covered by this Certificate:', cert.install.extent, { minLines: 2 });
    const ye = k.y; let yy = yb + 4;
    // v0.33: A4 wording 'Adding to…' (the saved value stays 'Addition to…' so old certs match)
    for (const [t, lab] of [['New installation', 'New installation'], ['Addition to an existing installation', 'Adding to an existing installation'], ['Alteration to an existing installation', 'Alteration to an existing installation']]) { k.cb(x + w * 0.77, yy, cert.install.extentType === t, lab, { size: 7 }); yy += 5; }
    k.y = Math.max(ye, yy);
    k.t('(Use continuation sheet if necessary)   See continuation sheet No.: ' + (E.contSheet || '……'), x, k.y + 2.5, { size: 6.5, color: GREY }); k.y += 3.5;
  });
  k.section('SECTION C: CERTIFICATION SIGNATORIES', (k, x, w) => {
    const decl = (who, what) => `I${who === 'design' ? '/We' : ''}, being the person${who === 'design' ? '(s)' : ''} responsible for the ${what} of the electrical installation (as indicated by my${who === 'design' ? '/our' : ''} signature${who === 'design' ? 's' : ''} below), particulars of which are described above, having exercised reasonable skill and care when carrying out the ${what}, hereby CERTIFY that the ${who === 'inspection' ? 'work' : what + ' work'} for which I${who === 'design' ? '/we have' : ' have'} been responsible is to the best of my${who === 'design' ? '/our' : ''} knowledge and belief in accordance with BS 7671:2018, amended to ${cert.amendedTo} (date) except for the departures, if any, detailed as follows:`;
    const signLine = (s, name, role) => {
      const y = k.y + 7.5; sig(k, x, y, w * 0.30, s); k.field('Date:', fmtDate(s && s.date), x + w * 0.32, y, w * 0.14); k.field('Name (IN BLOCK CAPITALS):', (name || '').toUpperCase(), x + w * 0.48, y, w * 0.405); k.t(role, x + w, y, { size: 7, bold: true, align: 'right' }); k.y += 9;
    };
    // v0.33: the liability line and 'For … of the installation:' under each signatory, as on the A4 form
    const liab = (what) => { k.t('The extent of liability of the signatory or signatories is limited to the work described above as the subject of this Certificate.', x, k.y + 2.5, { size: 6.5 }); k.y += 3; k.t(`For ${what} of the installation:`, x, k.y + 2.8, { size: 7 }); k.y += 1; };
    k.t('FOR DESIGN', x, k.y + 3.2, { size: 7.5, bold: true }); k.y += 3.6;
    k.y += k.para(decl('design', 'design'), x, k.y + 2.5, w, { size: 6.8 });
    textBlock(k, x, w, 'Details of departures from BS 7671 (Regulations 120.3, 133.1.2, 133.1.3 and 133.5):', E.designDepartures);
    textBlock(k, x, w * 0.78, 'Details of permitted exceptions (Regulation 411.3.3). Where applicable, a suitable risk assessment(s) must be attached to this Certificate.', E.exceptions);
    k.cb(x + w * 0.8, k.y - 1.5, yes(E.riskAttached), 'Risk assessment attached', { size: 7 });
    k.t('The extent of liability of the signatory or signatories is limited to the work described above as the subject of this Certificate.', x, k.y + 2.5, { size: 6.5 }); k.y += 3;
    k.t('For the DESIGN of the installation:  **(Where there is mutual responsibility for the design)', x, k.y + 2.8, { size: 7 }); k.y += 1;
    signLine(S.designer, P.designer.name, 'Designer No 1');
    if (P.designer2 && P.designer2.name) signLine(S.designer2, P.designer2.name, 'Designer No 2**'); else { k.t('Designer No 2**:  N/A', x, k.y + 3, { size: 7, color: GREY }); k.y += 4.5; }
    const same = yes(E.samePerson);
    k.t('FOR CONSTRUCTION', x, k.y + 3.2, { size: 7.5, bold: true }); k.y += 3.6;
    k.y += k.para(decl('construction', 'construction'), x, k.y + 2.5, w, { size: 6.8 });
    textBlock(k, x, w, 'Details of departures from BS 7671 (Regulations 120.3, 133.1.2, 133.1.3 and 133.5):', E.constructionDepartures);
    liab('CONSTRUCTION');
    signLine(same ? S.designer : S.constructor, same ? P.designer.name : P.constructor.name, 'Constructor');
    k.t('FOR INSPECTION AND TESTING', x, k.y + 3.2, { size: 7.5, bold: true }); k.y += 3.6;
    k.y += k.para(decl('inspection', 'inspection & testing'), x, k.y + 2.5, w, { size: 6.8 });
    textBlock(k, x, w, 'Details of departures from BS 7671 (Regulations 120.3, 133.1.2, 133.1.3 and 133.5):', E.inspectionDepartures);
    liab('INSPECTION AND TESTING');
    signLine(same ? S.designer : S.inspector, same ? P.designer.name : P.inspector.name, 'Inspector');
  });
  k.section('SECTION D: NEXT INSPECTION', (k, x, w) => { k.y += k.para(`I/We, the designer(s), recommend that this installation is further inspected and tested after an interval of not more than  ${E.nextInterval || '……'}  (years/months).`, x, k.y + 3, w, { size: 7.5 }); });
  k.addPage('p'); contTitle(k, 'ELECTRICAL INSTALLATION CERTIFICATE (continued)', no);
  k.section('SECTION E: PARTICULARS OF SIGNATORIES IN SECTION C', (k, x, w) => {
    const same = yes(E.samePerson);
    const who = [['Designer (No 1)', P.designer], ['Designer (No 2) (if applicable)', P.designer2], ['Constructor', same ? P.designer : P.constructor], ['Inspector', same ? P.designer : P.inspector]];
    for (const [lab, p] of who) {
      const [l1, l2] = lab.split(' (if');
      k.t(l1, x, k.y + 3.4, { size: 7.5, bold: true }); if (l2) k.t('(if' + l2, x, k.y + 6.6, { size: 6.5, color: GREY });
      const xx = x + w * 0.22, ww = w * 0.78;
      if (l2 && !(p && p.name)) { row(k, xx, ww, [['Name:', 'N/A', 1]]); k.y += 1.6; continue; }
      row(k, xx, ww, [['Name:', p && p.name, 0.45], ['For/on behalf of:', p && p.for, 0.55]]);
      row(k, xx, ww, [['Address:', p && p.address, 1]]);
      row(k, xx, ww, [['Postcode:', p && p.postcode, 0.5], ['Tel No:', p && p.tel, 0.5]]);
      k.y += 0.8;
    }
  });
  supplySection(k, cert, 'F');
  particularsSection(k, cert, 'G');
  k.section('SECTION H: SCHEDULE OF INSPECTIONS', (k, x, w) => {
    k.t('Outcome: tick = acceptable, N/A = not applicable', x + w, k.y - 0.8, { size: 6.5, color: GREY, align: 'right' });
    const half = Math.ceil(EIC_ITEMS.length / 2); const cw = w / 2;
    const y0 = k.y + 1;
    EIC_ITEMS.forEach(([n, t], i) => {
      const col = i < half ? 0 : 1; const yy = y0 + (i % half) * 4.3 + 3.2; const xx = x + col * cw;
      k.t(n, xx, yy, { size: 7 }); k.t(t, xx + 9, yy, { size: 7, maxW: cw - 24 });
      k.rect(xx + cw - 13, yy - 3.1, 10, 4, { lw: 0.2 }); k.mark(cert.inspections[n], xx + cw - 8, yy, { size: 7.5 });
    });
    k.y = y0 + half * 4.3 + 1;
  });
  // v0.34: Section I. New installation with nothing typed: grey "N/A – new installation".
  // A comment too long to leave Section J on page 2 goes WHOLLY to a continuation sheet
  // (Section I then says "See continuation sheet"); a short one stays here.
  const secI = withNotices(cert, cert.comments);
  const nb = (cert.boards || []).length;
  const iw = k.cw - 3.6; const ix = k.x0 + 1.8;
  const iBody = (txt) => (k, x, w) => textBlock(k, x, w, '', txt, { minLines: 2 });
  let iCont = 0;
  const jBody = (k, x, w) => {
    k.y += k.para(`${contSheets(cert) + iCont}  Continuation sheet(s)${contWhat(cert, iCont)}    1  Schedule(s) of Inspection    ${nb}  Schedule(s) of Circuit Details and Schedule(s) of Test Results`, x, k.y + 3, w, { size: 7.5 }) + 1;
    k.y += k.para('The schedule(s) and continuation sheet(s) listed are part of this document and this certificate is valid only when they are attached to it.', x, k.y + 3, w, { size: 7 });
  };
  if (secI.trim()) {
    const hI = measure(k, () => iBody(secI)(k, ix, iw)) + 7.2;
    const hJ = measure(k, () => jBody(k, ix, iw)) + 7.2;
    if (k.y + hI + hJ > k.H - k.M - 8 + 6) iCont = commentPages(k, secI);
  }
  const I_TITLE = 'SECTION I: COMMENTS ON EXISTING INSTALLATION (in the case of an addition or alteration see Regulation 644.1.2):';
  if (iCont) k.section(I_TITLE, iBody(`See continuation sheet${iCont > 1 ? 's' : ''} (Section I: comments on existing installation), after the schedules.`));
  else if (!secI.trim() && isNewInstall(cert)) k.section(I_TITLE, (k, x, w) => { const y0 = k.y; textBlock(k, x, w, '', '', { minLines: 2 }); k.t(SECTION_I_NA, x + 0.5, y0 + 3.4, { size: 8.5, color: AUTO_GREY }); });
  else k.section(I_TITLE, iBody(secI));
  k.section('SECTION J: SCHEDULES', jBody, { minGap: -6 }); // v0.33: let Section J use the space above the footer so it stays on page 2, as on the A4 form
  schedules(k, cert, no);
  if (iCont) commentsSheet(k, secI, no, iCont);
}
// v0.34: Section I comments continuation sheet (portrait): the whole comment, full wrap.
const CONT_LH = 4.2;
function commentPages(k, text) {
  const per = Math.floor((k.H - 22 - 40) / CONT_LH); // room under the title on each A4 page
  return Math.max(1, Math.ceil(k.wrap(text, k.cw - 4.6, 8.5).length / per));
}
function commentsSheet(k, text, certNo, total) {
  let lines = null; let part = 0; let i = 0;
  while (!lines || i < lines.length || part === 0) {
    k.addPage('p'); part++;
    if (!lines) lines = k.wrap(text, k.cw - 4.6, 8.5); // wrap on the portrait page (the schedules before it are landscape)
    contTitle(k, 'COMMENTS ON EXISTING INSTALLATION (continuation sheet)', certNo, 'Continuation sheet' + (total > 1 ? ` ${part} of ${total}` : '') + ' · Section I (in the case of an addition or alteration see Regulation 644.1.2)');
    const y0 = k.y; k.y += 2;
    while (i < lines.length && k.y + 3.6 + CONT_LH < k.H - 22) {
      const yy = k.y + 3.6;
      k.line(k.x0 + 1.8, yy + 0.9, k.x1 - 1.8, yy + 0.9, { w: 0.15, color: [150, 150, 150], dash: [0.4, 0.6] });
      k.t(lines[i], k.x0 + 2.3, yy - 0.2, { size: 8.5, color: VALUE });
      k.y += CONT_LH; i++;
    }
    k.y += 2; k.rect(k.x0, y0, k.cw, k.y - y0, { lw: 0.35, color: INK });
  }
}

// ---------- EICR ----------
function eicr(k, cert, profile) {
  const no = cert.number; const R = cert.eicr; const S = cert.sigs || {}; const P = cert.people;
  brandStrip(k, profile, 'ELECTRICAL INSTALLATION CONDITION REPORT', no);
  k.section('SECTION A: DETAILS OF THE PERSON ORDERING THE REPORT', (k, x, w) => { row(k, x, w, [['Name', cert.client.name, 1]]); row(k, x, w, [['Address', cert.client.address, 1]]); });
  k.section('SECTION B: REASON FOR PRODUCING THIS REPORT', (k, x, w) => { textBlock(k, x, w, '', R.reason); row(k, x, w, [['Date(s) on which inspection and testing was carried out', R.datesDone, 1]]); });
  k.section('SECTION C: DETAILS OF THE INSTALLATION WHICH IS THE SUBJECT OF THIS REPORT', (k, x, w) => {
    row(k, x, w, [['Occupier', cert.install.occupier, 1]]); row(k, x, w, [['Address', [cert.install.address, cert.install.postcode].filter(Boolean).join(', '), 1]]);
    checks(k, x, [['Residential', R.premises === 'Residential'], ['Commercial', R.premises === 'Commercial'], ['Industrial', R.premises === 'Industrial'], ['Other (include brief description)', R.premises === 'Other']], { label: 'Description of premises' });
    if (R.premisesOther) row(k, x, w, [['', R.premisesOther, 1]]);
    row(k, x, w, [['Estimated age of wiring system', R.wiringAge, 0.4, { unit: 'years' }]]);
    const y = k.y; checks(k, x, [['Yes', R.alterations === 'Yes'], ['Not apparent', R.alterations === 'Not apparent']], { label: 'Evidence of additions / alterations?' }); k.y = y; row(k, x + w * 0.62, w * 0.38, [['If yes, estimate age', R.alterAge, 1, { unit: 'years' }]]);
    const y2 = k.y; checks(k, x, [['Yes', R.records === 'Yes'], ['No', R.records === 'No']], { label: 'Installation records available? (Regulation 651.1)' }); k.y = y2; row(k, x + w * 0.62, w * 0.38, [['Date of last inspection', R.lastInspection, 1]]);
  });
  k.section('SECTION D: EXTENT AND LIMITATIONS OF INSPECTION AND TESTING (see Regulation 651)', (k, x, w) => {
    textBlock(k, x, w, 'Details of those parts of the installation that have been inspected and tested', R.extent, { minLines: 2 });
    textBlock(k, x, w, 'Agreed limitations including the reasons', R.agreedLimits, { minLines: 1 });
    row(k, x, w, [['Agreed with:', R.agreedWith, 1]]);
    // v0.33: the two standard limitations as a bulleted list, as on the A4 form
    k.y += k.para('Unless specifically agreed between the client and inspector prior to the inspection:', x, k.y + 2.5, w, { size: 6.6 });
    for (const b of ['Cables concealed within trunking and conduits, under floors, in roof spaces, and generally within the fabric of the building or underground, have not been inspected.', 'No checks for safety alerts, corrective actions or product recalls for electrical equipment forming part of the installation have been made.']) { k.t('\u2022', x + 2, k.y + 2.5, { size: 6.6 }); k.y += k.para(b, x + 5, k.y + 2.5, w - 5, { size: 6.6 }); }
    k.y += k.para('An inspection should be made of other electrical equipment housed within an accessible roof space.', x, k.y + 2.5, w, { size: 6.6 });
    textBlock(k, x, w, 'Operational limitations including the reasons (see page no. ' + (R.opLimitsPage || '..........') + ')', R.operationalLimits);
    k.t('(Use continuation sheet(s) if necessary)', x, k.y + 2.2, { size: 6.5, color: GREY }); k.y += 3;
    k.y += k.para(`The inspection and testing detailed in this report and accompanying schedules have been carried out in accordance with BS 7671:2018 as amended to ${cert.amendedTo} (date)`, x, k.y + 2.5, w, { size: 7 });
  });
  const overall = R.overall || eicrOverall(cert);
  k.section('SECTION E: SUMMARY OF THE CONDITION OF THE INSTALLATION', (k, x, w) => {
    const y = k.y + 3.6;
    k.t('Overall assessment of the installation as detailed in Section D, in terms of suitability for continued service:', x, y, { size: 7.5, maxW: w * 0.68 });
    const okX = x + w * 0.7;
    k.rect(okX, y - 3.6, w * 0.3, 6, { lw: 0.4, color: overall === 'UNSATISFACTORY' ? RED : VALUE, fill: overall === 'UNSATISFACTORY' ? [252, 228, 228] : [228, 236, 250] });
    k.t(overall, okX + w * 0.15, y + 0.6, { size: 10, bold: true, color: overall === 'UNSATISFACTORY' ? RED : VALUE, align: 'center' });
    k.y += 7;
    k.y += k.para('*An unsatisfactory assessment indicates that dangerous (code C1) and/or potentially dangerous (code C2) conditions have been identified. Where the overall assessment is UNSATISFACTORY, any observations classified as \u2018Danger present\u2019 (code C1) or \u2018Potentially dangerous\u2019 (code C2) should be acted on as a matter of urgency.', x, k.y + 2, w, { size: 6.6 });
    textBlock(k, x, w, 'General condition of the installation (in terms of electrical safety)', withNotices(cert, R.general), { minLines: 2 });
    k.y += k.para('Any observation classified as \u2018Improvement recommended\u2019 (code C3), or \u2018Further investigation\u2019 (code FI), is advisory and does not affect the overall assessment but should be given due consideration.', x, k.y + 2, w, { size: 6.6 });
  });
  k.section('SECTION F: RECOMMENDATION FOR NEXT INSPECTION', (k, x, w) => {
    row(k, x, w, [['Subject to the necessary remedial action being taken, I/We recommend that the installation is further inspected and tested before', fmtDate(R.nextDate), 1, { unit: '(date)' }]]);
    textBlock(k, x, w, 'for the following reasons', R.nextReasons);
  });
  k.section('SECTION G: DECLARATION', (k, x, w) => {
    k.y += k.para('I/We, being the person(s) responsible for the inspection and testing of the electrical installation (as indicated by my/our signatures below), particulars of which are described above, having exercised reasonable skill and care when carrying out the inspection and testing, hereby declare that the information in this report, including the observations and the attached schedules, provides an accurate assessment of the condition of the electrical installation taking into account the stated extent and limitations in section D of this report.', x, k.y + 2.5, w, { size: 6.8, bold: true });
    const hw = w / 2 - 2; const y0 = k.y; const A = R.authoriser || {};
    const col = (cx, title, p, s) => {
      k.y = y0; k.t(title, cx, k.y + 3.4, { size: 7.5, bold: true }); k.y += 4;
      row(k, cx, hw, [['Name (Capitals)', (p.name || '').toUpperCase(), 1]]);
      k.y += 4; sig(k, cx, k.y + 3.4, hw, s); k.y += 4.6;
      row(k, cx, hw, [['For/on behalf of', p.for, 1]]); row(k, cx, hw, [['Position', p.position, 1]]); row(k, cx, hw, [['Address', p.address, 1]]); row(k, cx, hw, [['Date', fmtDate(s && s.date), 1]]);
    };
    col(x, 'Inspected and tested by:', P.inspector, S.inspector); const yA = k.y;
    col(x + w / 2 + 2, 'Report authorized for issue by:', A, S.authoriser || S.inspector); k.y = Math.max(yA, k.y);
  });
  k.addPage('p'); contTitle(k, 'ELECTRICAL INSTALLATION CONDITION REPORT (continued)', no);
  const nb = (cert.boards || []).length;
  k.section('SECTION H: SCHEDULES AND CONTINUATION SHEET(S) ATTACHED', (k, x, w) => {
    k.y += k.para(`${contSheets(cert)}  Continuation sheet(s)${contWhat(cert)}    1  Schedule(s) of Inspection    ${nb}  Schedule(s) of Circuit Details and Schedule(s) of Test Results.`, x, k.y + 3, w, { size: 7.5 }) + 1;
    k.y += k.para('The schedule(s) and continuation sheet(s) listed are part of this document and this report is valid only when they are attached to it.', x, k.y + 3, w, { size: 7 });
  });
  supplySection(k, cert, 'I');
  particularsSection(k, cert, 'J');
  observationsSection(k, cert);
  inspectionSchedule(k, cert, no);
  schedules(k, cert, no);
}
function observationsSection(k, cert) {
  const obs = cert.observations || [];
  const hi = obs.filter((o) => o.code === 'C1' || o.code === 'C2'); const lo = obs.filter((o) => !(o.code === 'C1' || o.code === 'C2'));
  k.section('SECTION K: OBSERVATIONS', (k, x, w) => {
    k.y += k.para('Referring to the attached Schedule(s) of Inspection and Schedule(s) of Circuit Details and Schedule(s) of Test Results, and subject to the limitations specified at the Extent and limitations of inspection and testing section', x, k.y + 2.5, w, { size: 6.8 });
    checks(k, x, [['No remedial action is required', !obs.length], ['The following observations are made (see below):', obs.length > 0]]);
    k.t('NOTE: Photographic and/or thermographic images can be attached to the report to support observations made in this Section.', x, k.y + 2, { size: 6.4, color: GREY }); k.y += 3.5;
  });
  // v0.5: long lists flow onto continuation pages (table heading repeated,
  // "SECTION K: OBSERVATIONS (continued)"), instead of running off the page.
  const table = (title, list, foot) => {
    const x = k.x0; const w = k.cw;
    const rows = list.length ? list : [{}, {}, {}];
    const txtOf = (o) => (o.text ? `${o.text}${o.location ? ' — ' + o.location : ''}${o.reg ? '  (Reg. ' + o.reg + ')' : ''}${noticeFor(cert, o) ? '  ' + noticeFor(cert, o) : ''}` : '');
    const rowH = (o) => Math.max(6, k.wrap(txtOf(o), w - 50, 8).length * 3.6 + 2.4);
    const footH = measure(k, () => { k.y += 1; foot.forEach((s) => { k.y += k.para(s, x, k.y + 2.5, w, { size: 6.8, gap: 0.3 }); }); k.y += 2; });
    const head = (cont) => {
      const y0 = k.y;
      k.rect(x, y0, w, 6, { lw: 0.35, color: INK, fill: [238, 238, 238] });
      k.t('Item No.', x + 2, y0 + 4, { size: 7, bold: true }); k.t(title + (cont ? ' (continued)' : ''), x + 20, y0 + 4, { size: 7, bold: true }); if (!cont) k.t('Include the relevant schedule reference(s), as appropriate', x + 20 + k.tw(title, 7, true) + 2, y0 + 4, { size: 6.2, color: GREY, maxW: w - 50 - k.tw(title, 7, true) }); k.t('Classification code', x + w - 2, y0 + 4, { size: 7, bold: true, align: 'right' });
      k.y = y0 + 6;
    };
    const bottom = k.H - k.M - 8;
    // keep the heading with at least the first row (and the notes if it all fits)
    const firstH = 6 + rowH(rows[0]) + (rows.length === 1 ? footH : 0);
    if (k.y + firstH > bottom) { k.addPage('p'); contTitle(k, 'SECTION K: OBSERVATIONS (continued)', cert.number); }
    head(false);
    rows.forEach((o, i) => {
      const ls = k.wrap(txtOf(o), w - 50, 8); const h = rowH(o);
      const last = i === rows.length - 1;
      if (k.y + h + (last ? Math.min(footH, 30) : 0) > bottom) { k.addPage('p'); contTitle(k, 'SECTION K: OBSERVATIONS (continued)', cert.number); head(true); }
      k.rect(x, k.y, w, h, { lw: 0.2 }); k.line(x + 18, k.y, x + 18, k.y + h); k.line(x + w - 28, k.y, x + w - 28, k.y + h);
      if (o.text) { k.t(o.item || String(obs.indexOf(o) + 1), x + 9, k.y + 4, { size: 8, color: VALUE, align: 'center', maxW: 16 }); ls.forEach((s, j) => k.t(s, x + 20, k.y + 4 + j * 3.6, { size: 8, color: VALUE })); k.t(o.code, x + w - 14, k.y + 4.2, { size: 9, bold: true, color: o.code === 'C1' || o.code === 'C2' ? RED : VALUE, align: 'center' }); }
      k.y += h;
    });
    if (k.y + footH > bottom) { k.addPage('p'); contTitle(k, 'SECTION K: OBSERVATIONS (continued)', cert.number); }
    k.y += 1; foot.forEach((s) => { k.y += k.para(s, x, k.y + 2.5, w, { size: 6.8, gap: 0.3 }); }); k.y += 2;
  };
  table('C1 and C2 OBSERVATION(S)', hi, ['One of the following codes, as appropriate, has been allocated to each of the observations made above to indicate to the person(s) responsible for the installation the degree of urgency for remedial action. These items affect the overall assessment of the report.', 'C1 – ' + CODE_TEXT.C1, 'C2 – ' + CODE_TEXT.C2]);
  table('C3 and FI OBSERVATION(S)', lo, ['One of the following codes, as appropriate, has been allocated to each of the observations made above to indicate to the person(s) responsible for the installation the advisory nature degree of urgency for remedial action. These items do not affect the overall assessment of the report.', 'C3 – ' + CODE_TEXT.C3, 'FI – ' + CODE_TEXT.FI]);
}
function inspectionSchedule(k, cert, no) {
  k.addPage('p');
  formTitle(k, 'CONDITION REPORT SCHEDULE OF INSPECTION', no, 'FOR RESIDENTIAL AND SIMILAR PREMISES WITH UP TO 100 A SUPPLY');
  k.y += k.para('NOTE: This form is suitable for many types of smaller installation, not exclusively residential. Outcomes: tick = Acceptable condition · C1 or C2 Unacceptable condition · C3 Improvement recommended · FI Further investigation · N/V Not verified · LIM Limitation · N/A Not applicable. C1, C2, C3 and FI coded items to be recorded in Section K of the Condition Report.', k.x0, k.y + 1, k.cw, { size: 6.6 });
  k.y += k.para('The persons responsible for the periodic inspection and testing of the installation should include the relevant items in relation to the electrical installation, the Schedule of Inspection can be reduced or expanded depending on the requirements for the installation.', k.x0, k.y + 1, k.cw, { size: 6.6 }); // v0.33

  const head = () => { const y = k.y; k.rect(k.x0, y, k.cw, 5.5, { lw: 0.35, color: INK, fill: [238, 238, 238] }); k.t('Item No.', k.x0 + 1.5, y + 3.8, { size: 7, bold: true }); k.t('Description', k.x0 + 16, y + 3.8, { size: 7, bold: true }); k.t('Outcome', k.x1 - 9, y + 3.8, { size: 7, bold: true, align: 'center' }); k.y += 5.5; };
  head();
  // v0.33: old single 1.1 outcome → the six sub-rows (on a copy; the saved cert isn't touched here)
  const tmp = { type: 'EICR', inspections: { ...(cert.inspections || {}) } }; migrateIntake(tmp); const ins = tmp.inspections;
  const R = cert.eicr || {};
  for (const [n0, t0, h0, o4] of EICR_ITEMS) {
    const sub = h0 === 'sub'; const h = h0 && !sub; const n = o4 && 'label' in o4 ? o4.label : n0;
    const t = n0 === '1.0' ? t0 + '\n' + INTAKE_NOTE_10 : t0;
    const ls = t.split('\n').flatMap((p, i) => k.wrap(p, k.cw - 40, h && i === 0 ? 7.4 : 7.2, !!(h && i === 0) || sub)); const rh = Math.max(5, ls.length * 3.1 + 1.8);
    if (k.y + rh > k.H - 16) { k.addPage('p'); contTitle(k, 'CONDITION REPORT SCHEDULE OF INSPECTION (continued)', no); head(); }
    k.rect(k.x0, k.y, k.cw, rh, { lw: 0.15, fill: h ? [247, 247, 247] : null });
    k.line(k.x0 + 14, k.y, k.x0 + 14, k.y + rh, { w: 0.15 }); k.line(k.x1 - 18, k.y, k.x1 - 18, k.y + rh, { w: 0.15 });
    k.t(n, k.x0 + 1.5, k.y + 3.6, { size: 7.2, bold: !!h });
    ls.forEach((s, i) => k.t(s, k.x0 + 16, k.y + 3.6 + i * 3.1, { size: h && i === 0 ? 7.4 : 7.2, bold: (!!h && (n0 !== '1.0' || i === 0)) || sub }));
    const v = h0 ? '' : ins[n0];
    if (v) { if (/^(C1|C2)$/.test(v)) k.t(v, k.x1 - 9, k.y + 3.7, { size: 8, bold: true, color: RED, align: 'center' }); else k.mark(v, k.x1 - 9, k.y + 3.7, { size: 7.5 }); }
    k.y += rh;
    if (n0 === '1.1f') { // v0.33: intake NOTE 1 / NOTE 2 and the "person ordering notified" Y / N/A tick
      const nl = INTAKE_NOTES.flatMap((p) => k.wrap(p, k.cw - 40, 6.4)); const ml = k.wrap(INTAKE_NOTIFIED, k.cw - 62, 7.2);
      const nh = nl.length * 2.7 + ml.length * 3.1 + 3.5;
      k.rect(k.x0, k.y, k.cw, nh, { lw: 0.15 }); k.line(k.x0 + 14, k.y, k.x0 + 14, k.y + nh, { w: 0.15 }); k.line(k.x1 - 18, k.y, k.x1 - 18, k.y + nh, { w: 0.15 });
      nl.forEach((s, i) => k.t(s, k.x0 + 16, k.y + 3 + i * 2.7, { size: 6.4 }));
      const my = k.y + 3.4 + nl.length * 2.7; ml.forEach((s, i) => k.t(s, k.x0 + 16, my + i * 3.1, { size: 7.2 }));
      const by = my + (ml.length - 1) * 3.1; let bx = k.x1 - 44; bx = k.cb(bx, by, R.intakeNotified === 'Y', 'Y', { size: 7 }); k.cb(bx + 2, by, R.intakeNotified === 'N/A', 'N/A', { size: 7 });
      k.y += nh;
    }
  }
  k.y += 3;
  const s = (cert.sigs || {}).inspector || {};
  k.field('Inspected and tested by: Name (Capitals)', ((cert.people.inspector || {}).name || '').toUpperCase(), k.x0, k.y + 4, 95);
  sig(k, k.x0 + 100, k.y + 4, 55, s); k.field('Date', fmtDate(s.date), k.x0 + 160, k.y + 4, 30); k.y += 7;
}

// ---------- Minor works ----------
// v0.26: Minor Works prints one line of instruments (each different one once).
export function mwInstruments(cert) { return [...new Set(Object.values((cert && cert.instruments) || {}).map((v) => String(v || '').trim()).filter(Boolean))].join('; '); }
function mw(k, cert, profile) {
  const no = cert.number; const M = cert.mw; const c = M.circuit; const S = cert.sigs || {}; const P = cert.people.inspector || {};
  brandStrip(k, profile, 'MINOR ELECTRICAL INSTALLATION WORKS CERTIFICATE', no, '(See the guidance for recipients included with this certificate)\nTo be used only for minor electrical work which does not include the provision of a new circuit');
  k.section('SECTION A: Description of the minor works', (k, x, w) => {
    row(k, x, w, [['1. Details of the Client', cert.client.name, 0.62], ['Date minor works completed', fmtDate(M.completed), 0.38]]);
    row(k, x, w, [['2. Installation location/address', [cert.install.address, cert.install.postcode].filter(Boolean).join(', '), 1]]);
    row(k, x, w, [['3. Description of the minor works', M.description, 1]]);
    k.y += k.para(`4. Details of any departures from BS 7671:2018 as amended to ${cert.amendedTo} (date) for the circuit altered or extended (Regulation 120.3, 133.1.2, 133.1.3 and 133.5).`, x, k.y + 3, w, { size: 7 });
    textBlock(k, x, w, '', M.departures);
    k.t('Details of permitted exceptions (Regulation 411.3.3). Where applicable, a suitable risk assessment(s) must be attached to this Certificate.', x, k.y + 3, { size: 7, bold: true }); k.y += 3.4;
    textBlock(k, x, w * 0.75, '', M.exceptions); k.cb(x + w * 0.78, k.y - 1.6, yes(M.risk), 'Risk assessment attached', { size: 7 });
    k.t('5. Comments on (including any defects observed in) the existing installation (Regulation 644.1.2):', x, k.y + 3, { size: 7.5, bold: true }); k.y += 3.4;
    textBlock(k, x, w, '', withNotices(cert, M.comments));
  });
  k.section('SECTION B: Presence and adequacy of installation earthing and bonding arrangements (Regulation 132.16)', (k, x, w) => {
    checks(k, x, ['TN-S', 'TN-C-S (PME)', 'TN-C-S (PNB)', 'TT', 'TN-C', 'IT'].map((e) => [e, M.earthing === e]), { label: '1. System earthing arrangement:' });
    row(k, x, w, [['2. Earth fault loop impedance at distribution board (Zdb) supplying the final circuit', M.zdb, 1, { unit: 'Ω' }]]);
    k.t('3. Presence of adequate main protective conductors:', x, k.y + 3.2, { size: 7.5 }); k.y += 3.6;
    checks(k, x + 3, [['Earthing conductor', yes(M.earthingCond)]]);
    checks(k, x + 3, [['Water', M.bondWater], ['Gas', M.bondGas], ['Oil', M.bondOil], ['Structural steel', M.bondSteel]], { label: 'Main protective bonding conductor(s) to:' });
    { const yo = k.y; row(k, x + 3, w - 9, [['Other (Specify)', M.bondOther || '', 1]]); k.cb(x + w - 4.5, yo + 3.4, Boolean(String(M.bondOther || '').trim()), '', { size: 7 }); } // v0.33: always shown
  });
  k.section('SECTION C: Circuit details', (k, x, w) => {
    row(k, x, w, [['DB Reference No.:', M.dbRef, 0.4], ['DB Location and type:', M.dbLocation, 0.6]]);
    row(k, x, w, [['Circuit No.:', c.num, 0.2], ['Circuit description:', c.desc, 0.5], ['Reference method*', c.ref, 0.3]]);
    row(k, x, w, [['csa of conductors: Live', c.live, 0.4, { unit: 'mm²' }], ['CPC', c.cpc, 0.3, { unit: 'mm²' }]]);
    row(k, x, w, [['Circuit overcurrent protective device: BS (EN)', c.bs, 0.42], ['Type', c.type, 0.15], ['Rating', c.rating, 0.15, { unit: 'A' }], ['Breaking capacity', c.bka, 0.28, { unit: 'kA' }]]);
    row(k, x, w, [['RCD:  BS (EN)', c.rcdBs, 0.25], ['Type', showRcdType(c.rcdType), 0.12], ['Rating', c.rcdRating, 0.14, { unit: 'A' }], ['Rated residual operating current (IΔn)', c.rcdIdn, 0.3, { unit: 'mA' }], ['Time delay', c.rcdDelay || '', 0.19, { unit: 'ms' }]]);
    row(k, x, w, [['AFDD:  BS (EN)', c.afddBs || '', 0.4], ['Rating', c.afddRating || '', 0.2, { unit: 'A' }]]);
    row(k, x, w, [['SPD:  BS (EN)', c.spdBs || '', 0.4], ['Type', c.spdType || '', 0.2]]);
    k.t('* See Table 4A2 of Appendix 4 of BS 7671:2018+A4:2026', x, k.y + 2.4, { size: 6.2 }); k.y += 3;
  });
  const lim = limitZs(c, { earthing: M.earthing });
  k.section('SECTION D: Test results for the altered or extended circuit (where relevant and practicable)', (k, x, w) => {
    const L = w * 0.38, R = w - L;
    const line2 = (label, items) => { k.t(label, x, k.y + 3.4, { size: 7.5 }); row(k, x + L, R, items); };
    line2('Protective conductor continuity:', [['(R1 + R2)', c.r1r2, 0.5, { unit: 'Ω or' }], ['R2', c.R2, 0.5, { unit: 'Ω' }]]);
    line2('Continuity of ring final circuit conductors:', [['r1 - r1', c.r1, 0.33, { unit: 'Ω' }], ['rn - rn', c.rn, 0.33, { unit: 'Ω' }], ['r2 - r2', c.r2, 0.34, { unit: 'Ω' }]]);
    line2('Insulation resistance:', [['Test voltage', c.irV, 0.3, { unit: 'V' }], ['Live - Live', c.irLL, 0.35, { unit: 'MΩ' }], ['Live - Earth', c.irLE, 0.35, { unit: 'MΩ' }]]);
    const y = k.y; checks(k, x, [['Polarity satisfactory:', /✓/.test(c.pol) ? true : /✗/.test(c.pol) ? 'x' : false]]); k.y = y;
    row(k, x + L, R, [['Maximum measured earth fault loop impedance: ZS', c.zs, 1, { unit: 'Ω' }]]);
    const y2 = k.y; row(k, x, L + R * 0.35, [['RCD disconnection time at rated residual operating current (IΔn)', c.rcdMs, 1, { unit: 'ms' }]]); k.y = y2; checks(k, x + L + R * 0.45, [['Satisfactory test button operation:', /✓/.test(c.rcdBtn) ? true : /✗/.test(c.rcdBtn) ? 'x' : false]]);
    const y3 = k.y; checks(k, x, [['AFDD satisfactory test button operation:', /✓/.test(c.afddBtn) ? true : false]]); k.y = y3; k.t('NOTE: Not all AFDDs have a test button', x + L, k.y + 3.4, { size: 7 }); k.y += 4.6;
    const y4 = k.y; checks(k, x, [['SPD functionality confirmed:', /✓/.test(M.spdOk) ? true : false]]); k.y = y4; k.t('NOTE: Not all SPDs have visible functionality indication', x + L, k.y + 3.4, { size: 7 }); k.y += 4.6;
    row(k, x, w, [['Test instruments used (serial and/or asset numbers):', mwInstruments(cert), 1]]); // v0.26
    if (lim.value != null) { k.t(`Maximum permitted Zs for this device: ${lim.value.toFixed(2)} Ω (${lim.source}).`, x, k.y + 2.6, { size: 6.4, color: GREY }); k.y += 3.2; }
  });
  k.section('SECTION E: Declaration', (k, x, w) => {
    k.y += k.para(`I certify that the work covered by this certificate does not impair the safety of the existing installation and the work has been designed, constructed, inspected and tested in accordance with BS 7671:2018 amended to ${cert.amendedTo} (date) and that to the best of my knowledge and belief, at the time of my inspection, complied with BS 7671 except as detailed in Section A.`, x, k.y + 3, w, { size: 7.5 });
    const y0 = k.y; const hw = w * 0.48;
    row(k, x, hw, [['Name:', (P.name || '').toUpperCase(), 1]]); row(k, x, hw, [['For/on behalf of:', P.for, 1]]); row(k, x, hw, [['Address:', P.address, 1]]); row(k, x, hw, [['', P.postcode ? 'Postcode ' + P.postcode : '', 1]]);
    const yL = k.y; k.y = y0 + 4;
    const s = S.mw || S.inspector || {};
    sig(k, x + w * 0.52, k.y + 4, w * 0.48, s); k.y += 6;
    row(k, x + w * 0.52, w * 0.48, [['Position:', P.position, 1]]); row(k, x + w * 0.52, w * 0.48, [['Date:', fmtDate(s.date), 1]]);
    k.y = Math.max(yL, k.y);
  });
}

// ---------- Board schedule printout (circuit chart) ----------
export async function boardChartPdf(cert, board, profile) {
  const { jsPDF } = await loadJsPDF();
  const k = new Kit(jsPDF, { orientation: 'p', footer: '' });
  const p = profile || {};
  k.t('CIRCUIT CHART', k.x0, k.y + 6, { size: 16, bold: true });
  k.t(`${board.ref || 'Consumer unit'}${board.location ? '  ·  ' + board.location : ''}`, k.x0, k.y + 12, { size: 10, color: GREY });
  k.t(p.business || p.name || '', k.x1, k.y + 6, { size: 10, bold: true, align: 'right' });
  k.t([p.phone, p.email].filter(Boolean).join('  ·  '), k.x1, k.y + 11, { size: 8, color: GREY, align: 'right' });
  k.y += 17;
  const cols = [{ k: 'num', label: 'Way', w: 10 }, { k: 'desc', label: 'Circuit', w: 62, left: true }, { k: 'dev', label: 'Device', w: 24 }, { k: 'rating', label: 'Rating (A)', w: 16 }, { k: 'rcd', label: 'RCD (mA)', w: 16 }, { k: 'cable', label: 'Cable (mm²)', w: 22 }, { k: 'pts', label: 'Points', w: 12 }];
  const rows = board.circuits.map((c) => isSpare(c) ? { num: c.num, desc: 'SPARE' } : { num: c.num, desc: c.desc, dev: [c.type === 'adj' ? '' : c.type, c.device === 'rcbo' ? 'RCBO' : c.device === 'mcb' ? 'MCB' : c.bs].filter(Boolean).join(' '), rating: c.rating, rcd: c.rcdIdn, cable: [c.live, c.cpc].filter(Boolean).join(' / '), pts: c.points });
  const x = k.x0; const W = cols.reduce((a, c) => a + c.w, 0); const sc = k.cw / W; let cx = x; const xs = cols.map((c) => { const v = cx; cx += c.w * sc; return v; });
  k.rect(x, k.y, k.cw, 8, { lw: 0.4, color: INK, fill: [235, 235, 235] });
  cols.forEach((c, i) => k.t(c.label, c.left ? xs[i] + 2 : xs[i] + (c.w * sc) / 2, k.y + 5.4, { size: 9, bold: true, align: c.left ? 'left' : 'center' }));
  k.y += 8;
  rows.forEach((r) => {
    k.rect(x, k.y, k.cw, 8.5, { lw: 0.2 });
    cols.forEach((c, i) => { if (i) k.line(xs[i], k.y, xs[i], k.y + 8.5, { w: 0.15 }); k.t(r[c.k] ?? '', c.left ? xs[i] + 2 : xs[i] + (c.w * sc) / 2, k.y + 5.8, { size: 10, bold: c.k === 'desc' || c.k === 'num', align: c.left ? 'left' : 'center', maxW: c.w * sc - 2 }); });
    k.y += 8.5;
  });
  k.y += 6;
  const lastSig = (cert.sigs && (cert.sigs.inspector || cert.sigs.designer || cert.sigs.mw)) || {};
  k.t(`Certificate ${cert.number}  ·  ${TYPES[cert.type].name}  ·  ${fmtDate(lastSig.date) || ''}`, k.x0, k.y, { size: 8.5 }); k.y += 8;
  k.rect(k.x0, k.y, k.cw, 22, { lw: 0.5, color: INK });
  k.t('IMPORTANT', k.x0 + 3, k.y + 5.5, { size: 10, bold: true });
  k.y += k.para('This installation should be periodically inspected and tested and a report on its condition obtained, as prescribed in the IET Wiring Regulations BS 7671. RCDs: press the button marked \u2018T\u2019 or \u2018Test\u2019 every six months. The device should switch off the supply and should then be switched on to restore the supply. If it does not switch off, seek expert advice.', k.x0 + 3, k.y + 10, k.cw - 6, { size: 8.5 });
  k.footers();
  return k.blob();
}

// ---------- entry point ----------
export async function certificatePdf(cert, { profile = {}, photos = [] } = {}) {
  const { jsPDF } = await loadJsPDF();
  cert = normaliseCert(structuredClone(cert || {})); profile = profile || {}; // v0.36: old/damaged jobs never crash the PDF
  const k = new Kit(jsPDF, { orientation: 'p', footer: FOOT + (profile.business ? '  Issued by ' + profile.business + '.' : '') });
  if (cert.type === 'EIC') { eic(k, cert, profile); guidancePage(k, 'EIC'); }
  else if (cert.type === 'EICR') { k.noLabel = 'Report No.'; eicr(k, cert, profile); guidancePage(k, 'EICR'); }
  else { mw(k, cert, profile); guidancePage(k, 'MW'); }
  photosPages(k, photos, cert.number);
  k.footers(cert.number);
  return k.blob();
}
export const pdfName = (cert, extra = '') => `${cert.number || cert.type}${extra} ${(cert.install.address || cert.client.name || '').split(/[,\n]/)[0].trim()}`.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') + '.pdf';
